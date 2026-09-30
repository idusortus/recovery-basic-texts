# Design

## Context

See `proposal.md` — Why. Current state that shapes the approach:

- `src/routes/+page.svelte` renders each search result's snippet with
  `{@html result.kwic}` (already-escaped `<mark>` markup). Its "View passage" link
  (`~lines 687-692`) is shown only when `group.source.displayMode === 'full-text'` and
  points at `/passage/{result.passage.sourceId}/{result.passage.id}` with no query.
  `syncUrl(q)` (`~lines 163-168`) already writes `q` and `phrase` to the home-page URL and
  is the convention to mirror.
- `src/routes/passage/[sourceId]/[passageId]/+page.svelte` renders, for a `full-text`
  source, every passage in the same chapter as plain text (`{cp.text}` inside
  `<p id="passage-{cp.id}">`, `~lines 204-214`); the target passage gets a subtle ring via
  `cp.id === passageId ? 'ring-1 ring-stone-300 …'`. After load it runs
  `await tick(); document.getElementById('passage-'+pid)?.scrollIntoView(...)` (`~lines
  87-90`). The route currently reads no query params. Protected sources render "Full text
  not available" plus the official-source link.
- `src/lib/search/kwic.ts` exposes `extractTerms(query)` and `buildFullKwic(text, query)`;
  the latter returns the full text with escaped `<mark>` highlights and an sr-only
  "highlighted:" prefix, and is used today for pinned Quick Reference results. Its output
  is HTML-escaped, so `{@html}` of it is safe. Note `extractTerms` is a naive whitespace
  split + lowercase and is **not** equivalent to search's matching path: it keeps
  punctuation and apostrophes, does not fold separators, and does not drop single-character
  tokens (so phrase `Gods will` would not match "God's will" through it). It must not be the
  passage page's highlight mechanism.
- `src/lib/search/match.ts` exposes `analyzePassage(text, phrases, keywords)`, which returns
  merged offset-based match ranges computed from the canonical tokenizer
  (`src/lib/search/normalize.js` `scanTokens`/`normalizeTerm`) — the same analysis that
  produces a search result's `result.kwic` offsets. For a whole chapter those offsets need a
  whole-text renderer, not the clipping KWIC builder: see "Highlight each passage…" below.
- `src/lib/search/kwic.ts`'s `buildKwicFromOffsets(text, offsets, 'full-text', …)` does **not**
  return the whole `text` when offsets exist: `resolveWindow` routes to `fullTextWindow`, which
  clips to `SENTENCE_CONTEXT = 2` sentences around the first match. It returns the whole text
  only when there are no offsets. It therefore cannot be the passage page's whole-chapter
  renderer. The only existing whole-offset renderer is the private `highlightByOffsets`
  (`~line 173`), currently unexported.
- `src/lib/search/index.ts` derives `phraseTokens`/`keywords` in the private `parseQuery`
  (`~line 215`) via the private `termsFromText` (`~line 202`); only `analyzePassage` is
  exported today, so the passage page currently has no shared way to derive them. Phrase mode
  (`phraseMode`, `~line 282`) matches the entire trimmed query as one run of adjacent
  normalized tokens (token adjacency, not a character substring), so phrase-mode highlighting
  must treat the query as a single phrase token run.
- `AGENTS.md` forbids auth/accounts/bookmarks/notes, forbids non-AA content, and forbids
  rendering full text for any source whose `displayMode` is not `full-text` (protected,
  `snippet`, and concordance-only alike).

## Goals / Non-Goals

**Goals:**

- A shareable passage URL that reproduces the search highlight and lands the user on the
  match.
- Render highlights from the same match path search uses (offset-based `analyzePassage` plus
  a whole-text renderer that reuses the shared escaping) rather than introducing a second
  highlighter.
- Keyboard and screen-reader users land on the highlighted passage.

**Non-Goals:**

- No new persistence store; the URL is the whole mechanism.
- No passage-view affordance or full-text rendering for a source whose `displayMode` is not
  `full-text`.
- No change to search matching/ranking or to the chapter rendering's citation, copy, or
  chapter-navigation behavior.

## Decisions

### New `passage-view` capability, not a change to `search-ui` or `search-quality`

The behavior being added is passage-page rendering and navigation. `search-ui`'s
requirements are specifically about filter-chip presentation, and `search-quality` is about
search over the prebuilt index (normalization, clipping, ranking). Neither owns the passage
page, so reusing either would misplace the requirements. The search page's link becomes the
entry point into `passage-view`; `search-ui`'s requirements are unaffected.
Alternative considered: fold the link change into `search-ui` and the rendering into
`search-quality`. Rejected because it splits one capability's behavior across two specs that
do not describe it.

