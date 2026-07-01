#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ingest.py — Multi-stage corpus ingest pipeline for basictexts.org
==================================================================
Transforms a raw PDF or plain-text source into a clean JSON array of passage
objects consumed by the MiniSearch index builder (Node.js, no database).

Pipeline stages
---------------
  Stage 0  Dependency check
  Stage 1  PDF extraction             (skipped for .txt input)
  Stage 2  Unicode normalization      (ftfy, ligatures, smart quotes, dashes)
  Stage 3  Header/footer stripping    (heuristics + optional pattern file)
  Stage 4  Hyphen repair              (dictionary + custom-compound logic)
  Stage 5  Paragraph segmentation     (split, discard fragments, split long)
  Stage 6  Chapter assignment         (page-range lookup from chapter-map JSON)
  Stage 7  ID generation + schema     (produces final corpus JSON)
  Stage 8  Audit report               (flags passages for manual review)

Each stage writes a timestamped intermediate file to:
  ./pipeline-artifacts/<source-id>/<YYYYMMDD-HHMMSS>/

NOTE — Line-join sequencing
  The spec describes Stage 1 as collapsing single newlines within paragraphs
  to spaces.  However Stage 4 requires the raw `word-\\nword` pattern to still
  be present so it can detect and repair hyphenated line-breaks before they are
  destroyed by the join.

  This implementation therefore preserves single newlines through Stages 1–3
  and defers the single-newline collapse to the END of Stage 4, after all
  hyphen decisions have been logged.  The net result is identical to collapsing
  in Stage 1, but the audit trail is complete.

Run as:
  python ingest.py --source-id big-book-1ed \\
                   --input ./raw/big-book-1ed.pdf \\
                   --chapter-map ./raw/big-book-1ed-chapters.json \\
                   --output ./sources/big-book-1ed.json

For .txt input (PDF stage skipped):
  python ingest.py --source-id big-book-1ed \\
                   --input ./raw/big-book-1ed.txt \\
                   --chapter-map ./raw/big-book-1ed-chapters.json \\
                   --output ./sources/big-book-1ed.json
