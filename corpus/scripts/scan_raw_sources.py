#!/usr/bin/env python3
"""Scan corpus/raw for files that may need to be added to the corpus registry.

The script compares files in corpus/raw against the source registry defined in
sources.json (checking the repo-level corpus registry first, then the proto
Google OneShot copy if needed). It reports:
- raw files that look already covered by an existing source entry
- raw files that look like new corpus candidates
- a suggested source id for each new candidate

Example:
    python corpus/scripts/scan_raw_sources.py
    python corpus/scripts/scan_raw_sources.py --json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def tokenize(value: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", value.lower()))


def find_repo_root(explicit: str | None) -> Path:
    if explicit:
        path = Path(explicit).resolve()
        if path.is_file():
            path = path.parent
        return path

    script_path = Path(__file__).resolve()
    return script_path.parent.parent.parent


def find_registry_path(repo_root: Path, explicit: str | None) -> Path:
    if explicit:
        return Path(explicit).resolve()

    candidates = [
        repo_root / "corpus" / "sources.json",
        repo_root / "proto" / "google-oneshot" / "public" / "corpus" / "sources.json",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate

    raise FileNotFoundError(
        "Could not find a sources.json registry. Checked: "
        + ", ".join(str(path) for path in candidates)
    )


def load_registry(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if isinstance(data, list):
        return data

    if isinstance(data, dict) and isinstance(data.get("sources"), list):
        return data["sources"]

    raise ValueError(f"Unsupported registry format in {path}")


def compare_file_to_registry(raw_name: str, registry_entries: list[dict[str, Any]]) -> dict[str, Any]:
    raw_stem = Path(raw_name).stem
    raw_slug = slugify(raw_stem)

    best_entry: dict[str, Any] | None = None
    best_score = -1.0
    best_reason = ""

    for entry in registry_entries:
        entry_id = str(entry.get("id", "")).strip()
        entry_title = str(entry.get("title", "")).strip()
        entry_short = str(entry.get("shortTitle", "")).strip()
        entry_text = " ".join([entry_id, entry_title, entry_short]).strip()

        entry_slug = slugify(entry_id)
        title_slug = slugify(entry_title or entry_short)

        raw_tokens = tokenize(raw_slug)
        entry_tokens = tokenize(entry_slug) | tokenize(title_slug) | tokenize(entry_text)
        overlap = len(raw_tokens & entry_tokens)

        similarity = max(
            SequenceMatcher(None, raw_slug, entry_slug).ratio(),
            SequenceMatcher(None, raw_slug, title_slug).ratio(),
        )

        score = (similarity * 100) + (overlap * 8)
        if score > best_score:
            best_score = score
            best_entry = entry
            best_reason = (
                f"similarity={similarity:.2f}, overlap={overlap}"
            )

    if best_entry is None:
        return {
            "filename": raw_name,
            "status": "new",
            "suggested_source_id": raw_slug or "new-source",
            "reason": "no registry entries found",
        }

    entry_id = str(best_entry.get("id", "")).strip()
    entry_title = str(best_entry.get("title", "")).strip()
    entry_slug = slugify(entry_id)

    is_likely_existing = (
        raw_slug == entry_slug
        or raw_slug in entry_slug
        or entry_slug in raw_slug
        or best_score >= 75
    )

    if is_likely_existing:
        return {
            "filename": raw_name,
            "status": "existing",
            "matched_source_id": entry_id,
            "matched_source_title": entry_title,
            "reason": best_reason,
        }

    return {
        "filename": raw_name,
        "status": "new",
        "suggested_source_id": raw_slug or "new-source",
        "matched_source_id": entry_id,
        "matched_source_title": entry_title,
        "reason": best_reason,
    }


def scan_raw_sources(raw_dir: Path, registry_entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    files = sorted(
        [path for path in raw_dir.iterdir() if path.is_file() and not path.name.startswith(".")],
        key=lambda item: item.name.lower(),
    )
    return [compare_file_to_registry(path.name, registry_entries) for path in files]


def print_summary(results: list[dict[str, Any]], raw_dir: Path, registry_path: Path) -> None:
    existing = [item for item in results if item["status"] == "existing"]
    new_items = [item for item in results if item["status"] == "new"]

    print(f"Scanned raw files in {raw_dir}")
    print(f"Compared against registry: {registry_path}")
    print(f"Found {len(results)} raw file(s); {len(existing)} likely already covered, {len(new_items)} likely new.")
    print()

    if existing:
        print("Likely already covered:")
        for item in existing:
            print(
                f"- {item['filename']} -> {item['matched_source_id']} ({item['matched_source_title']})"
            )
        print()

    if new_items:
        print("Likely new corpus candidates:")
        for item in new_items:
            print(
                f"- {item['filename']} -> suggested id '{item['suggested_source_id']}' ({item['reason']})"
            )
    else:
        print("No new corpus candidates found.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", help="Path to the repository root")
    parser.add_argument("--sources-json", help="Path to the sources.json registry")
    parser.add_argument("--raw-dir", help="Path to the raw corpus directory")
    parser.add_argument("--json", action="store_true", help="Print JSON instead of human-readable text")
    args = parser.parse_args()

    try:
        repo_root = find_repo_root(args.repo_root)
        registry_path = find_registry_path(repo_root, args.sources_json)
        raw_dir = Path(args.raw_dir).resolve() if args.raw_dir else (repo_root / "corpus" / "raw")

        if not raw_dir.exists():
            raise FileNotFoundError(f"Raw directory not found: {raw_dir}")

        registry_entries = load_registry(registry_path)
        results = scan_raw_sources(raw_dir, registry_entries)

        if args.json:
            print(json.dumps({
                "raw_dir": str(raw_dir),
                "registry_path": str(registry_path),
                "results": results,
            }, indent=2))
        else:
            print_summary(results, raw_dir, registry_path)

        return 0
    except Exception as exc:  # pragma: no cover - command-line safety
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
