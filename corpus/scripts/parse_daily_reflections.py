#!/usr/bin/env python3
"""
parse_daily_reflections.py

Parses the extracted text of AA Daily Reflections into corpus/sources/daily-reflections.json.

Input:  /tmp/dr_raw.txt  (from: pdftotext -layout AA-Daily-Reflections.pdf /tmp/dr_raw.txt)
Output: corpus/sources/daily-reflections.json

Each entry in the corpus:
  {
    "id":         "dr-MM-DD",
    "sourceId":   "daily-reflections",
    "title":      <string>,
    "sequence":   <int>,
    "date":       "MM-DD",
    "pageRef":    null,
    "chapterRef": "Month Day",          (e.g. "June 28")
    "text":       <full entry text — quote + citation + reflection>,
    "linkData":   null
  }

Usage:
  python3 corpus/scripts/parse_daily_reflections.py
  python3 corpus/scripts/parse_daily_reflections.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# ── Month helpers ─────────────────────────────────────────────────────────────

MONTH_NUMS = {
    "JANUARY": "01", "FEBRUARY": "02", "MARCH": "03", "APRIL": "04",
    "MAY": "05", "JUNE": "06", "JULY": "07", "AUGUST": "08",
    "SEPTEMBER": "09", "OCTOBER": "10", "NOVEMBER": "11", "DECEMBER": "12",
}
MONTH_TITLES = {v: k.capitalize() for k, v in MONTH_NUMS.items()}
MONTH_PATTERN = re.compile(
    r"^(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|"
    r"SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{1,2})",
    re.IGNORECASE,
)

# Known AA source citation patterns (used to identify the citation line)
CITATION_PATTERN = re.compile(
    r"(ALCOHOLICS ANONYMOUS|TWELVE STEPS AND TWELVE TRADITIONS|AS BILL SEES IT"
    r"|DAILY REFLECTIONS|THE LANGUAGE OF THE HEART|CAME TO BELIEVE"
    r"|A\.A\. COMES OF AGE|DR\. BOB AND THE GOOD OLDTIMERS"
    r"|PASS IT ON|THE A\.A\. WAY OF LIFE|IN ALL OUR AFFAIRS"
    r"|EXPERIENCE, STRENGTH AND HOPE|GRAPEVINE|A\.A\. GRAPEVINE"
    r"|THE BEST OF THE GRAPEVINE|TWELVE TRADITIONS|STEP \w+"
    r"|TRADITION \w+)[,\s]",
    re.IGNORECASE,
)


def clean_line(line: str) -> str:
    """Strip leading/trailing whitespace; collapse internal whitespace."""
    return re.sub(r"\s+", " ", line).strip()


def parse_entry(page_text: str) -> dict | None:
    """Parse a single DR page into a structured entry dict, or None if unparseable."""
    lines = [clean_line(l) for l in page_text.splitlines()]
    lines = [l for l in lines if l]  # remove blank after stripping

    if not lines:
        return None

    # ── 1. Find date line ─────────────────────────────────────────────────────
    date_idx = None
    month_str = ""
    day_str = ""
    for i, line in enumerate(lines):
        m = MONTH_PATTERN.match(line)
        if m:
            month_str = m.group(1).upper()
            day_str = m.group(2)
            date_idx = i
            break

    if date_idx is None:
        return None  # Can't find the date — skip

    # ── 2. Title is the line immediately after the date ───────────────────────
    title_idx = date_idx + 1
    if title_idx >= len(lines):
        return None
    raw_title = lines[title_idx]
    # Strip surrounding quotes if present
    title = raw_title.strip('"').strip("'").strip()

    # ── 3. Everything after the title is the entry body ──────────────────────
    body_lines = lines[title_idx + 1:]

    # Rebuild the body: find citation line, separate quote from reflection
    # The text between title and citation is the AA-literature quote
    # The text after the citation is the personal reflection

    # Rejoin body into one block for output (quote + citation + reflection)
    body = " ".join(body_lines)
    # Normalize whitespace
    body = re.sub(r"\s{2,}", " ", body).strip()

    # ── 4. Compute date key ───────────────────────────────────────────────────
    month_num = MONTH_NUMS.get(month_str, "00")
    day_num = day_str.zfill(2)
    date_key = f"{month_num}-{day_num}"

    # Human-readable chapter ref
    month_title = month_str.capitalize()
    chapter_ref = f"{month_title} {int(day_str)}"

    entry_id = f"dr-{date_key}"

    return {
        "id": entry_id,
        "sourceId": "daily-reflections",
        "title": title,
        "sequence": 0,  # filled in later
        "date": date_key,
        "pageRef": None,
        "chapterRef": chapter_ref,
        "text": body,
        "linkData": None,
    }


def main():
    parser = argparse.ArgumentParser(description="Parse AA Daily Reflections PDF text")
    parser.add_argument("--dry-run", action="store_true", help="Parse and report; don't write")
    parser.add_argument("--input", default="/tmp/dr_raw.txt", help="Path to extracted PDF text")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent.parent
    input_path = Path(args.input)
    output_path = repo_root / "corpus" / "sources" / "daily-reflections.json"

    if not input_path.exists():
        print(f"ERROR: input file not found: {input_path}", file=sys.stderr)
        print("Run: pdftotext -layout corpus/raw/AA-Daily-Reflections.pdf /tmp/dr_raw.txt", file=sys.stderr)
        sys.exit(1)

    raw = input_path.read_text(encoding="utf-8", errors="replace")

    # ── Split by form feed (one entry per page) ───────────────────────────────
    pages = raw.split("\f")
    print(f"Pages found: {len(pages)}")

    entries: list[dict] = []
    skipped = 0
    seen_dates: set[str] = set()

    for page in pages:
        entry = parse_entry(page)
        if entry is None:
            skipped += 1
            continue
        if entry["date"] in seen_dates:
            # Duplicate date — keep first occurrence
            continue
        seen_dates.add(entry["date"])
        entries.append(entry)

    # Sort by date (month-day order)
    entries.sort(key=lambda e: e["date"])

    # Assign sequence numbers in order
    for i, entry in enumerate(entries, start=1):
        entry["sequence"] = i

    print(f"Parsed {len(entries)} entries, skipped {skipped} pages")

    # Verify expected count (366 for leap year coverage)
    if len(entries) < 300:
        print(f"WARNING: only {len(entries)} entries — expected ~366. Check the input.", file=sys.stderr)

    # Show first/last/leap-day
    if entries:
        print(f"  First: {entries[0]['date']} — {entries[0]['title']}")
        print(f"  Last:  {entries[-1]['date']} — {entries[-1]['title']}")
        feb29 = next((e for e in entries if e["date"] == "02-29"), None)
        if feb29:
            print(f"  Feb 29 ✓: {feb29['title']}")
        else:
            print("  Feb 29: not found")

    if args.dry_run:
        print("Dry run — not writing output.")
        return

    output_path.write_text(
        json.dumps(entries, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )
    print(f"\nWritten: {output_path}")
    print("Next: node corpus/scripts/build-index.mjs")


if __name__ == "__main__":
    main()