"""

# Requirements: pdfplumber ftfy pyenchant spacy
# python -m spacy download en_core_web_sm
#
# pip install pdfplumber ftfy pyenchant spacy
# python -m spacy download en_core_web_sm

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Module-level constants — intended extension points
# ---------------------------------------------------------------------------

# CUSTOM_COMPOUNDS: legitimate hyphenated compounds that must NOT be joined even
# when the joined form ("selfwill") appears in the dictionary.  All values are
# lowercase; matching is case-insensitive.  Add entries here before processing
# sources that use specialised terminology.
CUSTOM_COMPOUNDS: frozenset[str] = frozenset({
    "self-will",
    "self-pity",
    "self-seeking",
    "self-centered",
    "self-knowledge",
    "self-deception",
    "self-reliance",
    "well-being",
    "well-known",
    "god-given",
    "god-consciousness",
    "ever-present",
    "cross-addiction",
    "step-work",
    "half-measures",
    "whole-hearted",
    "clear-cut",
    "hard-headed",
    "open-minded",
    "all-powerful",
    "so-called",
})

# OpenType ligature → ASCII expansion.
# tri-grams MUST appear before bi-grams to prevent partial substitution
# (e.g. ﬃ must be replaced as "ffi" before ﬁ tries to match the fi part).
LIGATURES: tuple[tuple[str, str], ...] = (
    ("\ufb03", "ffi"),   # ﬃ  LATIN SMALL LIGATURE FFI
    ("\ufb04", "ffl"),   # ﬄ  LATIN SMALL LIGATURE FFL
    ("\ufb00", "ff"),    # ﬀ  LATIN SMALL LIGATURE FF
    ("\ufb01", "fi"),    # ﬁ  LATIN SMALL LIGATURE FI
    ("\ufb02", "fl"),    # ﬂ  LATIN SMALL LIGATURE FL
    ("\ufb05", "st"),    # ﬅ  LATIN SMALL LIGATURE LONG S T
    ("\ufb06", "st"),    # ﬆ  LATIN SMALL LIGATURE ST
    ("\u01f3", "dz"),    # ǳ  LATIN SMALL LETTER DZ
)

# Page marker written by Stage 1, consumed by Stages 5 and 6
PAGE_MARKER_FMT = "<<<PAGE {page}>>>"
PAGE_MARKER_RE  = re.compile(r"^<<<PAGE (\d+)>>>$")

# Vowel set used in Stage 4 abbreviation heuristic
_VOWELS: frozenset[str] = frozenset("aeiouAEIOU")

# Stage 4 decision code strings (appear verbatim in the log and audit report)
_DEC_CUSTOM     = "custom compound"
_DEC_DICT_JOIN  = "dict match"
_DEC_DICT_HYPH  = "dict hyphenated"
_DEC_NO_VOWEL   = "no vowel (abbrev)"
_DEC_DEFAULT    = "default join"

# Regex: alphabetic word ending in hyphen at end-of-line, continuation follows.
# Using [A-Za-z] rather than \w to exclude digits/underscores — genuine
# typographic hyphenation only breaks alphabetic words.
# [ \t]* after \n handles indented continuations from pdfplumber layout=True
# (e.g. "unfortu-\n          nates" — the continuation has leading spaces).
_HYPHEN_EOL_RE = re.compile(r"([A-Za-z]+)-\n[ \t]*([A-Za-z]+)")

# Regex for paragraph-boundary hyphenation: word-\n\n...continuation
# pdfplumber layout=True sometimes emits a double-newline (paragraph break)
# at a visual line boundary, splitting a word across what looks like two
# paragraphs.  The continuation MUST start lowercase (it's a word fragment,
# not a new sentence).  This is applied as a pre-pass in Stage 4 before the
# main single-newline pass.
_PARA_HYPHEN_RE = re.compile(r"([A-Za-z]+)-\n{2,}[ \t]*([a-z]+)")


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def _setup_logging(artifact_dir: Path) -> logging.Logger:
    """Attach a file handler to the 'ingest' logger after the artifact dir exists."""
    logger = logging.getLogger("ingest")
    logger.setLevel(logging.DEBUG)

    # Console handler — INFO and above only
    if not logger.handlers:
        ch = logging.StreamHandler(sys.stdout)
        ch.setLevel(logging.INFO)
        ch.setFormatter(logging.Formatter("%(levelname)-8s %(message)s"))
        logger.addHandler(ch)

    # File handler — DEBUG and above, with timestamps
    fh = logging.FileHandler(artifact_dir / "pipeline-run.log", encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(logging.Formatter("%(asctime)s  %(levelname)-8s  %(message)s"))
    logger.addHandler(fh)

    return logger


def _art(artifact_dir: Path, name: str) -> Path:
    """Return the path to a named artifact inside the run directory."""
    return artifact_dir / name


def _write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _banner(title: str) -> None:
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}")


# ---------------------------------------------------------------------------
# Stage 0 — Dependency check
# ---------------------------------------------------------------------------

def stage_0_dependency_check() -> dict[str, Any]:
    """
    Verify all required packages are importable and print their versions.
    Exits with code 1 if any package or model is missing.

    For pyenchant: also tests that Dict('en_US') can be loaded.  If the import
    succeeds but the dictionary fails (common on Linux without hunspell-en), a
    WARNING is printed but the pipeline continues — Stage 4 falls back
    automatically.  This matches the constraint that dictionary validation is
    optional-degradable, while the import itself is mandatory.

    Returns a dict of loaded module objects for use in downstream stages.
    """
    _banner("STAGE 0 — Dependency check")

    missing: list[str] = []
    modules: dict[str, Any] = {}

    # --- pdfplumber ---
    try:
        import pdfplumber  # type: ignore[import-untyped]
        print(f"  OK  pdfplumber  {pdfplumber.__version__}")
        modules["pdfplumber"] = pdfplumber
    except ImportError:
        print("  --  pdfplumber  (not installed)")
        missing.append("pdfplumber")

    # --- ftfy ---
    try:
        import ftfy  # type: ignore[import-untyped]
        print(f"  OK  ftfy        {ftfy.__version__}")
        modules["ftfy"] = ftfy
    except ImportError:
        print("  --  ftfy        (not installed)")
        missing.append("ftfy")

    # --- pyenchant (import as `enchant`) ---
    try:
        import enchant  # type: ignore[import-untyped]
        ver = getattr(enchant, "__version__", "unknown")
        # Also probe the en_US dictionary now so any warning appears early.
        # We don't exit here — graceful fallback is handled per-stage.
        try:
            _probe = enchant.Dict("en_US")
            print(f"  OK  pyenchant   {ver}  (en_US dictionary OK)")
        except Exception as dict_exc:
            print(f"  WW  pyenchant   {ver}  "
                  f"(en_US dictionary failed: {dict_exc})")
            print("      Dictionary validation will be disabled in Stage 4 and 8.")
        modules["enchant"] = enchant
    except ImportError:
        print("  --  pyenchant   (not installed)")
        missing.append("pyenchant")

    # --- spaCy + en_core_web_sm ---
    try:
        import spacy  # type: ignore[import-untyped]
        print(f"  OK  spacy       {spacy.__version__}")
        try:
            nlp = spacy.load("en_core_web_sm")
            print("  OK  en_core_web_sm  (loaded OK)")
            modules["spacy"] = spacy
            modules["nlp"]   = nlp
        except OSError:
            print("  --  en_core_web_sm  (model not installed)")
            missing.append("en_core_web_sm")
    except ImportError:
        print("  --  spacy       (not installed)")
        missing.append("spacy")

    if missing:
        pip_pkgs   = [m for m in missing if m != "en_core_web_sm"]
        need_model = "en_core_web_sm" in missing
        print("\nMissing dependencies — install with:")
        if pip_pkgs:
            print(f"  pip install {' '.join(pip_pkgs)}")
        if need_model:
            print("  python -m spacy download en_core_web_sm")
        sys.exit(1)

    print("\n  All dependencies satisfied.")
    return modules


# ---------------------------------------------------------------------------
# Stage 1 — PDF extraction / plain-text passthrough
# ---------------------------------------------------------------------------

def stage_1_extract_pdf(
    input_path: Path,
    artifact_dir: Path,
    pdfplumber: Any,
) -> Path:
    """
    Extract text from a PDF using pdfplumber with layout-aware reading order.

    For each page:
    - Calls extract_text(layout=True) which uses pdfplumber's spatial layout
      algorithm, preserving reading order better than the default.
    - Prefixes the page content with a <<<PAGE N>>> marker.
    - Preserves ALL newlines as-is.  Single-newline collapsing within
      paragraphs is intentionally deferred to Stage 4 so the hyphen repair
      step can see `word-\\nword` patterns before they are destroyed.

    Output format:
      <<<PAGE 58>>>
      Rarely have we seen a person fail who
      has thoroughly followed our path.

      Those who do not recover...
      <<<PAGE 59>>>
      ...
    """
    _banner("STAGE 1 — PDF extraction")

    out_path = _art(artifact_dir, "01-extracted.txt")
    page_segments: list[str] = []
    total_pages = 0
    total_chars = 0

    with pdfplumber.open(str(input_path)) as pdf:
        total_pages = len(pdf.pages)
        for page in pdf.pages:
            # layout=False (the default) gives clean single-newline-per-line text
            # in reading order without the extra whitespace padding that layout=True
            # inserts.  layout=True was tested and found to emit double-newlines at
            # EVERY visual line break (not just paragraph boundaries), which breaks
            # Stage 5's \n\n paragraph detection and produces hundreds of <20-word
            # fragments.  layout=False means each page becomes one text block with
            # single \n between lines; Stage 4 joins all hyphenated line breaks;
            # Stage 5 treats each page block as a passage unit.
            raw = page.extract_text(layout=False) or ""
            page_num = page.page_number  # 1-based in pdfplumber

            # Normalize CRLF from PDF extraction
            raw = raw.replace("\r\n", "\n").replace("\r", "\n")

            # Strip trailing whitespace from each line.
            lines = [ln.rstrip() for ln in raw.split("\n")]

            # IMPORTANT: the page marker is separated from the page content with
            # \n\n (not \n) so that Stage 4's paragraph-block splitter treats the
            # marker as a standalone block.  If we used a single \n here, the
            # marker would merge with the page content into one block and be
            # collapsed into the passage text by Stage 4.
            page_text = PAGE_MARKER_FMT.format(page=page_num) + "\n\n" + "\n".join(lines)
            page_segments.append(page_text)
            total_chars += len(page_text)

    full_text = "\n\n".join(page_segments)
    _write(out_path, full_text)

    print(f"  Pages extracted:   {total_pages:,}")
    print(f"  Total characters:  {total_chars:,}")
    print(f"  Output:            {out_path}")
    return out_path


def stage_1_load_txt(
    input_path: Path,
    artifact_dir: Path,
    logger: logging.Logger,
) -> Path:
    """
    Pass-through for pre-extracted .txt files.

    Normalizes line endings.  If no <<<PAGE N>>> markers are present, inserts
    <<<PAGE 1>>> at the top and logs a warning — all passages will receive
    pageRef='p.1', which is fine for sources without meaningful page numbers.
    """
    _banner("STAGE 1 — Load plain text (PDF stage skipped)")

    out_path = _art(artifact_dir, "01-extracted.txt")
    raw = input_path.read_text(encoding="utf-8")
    raw = raw.replace("\r\n", "\n").replace("\r", "\n")

    if not PAGE_MARKER_RE.search(raw):
        logger.warning(
            "No <<<PAGE N>>> markers found in .txt input. "
            "Inserting <<<PAGE 1>>> at top — all passages will get pageRef='p.1'."
        )
        raw = PAGE_MARKER_FMT.format(page=1) + "\n" + raw

    _write(out_path, raw)
    print(f"  Input characters:  {len(raw):,}")
    print(f"  Output:            {out_path}")
    return out_path


# ---------------------------------------------------------------------------
# Stage 2 — Unicode normalization
# ---------------------------------------------------------------------------

def stage_2_normalize(
    extracted_path: Path,
    artifact_dir: Path,
    ftfy: Any,
) -> Path:
    """
    Apply Unicode normalization in a fixed, deterministic order to ensure
    consistent treatment across different PDF sources:

    1. ftfy.fix_text()  — encoding errors, mojibake, stray control chars
    2. Ligature expansion (8 common OpenType ligatures; tri-grams first)
    3. Smart quote → ASCII normalization
    4. Em/en-dash normalization to ' — ' when between word characters
    5. Whitespace collapse within lines (tab runs, multiple spaces → one space)

    Page markers (<<<PAGE N>>>) and paragraph-boundary newlines are preserved.
    """
    _banner("STAGE 2 — Unicode normalization")

    out_path = _art(artifact_dir, "02-normalized.txt")
    text = _read(extracted_path)
    chars_before = len(text)

    # 1. ftfy — fixes mojibake (e.g. â€™ → '), stray control characters,
    #    and common UTF-8/Latin-1 confusion from PDF text extraction.
    text = ftfy.fix_text(text)

    # 2. Ligature expansion.
    #    We count each ligature type for the audit trail; the caller can
    #    cross-check against expected frequency for the source.
    lig_counts: dict[str, int] = {}
    for lig_char, replacement in LIGATURES:
        n = text.count(lig_char)
        if n > 0:
            lig_counts[lig_char] = n
            text = text.replace(lig_char, replacement)

    # 3. Smart quote normalization.
    #    Using explicit Unicode code points to prevent editors/git from
    #    re-encoding the source file of this script.
    smart_quotes: dict[str, str] = {
        "\u201c": '"',   # LEFT DOUBLE QUOTATION MARK  "
        "\u201d": '"',   # RIGHT DOUBLE QUOTATION MARK "
        "\u2018": "'",   # LEFT SINGLE QUOTATION MARK  '
        "\u2019": "'",   # RIGHT SINGLE QUOTATION MARK '  (also apostrophe)
        "\u201a": "'",   # SINGLE LOW-9 QUOTATION MARK  ‚
        "\u201e": '"',   # DOUBLE LOW-9 QUOTATION MARK  „
        "\u2032": "'",   # PRIME ′  (sometimes used as apostrophe in scans)
    }
    for src, dst in smart_quotes.items():
        text = text.replace(src, dst)

    # 4. Em/en-dash normalization.
    #    Only normalize dashes that are between word characters to avoid
    #    mangling bullets, list markers, or range-indicators like "pp. 1–5".
    #    We emit a space on each side to match the house style " — ".
    def _norm_dash(m: re.Match) -> str:
        return m.group(1) + " \u2014 " + m.group(2)

    text = re.sub(
        r"(\w)\s*[\u2013\u2014]\s*(\w)",  # en-dash or em-dash between word chars
        _norm_dash,
        text,
    )

    # 5. Collapse runs of spaces/tabs within each line.
    #    Split on newline (NOT strip) to preserve paragraph boundaries.
    lines = text.split("\n")
    text = "\n".join(re.sub(r"[ \t]+", " ", ln).rstrip() for ln in lines)

    chars_after = len(text)
    _write(out_path, text)

    # Reporting
    print(f"  Characters before: {chars_before:,}")
    print(f"  Characters after:  {chars_after:,}")
    print("  Ligatures replaced:")
    _lig_display: dict[str, str] = {
        "\ufb03": "ﬃ", "\ufb04": "ﬄ", "\ufb00": "ﬀ",
        "\ufb01": "ﬁ", "\ufb02": "ﬂ", "\ufb05": "ﬅ",
        "\ufb06": "ﬆ", "\u01f3": "ǳ",
    }
    _lig_repl = dict(LIGATURES)
    if lig_counts:
        for lig_char, n in sorted(lig_counts.items()):
            display = _lig_display.get(lig_char, repr(lig_char))
            repl    = _lig_repl.get(lig_char, "?")
            print(f"    {display} → {repl:<4}  {n} occurrence(s)")
    else:
        print("    (none found)")
    print(f"  Output:            {out_path}")
    return out_path


# ---------------------------------------------------------------------------
# Stage 3 — Header/footer stripping
# ---------------------------------------------------------------------------

def stage_3_strip(
    normalized_path: Path,
    artifact_dir: Path,
    logger: logging.Logger,
    strip_patterns_path: Path | None,
) -> Path:
    """
    Remove non-content lines: standalone page numbers, running headers/footers,
    and operator-supplied patterns.

    Detection strategy (priority order):
    1. Custom regex patterns from --strip-patterns JSON (highest priority)
    2. Lines consisting solely of digits (standalone page numbers from PDF layout)
    3. Lines shorter than 40 chars appearing ≥3 times within 2 lines of a
       <<<PAGE N>>> marker (running headers/footers by proximity heuristic)

    Auto-detection warning: lines appearing verbatim ≥5 times across the
    document are printed as WARNING so the operator can add them to
    --strip-patterns if needed.  They are NOT automatically removed because
    frequency alone can be a false signal (e.g. "We" appears many times as
    a genuine first word).

    Removed lines are replaced with blank lines to preserve paragraph structure.
    """
    _banner("STAGE 3 — Header/footer stripping")

    out_path = _art(artifact_dir, "03-stripped.txt")
    text  = _read(normalized_path)
    lines = text.split("\n")

    # Load explicit patterns from JSON if provided
    compiled_patterns: list[tuple[re.Pattern, str]] = []
    if strip_patterns_path is not None:
        raw_patterns: list[str] = json.loads(
            strip_patterns_path.read_text(encoding="utf-8")
        )
        for p in raw_patterns:
            compiled_patterns.append((re.compile(p), p))
        print(f"  Loaded {len(compiled_patterns)} custom strip pattern(s) from {strip_patterns_path}")

    # Auto-detect running headers/footers by proximity to page markers.
    # "Boundary region" = lines within 2 positions of a <<<PAGE N>>> line.
    page_boundary_freq: Counter[str] = Counter()
    for i, line in enumerate(lines):
        if PAGE_MARKER_RE.match(line.strip()):
            for offset in (-2, -1, 1, 2):
                j = i + offset
                if 0 <= j < len(lines):
                    candidate = lines[j].strip()
                    # Short lines only; skip blank lines and page markers themselves
                    if (candidate
                            and len(candidate) < 40
                            and not PAGE_MARKER_RE.match(candidate)):
                        page_boundary_freq[candidate] += 1

    # Lines appearing ≥3 times at page boundaries are auto-stripped
    auto_strip: set[str] = {
        ln for ln, cnt in page_boundary_freq.items() if cnt >= 3
    }
    if auto_strip:
        print(f"  Auto-detected {len(auto_strip)} running header/footer line(s):")
        for s in sorted(auto_strip):
            print(f"    [auto]  {s!r}")

    digit_only_re = re.compile(r"^\d+$")
    kept_lines:   list[str] = []
    removal_log:  list[str] = []

    for line in lines:
        s = line.strip()

        # Always preserve page markers (structural, not content)
        if PAGE_MARKER_RE.match(s):
            kept_lines.append(line)
            continue

        # Always preserve blank lines (paragraph separators)
        if not s:
            kept_lines.append(line)
            continue

        removed = False
        reason  = ""

        # Priority 1: explicit patterns
        for pat, label in compiled_patterns:
            if pat.search(s):
                removed = True
                reason  = f"pattern: {label!r}"
                break

        # Priority 2: digit-only (standalone page number)
        if not removed and digit_only_re.match(s):
            removed = True
            reason  = "digit-only"

        # Priority 3: auto-detected header/footer
        if not removed and s in auto_strip:
            removed = True
            reason  = "auto header/footer"

        if removed:
            removal_log.append(f"  [{reason}]  {s!r}")
            kept_lines.append("")   # blank line preserves paragraph structure
        else:
            kept_lines.append(line)

    # Warn about high-frequency lines that survived stripping
    all_content_freq: Counter[str] = Counter(
        l.strip() for l in lines
        if l.strip() and not PAGE_MARKER_RE.match(l.strip())
    )
    high_freq_survivors = [
        (cnt, ln)
        for ln, cnt in all_content_freq.most_common(30)
        if cnt >= 5 and ln not in auto_strip
    ]

    _write(out_path, "\n".join(kept_lines))

    print(f"  Lines removed:     {len(removal_log)}")
    for msg in removal_log[:20]:
        print(msg)
    if len(removal_log) > 20:
        print(f"  ... and {len(removal_log) - 20} more")

    if high_freq_survivors:
        print()
        print("  WARNING — High-frequency lines NOT removed (add to --strip-patterns if needed):")
        for cnt, ln in high_freq_survivors[:20]:
            print(f"    {cnt:4d}x  {ln!r}")

    print(f"  Output:            {out_path}")
    return out_path


# ---------------------------------------------------------------------------
# Stage 4 — Hyphen repair
# ---------------------------------------------------------------------------

def _has_vowel(word: str) -> bool:
    return any(c in _VOWELS for c in word)


def stage_4_repair_hyphens(
    stripped_path: Path,
    artifact_dir: Path,
    logger: logging.Logger,
    enchant_module: Any | None,
) -> Path:
    """
    Repair PDF typesetting hyphens that break a word across two lines.

    Two patterns are handled (both observed from pdfplumber layout=True):

    Type A — single-newline with optional indentation:
      "unfortu-\n          nates"  →  _HYPHEN_EOL_RE  →  "unfortunates"
      pdfplumber preserves the raw line break and indentation.

    Type B — double-newline (paragraph-boundary split):
      "be-\n\n          ing"  →  _PARA_HYPHEN_RE (pre-pass)  →  "being"
      pdfplumber layout=True sometimes creates a visual paragraph break at a
      line boundary, putting the word end in one block and the continuation
      in the next.  The continuation is identified by starting with a lowercase
      letter (word fragments never start uppercase).

    Decision logic (first match wins for both types):
      Rule 1: hyphenated form is in CUSTOM_COMPOUNDS  →  keep hyphenated
      Rule 2: joined form is in en_US dictionary       →  join (layout artifact)
      Rule 3: hyphenated form is in en_US dictionary   →  keep hyphenated
      Rule 4: either part has no vowels                →  keep hyphenated
      Rule 5: default                                  →  join

    Rule 5 is the highest-risk decision.  All Rule-5 joins are listed in the
    audit report for spot-checking.
    """
    _banner("STAGE 4 — Hyphen repair")

    out_path = _art(artifact_dir, "04-repaired.txt")
    log_path = _art(artifact_dir, "04-hyphen-decisions.log")
    text     = _read(stripped_path)

    # Attempt to load en_US dictionary.
    # If enchant_module is None the package wasn't installed (already warned).
    # If Dict("en_US") raises, the package is installed but lacks dictionaries.
    en_dict: Any     = None
    dict_enabled     = False
    if enchant_module is not None:
        try:
            en_dict      = enchant_module.Dict("en_US")
            dict_enabled = True
        except Exception as exc:
            logger.warning(
                f"pyenchant: en_US dictionary unavailable ({exc}).\n"
                "  Rules 2 and 3 are disabled — only CUSTOM_COMPOUNDS prevents joins.\n"
                "  All other hyphens default to joined form (Rule 5).\n"
                "  Review 04-hyphen-decisions.log carefully.\n"
                "  For better accuracy, install hunspell-en (or equivalent) and re-run."
            )

    counts: Counter[str] = Counter()
    log_entries: list[str] = []

    def _decide(left: str, right: str) -> tuple[str, str]:
        """
        Return (replacement_text, decision_code).
        Comparisons against the dictionary and CUSTOM_COMPOUNDS are lowercase.
        """
        joined     = left + right
        hyphenated = left + "-" + right
        jl = joined.lower()
        hl = hyphenated.lower()

        # Rule 1: explicitly listed compound (e.g. "self-will")
        if hl in CUSTOM_COMPOUNDS:
            return hyphenated, _DEC_CUSTOM

        if dict_enabled:
            # Rule 2: joined form is a valid English word — the hyphen is a
            # layout artifact (e.g. "dis-\ngusted" → "disgusted")
            if en_dict.check(jl):
                return joined, _DEC_DICT_JOIN

            # Rule 3: only the hyphenated form is in the dictionary — keep it
            # (e.g. "well-\nbeing" if "wellbeing" is not in en_US)
            if en_dict.check(hl):
                return hyphenated, _DEC_DICT_HYPH

        # Rule 4: no vowels in either part → likely an abbreviation/acronym
        # fragment that shouldn't be joined. Example: "pgm-\nstep" → left="pgm"
        # has no vowel, so keep hyphenated. Note: "A" IS a vowel, so "AA"-left
        # fragments would not be caught here — handle those via CUSTOM_COMPOUNDS.
        if not _has_vowel(left) or not _has_vowel(right):
            return hyphenated, _DEC_NO_VOWEL

        # Rule 5: default join — most PDF hyphens are layout artifacts.
        # This is the least certain rule; all Rule-5 joins appear in the audit.
        return joined, _DEC_DEFAULT

    def _replace(m: re.Match, cross_para: bool = False) -> str:
        counts["total"] += 1
        left, right      = m.group(1), m.group(2)
        replacement, dec = _decide(left, right)

        is_join = dec in (_DEC_DICT_JOIN, _DEC_DEFAULT)
        if is_join:
            counts["joined"] += 1
        else:
            counts["kept"] += 1
        if dec == _DEC_DEFAULT:
            counts["defaulted"] += 1

        # Log uses literal \n (two chars) so the log file is grep-friendly
        sep  = "\\n\\n" if cross_para else "\\n"
        verb = "JOINED    " if is_join else "KEPT      "
        log_entries.append(
            f'{verb} "{left}-{sep}{right}"'
            f'  →  "{replacement}"'
            f'  [{dec}]'
        )
        return replacement

    def _replace_para(m: re.Match) -> str:
        return _replace(m, cross_para=True)

    # --- Pre-pass: paragraph-boundary hyphens (Type B: word-\n\nword) ---
    # Must run BEFORE the main pass so that the double-newlines that bridge
    # the split are collapsed first; otherwise the main pass would miss them.
    repaired = _PARA_HYPHEN_RE.sub(_replace_para, text)

    # --- Main pass: single-newline hyphens (Type A: word-\n   word) ---
    repaired = _HYPHEN_EOL_RE.sub(_replace, repaired)

    # --- Second pass: deferred single-newline collapse ---
    # Split on 2+ consecutive newlines to preserve paragraph boundaries.
    # Within each block, any remaining bare \n is now safe to collapse to space.
    para_blocks = re.split(r"\n{2,}", repaired)
    collapsed: list[str] = []
    for block in para_blocks:
        b = block.strip()
        if not b:
            continue
        if PAGE_MARKER_RE.match(b):
            # Page markers are structurally significant; preserve as-is
            collapsed.append(b)
        else:
            # Collapse remaining single newlines within the paragraph
            one_line = re.sub(r"\n", " ", b)
            one_line = re.sub(r" {2,}", " ", one_line).strip()
            if one_line:
                collapsed.append(one_line)

    repaired = "\n\n".join(collapsed)
    _write(out_path, repaired)

    # Write decision log with header summary
    log_header = (
        "Hyphen Repair Decision Log\n"
        f"Input:       {stripped_path}\n"
        f"Dictionary:  {'en_US (enchant)' if dict_enabled else 'DISABLED (fallback mode)'}\n"
        f"Total:       {counts['total']}\n"
        f"Joined:      {counts['joined']}\n"
        f"Kept:        {counts['kept']}\n"
        f"Defaulted:   {counts['defaulted']}\n"
        + "=" * 72 + "\n"
    )
    log_path.write_text(log_header + "\n".join(log_entries) + "\n", encoding="utf-8")

    print(f"  Hyphens processed: {counts['total']}")
    print(f"  Joined:            {counts['joined']}")
    print(f"  Kept hyphenated:   {counts['kept']}")
    print(f"  Defaulted (join):  {counts['defaulted']}")
    print(f"  Dictionary:        {'en_US enabled' if dict_enabled else 'DISABLED — review decision log'}")
    print(f"  Decision log:      {log_path}")
    print(f"  Output:            {out_path}")
    return out_path


# ---------------------------------------------------------------------------
# Stage 5 — Paragraph segmentation
# ---------------------------------------------------------------------------

def _split_long_paragraph(text: str, nlp: Any, target_words: int = 150) -> list[str]:
    """
    Split a paragraph at the sentence boundary nearest to target_words.
    Recurses if any segment is still >300 words.

    Uses spaCy's sentence segmentation (doc.sents).  Falls back to a word-
    boundary split if the whole block parses as a single sentence (unusual
    but possible for long run-on text without terminal punctuation).
    """
    doc       = nlp(text)
    sentences = list(doc.sents)

    if len(sentences) <= 1:
        # Fallback: word-boundary split — not sentence-aware, but safe
        words = text.split()
        pivot = min(target_words, len(words) - 1)
        parts = [" ".join(words[:pivot]), " ".join(words[pivot:])]
        return [p.strip() for p in parts if p.strip()]

    # Walk sentences, tracking cumulative word count.
    # Choose the split point (after sentence i) that minimises |cumsum - target|.
    cumulative      = 0
    best_split_after = 1            # always include at least one sentence
    best_delta       = float("inf")
    for i, sent in enumerate(sentences):
        n         = len(sent.text.split())
        new_delta = abs(cumulative + n - target_words)
        if new_delta < best_delta:
            best_delta       = new_delta
            best_split_after = i + 1
        cumulative += n

    first  = " ".join(s.text for s in sentences[:best_split_after]).strip()
    second = " ".join(s.text for s in sentences[best_split_after:]).strip()

    result: list[str] = []
    for part in (first, second):
        if not part:
            continue
        if len(part.split()) > 300:
            result.extend(_split_long_paragraph(part, nlp, target_words))
        else:
            result.append(part)
    return result


def stage_5_segment(
    repaired_path: Path,
    artifact_dir: Path,
    logger: logging.Logger,
    nlp: Any,
) -> Path:
    """
    Split the clean text into passage paragraphs.

    Rules:
    - Paragraph boundary = 2+ consecutive newlines
    - pageRef is inherited from the most recent <<<PAGE N>>> marker
    - Paragraphs < 20 words are discarded (logged to 05-discarded-fragments.log)
    - Paragraphs > 300 words are split at the sentence boundary nearest to
      word 150, using spaCy (split events logged to 05-split-log.log)

    Output: JSONL, one object per line:
      {"seq": 1, "pageRef": "p.58", "text": "Rarely have we seen..."}
    """
    _banner("STAGE 5 — Paragraph segmentation")

    out_path    = _art(artifact_dir, "05-paragraphs.jsonl")
    discard_log = _art(artifact_dir, "05-discarded-fragments.log")
    split_log   = _art(artifact_dir, "05-split-log.log")

    text   = _read(repaired_path)
    blocks = re.split(r"\n{2,}", text)

    current_page  = 1
    paragraphs:   list[dict] = []
    discarded:    list[str]  = []
    split_notes:  list[str]  = []
    seq = 1

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        # Update running page number from page markers
        pm = PAGE_MARKER_RE.match(block)
        if pm:
            current_page = int(pm.group(1))
            continue

        page_ref   = f"p.{current_page}"
        word_count = len(block.split())

        if word_count < 20:
            # Discard short fragments (headers, labels, isolated sentences)
            discarded.append(f"[{page_ref}] ({word_count} words)  {block[:120]}")
            continue

        if word_count > 300:
            # Split long paragraphs at a sentence boundary near word 150
            sub_parts = _split_long_paragraph(block, nlp, target_words=150)
            split_notes.append(
                f"[{page_ref}] {word_count} words → {len(sub_parts)} segment(s)"
            )
            for sub in sub_parts:
                sw = len(sub.split())
                if sw < 20:
                    discarded.append(
                        f"[{page_ref}] (post-split fragment, {sw} words)  {sub[:120]}"
                    )
                    continue
                paragraphs.append({"seq": seq, "pageRef": page_ref, "text": sub})
                seq += 1
        else:
            paragraphs.append({"seq": seq, "pageRef": page_ref, "text": block})
            seq += 1

    # Write JSONL (one JSON object per line)
    out_path.write_text(
        "\n".join(json.dumps(p, ensure_ascii=False) for p in paragraphs) + "\n",
        encoding="utf-8",
    )
    discard_log.write_text(
        f"Discarded fragments — {len(discarded)} total\n" + "=" * 60 + "\n"
        + "\n".join(discarded) + "\n",
        encoding="utf-8",
    )
    split_log.write_text(
        f"Long paragraph splits — {len(split_notes)} total\n" + "=" * 60 + "\n"
        + "\n".join(split_notes) + "\n",
        encoding="utf-8",
    )

    print(f"  Paragraphs kept:   {len(paragraphs)}")
    print(f"  Discarded:         {len(discarded)}")
    print(f"  Long-para splits:  {len(split_notes)}")
    print(f"  Discard log:       {discard_log}")
    print(f"  Split log:         {split_log}")
    print(f"  Output:            {out_path}")
    return out_path


# ---------------------------------------------------------------------------
# Stage 6 — Chapter assignment
# ---------------------------------------------------------------------------

def stage_6_assign_chapters(
    paragraphs_path: Path,
    artifact_dir: Path,
    logger: logging.Logger,
    chapter_map_path: Path | None,
) -> Path:
    """
    Enrich each paragraph with chapterRef and title by looking up its pageRef
    in the chapter map JSON.

    Chapter map format:
      [
        {"chapterRef": "Chapter 5 — How It Works",
         "title": "How It Works",
         "startPage": 58,
         "endPage": 71},
        ...
      ]

    Paragraphs falling outside all chapter ranges receive:
      chapterRef = "Front Matter"
      title      = "Front Matter"

    If --chapter-map is absent, all paragraphs receive chapterRef = "Unknown"
    and a WARNING is printed.
    """
    _banner("STAGE 6 — Chapter assignment")

    out_path = _art(artifact_dir, "06-chaptered.jsonl")
    chapters: list[dict] = []

    if chapter_map_path is not None:
        raw = json.loads(chapter_map_path.read_text(encoding="utf-8"))
        required_keys = {"chapterRef", "title", "startPage", "endPage"}
        for i, ch in enumerate(raw):
            missing_keys = required_keys - ch.keys()
            if missing_keys:
                print(
                    f"ERROR: chapter map entry {i} is missing keys: {missing_keys}",
                    file=sys.stderr,
                )
                sys.exit(1)
        chapters = sorted(raw, key=lambda c: c["startPage"])
        print(f"  Loaded {len(chapters)} chapter(s) from {chapter_map_path}")
    else:
        logger.warning(
            "No --chapter-map provided.  All paragraphs will get chapterRef='Unknown'.\n"
            "  Re-run with --chapter-map for proper chapter metadata."
        )

    def _page_int(page_ref: str) -> int | None:
        m = re.match(r"p\.(\d+)$", page_ref)
        return int(m.group(1)) if m else None

    def _lookup(page_ref: str) -> tuple[str, str]:
        pg = _page_int(page_ref)
        if pg is None or not chapters:
            return "Unknown", "Unknown"
        for ch in chapters:
            if ch["startPage"] <= pg <= ch["endPage"]:
                return ch["chapterRef"], ch["title"]
        return "Front Matter", "Front Matter"

    paragraphs = [
        json.loads(line)
        for line in _read(paragraphs_path).splitlines()
        if line.strip()
    ]

    chapter_counts: Counter[str] = Counter()
    enriched: list[dict] = []
    for para in paragraphs:
        ch_ref, title  = _lookup(para["pageRef"])
        para["chapterRef"] = ch_ref
        para["title"]      = title
        chapter_counts[ch_ref] += 1
        enriched.append(para)

    out_path.write_text(
        "\n".join(json.dumps(p, ensure_ascii=False) for p in enriched) + "\n",
        encoding="utf-8",
    )

    print(f"  Paragraphs processed: {len(enriched)}")
    print("  Distribution by chapter:")
    for ch_ref, cnt in sorted(chapter_counts.items(), key=lambda x: -x[1]):
        print(f"    {cnt:4d}  {ch_ref}")
    print(f"  Output:               {out_path}")
    return out_path


# ---------------------------------------------------------------------------
# Stage 7 — ID generation and final schema
# ---------------------------------------------------------------------------

def _chapter_slug(chapter_ref: str, max_len: int = 30) -> str:
    """
    Convert a chapterRef string to a URL-safe slug, truncated to max_len chars.

    "Chapter 5 — How It Works"  →  "chapter-5-how-it-works"
    "Front Matter"              →  "front-matter"
    """
    s = chapter_ref.lower()
    s = re.sub(r"[\u2014\u2013\s]+", "-", s)    # em/en-dash + whitespace → hyphen
    s = re.sub(r"[^a-z0-9\-]",       "", s)     # keep only alnum and hyphen
    s = re.sub(r"-{2,}",             "-", s)     # collapse consecutive hyphens
    s = s.strip("-")
    return s[:max_len].rstrip("-")


def stage_7_generate_ids(
    chaptered_path: Path,
    artifact_dir: Path,
    logger: logging.Logger,
    source_id: str,
    output_path: Path,
) -> Path:
    """
    Generate unique passage IDs and build the final schema-conformant objects.

    ID format: {source_id}-{chapter_slug}-p{sequence:04d}
    Example:   big-book-1ed-chapter-5-how-it-works-p0058

    Validates before writing — exits with code 1 on any failure:
    - All IDs unique within this file
    - No empty text fields
    - No newlines within text fields
    - sequence values are gapless (1, 2, 3, …, N)

    Writes the artifact (07-final.json) and copies to --output.
    """
    _banner("STAGE 7 — ID generation and final schema")

    out_path = _art(artifact_dir, "07-final.json")
    paragraphs = [
        json.loads(line)
        for line in _read(chaptered_path).splitlines()
        if line.strip()
    ]

    passages: list[dict] = []
    for para in paragraphs:
        seq  = para["seq"]
        slug = _chapter_slug(para.get("chapterRef", "unknown"))
        pid  = f"{source_id}-{slug}-p{seq:04d}"
        passages.append({
            "id":         pid,
            "sourceId":   source_id,
            "title":      para.get("title", "Unknown"),
            "sequence":   seq,
            "date":       None,
            "pageRef":    para.get("pageRef", "p.?"),
            "chapterRef": para.get("chapterRef", "Unknown"),
            "text":       para.get("text", ""),
            "linkData":   None,
        })

    # --- Mandatory validation ---
    errors: list[str] = []

    id_counts = Counter(p["id"] for p in passages)
    for pid, cnt in id_counts.items():
        if cnt > 1:
            errors.append(f"Duplicate ID ({cnt}×): {pid!r}")

    for expected, p in enumerate(passages, start=1):
        if p["sequence"] != expected:
            errors.append(
                f"Sequence gap: expected {expected}, got {p['sequence']} "
                f"(id={p['id']!r})"
            )
            break   # cascading sequence errors — report only the first

    for p in passages:
        if not p["text"].strip():
            errors.append(f"Empty text: id={p['id']!r}")
        elif "\n" in p["text"]:
            errors.append(f"Newline inside text: id={p['id']!r}")

    if errors:
        print("\nVALIDATION FAILED — corpus file NOT written:", file=sys.stderr)
        for e in errors:
            print(f"  {e}", file=sys.stderr)
        sys.exit(1)

    json_text = json.dumps(passages, ensure_ascii=False, indent=2)
    out_path.write_text(json_text, encoding="utf-8")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json_text, encoding="utf-8")

    print(f"  Passages written:  {len(passages)}")
    print(f"  Artifact:          {out_path}")
    print(f"  Production output: {output_path}")
    return out_path


# ---------------------------------------------------------------------------
# Stage 8 — Audit report
# ---------------------------------------------------------------------------

def stage_8_audit(
    final_json_path: Path,
    artifact_dir: Path,
    logger: logging.Logger,
    source_id: str,
    input_path: Path,
    stage_summary: list[str],
    hyphen_log_path: Path,
    enchant_module: Any | None,
) -> Path:
    """
    Write a human-readable audit report summarising the pipeline run and
    flagging passages that warrant manual review.

    Flagging criteria:
    1. Words not in en_US dictionary AND not in CUSTOM_COMPOUNDS (≥3 per passage)
       — possible OCR errors or missed ligatures.
       Only applied when enchant's en_US dictionary is available.
    2. Passages with 20–29 words — borderline fragments that passed the cutoff.
    3. Passages where >5% of characters are non-alphabetic — possible
       header/footer bleed-through.

    Note on criterion 1: the ≥3 unknown-word threshold is intentional to reduce
    noise from proper nouns and AA-specific terminology (sponsor, amends, etc.)
    that are not in en_US.  If false-negatives are a concern, lower the threshold
    and re-run — this is purely a review hint, not a gating check.
    """
    _banner("STAGE 8 — Audit report")

    out_path = _art(artifact_dir, "08-audit-report.txt")
    passages: list[dict] = json.loads(_read(final_json_path))

    # --- Top-20 word frequency ---
    all_tokens: list[str] = []
    for p in passages:
        all_tokens.extend(re.findall(r"\b[a-zA-Z]+\b", p["text"].lower()))
    top_words = Counter(all_tokens).most_common(20)

    # --- Enchant dictionary for vocabulary check ---
    en_dict: Any = None
    if enchant_module is not None:
        try:
            en_dict = enchant_module.Dict("en_US")
        except Exception:
            pass   # already warned in Stage 4; silently omit the check here

    custom_lc = {c.lower() for c in CUSTOM_COMPOUNDS}

    # --- Passage flagging ---
    flagged: list[tuple[str, str]] = []

    for p in passages:
        text       = p["text"]
        tokens     = re.findall(r"\b[a-zA-Z]+\b", text)
        word_count = len(tokens)
        total_len  = len(text)

        # Criterion 1: unknown words (only when enchant is functional)
        if en_dict is not None:
            unknown = [
                t for t in tokens
                if len(t) > 3
                and not t.isupper()                          # skip ALL-CAPS abbreviations
                and t.lower() not in custom_lc
                and not en_dict.check(t.lower())
            ]
            if len(unknown) >= 3:
                flagged.append((p["id"], f"Possible OCR errors: {unknown[:5]}"))
                continue   # only one flag per passage

        # Criterion 2: borderline short passage
        if 20 <= word_count < 30:
            flagged.append((p["id"], f"Short passage ({word_count} words)"))
            continue

        # Criterion 3: high non-alpha character ratio
        if total_len > 0:
            non_alpha = len(re.findall(r"[^a-zA-Z\s]", text))
            ratio     = non_alpha / total_len
            if ratio > 0.05:
                flagged.append((
                    p["id"],
                    f"High non-alpha ratio {ratio:.1%} ({non_alpha}/{total_len} chars)",
                ))

    # --- Default-rule hyphen joins from Stage 4 ---
    default_joins: list[str] = []
    if hyphen_log_path.exists():
        for line in hyphen_log_path.read_text(encoding="utf-8").splitlines():
            if f"[{_DEC_DEFAULT}]" in line:
                default_joins.append(line.strip())

    # --- Assemble report ---
    run_ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    report: list[str] = [
        "=" * 70,
        "BASICTEXTS.ORG — CORPUS INGEST AUDIT REPORT",
        "=" * 70,
        f"Source ID:       {source_id}",
        f"Input file:      {input_path}",
        f"Run timestamp:   {run_ts}",
        f"Total passages:  {len(passages)}",
        "",
        "STAGE-BY-STAGE SUMMARY",
        "-" * 40,
        *stage_summary,
        "",
        "TOP 20 WORDS (vocabulary sanity check)",
        "-" * 40,
        *(f"  {cnt:6d}  {word}" for word, cnt in top_words),
        "",
        f"PASSAGES FLAGGED FOR REVIEW  ({len(flagged)} passage(s))",
        "-" * 40,
    ]

    if flagged:
        for pid, reason in flagged:
            report += [f"  {pid}", f"    Reason: {reason}"]
    else:
        report.append("  (none — all passages passed automated checks)")

    report += [
        "",
        f"DEFAULT-RULE HYPHEN JOINS  ({len(default_joins)} — spot-check these)",
        "-" * 40,
    ]
    if default_joins:
        report.extend(f"  {d}" for d in default_joins)
    else:
        report.append("  (none)")

    report += ["", "END OF REPORT", "=" * 70, ""]

    out_path.write_text("\n".join(report), encoding="utf-8")

    print(f"  Passages flagged:  {len(flagged)}")
    print(f"  Default joins:     {len(default_joins)}")
    print(f"  Report:            {out_path}")
    return out_path


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        prog="ingest.py",
        description="Multi-stage corpus ingest pipeline for basictexts.org",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
examples:
  # PDF source with chapter map
  python ingest.py --source-id big-book-1ed \\
                   --input ./raw/big-book-1ed.pdf \\
                   --chapter-map ./raw/big-book-1ed-chapters.json \\
                   --output ./sources/big-book-1ed.json

  # Pre-extracted text with custom strip patterns
  python ingest.py --source-id big-book-2ed \\
                   --input ./raw/big-book-2ed.txt \\
                   --chapter-map ./raw/big-book-2ed-chapters.json \\
                   --strip-patterns ./raw/big-book-2ed-strip.json \\
                   --output ./sources/big-book-2ed.json
        """,
    )
    parser.add_argument(
        "--source-id", required=True,
        help="Unique source identifier (e.g. big-book-1ed)",
    )
    parser.add_argument(
        "--input", required=True, type=Path,
        help="Path to a .pdf or .txt input file",
    )
    parser.add_argument(
        "--chapter-map", type=Path, default=None, dest="chapter_map",
        help="Path to chapter map JSON file",
    )
    parser.add_argument(
        "--output", required=True, type=Path,
        help="Path to write the final corpus JSON",
    )
    parser.add_argument(
        "--strip-patterns", type=Path, default=None, dest="strip_patterns",
        help="Path to JSON array of regex patterns for header/footer stripping",
    )
    parser.add_argument(
        "--artifacts-dir", type=Path, default=None, dest="artifacts_dir",
        help="Base directory for pipeline artifacts (default: ./pipeline-artifacts)",
    )
    args = parser.parse_args()

    # --- Input validation ---
    if not args.input.exists():
        print(f"ERROR: Input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    suffix = args.input.suffix.lower()
    if suffix not in (".pdf", ".txt"):
        print(
            f"ERROR: --input must be a .pdf or .txt file, got: {args.input.suffix!r}",
            file=sys.stderr,
        )
        sys.exit(1)

    if args.strip_patterns is not None and not args.strip_patterns.exists():
        print(f"ERROR: --strip-patterns file not found: {args.strip_patterns}", file=sys.stderr)
        sys.exit(1)

    if args.chapter_map is not None and not args.chapter_map.exists():
        print(f"ERROR: --chapter-map file not found: {args.chapter_map}", file=sys.stderr)
        sys.exit(1)

    # --- Create timestamped artifact directory ---
    # Each run is fully self-contained — re-runs never overwrite previous artifacts.
    ts           = datetime.now().strftime("%Y%m%d-%H%M%S")
    base_dir     = args.artifacts_dir or Path("pipeline-artifacts")
    artifact_dir = base_dir / args.source_id / ts
    artifact_dir.mkdir(parents=True, exist_ok=True)

    print()
    print("basictexts.org Corpus Ingest Pipeline")
    print(f"  Source ID:  {args.source_id}")
    print(f"  Input:      {args.input}")
    print(f"  Output:     {args.output}")
    print(f"  Artifacts:  {artifact_dir}")

    # Stage 0 — must pass before logger exists
    modules = stage_0_dependency_check()

    # Logger is created after artifact_dir exists
    logger = _setup_logging(artifact_dir)

    stage_summary: list[str] = []

    # Stage 1
    if suffix == ".pdf":
        s1 = stage_1_extract_pdf(args.input, artifact_dir, modules["pdfplumber"])
        stage_summary.append(f"  Stage 1 (PDF extract):     {s1.stat().st_size:>10,} bytes  {s1.name}")
    else:
        s1 = stage_1_load_txt(args.input, artifact_dir, logger)
        stage_summary.append(f"  Stage 1 (TXT passthrough): {s1.stat().st_size:>10,} bytes  {s1.name}")

    # Stage 2
    s2 = stage_2_normalize(s1, artifact_dir, modules["ftfy"])
    stage_summary.append(f"  Stage 2 (normalize):       {s2.stat().st_size:>10,} bytes  {s2.name}")

    # Stage 3
    s3 = stage_3_strip(s2, artifact_dir, logger, args.strip_patterns)
    stage_summary.append(f"  Stage 3 (strip):           {s3.stat().st_size:>10,} bytes  {s3.name}")

    # Stage 4
    s4 = stage_4_repair_hyphens(s3, artifact_dir, logger, modules.get("enchant"))
    stage_summary.append(f"  Stage 4 (hyphen repair):   {s4.stat().st_size:>10,} bytes  {s4.name}")

    # Stage 5
    s5 = stage_5_segment(s4, artifact_dir, logger, modules["nlp"])
    stage_summary.append(f"  Stage 5 (segment):         {s5.stat().st_size:>10,} bytes  {s5.name}")

    # Stage 6
    s6 = stage_6_assign_chapters(s5, artifact_dir, logger, args.chapter_map)
    stage_summary.append(f"  Stage 6 (chapters):        {s6.stat().st_size:>10,} bytes  {s6.name}")

    # Stage 7
    s7 = stage_7_generate_ids(s6, artifact_dir, logger, args.source_id, args.output)
    stage_summary.append(f"  Stage 7 (final schema):    {s7.stat().st_size:>10,} bytes  {s7.name}")

    # Stage 8
    hyphen_log = _art(artifact_dir, "04-hyphen-decisions.log")
    audit = stage_8_audit(
        s7, artifact_dir, logger,
        args.source_id, args.input,
        stage_summary, hyphen_log,
        modules.get("enchant"),
    )

    print(f"\n{'=' * 60}")
    print("  PIPELINE COMPLETE")
    print(f"{'=' * 60}")
    print(f"  Production corpus: {args.output}")
    print(f"  Audit report:      {audit}")
    print(f"  All artifacts:     {artifact_dir}")
    print()


if __name__ == "__main__":
    main()
