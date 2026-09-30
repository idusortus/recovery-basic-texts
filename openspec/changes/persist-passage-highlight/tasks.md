# Tasks

> Tasks tagged **manual (browser)** need a running browser session (URL bar, focus ring,
> scroll position) and have no component/visual harness in this repo, so they must be left
> unchecked honestly if not run (see `decisions.md` 2026-09-30). Automatable (no browser):
> 2.1, 2.2, 5.1, 5.2, 6.1.

## 1. Carry the query on the "View passage" link

- [ ] 1.1 In `src/routes/+page.svelte`, build the full-text result's `href` as
      `/passage/{sourceId}/{passageId}?q=<encoded query>` plus `phrase=1` when `phraseMode`
      is active, mirroring `syncUrl`. **manual (browser)** — verify by running a search,
      activating "View passage", and confirming the destination URL carries `q` (and
      `phrase=1` in exact-phrase mode).
- [ ] 1.2 Confirm results whose source `displayMode` is not `full-text` are untouched: they
      still show "Read at official source" and no "View passage" link. **manual (browser)** —
      verify by inspecting a snippet/concordance-only/protected result after the change.

## 2. Highlight query terms on the passage page

- [x] 2.1 In `src/lib/search/kwic.ts`, add and export a whole-text offset renderer
      `buildFullTextHighlight(text, offsets)` that renders the **complete** `text` with
      **every** offset wrapped in `<mark>` (reuse the existing escaping and sr-only
      "highlighted:" prefix — e.g. export the private `highlightByOffsets`). It MUST render
      the whole text with no clipping window and no ellipsis. `buildKwicFromOffsets`'s
      `snippet`/`concordance-only` windows and its `full-text` clipping for search-result
      snippets, and all search-result rendering, MUST stay unchanged. Add a unit test (see
      5.1) asserting (i) the rendered plain-text length is preserved (no clipping/ellipsis)
      and (ii) every occurrence is marked.
- [x] 2.2 In `src/lib/search/index.ts`, add and export one shared entry point for deriving
      the highlight parameters — `derivePassageParams(q, phrase)` returning
      `{ phraseTokens, keywords }` (or export the existing private `parseQuery`/`termsFromText`
      and reuse them) — so the passage page does not re-implement search's query→params step.
      Phrase mode is one adjacent normalized-token run (`[termsFromText(q)]`); otherwise
      `keywords = termsFromText(q)`. Add a unit test (see 5.1) pinning both cases.
- [ ] 2.3 In `src/routes/passage/[sourceId]/[passageId]/+page.svelte`, read `q` (and
      `phrase`) from `$page.url.searchParams` and, inside the existing `full-text` branch,
      highlight each rendered chapter passage from the same match path as search: derive
      `{ phraseTokens, keywords }` via the shared entry point from 2.2, call
      `analyzePassage(passage.text, phraseTokens, keywords)` (`src/lib/search/match.ts`), and
      render its merged offsets through the whole-text renderer `buildFullTextHighlight`
      (`src/lib/search/kwic.ts`) via `{@html}`. Do **not** use `buildKwicFromOffsets` with
      `displayMode: 'full-text'` (it clips matched paragraphs to ±2 sentences) and do **not**
      use `extractTerms`/`buildFullKwic` — `extractTerms` is a naive whitespace split that is
      not equivalent to search's matching path. Put the
      `// eslint-disable-next-line svelte/no-at-html-tags` comment on the line before the new
      `{@html}` (compare `src/routes/+page.svelte:680`), or the lint step in 5.2 fails.
      **manual (browser)** — verify a passage URL with `?q=…` shows `<mark>` around the query
      terms in the rendered chapter text, renders the whole passage (no excerpt), and that the
      output is HTML-escaped.
- [ ] 2.4 Handle exact-phrase mode: when `phrase=1`, derive `phraseTokens` through the shared
      entry point (2.2) as the whole trimmed query in one run of adjacent normalized tokens
      (token adjacency, not a character substring) and highlight that run.
      **manual (browser)** — verify a `phrase=1` URL highlights the whole token run and a
      non-phrase URL highlights each term, matching the search page.
