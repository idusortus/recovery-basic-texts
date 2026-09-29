# Proposal: Search overhaul

## Why

Search is the product's core surface, and it is the MVP's weakest area. Results are "still a
bit off": contractions do not match symmetrically (`Havent got` misses `Haven't got` and vice
versa) because `normalizeForSearch` (`src/lib/search/index.ts`) is applied to the query while
the MiniSearch index/query tokenization stays at MiniSearch defaults, so the two sides are not
normalized the same way; the word `tornado` is reported to return no results although it is
present in the corpus; and the query parser, sentence splitter, and KWIC snippet windows
produce visibly off-target excerpts and highlights. The known gaps are already recorded as
backlog items 1.1–1.5, and this change promotes and resolves them together as one broad
search-quality change rather than five narrow, conflicting ones.

## What Changes

- **Contraction / punctuation-insensitive matching.** Make the query side and the index side
  use the *same* normalization so `Havent got` and `Haven't got` return the same passages, and
  so other apostrophe/punctuation variants (curly vs straight, hyphen vs space) match
  symmetrically. The current split — `normalizeForSearch` strips apostrophes on the query only,
  `build-index.mjs` strips them on the built fields, and MiniSearch tokenizes with defaults — is
  replaced by one shared normalization applied consistently to both sides and to the concordance
  tokenizer.
- **Fix the `tornado` miss and the suspected corpus merge defect.** Diagnose and fix why
  `tornado` / `Tornado` returns no result although passage
  `big-book-2ed-chapter-6-into-action-p0142` (pageRef `p.103`) contains it. This includes the
  tokenizer/normalization path *and* the suspected corpus page-ref/paragraph-merge defect in
  that passage, whose text begins with a leaked page header (`82 ALCOHOLICS ANONYMOUS`) and
  whose `pageRef` does not match the page it came from.
- **Expanded parser / tokenization and snippet (KWIC) correctness.** Improve query parsing
  (phrase vs keyword, punctuation, multi-word terms), sentence splitting (abbreviations,
  numbered lists, page headers), and KWIC clipping/highlighting so the shown window and the
  highlighted span are both correct, and so the two search paths highlight identically.
- **Search-box suggestions.** Add autocomplete / did-you-mean / related-term suggestions as the
  user types, derived from the locally loaded index data (concordance term dictionary and the
  synonym map), **without blocking or replacing** the existing debounced search. Suggestions are
  an additive layer; a selection runs the existing search.
- **Synonym & concept grouping.** Extend `corpus/synonyms.json` + `src/lib/corpus/synonyms.ts`
  so searching `God` surfaces `Higher Power` / `Creator` / `Spirit of the Universe` and vice
  versa, and so synonym-matched results stay visibly marked (`matchedBySynonym`).
- **Ranking / snippet quality.** Improve relevance ordering and KWIC snippet quality so the most
  relevant passage and the best window appear first, within a source group, rather than pure
  corpus sequence order.

Scope note on architecture: the search index is a **prebuilt, client-side static asset**
(`static/index/*`, built by `corpus/scripts/build-index.mjs`) consumed in the browser by
MiniSearch plus a concordance index — there is no server-side search. Every option below is
evaluated against that constraint; anything that would require a server-side search service or
a new runtime dependency is a non-goal (see below), not a silent addition.

## Capabilities

### New Capabilities

- `search-quality`: The search experience — index/query normalization symmetry, tokenization
  and query parsing, sentence/KWIC snippet correctness, search-box suggestions, synonym and
  concept expansion, and result ranking — over the prebuilt client-side index, honoring each
  source's display mode.

### Modified Capabilities

- None. `openspec/specs/` contains only `feedback-to-github`, which is unrelated, and no
  existing capability's requirements change.

## Non-goals

- **Semantic / embedding search.** No vector search, embeddings, model downloads, or ML runtime.
  Suggestions and synonym grouping are lexical and data-driven (concordance dictionary +
  curated synonym map), not semantic.
- **Server-side search.** No search Worker, no D1/FTS5, no server round-trip for query
  execution. The architecture stays a prebuilt client-side index; any option that would require
  a server-side search service is rejected.
- **Abandoning the prebuilt client index.** The MiniSearch + concordance two-path design stays.
  This change *aligns* the two paths' behavior; it does not replace or remove either.
- **New runtime dependencies.** No new `dependencies` (e.g. an NLP/stemmer library shipped to the
  browser). Index-build-time tooling may be discussed, but nothing new ships in the app bundle.
- **Full-text rendering of protected sources.** No change to the display-mode/copyright rules:
  `concordance-only` and `snippet` passages are still clipped to a KWIC window and never rendered
  or copied in full.
- **Auth/accounts, bookmarks, notes, non-AA content** (MVP guardrails, unchanged).
- **Usage logging / analytics changes** (`/api/log`, privacy posture) — untouched.

## Impact

- **Source files (planned):** `src/lib/search/index.ts` (shared normalization, parser,
  concordance/MiniSearch alignment, ranking), `src/lib/search/kwic.ts` (sentence splitting, KWIC
  clipping, highlight correctness), `src/lib/corpus/synonyms.ts` + `corpus/synonyms.json`
  (concept groups), `src/routes/+page.svelte` (suggestion UI wiring; existing debounce retained),
  and likely a new `src/lib/search/suggestions.ts` plus a `search-quality` unit test.
- **Corpus/build:** `corpus/scripts/concordance-utils.mjs` and `corpus/scripts/build-index.mjs`
  (shared normalization applied at build time), and a fix to the merged/leaked passage in
  `corpus/sources/big-book-2ed.json`. Any change to index inputs requires `npm run build:index`
  to regenerate `static/index/*` (gitignored build artifacts).
- **No new runtime dependencies.** No `package.json` `dependencies` change.
- **No API, database, schema, or deployment-config change.** No `wrangler.jsonc` change; the
  search Worker/log path is untouched.
- **Supersedes backlog items 1.1–1.5** in `openspec/changes/product-backlog/tasks.md`; each entry
  is annotated `→ promoted to search-overhaul` and left unchecked, per the backlog convention.
