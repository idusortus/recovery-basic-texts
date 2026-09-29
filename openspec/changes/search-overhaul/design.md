# Design

## Context

See `proposal.md` — Why. This design covers *how* the six search-quality areas are implemented
against the existing architecture. Current state that shapes the approach (read-only findings):

- **Two search paths, one store.** `src/lib/search/index.ts` loads a prebuilt MiniSearch index
  (`static/index/minisearch.json`) and then, in the background, a concordance index
  (`static/index/concordance.json`). `search()` uses MiniSearch only until the concordance
  loads; after that the concordance path (`_searchByConcordance`, exact term lookup, character
  offsets, no fuzzy) is authoritative. On the MiniSearch fallback, only the keyword branch
  disables fuzzy (`fuzzy: false`, `src/lib/search/index.ts:516`); the phrase branch calls
  `ms.search(...)` without a `fuzzy` override (`src/lib/search/index.ts:507`), so it uses
  MiniSearch's default fuzzy matching. Both paths group by source and sort results by
  `passage.sequence`.
- **Normalization is duplicated and asymmetric.** `normalizeForSearch` (`src/lib/search/index.ts`)
  strips `' ‘ ’ ʼ` from the *query* before MiniSearch; `build-index.mjs` applies a separate
  `normalizeForIndex` to the indexed fields; `concordance-utils.mjs` has a third
  (`normalizeToken`), and `_normalizedTerm` in the search service a fourth. MiniSearch's
  `tokenize`/`processTerm` are left at defaults, so the tokenization of query vs index is not
  guaranteed identical. This is the root of the contraction asymmetry (spec Requirement 1).
- **Index build is a prebuilt static asset.** `corpus/scripts/build-index.mjs` reads
  `corpus/sources.json` + `corpus/sources/<id>.json`, emits `static/index/{minisearch,passages,
  concordance,index-meta}.json`, and versions the index by a SHA-256 of corpus inputs.
  `static/index/` is gitignored and produced by `npm run build:index` (also wired into
  `npm run build`). Any change to normalization/tokenization/corpus requires a rebuild.
- **Corpus defect.** Passage `big-book-2ed-chapter-6-into-action-p0142` has `pageRef "p.103"`
  but its text begins with a leaked page header `82 ALCOHOLICS ANONYMOUS` (a page-82 header
  merged into the paragraph) — a suspected paragraph/page-reference merge defect.
- **Sentence splitting + KWIC.** `src/lib/search/kwic.ts` splits on `[.!?]` before an uppercase
  letter, patches a fixed abbreviation list, and clips to 2 sentences each side; the
  concordance path clips by recomputing sentence character positions and highlights by exact
  offsets, while the MiniSearch/phrase paths highlight by regex (`highlightAll`). The
  `contextWords`/`displayMode` parameters are currently ignored for clipping.
- **Synonym data.** `corpus/synonyms.json` is imported directly by `src/lib/corpus/synonyms.ts`
  (no duplication) and expanded only for bare-keyword queries; results carry `matchedBySynonym`.
- **Constraints (unchanged):** no server-side search, no database, no new runtime dependency,
  and display-mode gating — `snippet`/`concordance-only` passages are clipped, never rendered or
  copied in full (PRD §7, §8.4; `AGENTS.md`).

## Goals / Non-Goals

**Goals**

- Make query/index normalization one shared, symmetric rule so contractions and punctuation no
  longer change matches.
- Make a word present in the corpus retrievable, and remove the leaked-header/page-ref corpus
  defect.
- Make parsing, sentence splitting, highlighting, and snippet windows correct and consistent
  across both search paths.
- Add non-blocking search-box suggestions and broader, symmetric concept grouping.
- Rank by relevance within a source group, deterministically.

**Non-Goals**

- No server-side search, no embeddings/semantic search, no new runtime dependency (see
  `proposal.md` — Non-goals).
- Not replacing or removing either search path; this design *aligns* them.
- Not changing display-mode/copyright behavior, usage logging, the search worker's logging
  role, or the corpus/citation verification workflow's guarantees.

## Decisions

### Area 1 — Shared, symmetric normalization

Options considered:

- **A. One canonical normalizer module imported by both the build scripts and the app.**
  Place the canonical implementation in a plain ESM module (`src/lib/search/normalize.js` with
  JSDoc types) that `corpus/scripts/build-index.mjs`, `corpus/scripts/concordance-utils.mjs`,
  and `src/lib/search/index.ts` all import. It lowercases, strips all apostrophe variants,
  folds/normalizes Unicode quotes and dashes, and treats hyphens as separators so index-time and
  query-time tokens are byte-identical. MiniSearch is given a custom `processTerm` (and the
  query is passed through the same function) so MiniSearch tokenization matches the concordance
  tokenizer.
- **B. Keep four copies** and add a parity test. Works but is the status quo that caused drift;
  a single edit can silently desync the paths.