- [ ] 2.5 Confirm no highlight is emitted for an absent/empty `q`, and that sources whose
      `displayMode` is not `full-text` still render "Full text not available" with no
      highlighted full text. **manual (browser)** — verify by loading each URL variant.

## 3. Scroll to and focus the highlighted passage

- [ ] 3.1 Make the target passage focusable by adding `tabindex="-1"` to the
      `<p id="passage-{cp.id}">` element and add a visible focus style that is a non-color cue
      (outline/ring applied on the element's focused state, not `:focus-visible` only), while
      keeping the existing subtle target-passage ring. **manual (browser)** — verify the
      target paragraph can receive focus and shows the visible indication.
- [ ] 3.2 On load with a query, after `tick()`, focus the target paragraph with
      `preventScroll: true`, then `scrollIntoView({ block: 'start' })` on the first `<mark>`
      inside it (falling back to the paragraph when there is no mark). The query path scrolls
      immediately (deliberately no `behavior: 'smooth'`) so the scroll does not race the
      programmatic focus. This focus/scroll MUST run from the navigation-complete hook
      (`afterNavigate`, after SvelteKit's own scroll reset on client-side navigation) as well
      as after the render-time load, so entering from a search result's "View passage" link
      lands on the highlight exactly like a full page load; extract it into one idempotent
      helper called from both sites. Do NOT use `data-sveltekit-noscroll` or
      `disableScrollHandling()`. **manual (browser)** — verify the first highlighted term is in
      view and keyboard focus is on the target passage when entering BOTH via a search-result
      "View passage" click (client-side navigation) AND via a full reload of the same URL.
- [ ] 3.3 Preserve the current fallback: when there is no `q`, or the query has no occurrence
      in the target passage, scroll to and ring the target paragraph without moving focus to a
      highlight, keeping today's `scrollIntoView({ behavior: 'smooth', block: 'start' })`.
      **manual (browser)** — verify both cases against today's behavior.

## 4. URL reproducibility and guardrails

- [ ] 4.1 Verify the highlight and focus state reproduce from the URL alone on reload,
      back/forward navigation, and a URL opened in a fresh session; confirm no local storage,
      cookies, accounts, bookmarks, or notes are used. **manual (browser)**
- [ ] 4.2 Verify the guardrails in `AGENTS.md` hold: only public-domain `full-text` sources
      can render or highlight full text, sources whose `displayMode` is not `full-text` are
      unchanged, and no non-AA content or persistence surface is introduced. **manual (browser)**

## 5. Tests and validation

- [x] 5.1 Add focused unit tests for the highlighting path (offset reuse through
      `analyzePassage`, phrase-mode token adjacency, HTML escaping, and the non-`full-text`
      guard) to `scripts/test-search.mjs` or a new `scripts/test-*.mjs` run with
      `scripts/search-test-loader.mjs` (there are no tests under `src/lib/search/`); verify
      the new tests pass. Include the two assertions required by 2.1 — `buildFullTextHighlight`
      preserves the rendered plain-text length (no clipping/ellipsis) on an offset-bearing
      passage and marks every occurrence — and the `derivePassageParams` cases required by 2.2.
      Also assert `buildKwicFromOffsets`'s existing `snippet`/`concordance-only` clipping is
      unchanged.
- [x] 5.2 Run the project's build, type-check, lint, and test commands and verify they pass with
      **no NEW lint errors** (4 pre-existing lint errors on unrelated lines are accepted — one of
      them is in a file this change edits, on an untouched line — see `decisions.md` 2026-09-29
      and the `fix-daily-reflections-formatting` precedent); then run
      `openspec validate persist-passage-highlight --strict` and verify it
      reports the change as valid. **artifact amendment** — reworded from "verify they pass" to
      "no NEW lint errors" because `pnpm run lint` fails on those 4 pre-existing errors alone.

## 6. Correct stale phrase-mode comments

- [x] 6.1 Correct the contradictory comments in `src/lib/search/index.ts` that describe phrase
      mode as a substring: the `phraseMode` option doc (~line 250, "linear in-memory …
      substring scan") and the phrase-path banner (~line 281, "exact adjacent substring scan")
      now describe normalized-token adjacency, matching the implementation and `design.md`.
      Wording only — no behavior change.
