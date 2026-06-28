#!/usr/bin/env python3
"""
process_pdfs.py — Extract, clean, structure, and validate PDF corpus files
for basictexts.org.

Steps performed for each PDF:
  1. Extract text per page  (pymupdf preferred; pdfminer.six as fallback)
  2. Detect repeated header/footer lines across pages and strip them
  3. Apply text cleaning: ligatures, hyphenated line-breaks, whitespace
  4. Detect chapter headings; track current chapter for passage metadata
  5. Split into passages  (paragraph = 1 passage; min 20 words; split ≈200 words)
  6. Validate: unique IDs, non-empty text, monotone sequence, no HTML tags
  7. Write passage array  →  corpus/sources/<source-id>.json
  8. Upsert registry entry  →  corpus/sources.json

Requirements — install exactly one:
    pip install pymupdf        ← preferred (faster, more accurate)
    pip install pdfminer.six   ← pure-Python fallback

Usage:
    py -3 corpus/scripts/process_pdfs.py
    py -3 corpus/scripts/process_pdfs.py --file corpus/raw/BigBookSecondEdition.pdf
    py -3 corpus/scripts/process_pdfs.py --source-id big-book-2ed --file corpus/raw/BigBookSecondEdition.pdf
    py -3 corpus/scripts/process_pdfs.py --dry-run
    py -3 corpus/scripts/process_pdfs.py --check-deps
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MIN_PASSAGE_WORDS = 20
MAX_PASSAGE_WORDS = 200

# A line must appear on at least this many pages to be treated as a header/footer
HEADER_FOOTER_THRESHOLD = 3

# How many lines to check at the top / bottom of each page for header/footer detection
HEADER_FOOTER_LINE_CHECK = 4

LIGATURE_MAP: Dict[str, str] = {
    "\ufb01": "fi",   # ﬁ
    "\ufb02": "fl",   # ﬂ
    "\ufb00": "ff",   # ﬀ
    "\ufb03": "ffi",  # ﬃ
    "\ufb04": "ffl",  # ﬄ
    "\u2018": "'",    # left single quotation mark
    "\u2019": "'",    # right single quotation mark
    "\u201c": '"',    # left double quotation mark
    "\u201d": '"',    # right double quotation mark
    "\u2013": "-",    # en dash
    "\u2014": "--",   # em dash
    "\u00ad": "",     # soft hyphen (discard)
    "\u00a0": " ",    # non-breaking space
}

# Chapter heading patterns (AA-specific and generic)
_CHAPTER_PATTERNS: List[re.Pattern] = [
    re.compile(
        r"^(STEP|TRADITION)\s+"
        r"(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE)\b",
        re.IGNORECASE,
    ),
    re.compile(r"^(STEP|TRADITION)\s+\d+\b", re.IGNORECASE),
    re.compile(r"^CHAPTER\s+\w+", re.IGNORECASE),
    re.compile(r"^(FOREWORD|PREFACE|INTRODUCTION|EPILOGUE|APPENDIX)\b", re.IGNORECASE),
    re.compile(r"^(DOCTOR.S OPINION|DOCTOR.S NIGHTMARE)\b", re.IGNORECASE),
    re.compile(
        r"^(BILL.S STORY|THERE IS A SOLUTION|MORE ABOUT ALCOHOLISM|HOW IT WORKS)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"^(INTO ACTION|WORKING WITH OTHERS|TO WIVES|THE FAMILY AFTERWARD"
        r"|TO EMPLOYERS|A VISION FOR YOU|SPIRITUAL EXPERIENCE|COMING TO BELIEVE)\b",
        re.IGNORECASE,
    ),
]

# ---------------------------------------------------------------------------
# Known PDF → source configuration
#
# Keys are the slugified stem of the raw filename (lowercase, hyphens).
# Each entry provides the canonical source_id and the full registry object
# that will be written to corpus/sources.json.
# ---------------------------------------------------------------------------

KNOWN_FILES: Dict[str, Dict[str, Any]] = {
    "bigbooksecondedition": {
        "source_id": "big-book-2ed",
        "registry": {
            "id": "big-book-2ed",
            "title": "Alcoholics Anonymous (2nd Edition)",
            "shortTitle": "Big Book",
            "description": (
                "The 1955 second edition of Alcoholics Anonymous. "
                "Public domain in the United States."
            ),
            "copyright": "public-domain",
            "displayMode": "full-text",
            "contextWords": 15,
            "linkTemplate": None,
            "officialUrl": "https://www.aa.org/alcoholics-anonymous",
            "freeUrl": "https://anonpress.org/bb/",
            "color": "#2c4a6e",
            "sortOrder": 1,
            "enabled": True,
        },
    },
    "aa-12-steps-12-traditions": {
        "source_id": "twelve-steps-traditions",
        "registry": {
            "id": "twelve-steps-traditions",
            "title": "Twelve Steps and Twelve Traditions",
            "shortTitle": "12&12",
            "description": (
                "Bill W.'s 1953 essays expanding on the Twelve Steps and Twelve Traditions. "
                "Copyright confirmed for public use."
            ),
            "copyright": "public-domain",
            "displayMode": "full-text",
            "contextWords": 12,
            "linkTemplate": None,
            "officialUrl": "https://www.aa.org/twelve-steps-twelve-traditions",
            "freeUrl": "https://www.portlandeyeopener.com/AA-12-Steps-12-Traditions.pdf",
            "color": "#c8902a",
            "sortOrder": 4,
            "enabled": True,
        },
    },
}

# ---------------------------------------------------------------------------
# Repository layout
# ---------------------------------------------------------------------------


def find_repo_root() -> Path:
    """Return the repository root (three levels above this script)."""
    return Path(__file__).resolve().parent.parent.parent


# ---------------------------------------------------------------------------
# Dependency check
# ---------------------------------------------------------------------------


def check_deps() -> int:
    found = False
    print("Checking PDF extraction dependencies:")
    try:
        import fitz  # type: ignore
        print(f"  OK  pymupdf {fitz.version[0]}  (preferred)")
        found = True
    except ImportError:
        print("  --  pymupdf not installed     (pip install pymupdf)")
    try:
        import pdfminer  # type: ignore
        ver = getattr(pdfminer, "__version__", "?")
        print(f"  OK  pdfminer.six {ver}  (fallback)")
        found = True
    except ImportError:
        print("  --  pdfminer.six not installed  (pip install pdfminer.six)")
    if not found:
        print("\nInstall at least one extractor before running.")
        return 1
    return 0


# ---------------------------------------------------------------------------
# PDF text extraction
# ---------------------------------------------------------------------------


def _extract_pymupdf(pdf_path: Path) -> Optional[List[Tuple[int, str]]]:
    try:
        import fitz  # type: ignore
    except ImportError:
        return None
    try:
        doc = fitz.open(str(pdf_path))
        pages = [(i + 1, page.get_text("text")) for i, page in enumerate(doc)]
        doc.close()
        return pages
    except Exception as exc:
        print(f"  [warn] pymupdf: {exc}", file=sys.stderr)
        return None


def _extract_pdfminer(pdf_path: Path) -> Optional[List[Tuple[int, str]]]:
    try:
        from pdfminer.high_level import extract_pages as pm_extract  # type: ignore
        from pdfminer.layout import LTTextContainer  # type: ignore
    except ImportError:
        return None
    try:
        pages = []
        for page_num, layout in enumerate(pm_extract(str(pdf_path)), start=1):
            parts = [el.get_text() for el in layout if isinstance(el, LTTextContainer)]
            pages.append((page_num, "".join(parts)))
        return pages
    except Exception as exc:
        print(f"  [warn] pdfminer: {exc}", file=sys.stderr)
        return None


def extract_pages(pdf_path: Path) -> Optional[List[Tuple[int, str]]]:
    """Try pymupdf first, fall back to pdfminer.six."""
    pages = _extract_pymupdf(pdf_path)
    if pages is not None:
        return pages
    return _extract_pdfminer(pdf_path)


# ---------------------------------------------------------------------------
# Text cleaning helpers
# ---------------------------------------------------------------------------


def _apply_ligature_fixes(text: str) -> str:
    for src, dst in LIGATURE_MAP.items():
        text = text.replace(src, dst)
    return text


def _join_hyphenated_breaks(text: str) -> str:
    """'recov-\\nery' → 'recovery'."""
    return re.sub(r"(\w)-\n(\w)", r"\1\2", text)


def _normalize_blank_lines(text: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", text)


def detect_repeated_lines(
    pages: List[Tuple[int, str]],
    threshold: int = HEADER_FOOTER_THRESHOLD,
) -> Set[str]:
    """Return lines that appear on ≥ threshold pages in header or footer position."""
    line_pages: Dict[str, Set[int]] = defaultdict(set)
    for page_num, text in pages:
        lines = [ln.strip() for ln in text.split("\n")]
        non_blank = [ln for ln in lines if ln]
        candidates = non_blank[:HEADER_FOOTER_LINE_CHECK] + non_blank[-HEADER_FOOTER_LINE_CHECK:]
        for ln in candidates:
            if len(ln) >= 4:
                line_pages[ln].add(page_num)
    return {ln for ln, pg_set in line_pages.items() if len(pg_set) >= threshold}


def clean_page_text(raw: str, repeated_lines: Set[str]) -> str:
    text = _apply_ligature_fixes(raw)
    text = _join_hyphenated_breaks(text)
    # Strip repeated header/footer lines
    kept = [ln for ln in text.split("\n") if ln.strip() not in repeated_lines]
    text = "\n".join(kept)
    text = _normalize_blank_lines(text)
    return text.strip()


# ---------------------------------------------------------------------------
# Chapter heading detection
# ---------------------------------------------------------------------------


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def is_chapter_heading(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return False
    words = stripped.split()
    if not (1 <= len(words) <= 10):
        return False
    for pattern in _CHAPTER_PATTERNS:
        if pattern.match(stripped):
            return True
    # All-caps heuristic: short line, not a page number or all-digit
    if (
        stripped == stripped.upper()
        and len(stripped) >= 3
        and not stripped.isdigit()
        and not re.fullmatch(r"[IVXLCDM]+", stripped)  # skip Roman numerals alone
    ):
        return True
    return False


# ---------------------------------------------------------------------------
# Passage structuring
# ---------------------------------------------------------------------------


def split_long_paragraph(text: str) -> List[str]:
    """Split a paragraph over MAX_PASSAGE_WORDS at the nearest sentence boundary."""
    if len(text.split()) <= MAX_PASSAGE_WORDS:
        return [text]
    sentences = re.split(r"(?<=[.!?])\s+", text)
    if len(sentences) <= 1:
        return [text]
    chunks: List[str] = []
    current: List[str] = []
    current_words = 0
    for sentence in sentences:
        sw = len(sentence.split())
        if current_words + sw > MAX_PASSAGE_WORDS and current:
            chunks.append(" ".join(current))
            current = [sentence]
            current_words = sw
        else:
            current.append(sentence)
            current_words += sw
    if current:
        chunks.append(" ".join(current))
    return chunks


def structure_passages(
    pages: List[Tuple[int, str]],
    source_id: str,
    repeated_lines: Set[str],
) -> List[Dict[str, Any]]:
    """
    Convert per-page extracted text into a flat list of passage dicts
    conforming to the corpus passage schema.

    Paragraphs are delimited by blank lines.  Each paragraph becomes one
    passage (or multiple if it exceeds MAX_PASSAGE_WORDS).  Lines that look
    like chapter headings are consumed as metadata rather than passages.
    """

    # Build flat list of (page_num, line) pairs across all pages
    annotated: List[Tuple[int, str]] = []
    for page_num, raw in pages:
        cleaned = clean_page_text(raw, repeated_lines)
        for line in cleaned.split("\n"):
            annotated.append((page_num, line))

    # Group consecutive non-blank lines into paragraph blocks
    para_blocks: List[Tuple[int, str]] = []  # (first_page_num, joined_text)
    current_lines: List[str] = []
    current_page: Optional[int] = None

    for page_num, line in annotated:
        stripped = line.strip()
        if not stripped:
            if current_lines:
                para_blocks.append((current_page or 1, " ".join(current_lines)))
                current_lines = []
                current_page = None
        else:
            if current_page is None:
                current_page = page_num
            current_lines.append(stripped)

    if current_lines:
        para_blocks.append((current_page or 1, " ".join(current_lines)))

    # Convert paragraph blocks to passage objects
    passages: List[Dict[str, Any]] = []
    sequence = 1
    current_chapter = "Front Matter"
    current_chapter_slug = "front-matter"
    chapter_counters: Dict[str, int] = {}

    for page_num, para_text in para_blocks:
        if not para_text.strip():
            continue

        if is_chapter_heading(para_text):
            current_chapter = para_text.strip()
            current_chapter_slug = slugify(current_chapter)
            continue

        for sub_para in split_long_paragraph(para_text):
            if len(sub_para.split()) < MIN_PASSAGE_WORDS:
                continue

            chapter_counters[current_chapter_slug] = (
                chapter_counters.get(current_chapter_slug, 0) + 1
            )
            within = chapter_counters[current_chapter_slug]
            passage_id = f"{source_id}-{current_chapter_slug}-p{within:03d}"

            passages.append(
                {
                    "id": passage_id,
                    "sourceId": source_id,
                    "title": current_chapter,
                    "sequence": sequence,
                    "date": None,
                    "pageRef": f"p.{page_num}",
                    "chapterRef": current_chapter,
                    "text": sub_para,
                    "linkData": None,
                }
            )
            sequence += 1

    return passages


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

_HTML_TAG_RE = re.compile(r"<[a-z][a-z0-9]*[\s>/]", re.IGNORECASE)


def validate_passages(
    passages: List[Dict[str, Any]],
    source_id: str,
    cross_file_ids: Optional[Set[str]] = None,
) -> List[str]:
    """
    Run all validation checks defined in CORPUS-GUIDE.md §Step 5.
    Returns a list of error strings; empty list means PASSED.
    """
    errors: List[str] = []
    seen_ids: Set[str] = set()
    prev_seq = 0

    for i, passage in enumerate(passages):
        pid = passage.get("id") or ""
        label = f"[{i}] id={pid!r}"

        # Unique ID within file
        if not pid:
            errors.append(f"{label}: missing id")
        elif pid in seen_ids:
            errors.append(f"{label}: duplicate id within file")
        else:
            seen_ids.add(pid)

        # Cross-file ID uniqueness
        if pid and cross_file_ids is not None:
            if pid in cross_file_ids:
                errors.append(f"{label}: id collides with another corpus file")
            else:
                cross_file_ids.add(pid)

        # sourceId matches
        if passage.get("sourceId") != source_id:
            errors.append(
                f"{label}: sourceId mismatch "
                f"(expected '{source_id}', got '{passage.get('sourceId')}')"
            )

        # Non-empty, HTML-free text
        text = passage.get("text") or ""
        if not text.strip():
            errors.append(f"{label}: text is empty")
        elif _HTML_TAG_RE.search(text):
            errors.append(f"{label}: text contains HTML tags")

        # Monotonically increasing sequence
        seq = passage.get("sequence", 0)
        if seq != prev_seq + 1:
            errors.append(
                f"{label}: sequence {seq} not monotonically increasing "
                f"(previous={prev_seq})"
            )
        prev_seq = seq

    return errors


# ---------------------------------------------------------------------------
# Registry helpers
# ---------------------------------------------------------------------------


def _load_registry(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and isinstance(data.get("sources"), list):
        return data["sources"]
    raise ValueError(f"Unrecognized registry format in {path}")


def _save_registry(path: Path, entries: List[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(entries, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def upsert_registry(registry_path: Path, new_entry: Dict[str, Any]) -> str:
    """Add or replace a registry entry by id.  Returns 'added' or 'updated'."""
    entries = _load_registry(registry_path)
    for i, entry in enumerate(entries):
        if entry.get("id") == new_entry["id"]:
            entries[i] = new_entry
            _save_registry(registry_path, entries)
            return "updated"
    entries.append(new_entry)
    _save_registry(registry_path, entries)
    return "added"


# ---------------------------------------------------------------------------
# Per-PDF processing
# ---------------------------------------------------------------------------


def process_pdf(
    pdf_path: Path,
    source_id: str,
    registry_entry: Dict[str, Any],
    output_dir: Path,
    registry_path: Path,
    dry_run: bool,
    cross_file_ids: Set[str],
) -> bool:
    print(f"\nProcessing : {pdf_path.name}")
    print(f"  source-id  : {source_id}")
    print(f"  displayMode: {registry_entry.get('displayMode')}")

    # 1. Extract
    pages = extract_pages(pdf_path)
    if pages is None:
        print(
            "  [error] No PDF extraction library available.\n"
            "          Install one: pip install pymupdf  OR  pip install pdfminer.six"
        )
        return False
    extractor = "pymupdf" if _extract_pymupdf(pdf_path) is not None else "pdfminer.six"
    print(f"  extractor  : {extractor}  ({len(pages)} pages)")

    # 2. Detect repeated headers/footers
    repeated = detect_repeated_lines(pages)
    if repeated:
        print(f"  stripping  : {len(repeated)} repeated header/footer line(s)")

    # 3–4. Clean + structure
    passages = structure_passages(pages, source_id, repeated)
    print(f"  passages   : {len(passages)}")

    if not passages:
        print(
            "  [error] No passages produced.\n"
            "          The PDF may be image-based (scanned). Run OCR first."
        )
        return False

    # Word-count summary
    word_counts = [len(p["text"].split()) for p in passages]
    avg_words = sum(word_counts) / len(word_counts)
    print(f"  words/pass : avg={avg_words:.0f}  min={min(word_counts)}  max={max(word_counts)}")

    # Unique chapters detected
    chapters = list(dict.fromkeys(p["chapterRef"] for p in passages))
    print(f"  chapters   : {len(chapters)}")
    for ch in chapters:
        count = sum(1 for p in passages if p["chapterRef"] == ch)
        print(f"    {count:4d}  {ch}")

    # 5. Validate
    errors = validate_passages(passages, source_id, cross_file_ids)
    if errors:
        print(f"  validation : {len(errors)} issue(s)")
        for err in errors[:10]:
            print(f"    - {err}")
        if len(errors) > 10:
            print(f"    ... ({len(errors) - 10} more — fix before ingesting)")
    else:
        print("  validation : PASSED")

    if dry_run:
        print("  [dry-run]  : skipping file writes")
        return True

    # 6. Write passage JSON
    output_dir.mkdir(parents=True, exist_ok=True)
    out_file = output_dir / f"{source_id}.json"
    with out_file.open("w", encoding="utf-8") as fh:
        json.dump(passages, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    repo_root = find_repo_root()
    try:
        display_path = out_file.relative_to(repo_root)
    except ValueError:
        display_path = out_file
    print(f"  written    : {display_path}")

    # 7. Upsert registry
    action = upsert_registry(registry_path, registry_entry)
    try:
        display_reg = registry_path.relative_to(repo_root)
    except ValueError:
        display_reg = registry_path
    print(f"  registry   : {action} → {display_reg}")

    return True


# ---------------------------------------------------------------------------
# Source config resolution
# ---------------------------------------------------------------------------


def resolve_source_config(
    pdf_path: Path,
    source_id_override: Optional[str],
) -> Tuple[str, Dict[str, Any]]:
    file_slug = slugify(pdf_path.stem)

    # Exact key match
    match = KNOWN_FILES.get(file_slug)

    # Partial key match (handles minor filename variations)
    if match is None:
        for key, val in KNOWN_FILES.items():
            key_tokens = set(key.split("-"))
            file_tokens = set(file_slug.split("-"))
            if key_tokens & file_tokens:  # any token overlap
                match = val
                break

    if match:
        source_id = source_id_override or match["source_id"]
        entry = dict(match["registry"])
        entry["id"] = source_id
        return source_id, entry

    # Unknown file — generate a safe stub the user can fill in
    source_id = source_id_override or file_slug or "new-source"
    print(
        f"  [info] No known config for '{pdf_path.name}'.\n"
        f"         Auto-generated defaults used; review corpus/sources.json after ingestion."
    )
    entry: Dict[str, Any] = {
        "id": source_id,
        "title": pdf_path.stem.replace("-", " ").replace("_", " "),
        "shortTitle": source_id,
        "description": f"Auto-generated entry for {pdf_path.name}. Update this description.",
        "copyright": "public-domain",
        "displayMode": "full-text",
        "contextWords": 15,
        "linkTemplate": None,
        "officialUrl": None,
        "freeUrl": None,
        "color": "#666666",
        "sortOrder": 10,
        "enabled": True,
    }
    return source_id, entry


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--file", help="Process a specific PDF file path")
    parser.add_argument(
        "--source-id",
        help="Override the derived source-id (only valid together with --file)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Extract, clean, validate — but do not write any output files",
    )
    parser.add_argument(
        "--check-deps",
        action="store_true",
        help="Check for required packages and exit",
    )
    args = parser.parse_args()

    if args.check_deps:
        return check_deps()

    repo_root = find_repo_root()
    raw_dir = repo_root / "corpus" / "raw"
    output_dir = repo_root / "corpus" / "sources"
    registry_path = repo_root / "corpus" / "sources.json"

    if args.file:
        pdf_files = [Path(args.file).resolve()]
    else:
        pdf_files = sorted(raw_dir.glob("*.pdf"))

    if not pdf_files:
        print(f"No PDF files found in {raw_dir}. Nothing to do.")
        return 0

    print(f"Found {len(pdf_files)} PDF file(s) to process.")

    cross_file_ids: Set[str] = set()
    success = 0

    for pdf_path in pdf_files:
        source_id_override = args.source_id if args.file else None
        source_id, registry_entry = resolve_source_config(pdf_path, source_id_override)
        ok = process_pdf(
            pdf_path,
            source_id,
            registry_entry,
            output_dir,
            registry_path,
            args.dry_run,
            cross_file_ids,
        )
        if ok:
            success += 1

    total = len(pdf_files)
    print(f"\n{'=' * 50}")
    print(f"Done: {success}/{total} file(s) processed successfully.")
    if args.dry_run:
        print("(dry-run — no files were written)")
    return 0 if success == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
