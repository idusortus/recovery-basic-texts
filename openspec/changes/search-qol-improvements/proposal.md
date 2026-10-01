# Proposal: Search QoL improvements

## Why

Four small usability gaps in the shipped search surface make the tool harder to
use day to day: a search cannot be repeated without retyping it, browser Back
from a passage drops the user at the top of a freshly re-rendered result list
instead of where they were, a result card's page number is missing even when
the corpus has one, and the result-card Copy control is named "Copy excerpt to
clipboard" (its visible label is just "Copy") even though a full-text source
copies the whole passage. Each is independent, none touches the
corpus or the search algorithm, and all four live behind the same surface, so
they ship as one change.

## What Changes

- **Recent searches (local only).** Persist the last ~8 distinct submitted
  queries in `localStorage` under a namespaced key. Show a small "Recent" row
  beneath the search input on the home/empty state; one tap re-runs that query.
  Deduplicate case-insensitively keeping the most recent, cap the list, and
  offer a clear control. **Local only** — the list is never transmitted, logged,
  or synced; no account is involved.
- **Back-to-search restoration (scroll + query).** After opening a passage from
  a scrolled result list and pressing browser Back, the user returns to the
  results with the same query **and** approximately the same scroll position.
  Query state already lives in the URL (`q`/`phrase`/`sources`); the actual gap
  is scroll restoration across SvelteKit client navigation, which the framework
  attempts but loses because results render asynchronously after the index
  loads.
- **Page reference on result cards.** Show each result's passage page reference
  (e.g. `p.58`) on the card header, next to the existing chapter label, for
  sources that carry one; omit it cleanly when absent (e.g. Daily Reflections).
  Existing copy/citation behavior is unchanged.
- **Copy-label accuracy.** The result-card Copy control's visible label is just
  "Copy" and its accessible name is "Copy excerpt to clipboard", but for
  `full-text` sources it copies the entire passage (`buildExcerpt` returns the
  whole passage for full-text). Make the visible label and accessible name
  truthfully describe the payload: full-text → "Copy passage", snippet/
  concordance-only → "Copy excerpt".

Non-goals:

- No authentication, accounts, bookmarks, or notes (AGENTS.md guardrails).
- No full-text rendering or copying for protected/concordance-only sources; the
  existing `displayMode` copy/render guard is unchanged.
- No change to the search algorithm, ranking, index format, corpus, or source
  registry.
- No non-AA content, no sync, no server-side storage of user state.
- No visual redesign: the recent row and page-ref label follow the existing calm,
  accessible, mobile-first presentation.

## Capabilities

### New Capabilities

- None. Every behavior here extends the existing search surface.

### Modified Capabilities

- `search-ui`: adds recent searches (local, clearable), back-to-search query +
  scroll restoration, a page reference on result cards, and a Copy label /
  accessible name that matches the copied payload.

## Impact

- **Search surface:** `src/routes/+page.svelte` (recent row, snapshot/scroll
  restoration, result-card header, Copy control label).
- **New pure helpers (testable):** `src/lib/search/recent-searches.ts`
  (add/dedupe/cap/parse/serialize/clear) and `src/lib/search/result-label.ts`
  (page-ref formatter and display-mode copy-label selector).
- **Tests:** new dependency-free `pnpm run test:recent-searches` and
  `pnpm run test:result-label` scripts in `package.json`; scroll restoration is
  verified `manual (browser)` because this repo has no headless browser.
- **Corpus / schema / dependencies / API:** none. No new runtime dependency, no
  schema change, no logging change.
- **Passage page:** expected to need no change; investigated in design.md.
