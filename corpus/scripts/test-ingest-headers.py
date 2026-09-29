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

# ─── Summary ──────────────────────────────────────────────────────────────────

print("")
if failures:
    print(f"[test-ingest-headers] FAILED \u2014 {failures} failure(s)")
    sys.exit(1)
print("[test-ingest-headers] \u2713 All tests passed")