- **C. Pre-normalize whole strings before indexing only** (today's approach). Does not fix
  query-side punctuation/hyphen handling or the two-path drift.

**Recommended: A.** One importable module gives a single source of truth for Node (build) and
Vite (browser); MiniSearch gets an explicit `tokenize`+`processTerm` aligned with
`tokenizeWithPositions`, and the concordance tokenizer reuses the same normalization. If the
ESM-import-from-`src` boundary proves awkward, fall back to: canonical `.mjs` in
`corpus/scripts/`, a mirrored `.ts` in `src/lib/search/`, and a golden parity test that asserts
both produce identical output for a fixture corpus — but do not ship without the parity test.

### Area 2 — `tornado` miss and merged-passage defect

Diagnosis path (implementation): compare the token `tokenizeWithPositions` emits for the word
against the token `_normalizedTerm` produces for the query; confirm the concordance dictionary
contains the term; and confirm the shipped `static/index/*` is not stale relative to the corpus
(compare `index-meta.version` to a fresh hash).

Options considered:

- **A. Fix normalization/tokenizer (Area 1) + rebuild the index + correct the corpus passage.**
- **B. Special-case `tornado`** — rejected; it treats a symptom, not the class of bug.
- **C. Only rebuild the index without fixing normalization** — rejected; the asymmetry would
  reproduce on the next contraction/punctuation query.

**Recommended: A.** Use the shared normalizer so any present word is tokenized identically at
build and query time; regenerate `static/index/*` (`npm run build:index`, which also bumps the
version hash for cache-busting); and correct `big-book-2ed-chapter-6-into-action-p0142` in
`corpus/sources/big-book-2ed.json` by removing the leaked `82 ALCOHOLICS ANONYMOUS` header and
setting `pageRef` to the page the text actually occupies. If the defect reproduces from the
ingest/parse pipeline (`corpus/scripts/ingest.py`), fix the pipeline too so it cannot recur, and
re-run `npm run validate:corpus` and `npm run verify:citations`. Because `tornado` currently
resolves through the concordance path, the regression test must assert the result is present on
*both* paths, not just post-load.

### Area 3 — Parser, sentence splitting, KWIC correctness

**Tokenizer / term matching.** Options: (A) align MiniSearch's `tokenize`/`processTerm` with the
concordance tokenizer (needed regardless); (B) add a light suffix stemmer; (C) enable
MiniSearch `prefix`; (D) enable MiniSearch `fuzzy`. **Recommended: A as the base, C for
suggestion matching only, and no stemmer or fuzzy in result generation.** The concordance path
is exact-match with offsets; a stemmer would have to be applied to the concordance at build time
to keep the paths aligned, and fuzzy/prefix in the candidate path reintroduces the false-positive
noise the design deliberately removed. Keep result candidates exact; use prefix/fuzzy only to
*rank or suggest* (Area 4).

**Parser.** Options: (A) keep the current `parseQuery` (quoted phrases + bare keywords) but
normalize phrase/keyword splitting through the shared tokenizer; (B) a full query-syntax parser.
**Recommended: A** — the PRD defines only phrase vs keyword (§4.2), so a syntax parser is scope
creep.

**Sentence splitting.** Options: (A) extend the existing regex + abbreviation list with page
headers and numbered lists, validated by a golden file; (B) adopt a sentence-tokenizer library.
**Recommended: A** — dependency-free and directly testable; B fails the no-new-dependency goal.

**KWIC / highlight.** Options: (A) keep offset-based highlighting for the concordance path and
make the MiniSearch/phrase paths compute equivalent normalized offsets via a shared helper so
both highlight identically; (B) leave the regex `highlightAll` on the fallback path. **Recommended:
A.** Also make clipping honor display mode and its excerpt-size limit: whole-sentence context
for `full-text`; for `snippet`, at most the source's `contextWords` words in **total** (never
exceeding the PRD §6.3 ~30-word excerpt cap), sentence-aligned only when that fits within the
word bound and otherwise clipped at a word boundary; and for `concordance-only`, `contextWords`
on **each side** of the match. This finally uses `contextWords`, per PRD §8.4, and tightens the
copyright posture.

### Area 4 — Search-box suggestions

Options considered:

- **A. Derive from the already-loaded concordance term dictionary.** Prefix matches via the
  sorted key list; did-you-mean via a bounded edit-distance (length-bucketed) over candidate
  terms; related terms from the synonym map. Offline, no new dependency, no server. **Recommended.**
- **B. MiniSearch's built-in `autoSuggest`** for prefix suggestions, plus a hand-rolled
  did-you-mean. Viable but adds a second term source; use only if it simplifies prefix ranking.
  Its prefix results can be combined with A.
- **C. A dedicated prebuilt `static/index/terms.json`** (terms + frequencies) to rank
  suggestions without touching the concordance structure. Optional; adds one small build output.
- **D. Server-side or a new fuzzy-matching dependency** — rejected (non-goals).

**Recommended: A**, optionally layering B for prefix ranking and C for frequency-based ordering
if the concordance key iteration proves too coarse. Suggestions are computed as a separate,
debounced, non-blocking step and never delay the existing debounced `search()` call; selecting a
suggestion calls the same `search()`. UI is an accessible combobox (keyboard navigable,
`aria-*` wired) so the existing search input contract is preserved. Suggestions expose only
terms, never passage text.

