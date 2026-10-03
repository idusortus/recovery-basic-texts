# Design

## Context

See `proposal.md - Why`. Two constraints shape the approach:

- **Derived file, script is source of truth.** `corpus/sources/twelve-steps.json` is generated
  by `corpus/scripts/extract-reference-texts.mjs`, not hand-maintained. Today the script emits
  each Big Book page chunk (`p0106`, `p0107`) unchanged as one passage, so the file is literally
  the prose pages. Editing only the JSON would drift from the script and be undone on the next
  `--write` run.
- **Reader layout.** The reference reader (`src/routes/reference/+page.svelte`) renders every
  passage of a source under one `<h2>` source title, and prefixes **each** passage with its
  `title` as an uppercase `<h3>`. Passage text is rendered with `whitespace-pre-line`, so
  newline-separated numbered lines render as a list without page changes.

## Goals / Non-Goals

**Goals:**
- `corpus/sources/twelve-steps.json` contains the clean numbered Twelve Steps (1–12), verbatim
  Big Book wording, with no unrelated Chapter 5 prose.
- `extract-reference-texts.mjs` deterministically produces that shape and verifies each step
  against its Big Book source passage; re-running is idempotent.
- Provenance (`pageRef`/`chapterRef`/registry) stays truthful and unchanged in basis.
- The reader shows a clean list with no application code change.

**Non-Goals:**
- No change to `corpus/sources/big-book-2ed.json`; the prose walkthrough stays searchable.
- No change to `corpus/sources.json` (registry entry, `sortOrder 5`, `filterable: false`).
- No reader/route/view-table change; `steps` keeps mapping to `twelve-steps`.
- No new copyrighted text; the source derivation basis is unchanged (public-domain 2nd-ed).
- No search behavior change beyond the reindexed content.

## Decisions

### Decision 1: One passage holding the numbered list, not twelve passages

The rewritten `twelve-steps.json` will be a **single passage** whose `text` is the twelve numbered
steps, each on its own line, joined by single `\n` separators.

**Target text shape:** twelve lines, one step per line, in order; each line begins `N. ` with
its step number `1.` through `12.`; exactly eleven `\n` characters between the steps; no
leading whitespace before `1.` and no trailing newline after step 12. Concretely:

```
1. We admitted we were powerless over alcohol-- that our lives had become unmanageable.\n
2. Came to believe that a Power greater than ourselves could restore us to sanity.\n
...
\n12. Having had a spiritual awakening as the result of these steps, we tried to carry this
message to alcoholics, and to practice these principles in all our affairs.
```

(The `\n` markers above stand for real newline characters; each step's own wording stays on one
line — no re-wrapping.)

**Why:** The reader emits one uppercase `<h3>{passage.title}</h3>` per passage. Twelve
single-step passages would print the header "The Twelve Steps" twelve times, visually
repeating a heading the selector already shows and the `<h2>` already carries — a worse result
than the current page. One passage produces exactly one heading and one numbered block. The
reader renders passage text with `whitespace-pre-line`, which breaks only on actual `\n`
characters, so the builder **must insert the separators** — the corpus step text has zero
newlines (steps 1–12 run together as one string), so a naive extract-and-join would reproduce a
run-on paragraph, which is the exact defect being fixed. **No `src/` change is needed** because
the reader already supports this shape (`whitespace-pre-line` + `mb-4` between passages).

**Alternative considered:** twelve passages (one per step) with titles like "Step 1"…"Step 12".
Rejected: it changes the reader's visual contract (repeated heading band per step), adds
passage-shape churn to the index, and is not needed to deliver the requested list. If a future
design wants per-step anchors, that is a separate change to the reader.

### Decision 2: Build the text by slicing the step statements out of the corpus, then split/join

`buildTwelveSteps()` will derive the text from the two source passages rather than embedding a
second transcription, then insert the line separators the corpus lacks:

- From `p0106`, take the substring **after** the lead-in marker
  `"Here are the steps we took, which are suggested as a program of recovery:"` — that slice is
  steps 1–11, already numbered `1.`…`11.`.
- From `p0107`, take the prefix **up to and including** step 12's sentence
  (`"12. Having had a spiritual awakening as the result of these steps, we tried to carry this
  message to alcoholics, and to practice these principles in all our affairs."`) and drop the
  trailing chapter prose.
