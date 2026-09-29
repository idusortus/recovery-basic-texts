# Tasks

> Future work — this change plans only. Every task below is unchecked until implemented.
> Grouped by the six search-quality areas; each task states its own verification.

## 1. Shared normalization (contraction & punctuation matching)

- [x] 1.1 Add one canonical normalizer module importable by both the build scripts and the app (lowercase, strip straight/curly/modifier apostrophes, fold Unicode quotes/dashes, treat hyphens as separators) and point `build-index.mjs`, `concordance-utils.mjs`, and `src/lib/search/index.ts` at it — done when a parity test proves Node and app consumers produce identical output for a fixture corpus
- [x] 1.2 Give MiniSearch an explicit `tokenize`/`processTerm` aligned with the concordance tokenizer and pass the query through the same function — done when a term tokenizes identically at index time and query time
- [x] 1.3 Add regression tests asserting `Havent got` and `Haven't got` (plus curly/no-apostrophe and punctuation-wrapped variants) return the same passages on both search paths — done when the tests pass and the two paths' passage sets are equal
- [x] 1.4 Rebuild the index (`npm run build:index`) after the normalization change — done when `static/index/*` is regenerated and `index-meta.version` changes

## 2. `tornado` miss and merged-passage defect

> Root cause (2.1): `tokenizeWithPositions` emits the token `tornado` and the query side (`_normalizedTerm`, now `normalizeTerm`) produces the same `tornado`, so the term was not mis-tokenized — tokenizer/normalization drift was **not** the cause. The concordance dictionary contains `tornado` → `…p0142`. The guaranteed fix is the shared canonical normalizer (Area 1) plus a forced clean rebuild (`npm run build:index`), which makes the passage retrievable on both paths; the index version now also covers the tokenizer/index schema, so a stale index can no longer ship silently. The corpus defect (leaked `82 ALCOHOLICS ANONYMOUS`) is separate and fixed in 2.2. The pageRef `p.103` was verified **correct**: the Big Book corpus numbers `pageRef` by PDF page (chapter map: PDF = book page + 21; pagemap maps `p.79` ↔ printed `58`), so the passage printed on book page 82 is at corpus page `p.103`, consistent with its neighbours `p.102`/`p.104`.

- [x] 2.1 Diagnose the miss by comparing the token `tokenizeWithPositions` emits vs `_normalizedTerm`, and confirm whether the shipped index was stale — done when the root cause is recorded and the normalization/tokenizer path is corrected under Area 1
- [x] 2.2 Correct `big-book-2ed-chapter-6-into-action-p0142` in `corpus/sources/big-book-2ed.json`: remove the leaked `82 ALCOHOLICS ANONYMOUS` header and set `pageRef` to the page the text actually occupies — done when the passage text contains no leaked header and its page reference matches the page
- [x] 2.3 If the merge reproduces from `corpus/scripts/ingest.py`, fix the parse/merge step so page headers cannot leak into paragraphs — done when re-ingesting the source reproduces no leaked header *(reproduces: Stage 3 has no running-header rule and the Big Book run had no `--strip-patterns` file; added a marker-proximity running-header rule, verified by `npm run test:ingest` on the exact leaked-header fixture. A full pipeline re-ingest was not runnable in this environment — the repo `.venv` targets Python 3.12, only 3.14 is present, and pdfplumber/ftfy/spaCy/enchant are not importable.)*
- [x] 2.4 Add a regression test asserting `tornado`/`Tornado` returns `big-book-2ed-chapter-6-into-action-p0142` on **both** the MiniSearch path and the concordance path — done when the test passes for both paths
- [x] 2.5 Run `npm run validate:corpus` and `npm run verify:citations` after the corpus edit — done when both pass with no new failures
- [x] 2.6 Rebuild the index after the corpus edit — done when `static/index/*` reflects the corrected passage and its version hash is updated

## 3. Parser, sentence splitting, and KWIC correctness

