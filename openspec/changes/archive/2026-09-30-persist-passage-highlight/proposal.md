# Proposal: Persist passage highlight

## Why

On the search page, a full-text result's "View passage" link opens the whole chapter with
the clicked paragraph merely ringed — it carries no query, so the terms the user searched
for are not highlighted and the view does not land on the match. The user must re-find the
passage by eye. Persisting the query in a shareable URL and highlighting and focusing the
match makes "View passage" land on the reason the user clicked.

## What Changes

- **Carry the query into the passage URL.** The full-text result's "View passage" link
  navigates to `/passage/{sourceId}/{passageId}` with the active query in the URL — `q`
  for the query text and `phrase=1` when exact-phrase mode is on — mirroring the home
  page's existing `syncUrl` convention so the state survives reload, back/forward, and
  sharing.
- **Highlight the query on the passage page.** The passage page reads `q` (and `phrase`)
  and highlights the query terms across the complete rendered chapter text from the same
  offset-based match path search uses (`analyzePassage`, rendered through a new whole-text
  offset renderer that reuses the existing escaping), so the query terms search highlighted
  are highlighted on the passage page with the same offsets and the same escaping rules,
  without clipping the chapter. Known limitation: search also highlights the synonym terms
  that caused a match, while the passage page derives its terms from `q`/`phrase` alone, so a
  result matched only by synonym expansion has no query term in its passage and gets no
  highlight there (it falls back to the scroll + ring). Carrying the matched highlight terms
  in the URL is a deliberate scope decision not taken here.
- **Scroll to and focus the match.** On load the view scrolls the first highlighted term
  within the target passage into view and moves keyboard focus to the target passage
  (programmatic focus via a focusable paragraph plus a visible focus style), so
  keyboard and screen-reader users land on the highlighted text rather than the chapter
  top.
- **Fall back to today's behavior when there is nothing to highlight.** With an absent or
  empty query, or no query term present in the target passage, the page keeps its current
  behavior: scroll to and ring the target passage, no highlight.
- **Full-text results only.** Sources whose `displayMode` is not `full-text` are unchanged:
  they keep "Read at official source" and never render full text.

Non-goals:

- Not adding a passage-view affordance for a source whose `displayMode` is not `full-text`,
  and not rendering their full text (per `AGENTS.md`).
- Not adopting a persistence mechanism other than the URL (no local storage, cookies,
  accounts, bookmarks, or notes).
- Not changing search matching, ranking, or snippet behavior, or the home page's `q` /
  `phrase` handling.

## Capabilities

### New Capabilities

- `passage-view`: The passage page renders a full-text source's chapter with the query's
  terms highlighted, scrolls to and focuses the highlighted target passage, and
  reproduces that highlight and focus from the URL — while never rendering full text for a
  source whose `displayMode` is not `full-text`.

### Modified Capabilities

- None that this change alters. `search-ui` governs the filter-chip presentation and
  `search-quality` governs search over the index; neither owns passage rendering or
  passage-page navigation. This change does add behavior alongside `search-ui` — the search
  page's "View passage" link becomes the entry point into the new capability — but that link
  change alters no existing `search-ui` requirement, so no `search-ui` delta is proposed.

## Impact

- **Search page** (`src/routes/+page.svelte`): the full-text "View passage" link builds its
  `href` with `q` (and `phrase=1` when active) instead of a bare path.
- **Passage page** (`src/routes/passage/[sourceId]/[passageId]/+page.svelte`): read `q` /
  `phrase`, render chapter passages with highlighted terms, and scroll/focus the match.
- **Shared highlight helpers** (`src/lib/search/match.ts`, `src/lib/search/kwic.ts`,
  `src/lib/search/index.ts`): `analyzePassage` for offset-based matching, a new exported
  whole-text renderer (`buildFullTextHighlight`) for escaped rendering of the complete
  passage, and a shared query→params helper (`derivePassageParams`) so phrase/keyword
  derivation matches search. `buildKwicFromOffsets` is **not** used for the whole chapter
  (its `full-text` window clips to ±2 sentences when offsets exist). The naive
  `extractTerms`/`buildFullKwic` pair is **not** the highlight mechanism (it is not
  equivalent to search's matching path).
- **No** API, data, corpus, dependency, schema, or config changes. No auth, bookmarks,
  notes, or non-AA content.
