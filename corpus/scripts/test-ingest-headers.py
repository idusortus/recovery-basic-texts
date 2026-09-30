#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test-ingest-headers.py
======================
Dependency-free tests for the Stage 3 running-header/footer stripping added to
`ingest.py` (the fix for the leaked `82 ALCOHOLICS ANONYMOUS` page header in
`corpus/sources/big-book-2ed.json`).

`ingest.py` imports its heavy dependencies (pdfplumber, ftfy, spaCy, enchant)
lazily inside the stages, so this script can import the module and exercise
Stage 3 with the standard library only.

Run:  python3 corpus/scripts/test-ingest-headers.py
Exits 1 on any failure. Area 2 — search-overhaul.
"""

from __future__ import annotations

import logging
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import ingest  # noqa: E402

failures = 0


def check(label: str, condition: bool, detail: str = "") -> None:
    global failures
    if condition:
        print(f"  \u2713 {label}")
    else:
        failures += 1
        print(f"  \u2717 {label} {detail}")


# ─── 1. Pattern unit cases ────────────────────────────────────────────────────

print("\n[test] running-header pattern")
for line in (
    "82 ALCOHOLICS ANONYMOUS",
    "2 ALCOHOLICS ANONYMOUS",
    "INTO ACTION 81",
    "WORKING WITH OTHERS 91",
    "A VISION FOR YOU 152",
    "THE FAMILY AFTERWARD 123",
):
    check(f"is header: {line!r}", ingest._is_running_header(line))

for line in (
    "STEP 12",
    "1. We admitted we were powerless",
    "Rarely have we seen a person fail",
    "82",  # digit-only is handled separately
    "ALCOHOLICS ANONYMOUS",  # no page number
    "",
):
    check(f"not header: {line!r}", not ingest._is_running_header(line))


# ─── 1b. Roman front-matter headers (incl. uppercase) ─────────────────────────

print("\n[test] roman-numeral front-matter headers")
for line in (
    "xii PREFACE",
    "FOREWORD xvii",
    "xxiv THE DOCTOR'S OPINION",
    "THE DOCTOR'S OPINION xxv",
    "XII PREFACE",       # uppercase roman, title last
    "FOREWORD XXI",      # uppercase roman, title first
    "xiv FOREWORD TO THE FIRST EDITION",  # long title must win over its FOREWORD prefix
):
    check(f"is header: {line!r}", ingest._is_running_header(line))

for line in (
    "did",                  # roman letters only, but not a valid roman numeral
    "CIVIL",                # ditto
    "CIVIL WAR",
    "We did what we could",
    "mix",                  # structurally valid (M + IX), but not adjacent to a front-matter title
    "MIX IT UP",            # roman-looking word + ALL-CAPS words, but no front-matter title
    "STEP 12",              # single caps word + arabic number is NOT a header
):
    check(f"not header: {line!r}", not ingest._is_running_header(line))


# ─── 1c. Header-prefix strip: Rule 1 -> Rule 4 priority ───────────────────────

print("\n[test] header-prefix strip keeps list numbers but drops separated page numbers")
check(
    "Rule 1 then Rule 4 keeps the twelfth-step list number",
    ingest.strip_running_header_prefix(
        "60 ALCOHOLICS ANONYMOUS 12. Having had a spiritual awakening"
    )
    == "12. Having had a spiritual awakening",
)
check(
    "Rule 4 strips a separated trailing page number",
    ingest.strip_running_header_prefix("1 THERE IS A SOLUTION 29 enough, we find")
    == "enough, we find",
)
check(
    "non-header line returns None",
    ingest.strip_running_header_prefix("Rarely have we seen a person fail") is None,
)


# ─── 2. Stage 3 integration ───────────────────────────────────────────────────

print("\n[test] stage_3_strip removes headers but preserves prose")

fixture = "\n".join(
    [
        "<<<PAGE 102>>>",
        "",
        "INTO ACTION 81",
        "Before taking drastic action which might implicate other people we secure their consent.",
        "",
        "<<<PAGE 103>>>",
        "",
        "82 ALCOHOLICS ANONYMOUS",
        "forget, so can she. The alcoholic is like a tornado roaring his way through the lives of others.",
        "",
        "<<<PAGE 104>>>",
        "",
        "INTO ACTION 83",
        "Yes, there is a long period of reconstruction ahead. We must take the lead.",
        "",
        "WE WROTE THE YEAR 1939",
        "This all-caps line is not near a page marker and must survive.",
        "",
    ]
)

with tempfile.TemporaryDirectory() as tmp:
    tmp_path = Path(tmp)
    input_path = tmp_path / "02-normalized.txt"
    input_path.write_text(fixture, encoding="utf-8")

    logger = logging.getLogger("test-ingest-headers")
    out_path = ingest.stage_3_strip(input_path, tmp_path, logger, None)
    output = out_path.read_text(encoding="utf-8")

check("leaked 82 header removed", "82 ALCOHOLICS ANONYMOUS" not in output)
check("81 header removed", "INTO ACTION 81" not in output)
check("83 header removed", "INTO ACTION 83" not in output)
check("body text preserved", "like a tornado roaring his way" in output)
check("page markers preserved", "<<<PAGE 103>>>" in output)
check(
    "all-caps line away from a marker survives",
    "WE WROTE THE YEAR 1939" in output,
)

# ─── 2b. Roman front-matter + list-number integrity ──────────────────────────

print("\n[test] stage_3_strip removes roman headers and keeps the twelfth-step number")

fixture2 = "\n".join(
    [
        "<<<PAGE 4>>>",
        "",
        "xii PREFACE",
        "been preserved and is followed by a second on describing Alcoholics Anonymous.",
        "",
        "<<<PAGE 5>>>",
        "",
        "FOREWORD xvii",
        "could. It also indicated that strenuous work was needed.",
        "",
        "<<<PAGE 88>>>",
        "",
        "60 ALCOHOLICS ANONYMOUS",
        "12. Having had a spiritual awakening as the result of these steps, we tried to carry this message.",
        "",
    ]
)

with tempfile.TemporaryDirectory() as tmp:
    tmp_path = Path(tmp)
    input_path = tmp_path / "02-normalized.txt"
    input_path.write_text(fixture2, encoding="utf-8")
    out_path = ingest.stage_3_strip(input_path, tmp_path, logger, None)
    output2 = out_path.read_text(encoding="utf-8")

check("roman-first header removed", "xii PREFACE" not in output2)
check("roman-last header removed", "FOREWORD xvii" not in output2)
check("arabic header removed", "60 ALCOHOLICS ANONYMOUS" not in output2)
check("twelfth-step list number preserved", "12. Having had a spiritual awakening" in output2)
check("roman body preserved", "been preserved and is followed" in output2)

# ─── Summary ──────────────────────────────────────────────────────────────────

print("")
if failures:
    print(f"[test-ingest-headers] FAILED \u2014 {failures} failure(s)")
    sys.exit(1)
print("[test-ingest-headers] \u2713 All tests passed")
