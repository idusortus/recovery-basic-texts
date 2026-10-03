# Proposal

## Why

The `/reference` reader's **Twelve Steps** view is supposed to be the clean, numbered list
the user asked for ("1. We admitted we were powerless... 2. Came to believe..."), but it
currently renders the raw Big Book page chunks: the first passage begins mid-word
("fling, powerful!...") and drags in unrelated Chapter 5 prose before the list, and the
second passage appends pages of "Many of us exclaimed..." walkthrough after step 12. The
numbered steps exist verbatim in the committed public-domain Big Book corpus, so the fix is
to reformat that same text into the steps, with no new or copyrighted content.

## What Changes

- Rewrite `corpus/sources/twelve-steps.json` so the source holds the clean numbered Twelve
  Steps (1–12) instead of the raw p0106/p0107 page chunks. The steps' wording stays verbatim
  from the Big Book corpus; only the list framing/numbering is added.
- Update the deterministic derivation script `corpus/scripts/extract-reference-texts.mjs` so
  a re-run (`--write`) still emits the clean steps, and the default dry run verifies each
  step against the Big Book source. Re-running is idempotent.
- Regenerate the prebuilt search index so the recorded index version matches a fresh hash of
  the changed corpus inputs.
- Update the tests/guards that assert the current shape (the reference-reader view mapping
  and any passage-shape expectations).
- **`corpus/sources/big-book-2ed.json` is NOT modified** — the Big Book prose walkthrough
  (including the same step statements) stays searchable there; the Twelve Steps reference
  source remains a labeled convenience collection over the Big Book, not a de-duplication.
- The reference reader's view table (`key → source id`) does not change: `steps` still maps
  to `twelve-steps`.

## Capabilities

### New Capabilities

- `reference-texts`: A new requirement is added specifying the `twelve-steps` source's passage
  content/shape — it SHALL carry the clean numbered Twelve Steps (1–12) as twelve newline-
  separated step lines derived verbatim from the public-domain Big Book, each step's wording
  preserved. This guarantee is new (the existing catalog, basis, provenance, and
  discoverability requirements are unchanged), so the delta is pure ADDED against the existing
  `reference-texts` capability rather than a MODIFIED requirement.

### Modified Capabilities
<!-- none: the delta adds a new requirement to reference-texts; no existing requirement text changes -->

## Impact

- Corpus data: `corpus/sources/twelve-steps.json` (rewritten content).
- Derivation script: `corpus/scripts/extract-reference-texts.mjs` (source of truth for the
  derived reference files; must be updated or a re-run would undo the change).
- Prebuilt index: `static/index/*` (`minisearch.json`, `passages.json`, `concordance.json`,
  `index-meta.json`) regenerated via `pnpm run build:index`.
- Tests: `scripts/test-reference-reader.mjs` and any passage-shape guard updated to the new
  Twelve Steps content; `pnpm run test:corpus-headers`, `pnpm run validate:corpus`.
- Docs: `corpus/CORPUS-GUIDE.md` Twelve Steps provenance wording adjusted to describe the
  numbered-step extraction (still byte-for-byte Big Book wording).
- Not touched: `corpus/sources/big-book-2ed.json`, `src/` application code (the reader shape
  already handles one passage containing a list), `corpus/sources.json` registry entry.