- Join the two slices with a single space to form the run-on numbered string.
- **Split that string back into its twelve steps on the `N. ` markers and re-join with `\n`:**
  split on the lookahead boundary `/(?=\s\d+\.\s)/` (each step number requires surrounding
  whitespace, so digits inside a step's own prose are not mistaken for markers), `trim()` each
  piece to drop the leading separator whitespace while preserving the step's `N. ` prefix, drop
  any empty piece, assert there are exactly twelve pieces, then `steps.join('\n')`.
- Assert the normalized invariants before emitting: the result contains exactly eleven `\n`
  characters; every line matches `^(\d+)\.\s` with line `i` numbered `i + 1`; there is no
  leading whitespace before `1.` and no trailing newline.

Each step's body is therefore a contiguous slice of the committed Big Book corpus, so fidelity
is provable, while the inter-step `\n` is inserted normalization (not corpus text) that makes
`whitespace-pre-line` render twelve separate lines. Add explicit start/end markers and
`requireSubstring` checks (mirroring the existing `twelve-traditions`/`promises-and-prayers`
pattern) so a corpus drift fails loudly in the dry run instead of silently emitting wrong text.

**Alternative considered:** hard-code the twelve step strings in the script. Rejected: it would
defeat the file's "derived, byte-for-byte" guarantee and the existing fidelity test convention.

### Decision 3: Provenance attributes for the single passage

The single passage keeps the existing id family but reflects that it now spans both pages. Use:

- `id`: `twelve-steps-list-1-12` (single passage; the old `-1-11`/`-12` ids are gone).
- `sequence`: `1`.
- `pageRef`: `"p.80"` (the page where the list begins; step 12's text spills to p.81, noted in
  `CORPUS-GUIDE.md`), matching the existing convention of citing the starting page.
- `title`: `"The Twelve Steps"`, `chapterRef`: `"The Twelve Steps"` (unchanged).
- `sourceId`: `"twelve-steps"`, `date: null`, `linkData: null` (unchanged).

**Why `p.80`:** the previous split had `p.80` (steps 1–11) and `p.81` (step 12). A single
passage must cite one page, the list opens on p.80, and that is where a reader would look; the
guide already states pages 80–81. This is a *starting-page* citation, not a claim that every
step's original printed page (or spread) is preserved — the source's edition basis
(public-domain 2nd-ed) is what stays unchanged.

### Decision 4: Spec delta is ADDED, not MODIFIED

The `reference-texts` main spec has no requirement describing the internal shape/content of the
`twelve-steps` passages; its requirements cover catalog/basis/provenance/discoverability, none
of which change. The clean-numbered-list guarantee is new behavior, so the delta uses
`## ADDED Requirements` against the existing `reference-texts` capability. No existing
requirement text or scenario is altered, so no `MODIFIED` block is needed (and adding one would
risk losing detail at archive time).

### Decision 5: Rebuild the index and update the guards

`twelve-steps.json` is an input to `corpus/scripts/build-index.mjs`, whose version hash covers
the corpus inputs, so `pnpm run build:index` MUST be run to keep `index-meta.version` fresh.
`scripts/test-reference-reader.mjs` asserts the `steps → twelve-steps` view mapping (unchanged)
and scans the corpus for Concepts only, so it needs no logic change, but its header comment
references the old prose shape and any passage-count expectation must be reconciled. Add a
small content assertion so the guard actually pins the clean list: step 1's line begins
`1. We admitted we were powerless`; the text contains `12. Having had a spiritual awakening`;
the text contains exactly eleven newlines with every line matching `^\d+\. `; and it does not
contain the "fling, powerful!" preamble. Because this assertion reads generated content, it is
updated **after** `--write` regenerates `twelve-steps.json` and `pnpm run build:index` rebuilds
the index (see tasks §4).

## Risks / Trade-offs

- **[Corpus drift breaks the slice markers]** → The script fails loudly (`requireSubstring`
  plus explicit marker checks) in the dry run, before writing, so a re-extraction that changes
  p0106/p0107 wording is caught rather than silently emitting a truncated list.
- **[Index staleness]** → Always run `pnpm run build:index` after the corpus change; the
  existing freshness guard fails the build if the version hash is stale.
- **[Provenance pointing at a page without the whole list]** → `pageRef: "p.80"` is the list's
  starting page and `CORPUS-GUIDE.md` records pages 80–81; the single-passage shape is the
  reason, documented in the guide.
- **[Search recall for step statements]** → The Big Book still carries the same wording, so
  occurrences now appear in both sources under their own labels (unchanged overlap behavior).

## Migration Plan

1. Update `extract-reference-texts.mjs`, run the dry run (verifies against Big Book), then
   `--write` to regenerate `twelve-steps.json`.
2. Run `pnpm run validate:corpus` and `pnpm run test:corpus-headers`.
3. Run `pnpm run build:index`.
4. Update `scripts/test-reference-reader.mjs` content assertion and `corpus/CORPUS-GUIDE.md`
   Twelve Steps wording, then run the guard tests.
5. Rollback: `git checkout corpus/sources/twelve-steps.json` and re-run `pnpm run build:index`
   (the script change is revertible independently).

## Open Questions

None. (A reader change for per-step anchors is explicitly out of scope and tracked only as an
alternative in Decision 1.)