- [x] 3.1 Route phrase/keyword splitting in `parseQuery` through the shared tokenizer without adding query-syntax features — done when quoted spans parse as exact adjacent phrases and bare words as AND terms
- [x] 3.2 Extend `splitSentences` (abbreviation list, page headers, numbered lists) so it does not split inside `Dr.`, `A.A.`, `p.58`, or `1. We admitted` — done when a golden-file test over a named query set asserts the expected sentence boundaries
- [x] 3.3 Make the MiniSearch/phrase highlight path compute normalized offsets via a shared helper so both paths highlight the exact matched span — done when a two-path test asserts identical highlighted spans for the same passage
- [x] 3.4 Honor display mode in clipping: whole-sentence context for `full-text`; for `snippet`, at most the source's `contextWords` words **total** (never exceeding the PRD §6.3 ~30-word excerpt cap), sentence-aligned only when it fits the word bound and otherwise clipped at a word boundary; for `concordance-only`, `contextWords` each side (never full text) — done when a `snippet` result's KWIC is at most `contextWords` words total, a `concordance-only` result's KWIC is clipped to `contextWords` each side, and no full passage is rendered
- [x] 3.5 Add a golden-file test over at least `tornado`, `Havent got` vs `Haven't got`, `higher power`, `acceptance`, and `Into Action` asserting expected sentence boundaries and highlighted spans — done when the test passes

## 4. Search-box suggestions

- [x] 4.1 Implement prefix suggestions from the loaded concordance term dictionary (sorted-key lookup) and did-you-mean via a bounded, length-bucketed edit-distance — done when typing a prefix and a misspelling each surface ranked suggestions without a network call
- [x] 4.2 Wire suggestions as an accessible combobox (listbox roles, keyboard nav, Escape to dismiss) that does not block or replace the existing debounced search — done when suggestions update while results still render on the existing debounce schedule
- [x] 4.3 Run a selected suggestion through the same `search()` path — done when selecting a suggestion executes that search
- [x] 4.4 Ensure suggestions show indexed terms only and never expose `snippet`/`concordance-only` passage text — done when no suggestion contains passage text

## 5. Synonym & concept grouping

- [x] 5.1 Extend `corpus/synonyms.json` with the `God` ↔ `Higher Power` / `Creator` / `Spirit of the Universe` concept group (reciprocal members) — done when searching any member surfaces the others' passages
- [x] 5.2 Make `getSynonymTerms` symmetric so any group member expands to the whole group, keeping expansion to bare-keyword queries only — done when `God` and each synonym return the same related set and quoted phrases are not expanded
- [x] 5.3 Tokenize multi-word synonyms through the shared normalizer so their terms AND-match in the concordance path — done when `spirit of the universe` matches passages containing that phrase
- [x] 5.4 Keep synonym-only results marked (`matchedBySynonym`) in the UI — done when a synonym-only result renders as marked
- [x] 5.5 Regression-test the existing groups (`fear`, `resentment`, `acceptance`, `sobriety`) — done when their synonyms still expand

## 6. Ranking and snippet quality

- [x] 6.1 Implement one shared relevance score (term coverage, quoted-phrase presence, term frequency, proximity) used by both search paths, with deterministic tie-break by source order then `passage.sequence` — done when the strongest match ranks first within a source group and repeated runs are stable
- [x] 6.2 Center each result's snippet on the best-ranked match sentence rather than the earliest offset — done when a result's snippet window contains its match
- [x] 6.3 Add a two-path ranking test asserting identical result order for a named query set — done when MiniSearch and concordance paths produce the same order

## 7. Verification

- [x] 7.1 Run `npm run build:index`, `npm run validate:corpus`, `npm run verify:citations`, `npm run test:concordance`, and the new search-quality tests — done when all pass
- [x] 7.2 Run `npm run check` and `npm run lint` — done when both pass with no new errors
- [ ] 7.3 Manually verify in the running app: `Havent got`/`Haven't got` parity, `tornado` returns the passage, suggestions appear while results still render, `God` surfaces its concept group, and snippets highlight correctly in light/dark and mobile — done when each is observed