### Persist via URL parameters `q` and `phrase`, mirroring `syncUrl`

The link carries `q` and, when exact-phrase mode is active, `phrase=1`, matching the home
page's existing `syncUrl` convention and `+page.svelte`'s on-mount restoration. This makes
the state survive reload, back/forward, and sharing with no storage.
Alternatives considered: `sessionStorage`/`localStorage` (not shareable, and a new
persistence surface the MVP avoids); a fragment such as `#highlight=…` (not part of the
project's URL convention and not read by the existing home-page code).

### Highlight each passage from the same match path as search (`analyzePassage`), rendered by a new full-text offset renderer

The passage page highlights offsets, not query text: it calls the same analysis the search
page uses — `analyzePassage(passage.text, phraseTokens, keywords)` from
`src/lib/search/match.ts`, which tokenizes with the canonical tokenizer
(`src/lib/search/normalize.js` `scanTokens`/`normalizeTerm`) and returns merged `[start, end)`
ranges.

Those offsets are rendered by a **new exported full-text offset renderer** in
`src/lib/search/kwic.ts`: add and export `buildFullTextHighlight(text, offsets)`
(alternative: export the existing private `highlightByOffsets` under the same signature). It
renders the **complete** `text` with **every** offset wrapped in `<mark>` (with the existing
sr-only "highlighted:" prefix) and all remaining text HTML-escaped — no clipping window, no
ellipsis. `buildKwicFromOffsets(text, offsets, 'full-text', …)` **cannot** serve this:
`resolveWindow` routes non-empty offsets for `full-text` to `fullTextWindow`, which clips to
`SENTENCE_CONTEXT = 2` sentences around the first match. Only offset-free input yields the
whole text, so following `buildKwicFromOffsets` as written would show matched paragraphs as
±2-sentence excerpts, violating the "every occurrence" requirement in
`specs/passage-view/spec.md` and the whole-chapter decision below. Evidence (reproduced with
`scripts/search-test-loader.mjs`): passage `big-book-2ed-chapter-6-into-action-p0142`
(1621 chars) with keyword `home` (4 offsets) renders 466 chars / 2 marks / a trailing ellipsis,
whereas `alcohol` (0 offsets) renders the full text.

`buildFullTextHighlight` must **not** alter existing clipping: `buildKwicFromOffsets`'s
windows for `snippet`/`concordance-only` and the `full-text` clipping used for search-result
snippets stay exactly as they are, and search-result rendering is untouched. The new renderer
is an additional whole-text path only.

`phraseTokens`/`keywords` are derived from the URL query through **one shared exported entry
point** — add and export `derivePassageParams(q, phrase)` (alternative: export the existing
private `parseQuery`/`termsFromText` and reuse them) in `src/lib/search/index.ts`, so the
passage page does not re-implement the query→params step and cannot reopen the divergence this
design removes. In phrase mode the query is one normalized-token run (`[termsFromText(q)]`);
otherwise keywords are `termsFromText(q)`. Every query term highlighted in the search result is
therefore highlighted here by construction, and no query text is ever injected.

**Known limitation — synonym-only matches are not highlighted.** The passage page derives its
highlight terms from `q`/`phrase` alone, whereas search also highlights the synonym terms that
caused a match (`highlightTerms` in `_rankAndGroup`, `src/lib/search/index.ts` ~L460-462). A
result matched *only* by synonym expansion therefore has no query term in its passage and gets
no highlight on the passage page; it falls back to the existing scroll + ring. This is a
deliberate scope decision (the URL carries `q` and `phrase` only), not an oversight. Revisit if
synonym-only results should stay highlighted: carry the matched highlight terms in the URL too.

**Known divergence — non-phrase quoted queries.** For a quoted query outside phrase mode the
passage page's highlight set is a *superset* of search's: search treats a quoted span as an
adjacent token run, while `derivePassageParams` tokenizes the whole query and highlights each
word independently. The page still highlights everything search highlights (Req 2's direction
holds), just without the same adjacency grouping.
Do **not** use `extractTerms`/`buildFullKwic` as the highlight mechanism: `extractTerms` is
a naive whitespace-split + lowercase that keeps punctuation and apostrophes, does not fold
separators, and drops nothing, so it is not equivalent to search's matching path (e.g.
phrase `Gods will` matches "God's will" in search but not through `extractTerms`;
`face-to-face` diverges too). If `buildFullKwic` stays referenced for the pinned Quick
Reference surface, that is a separate path — it is not passage-view highlighting.
Alternatives considered: reusing `buildKwicFromOffsets` with `displayMode: 'full-text'`
(rejected — it clips to ±2 sentences whenever offsets exist, so it cannot render the whole
chapter with highlights); a new passage-only highlighter (duplicates escaping logic and risks
diverging from search); highlighting with raw string replace (would bypass escaping and be
unsafe); treating phrase mode as a character substring (search uses normalized-token
adjacency, so a substring highlighter diverges on contractions and hyphenated words).

