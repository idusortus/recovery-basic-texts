# Architectural Decisions

> One entry per locked-in choice. Reverse chronological. Concise — not an ADR template.

## Format

    ## YYYY-MM-DD — <decision title>
    **Context:** Why we needed to decide.
    **Choice:** What we chose.
    **Trade-offs:** What we gave up.
    **Revisit:** Trigger that would re-open this decision (or "never").

---

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