### Area 5 — Synonym & concept grouping

Options considered:

- **A. Extend `corpus/synonyms.json` with reciprocal concept groups and make lookup symmetric**
  (if any member is searched, expand to all members). The app already imports this JSON
  directly, so there is no mirror to maintain. **Recommended.**
- **B. Restructure the JSON into explicit concept groups** (`[{ term, aliases: [...] }]`),
  deriving the lookup from the groups. Cleaner and inherently symmetric, but changes the data
  shape and every consumer.
- **C. Bake synonym expansion into the prebuilt index** — rejected: bloats the index, loses
  `matchedBySynonym` provenance, and makes synonym behavior hard to change without a rebuild.

**Recommended: A**, with B as a follow-up only if the pairwise map becomes unwieldy. Concretely:
add the `God` ↔ `Higher Power` / `Creator` / `Spirit of the Universe` group (and any other
requested groups) so lookup returns the *whole* group regardless of which member was typed;
keep expansion limited to bare-keyword queries; keep the `matchedBySynonym` flag and ensure the
UI marks synonym-only results. Multi-word synonyms (e.g. `spirit of the universe`) must be
tokenized through the shared normalizer so their terms AND-match consistently in the concordance
path.

### Area 6 — Ranking and snippet quality

Options considered:

- **A. One shared relevance score used by both paths** (direct term coverage, quoted-phrase
  presence, term frequency, and proximity of term offsets), with a deterministic tie-break by
  source order then `passage.sequence`. **Recommended.**
- **B. Use MiniSearch BM25 on the fallback path and a separate hand-rolled score on the
  concordance path.** Risks the two paths ordering differently — exactly the alignment problem
  this change is meant to remove.
- **C. Keep pure sequence order** — rejected (the relevance gap).

**Recommended: A.** Compute term/offset statistics the concordance path already has and the
MiniSearch path can derive from the query terms, rank within each source group, and break ties
deterministically. The snippet shown for each result centers on the best-ranked match (the
sentence containing the first/strongest match), not merely the earliest offset.

## Risks / Trade-offs

- **[The two paths drift again after this change]** → Put normalization, ranking, and
  highlight-offset computation in shared helpers used by both paths, and add a golden test that
  runs the same query through the MiniSearch path and the concordance path and asserts equal
  passage IDs and equal highlighted spans (spec: "Both search paths agree" / "highlight
  identically").
- **[Index rebuild required and easy to forget]** → `static/index/` is gitignored and derived;
  every normalization/tokenizer/corpus change must run `npm run build:index` (already part of
  `npm run build`). Add a check that fails when the emitted `index-meta.version` does not match
  a fresh hash of the corpus inputs, so a stale index cannot ship silently.
- **[Corpus edit changes the index version and citations]** → After correcting
  `big-book-2ed-chapter-6-into-action-p0142`, run `npm run validate:corpus` and
  `npm run verify:citations`; the change is source-data-only and reversible.
- **[Stemming/prefix/fuzzy reintroduces false positives]** → Keep exact matching for result
  candidates; restrict prefix/fuzzy to suggestions and ranking. Defer any stemmer (see Open
  Questions) to keep both paths exact and aligned.
- **[Suggestion cost on ~9k term keys]** → Prefix lookup via the sorted key list (binary
  search); bound did-you-mean by term-length buckets and a max candidate count; compute outside
  the search debounce so search latency is unaffected. Keep the work light so the search worker
  stays focused on search execution.
- **[Accessibility regression in the search box]** → Build suggestions as a proper combobox
  (listbox roles, `aria-activedescendant`, keyboard nav, Escape to dismiss); the existing input
  and debounced search behavior are preserved.
- **[Disagreement over the "right" KWIC window for protected sources]** → Follow the PRD
  display-mode rules (whole-sentence context for `full-text`; `contextWords` **total** for
  `snippet`, capped at ~30 words; `contextWords` **each side** for `concordance-only`); the
  copyright rule (never full text) is non-negotiable and overrides any preference for longer
  windows.

## Migration Plan

No data migration. Implementation order: (1) land the shared normalizer and align both paths,
(2) correct the corpus passage and rebuild the index, (3) parser/sentence/highlight/snippet
correctness, (4) suggestions, (5) synonym concept groups, (6) ranking, with the golden-file and
two-path-parity tests added alongside each area. Rollback is `git revert` plus
`npm run build:index` — the index is derived and gitignored, so no committed data needs undoing.

## Open Questions

- **Stemmer or not.** Whether to add a light English suffix stemmer (applied to the concordance
  at build time as well) can be decided during implementation against the golden-query set; the
  spec requires normalization symmetry and retrievability, not stemming, so deferring does not
  change the specs.
- **Suggestion ranking weights and whether to add `terms.json`.** The exact blend of prefix,
  frequency, edit-distance, and related-term scoring (and whether a small `terms.json` output is
  warranted) can be tuned during implementation without changing observable requirements.
- **Corpus fix mechanism.** Whether `p0142` is corrected by hand or by repairing the ingest
  pipeline is an implementation detail as long as the observable outcome (no leaked header,
  correct page reference) holds.