### Highlight scope: all rendered chapter passages, focus the target passage

The whole chapter is rendered, so highlighting every rendered passage whose text contains a
term keeps visible matches consistent and avoids a confusing "highlighted on the search page
but not here" gap. The scroll/focus target, however, is the passage the user clicked: the
first highlighted term **within the target passage** is scrolled to, and the target passage
receives focus.
Alternative considered: highlight only the target passage. Rejected because the same term
visibly recurs in adjacent chapter paragraphs and leaving those unmarked looks like a bug;
the focus target still keeps the view anchored on the clicked passage.

### Focus target and mechanics: focusable target paragraph, then scroll the first mark

The target passage `<p id="passage-…">` gets `tabindex="-1"` so it can receive programmatic
focus. On load with a query, the page calls `.focus({ preventScroll: true })` on the target
paragraph (to avoid the browser's own coarse scroll), then `scrollIntoView({ block: 'start'
})` on the first `<mark>` inside it, falling back to the paragraph when there is no mark.
The query path deliberately scrolls **immediately** (no `behavior: 'smooth'`) so the user
lands on the first highlighted term without a smooth animation racing the programmatic
focus. The no-query fallback keeps today's behavior, including its existing
`scrollIntoView({ behavior: 'smooth', block: 'start' })`, so the current page feel is
unchanged. A visible focus style is applied when the paragraph is focused (an outline/ring
pair that is a non-color cue, satisfying the spec), and the existing subtle ring on the
target passage is kept as the persistent "this is the passage you clicked" marker.
Alternatives considered: focus the first `<mark>` itself (marks are inline and not reliably
focusable, and focusing them moves the screen-reader cursor into the middle of a sentence);
focus the paragraph without `preventScroll` (the browser then scrolls to the paragraph top,
losing the "first highlighted term in view" requirement).

### Full-text-only guard is enforced at the link and re-asserted at the page

The link only appears for `full-text` sources (already true today), and the passage page
already branches on `source.displayMode === 'full-text'`; the highlight path is added only
inside that branch, so sources whose `displayMode` is not `full-text` continue to render
"Full text not available" and cannot highlight or emit full text.

## Risks / Trade-offs

- [Programmatic focus not matching `:focus-visible` in all browsers] → apply the visible
  focus style on the focused element's `.focus()` state (e.g. a state-driven class or
  `:focus`), not only on `:focus-visible`.
- [Phrase mode is normalized-token adjacency, not a character substring] → derive
  `phraseTokens` through the shared exported entry point (the whole trimmed query as one
  normalized-token run) and pin it with a test that compares phrase-mode highlighting on the
  passage page to the phrase-mode search result.
- [Using the clipping KWIC builder for the whole chapter would silently truncate matched
  paragraphs] → render via the new exported `buildFullTextHighlight`, and pin it with a test
  asserting the rendered plain-text length is preserved (no clipping) and every occurrence is
  marked, while `buildKwicFromOffsets`'s `snippet`/`concordance-only` clipping is unchanged.
- [Highlighting the whole chapter could be visually busy on common terms] → the focus/scroll
  target and ring keep the clicked passage prominent, and highlighting is only applied when
  a query is present.
- [Double scroll (focus then `scrollIntoView`) can fight] → focus with `preventScroll: true`
  and perform a single explicit `scrollIntoView` afterwards.
- [URL-only persistence means in-page chapter navigation loses the highlight] → acceptable;
  chapter navigation is a different reading intent, and the current chapter URL's query is
  preserved by normal link behavior only where the spec requires it (it does not).

## Migration Plan

No data, schema, or dependency migration. The change is confined to two Svelte routes plus a
new exported whole-text renderer (`buildFullTextHighlight`) and a shared query→params helper
(`derivePassageParams`) in `src/lib/search/`, reusing `src/lib/search/match.ts`
(`analyzePassage`). Rollback is reverting those files; passage URLs without `q`/`phrase`
already behave as before, so no compatibility window is needed.

## Open Questions

None that change the specs, approach, or task breakdown.
