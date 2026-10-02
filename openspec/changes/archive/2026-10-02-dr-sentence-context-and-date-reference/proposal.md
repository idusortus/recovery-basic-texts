# Proposal: Daily Reflections sentence context and date reference

## Why

Daily Reflections (DR) search results show only ~8 words on each side of the
match, so a result reads as a fragment and gives no sense of the reflection's
thought. Because DR entries average ~149 words, 8 words/side surfaces roughly 11%
of an entry. Expanding to whole-sentence context makes each result genuinely
readable while staying a bounded, fair-use excerpt, and leading with the
reflection's date makes the result self-identifying as a specific day's reading.

## What Changes

- **Expand DR search-result snippets to whole-sentence context**: 1 sentence on
  each side of the matched sentence, instead of `contextWords` words on each side.
- **Add a data-driven knob**: a new optional registry field `contextSentences`
  selects sentence-bounded clipping for `concordance-only` sources. `contextWords`
  remains the word-bound fallback for `snippet` sources and for any
  `concordance-only` source without `contextSentences`.
- **Make the reflection date the primary lookup reference** on every DR surface:
  lead the result card header with the date, and lead the copied citation with
  the date (`January 1 · Daily Reflections`).
- **Apply to all DR surfaces**: search-result snippets, the home "Today's
  Reflection" card, and the `/reflection` offline fallback all use the same
  expanded, date-led presentation.
- **Preserve the fair-use guard**: a protected entry's full `text` is never
  rendered; when a 1-sentence-each-side window would cover a short entry in full,
  the guard drops a whole sentence (or a word for a single-sentence entry) and
  marks that side clipped.
- **Update the documented posture**: the PRD's "~8 words each side" for
  `concordance-only`, and the `search-quality` and `daily-reflections-display`
  spec scenarios that pin the word bound, are updated to the sentence bound.

Non-goals:

- Not changing `full-text` clipping (whole sentences, `SENTENCE_CONTEXT = 2`) or
  `snippet` clipping (word-bounded, ~30-word cap).
- Not fetching, scraping, or rendering a DR entry's full text.
- Not changing which sources are enabled, the DR corpus, or the link-forward /
  redirect behavior on `/reflection`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `search-quality`: the "concordance-only snippets are clipped on each side"
  scenario and the sentence-splitting requirement's display-mode sentence are
  generalized so `concordance-only` is sentence-bounded when `contextSentences`
  is configured, word-bounded otherwise.
- `daily-reflections-display`: the local-display requirement and its "bounded
  KWIC window", "short entry is still not reproduced in full", and date-reference
  scenarios are updated to the 1-sentence-each-side window and the date-led
  presentation.

## Impact

- **Code:** `src/lib/search/kwic.ts` (clipping + citation), `src/lib/search/index.ts`
  (pass-through), `src/lib/corpus/reflection.ts` (teaser), `src/lib/corpus/registry.ts`
  and `src/lib/types.ts` (new field), `src/routes/+page.svelte` (result card +
  home card), `src/routes/reflection/+page.svelte` (offline fallback).
- **Data:** `corpus/sources.json` gains `"contextSentences": 1` on
  `daily-reflections`; the corpus text is unchanged. Because
  `corpus/scripts/index-version.mjs` hashes `sources.json` into the index version,
  this changes the index version, so the corpus index must be rebuilt
  (`pnpm run build:index`, which `test:search` already runs).
- **No new dependency, API, or auth change.**
