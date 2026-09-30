# Architectural Decisions

> One entry per locked-in choice. Reverse chronological. Concise — not an ADR template.

## Format

    ## YYYY-MM-DD — <decision title>
    **Context:** Why we needed to decide.
    **Choice:** What we chose.
    **Trade-offs:** What we gave up.
    **Revisit:** Trigger that would re-open this decision (or "never").

---

## 2026-09-29 — Ingest roman header rule requires a front-matter title allowlist

**Context:** Hardening `ingest.py` Stage 3 for `fix-corpus-running-headers`, the roman rule matched any `[ivxlcdmIVXLCDM]{2,}` token adjacent to any all-caps run, gated only by `_is_roman_numeral`. That grammar accepts structurally-valid English words — `mix` is `M` + `IX` — so `MIX IT UP` near a page marker would be stripped as a front-matter page number, and the test's "not a valid numeral" comment was false.
**Choice:** The roman rules (`_RUNNING_HEADER_ROMAN_FIRST_RE`/`_LAST_RE`) now require adjacency to an explicit `_FRONT_MATTER_TITLES` allowlist (`FOREWORD TO THE FIRST EDITION`, `THE DOCTOR'S OPINION`, `CONTENTS`, `FOREWORD`, `PREFACE`), matched longest-first; `_is_roman_numeral` stays as a secondary check. The Node detector `running-header-utils.mjs` keeps its allowlist-only check (it never validated the numeral), so the two differ deliberately — the shared allowlist signal, not the numeral shape, is what prevents false positives.
**Trade-offs:** A front-matter heading absent from the list is not stripped by ingest until added (the regression test's broad, non-allowlisted scan still surfaces unknown candidates); appendix section headings (`II SPIRITUAL EXPERIENCE`) are no longer treated as roman page headers, which is correct because their roman token is a section number, not a page number.
**Revisit:** If a re-ingest surfaces a front-matter heading outside the list, or the corpus gains new front-matter sections.

## 2026-09-29 — Bound running-header detection to known titles (corpus repair)
**Context:** Implementing the `fix-corpus-running-headers` repair, the design's literal rules (`CAPS_RUN` = two or more ALL-CAPS tokens) would swallow the first body word of `2 ALCOHOLICS ANONYMOUS I took a night law course` — the greedy run absorbs the body word `I`, silently dropping it. The design already offered an "optional allowlist cross-check" for exactly this class of false positive.
**Choice:** Make the allowlist mandatory: the ALL-CAPS run adjacent to the page number is bounded to a fixed list of the 17 observed running titles (`corpus/scripts/running-header-utils.mjs` `RUNNING_TITLES`), matched longest-first. Applied to the committed corpus this still yields exactly 172 matches (79 Rule 1 + 78 Rule 2 + 15 Rule 3) with correct remainders, and the two `…ALCOHOLICS ANONYMOUS I…` passages now strip to `…ALCOHOLICS ANONYMOUS` + `I …` instead of eating the `I`.
**Trade-offs:** New/unknown header titles are not stripped until added to the list (the regression test's corpus scan uses a separate broad, non-allowlisted shape so unknown headers still surface as candidates).
**Revisit:** If a future re-ingest produces a header title not in the list, or the ingest pipeline itself starts stripping headers (tasks 6.x).

## 2026-09-29 — Untrack generated/local state, not just gitignore it
**Context:** A review added `.wrangler/` and `__pycache__/` to `.gitignore`, but six files under `.wrangler/state/v3/...` were already tracked (since June), so the ignore entry is inert and local `wrangler dev` state can still be committed. The repo likewise tracks `.venv/` (9,308 files) and a 62 MB `diff.txt`.
**Choice:** A `.gitignore` entry only prevents *new* files being tracked. Any artifact already tracked must be removed from the index (`git rm --cached -r <path>`, committing the deletion) before an ignore rule is considered effective.
**Trade-offs:** Untracking historical build/venv artifacts rewrites the working-tree index (though not history) and adds a one-time deletion commit.
**Revisit:** If a future pass wants to purge `.venv/`, `.wrangler/`, or `diff.txt` from history (e.g. filter-repo), revisit then.

---

## 2026-09-29 — Feedback hardening + stale 1st-edition cleanup (code review)
**Context:** A review found stale 1st-edition references (about page, `/sources` free links, LICENSE, PRD, backlog design) after the corpus moved to `big-book-2ed`, plus feedback-form hardening gaps: a silent Turnstile test-secret bypass, undocumented setup, ARIA errors not tied to their fields, and low-contrast helper text.
**Choice:** (1) `/sources` derives the Big Book free link from the registry (`allSources.find((s) => s.id === 'big-book-2ed')?.freeUrl`) instead of hardcoding 1st-edition URLs, so it cannot drift; the archive.org entry stays but is explicitly labelled an external 1st-edition scan. (2) Validation failures echo a server-computed `errorField` so the form sets `aria-invalid`/`aria-describedby` only on the affected input, without duplicating the validation rules client-side (SvelteKit forbids importing `$lib/server/*` into the component). (3) `verifyTurnstile` emits one `console.warn` per process when a published Turnstile test secret is configured. (4) README gains a "Feedback form (maintainers)" setup section; CONTRIBUTING points to it.
**Trade-offs:** The `fail(400, …)` payload gains one field the UI must echo; the sources page now depends on the `big-book-2ed` registry id (omits the link if absent).
**Revisit:** If a second Big Book edition is added, or the validator is changed to return structured per-field errors itself.

## 2026-09-29 — Anonymous in-app feedback → GitHub issues (Turnstile + KV rate limit)
**Context:** Backlog item 2.4 needs an in-app suggestion/bug path that files a labeled GitHub issue (`from-app` + `bug`/`suggestion`) in `idusortus/recovery-basic-texts`. The reference carpool flow (`2026-09-27-app-feedback-to-github`) is signed-in-only, but this repo's `AGENTS.md` forbids authentication/accounts, so the path had to be public.
**Choice:** A public `/feedback` route (`+page.server.ts` action) gated by server-verified Cloudflare Turnstile (checks `success`, `action === 'feedback'`, and `hostname` against `TURNSTILE_HOSTNAMES`) plus a best-effort per-IP KV fixed-window counter (`FEEDBACK_RATE_LIMIT`, key `rl:<ip>`, 5 min / 3 submissions, fail-open). The issue body is built from an explicit allow-list (`type`, `summary`, `details` + UTC timestamp + route + app version) so no name, email, IP, user agent, token, or secret can reach GitHub; secrets are read via `$env/dynamic/private`.
**Trade-offs:** Anonymity means weaker attribution/anti-abuse than the signed-in carpool version; the KV counter is eventually consistent and secondary to Turnstile; Cloudflare's always-pass test secret returns `hostname: example.com` with no action, so `verifyTurnstile` skips action/hostname checks when a known test secret is configured (local-dev only).
**Revisit:** If accounts are introduced, or abuse is observed despite Turnstile + rate limiting.

## 2026-09-29 — Declared the ESLint devDependencies its config already imports
**Context:** `pnpm lint` was broken: `eslint.config.js` imports `@eslint/js`, `typescript-eslint`, and `globals`, but none were declared in `package.json`. They resolved under npm's flat `node_modules` but not under pnpm's isolated layout, so `pnpm lint` threw `ERR_MODULE_NOT_FOUND`.
**Choice:** Add `@eslint/js@^9.39.4` (matching the installed ESLint 9), `globals@^17`, and `typescript-eslint@^8` to `devDependencies`.
**Trade-offs:** `package.json`/`pnpm-lock.yaml` grow and the lockfile changes; a few pre-existing lint errors in untouched files remain (out of scope to fix here).
**Revisit:** If the project migrates to ESLint 10, bump `@eslint/js` accordingly.

---

## 2026-09-29 — Bootstrap the agentic coding stack (OpenCode target)
**Context:** The repo had Copilot artifacts and AGENTS.md but no OpenCode agent team, CodeGraph index, or OpenSpec workflow. Needed a consistent agent-ready setup.
**Choice:** Target OpenCode (running under OpenCode), cli-five agent team pinned to the authenticated `opencode-go` provider, CodeGraph MCP + `.codegraph/` index, and OpenSpec with `--tools opencode` surfaces. Per-session memory (`STATE.md`, `agent-diary.md`, `histories/`) is gitignored; config/surfaces are tracked.
**Trade-offs:** Chose OpenCode over the repo's pre-existing Copilot artifacts (those were preserved, not removed, so both coexist). Agents use `opencode-go` models rather than a provider-agnostic default.
**Revisit:** If the team standardizes on Copilot instead of OpenCode, or a different provider is mandated.

## 2026-09-29 — Product backlog tracked as one long-lived OpenSpec change
**Context:** Known MVP gaps lived only in a loose `docs/plans/todo.md`; the team wanted them tracked alongside specs without adopting a separate tool.
**Choice:** A single umbrella change, `product-backlog`, stays open as the living backlog: items are enumerated as unchecked tasks grouped by theme, each with an observable "done when", and are promoted to their own spec'd change when picked up (`→ promoted to <change-name>`). Chosen over one-change-per-item (thin specs for vague items) and a plain `docs/` backlog (no OpenSpec tracking / the propose workflow the user invoked).
**Trade-offs:** The change never "completes" in the normal apply/archive sense while it holds future work, and its spec delta describes the backlog *practice* rather than app behavior. `docs/plans/todo.md` is superseded in intent but left untouched, so two lists briefly coexist.
**Revisit:** If the backlog outgrows one change's `tasks.md`, or needs priority ordering/ownership, move to per-item changes or an issue tracker.

## 2026-09-29 — In-app feedback adapted to anonymous + Turnstile
**Context:** A reference feedback→GitHub flow exists (carpool, `2026-09-27-app-feedback-to-github`), but it is signed-in-only and this repo's `AGENTS.md` forbids authentication/accounts.
**Choice:** The feedback backlog item specifies an **anonymous** path protected by server-verified Cloudflare Turnstile plus rate limiting, with a no-PII, server-built GitHub issue body (labels `from-app` + `bug`/`suggestion`) filed to `idusortus/recovery-basic-texts`.
**Trade-offs:** No user identity means weaker attribution/anti-abuse than the signed-in carpool version; the path leans entirely on Turnstile + rate limiting.
**Revisit:** If accounts are ever introduced, or abuse is observed despite Turnstile.

## 2026-09-29 — Big Book: 2nd edition only (drop the 1st edition)
**Context:** `corpus/sources.json` already carried only `big-book-2ed`, but stale `big-book-1ed` / 1st-edition references remained across the PRD, implementation plan, feature backlog, ingestion scripts, corpus guide, exception hints, and project-structure docs (backlog item 2.5).
**Choice:** The project's only Big Book source is `big-book-2ed` (2nd edition, 1955; public domain — copyright lapsed 1983), the most recent public-domain edition. All stale 1st-edition references were reconciled to match: docs/plans (PRD, implementation plan LUW 3, features-001 plan), `corpus/scripts/ingest.py`, `corpus/scripts/validate.js`, `corpus/CORPUS-GUIDE.md`, `corpus/known-exceptions.json` + `src/lib/corpus/exceptions.ts`, `corpus/sources.json`, `README.md`, and `QUICKSTART.md`. The sponsor hint now cites the 2nd-edition corpus containing zero occurrences of "sponsor"/"sponsee"/"sponsorship".
**Trade-offs:** We give up any 1st-edition concordance coverage; the frozen-passage-ID contract applies to `big-book-2ed` only. Corpus text within the ingested files (e.g. the Preface's own mention of "the first edition") is left verbatim as it is the book's own words.
**Revisit:** If a clean, license-safe use case for the 1st edition emerges; then add it as a separate source with its own frozen passage IDs rather than merging editions.

## 2026-09-29 — App `GITHUB_TOKEN` sourced from `gh auth token` (over-privileged; replace later)
**Context:** The feedback feature files issues via a server-side secret. GitHub has no CLI/API to mint a fine-grained PAT (browser only), and the mandate was to provision from the CLI with `gh` + `wrangler`.
**Choice:** Set the Pages production secret `GITHUB_TOKEN` from `gh auth token -u idusortus` (account-wide; scopes gist / read:org / repo / workflow). It works today.
**Trade-offs:** Broader than needed (can act across the user's repos) and coupled to the `gh` login — rotating/revoking `gh` breaks the app. Replace with a repo-scoped fine-grained PAT (Issues: Read and write on `idusortus/recovery-basic-texts`).
**Revisit:** Before heavy production use, or if the `gh` login is rotated.

## 2026-09-29 — Search overhaul planned as one broad `search-quality` change (promotes backlog 1.1–1.5)
**Context:** Search is the core surface but is the MVP's weakest area: contraction matching is asymmetric (`normalizeForSearch` normalizes the query while MiniSearch tokenizes with defaults and `build-index.mjs` normalizes the indexed fields separately), `tornado` is reported unretrievable, parsing/sentence-splitting/KWIC snippets are "a bit off", and there are no suggestions, weak synonym grouping, and no relevance ranking. The gaps were tracked as backlog items 1.1–1.5.
**Choice:** One OpenSpec change, `search-overhaul` (new capability `search-quality`, ADDED requirements only; `proposal.md` + `specs/search-quality/spec.md` + `design.md` + `tasks.md`), covering six areas: (1) one shared normalization applied identically to query and index (recommended: a single ESM normalizer module imported by both the build scripts and the app, plus MiniSearch `tokenize`/`processTerm`); (2) the `tornado` miss diagnosed as tokenizer/normalization drift plus the leaked page-header/`pageRef` merge defect in `big-book-2ed-chapter-6-into-action-p0142`, fixed in the corpus and rebuilt; (3) parser/sentence-split/KWIC correctness with offset-based highlighting on both paths and display-mode-aware clipping; (4) non-blocking, locally derived search-box suggestions (concordance term dictionary prefix + bounded edit-distance, optional MiniSearch `autoSuggest`); (5) symmetric concept groups extending `corpus/synonyms.json`; (6) one shared relevance score with deterministic tie-breaks. Backlog 1.1–1.5 annotated `→ promoted to search-overhaul` and left unchecked.
**Trade-offs:** Keeps the prebuilt client-side index and rejects server-side search, embeddings, and new runtime dependencies (flagged as non-goals); the two search paths must stay behaviorally aligned, so normalization/ranking/highlighting are shared helpers verified by two-path parity tests; any normalization/tokenizer/corpus change requires `npm run build:index` (index is gitignored/derived). A light stemmer, suggestion weighting, and the exact corpus-fix mechanism are left as deferrable open questions.
**Revisit:** If the two paths drift again despite shared helpers, or if the corpus outgrows the client-side index (then revisit server-side search per PRD §5.2).

## 2026-09-29 — One canonical normalizer `.ts` module + Node-loader test seam (search-overhaul Area 1)

**Context:** Search normalization was duplicated and asymmetric across `src/lib/search/index.ts` (`normalizeForSearch`), `corpus/scripts/build-index.mjs` (`normalizeForIndex`), `corpus/scripts/concordance-utils.mjs` (`normalizeToken`) and the search service (`_normalizedTerm`), while MiniSearch `tokenize`/`processTerm` stayed at defaults — so contractions and punctuation did not match symmetrically between the two search paths.
**Choice:** A single `src/lib/search/normalize.ts` with no imports (no `$lib`, no Node/browser APIs), imported by all four consumers via relative/`./` paths. Exposes `normalizeTerm`, `normalizeString`, `scanTokens`, `tokenize` and `processTerm`; MiniSearch gets the custom `tokenize`/`processTerm`, and the concordance path tokenizes queries through the same functions. Chose a `.ts` module (Node 24 type-stripping, already used by `scripts/test-feedback.mjs`) over the design's `.js`+JSDoc fallback so the app keeps real types. To test the *real* app search module (two-path parity) without a test framework or bundler, added `scripts/search-test-loader.mjs`, a Node ESM loader (built-ins only) that resolves `$lib`, extensionless imports and JSON-without-attributes; `scripts/test-search.mjs` registers it and drives both paths.
**Trade-offs:** Test imports rely on Node's experimental-ish type stripping and a custom loader rather than plain `node file.mjs`; the loader is the only piece that knows about `$lib`. The canonical module must never grow runtime imports or it will break the Node build scripts.
**Revisit:** If Node changes type-stripping defaults or the app moves off `$lib`, replace the loader with the platform's module resolution; if a bundler-based test runner is adopted, the loader can go.

## 2026-09-29 — Big Book `pageRef` is the PDF page; `p0142` keeps `p.103`

**Context:** Task 2.2 asked to set `big-book-2ed-chapter-6-into-action-p0142`'s `pageRef` to "the page the text actually occupies (p.82 per the reported bug)" while also saying to verify against the surrounding passages. The reported bug (`docs/plans/todo.md`) calls the passage "Into Action p.82", and a stale PRD line claims Big Book page refs were "corrected to book page numbers (offset -21 from PDF)".
**Choice:** Keep `pageRef` `p.103`. The Big Book corpus numbers `pageRef` by PDF page — `corpus/raw/big-book-2ed-chapters.json` states "PDF page = book page + 21", `big-book-2ed.pagemap.json` maps `corpusPageRef p.79` ↔ `printedPage 58`, and the passage's neighbours are `p.102`/`p.104`. So the passage printed on book page 82 is corpus page `p.103`. Only the leaked `82 ALCOHOLICS ANONYMOUS` header was removed — that was the real defect. (The sibling 12&12 corpus does use printed pages; the two sources are inconsistent, but that is a separate corpus-wide issue, not this passage.)
**Trade-offs:** The app shows `p.103` for a passage a reader knows as page 82; making Big Book page refs book-numbered is a corpus-wide migration (or an app-side pagemap translation) and was out of scope.
**Revisit:** If users report page refs widely, migrate the Big Book corpus to printed pages (or translate via the pagemap at render time) as its own change.

## 2026-09-29 — Shared match/ranking module + display-mode clipping (search-overhaul Areas 3 & 6)

**Context:** Query parsing split phrases/keywords without the shared tokenizer, quoted phrases were AND-matched anywhere (not adjacent), `splitSentences` had an inverted abbreviation-merge (so `Dr. Bob` split wrongly) and no numbered-list handling, the MiniSearch path highlighted by regex while the concordance path used offsets (so the two paths could differ), clipping ignored `displayMode`/`contextWords` (always 2 sentences), and results were ordered by corpus sequence only.
**Choice:** Added `src/lib/search/match.ts` — one `analyzePassage(text, phrases, keywords, highlightTerms?)` that returns merged match offsets, a best-match `anchor`, coverage/phrase/frequency/proximity stats, and `scoreMatch()` (coverage >> phrase >> proximity >> frequency). Both paths build candidates (exact AND, quoted phrases verified adjacent) and share `_rankAndGroup()`, so matching, highlighting, ranking and tie-breaks are identical. Rewrote `kwic.ts`: range-based `splitSentenceRanges` (abbreviation/initial/acronym/numbered-list aware), offset-based highlighting, and clipping that honors display mode — `full-text` sentence context, `snippet` ≤ `min(contextWords,30)` words total (sentence-aligned when it fits, else word-boundary), `concordance-only` `contextWords` each side — with a guard that never renders a protected passage's full text even when it fits the bound. Snippets center on `analyzePassage().anchor` (densest window), not the earliest offset. Synonym-matched passages carry their synonym terms as `highlightTerms` so they are highlighted on the term that actually matched (never falling back to full text).
**Trade-offs:** Synonym *lookup* still uses the raw bare words (`synonymKeys`) to preserve pre-existing Area 5 semantics; tokenizing keywords for matching means `god` now finds `god.` as a keyword, but synonym expansion for punctuation variants is unchanged (Area 5 owns the asymmetry). Ranking weights are a hand-tuned single number; the invariants (coverage dominates, ties by sequence) are covered by tests rather than documented thresholds.
**Revisit:** When Area 5 lands, replace `synonymKeys` with tokenized synonyms and align the two paths' synonym expansion.

## 2026-09-29 — Suggestions from the concordance dictionary + symmetric concept groups (search-overhaul Areas 4 & 5)

**Context:** The search box had no autocomplete/did-you-mean; the design allowed deriving suggestions from the already-loaded concordance term dictionary or adding a `terms.json` artifact. Synonyms were pairwise but lookup was one-directional (though the God group was already present as values), so searching a term that only appeared as a value never expanded; multi-word synonyms failed on the concordance path (single-key lookup) while MiniSearch used OR, so the two paths disagreed.
**Choice:** `src/lib/search/suggestions.ts` builds a `SuggestIndex` (terms sorted + length buckets) once per loaded concordance and ranks: prefix matches via binary search by term frequency (total indexed occurrences — no `terms.json` needed), then bounded Levenshtein did-you-mean over length-neighbour buckets. `getSuggestionTerms()` in the search service returns [] until the concordance is loaded. `getSynonymTerms` now treats `corpus/synonyms.json` as an undirected graph and returns the whole connected component (symmetric), with the God group's members made explicit in the data. Both search paths tokenize each synonym term through the shared normalizer and AND-match it (concordance intersects the token postings; MiniSearch searches with `combineWith:'AND'` and re-verifies with `analyzePassage`). The UI input is an ARIA combobox (listbox/option roles, `aria-activedescendant`, ArrowUp/Down/Enter/Escape, blur dismissal) that refreshes suggestions synchronously on input while the 150ms debounced `search()` schedule is untouched. The copy citation is built from `buildExcerpt` (full text for `full-text`, the displayed clipped window otherwise) and Copy is now offered for protected sources too.
**Trade-offs:** No related-term suggestions (task 4.1 scopes prefix + did-you-mean); ranking uses term frequency as an occurrence-count proxy rather than a curated weight. The reciprocal duplicate entries in `synonyms.json` are redundant with the graph expansion but keep the group self-describing.
**Revisit:** Add related-term suggestions (synonym map) and frequency weighting if users want them; drop the explicit reciprocal entries if the graph lookup proves sufficient alone.

## 2026-09-29 — Index version hash must cover the index-building/tokenizer code, not just corpus inputs

**Context:** Review of `search-overhaul` found `corpus/scripts/build-index.mjs` computes `index-meta.version` as a SHA-256 of the enabled corpus source files plus `corpus/sources.json` only. `design.md` claimed the rebuild "also bumps the version hash for cache-busting" and proposed a check that fails when `index-meta.version` does not match a fresh corpus hash, but neither holds: a change to `src/lib/search/normalize.ts` (the shared tokenizer/normalizer) or the MiniSearch/concordance index format leaves the version unchanged, so a client with the old `static/index/*` cached can run new query code against a stale, format-incompatible index with no cache-bust signal. Task 1.4's "version changes" was satisfied only incidentally by the concurrent `big-book-2ed` corpus edit.

**Choice:** The index version must be a hash of *everything that determines the index's on-disk format and token content* — the corpus inputs **and** a tokenizer/index-schema version (e.g. hash `src/lib/search/normalize.ts`, or bump a hand-maintained `INDEX_SCHEMA_VERSION`) — so any normalizer/tokenizer change forces a new version and invalidates cached clients. The proposed "fresh hash vs emitted version" guard-check remains unimplemented and should be added (e.g. in `validate:corpus` or `test:search`).

**Trade-offs:** Hashing source code on every build is slightly less stable across machines than a hand-maintained integer, but a hand-maintained version can be forgotten; pick one and keep it in the build script. This intentionally narrows the design's stated (but currently false) cache-busting guarantee.

**Revisit:** When a stale-index guard is actually added, or if the client index gains a formal schema/version field.

## 2026-09-29 — Review fixes: version covers the tokenizer, plain-ESM normalizer, stale-index guard

**Context:** Four review findings on `search-overhaul`: (1) `index-meta.version` hashed only corpus JSON, so a tokenizer change would not invalidate cached clients (and the design's proposed stale-index guard was missing); (2) `build-index.mjs`/`concordance-utils.mjs` imported `src/lib/search/normalize.ts`, making `npm run build` require Node type-stripping (≥22.18) with no Node pin, a deploy risk on Cloudflare Pages; (3) the task 2.1 note self-contradicted ("not stale… therefore stale index"); (4) dead `searchOptions: { prefix:false, fuzzy:0.15 }` in the builder, and the corpus-validate workflow did not trigger on the shared normalizer.
**Choice:** Fix 2 route: the design's **primary option** — converted `normalize.ts` to a plain ESM `src/lib/search/normalize.js` (JSDoc-typed, native Node import, Vite bundles the same file) rather than pinning Node; `svelte-check` stays green via the existing `allowJs`/`checkJs`. Fix 1: added `corpus/scripts/index-version.mjs` exporting `INDEX_SCHEMA_VERSION` and `computeIndexVersion(repoRoot, registry)`, which hashes corpus inputs + schema + the builder/tokenizer code (`build-index.mjs`, `concordance-utils.mjs`, `normalize.js`); `build-index.mjs` uses it, and `validate.js` re-derives it and **fails** when the emitted `index-meta.version` is stale (skips when no index exists, so CI corpus validation without `static/index` still passes). Fix 4: removed the dead `searchOptions`; widened `.github/workflows/corpus-validate.yml` to `src/lib/search/**`. Fix 3: rewrote the 2.1 note to drop the stale-index conclusion.
**Trade-offs:** Hashing the builder itself means any edit to `build-index.mjs` bumps the version (a rebuild is expected anyway); `test:search`/`test:feedback` still import `.ts` via Node type-stripping (dev/CI-only, not the deploy path).
**Revisit:** If the version should be a hand-managed integer instead, replace `BUILD_INPUTS` hashing with an explicit bump discipline; if `static/index` is ever committed, the guard becomes a hard CI gate rather than a local check.
