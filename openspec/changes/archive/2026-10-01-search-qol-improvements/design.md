# Design

## Context

See `proposal.md` — Why. Current state and constraints that shape the approach:

- **Query state already lives in the URL.** `src/lib/search/url-state.ts`
  (`serializeSearchUrl`/`parseSearchUrl`) carries `q`, `phrase=1`, and `sources`;
  `src/routes/+page.svelte` restores them in `onMount` and rewrites them with
  `goto(..., { replaceState: true })`. So the only missing half of "back to
  search" is the scroll position.
- **The result list renders asynchronously.** `+page.svelte`'s `onMount` calls
  `await loadSearchIndex()` and only then runs the search, so for a period after
  the route is entered the document is short and the result list is empty.
- **SvelteKit does restore scroll on history navigation, but too early.** In
  `node_modules/@sveltejs/kit/src/runtime/client/client.js`, a history navigation
  restores the entry's scroll (`scrollTo(scroll.x, scroll.y)`, ~line 2006)
  *before* the async index/results have rendered; the browser clamps that to the
  short, still-empty document. The results then render, but the scroll position
  stays where it was clamped. `restore_snapshot` runs afterwards for `popstate`
  only (~line 2047). So this is not "SvelteKit scroll restoration is off"; it is
  "restoration runs before the content it should restore to exists".
- **Copy payload mapping lives in `buildExcerpt`.** `src/lib/search/kwic.ts`'s
  `buildExcerpt` returns the whole `text` for `displayMode === 'full-text'` and
  the clipped window for `snippet`/`concordance-only`; `src/lib/search/index.ts`
  uses it to build `result.citation`. The result card's Copy currently renders
  the visible label `Copy` and `aria-label="Copy excerpt to clipboard"`
  (`+page.svelte` ~837–839), which is wrong for full-text.
- **Page reference is already on the passage.** `Passage.pageRef` (e.g. `p.58`)
  is loaded in `passages.json` and already feeds `buildCitation`; Daily
  Reflections entries carry `null`. The card header (`+page.svelte` ~817–831)
  shows the source/edition/chapter line but not the page reference.
- **Guardrails.** `AGENTS.md` and the PRD forbid auth/accounts/bookmarks/notes,
  forbid rendering or copying protected full text, and require accessible, calm,
  mobile-first presentation. This repo has no headless browser, so visible
  behavior is verified `manual (browser)`; pure logic is covered by
  dependency-free `test:*` scripts (Node type-strips `.ts`, as
  `scripts/test-url-state.mjs` already does).

## Goals / Non-Goals

**Goals:**

- Let the user repeat a recent search with one tap, without an account and
  without the list leaving the device.
- Return the user to the result list with the same query and approximately the
  same scroll position after browser Back, by holding the offset until the
  async results have rendered.
- Show the passage's page reference on the card when it exists, and omit it
  cleanly when it does not.
- Make the Copy label and accessible name match what is actually copied.

**Non-Goals:**

- No new capability and no change to `app-shell`: these are requirements of the
  search surface, not app-wide shell chrome (see Decisions).
- No change to search matching/ranking, the index format, the corpus, or the
  `displayMode` render/copy guard.
- No change to what Copy puts on the clipboard — only how the control describes
  it.
- No persistence beyond browser-local recent queries and the existing URL/history
  state; no server, account, or sync.

## Decisions

### All four requirements live in `search-ui`; `app-shell` is not modified

Every requirement here is about the search surface and its results view:
recent-query affordances, restoration of the results view, the result card's
header, and the result card's Copy control. `search-ui` already owns all of
these (`search-ui/spec.md` owns the filter chips, result-card Copy/Share
confirmation, result headings, zero-result state, etc.).

`app-shell` was considered for the scroll restoration because back/forward is a
navigation concern, and rejected: `app-shell`'s purpose is route-agnostic shell
guarantees shared by every route (styled error page, mobile nav overlay, single
toast live region, single install-prompt init), and its requirements are
described as app-wide. Scroll restoration of the *search results* depends on the
search surface's own async index/results lifecycle, which the shell does not
observe; placing it in `app-shell` would misplace a route-specific requirement
and split one behavior across two specs.

Because requirements are *added* to existing behavior (nothing existing changes),
the delta uses `## ADDED Requirements` only — no `MODIFIED`/`REMOVED`. The
existing "Copy and share confirm in place on the result card" requirement is
untouched; the new label requirement is a separate concern layered on it.

### Recent searches: pure list helpers + a thin localStorage adapter

Two new modules:

- `src/lib/search/recent-searches.ts` — pure, no runtime imports, directly
  importable by a dependency-free test (the `url-state.ts` pattern):
  `addRecentSearch(list, query, cap)`, `parseRecentSearches(raw, cap)`,
  `serializeRecentSearches(list)`, `clearRecentSearches(storage)`, plus
  `RECENT_SEARCH_KEY = 'basictexts-recent-searches'` and
  `RECENT_SEARCH_LIMIT = 8`. Add semantics: trim, ignore blank, case-insensitive
  dedupe keeping the newest casing, prepend, cap to the limit. Parsing is
  defensive (non-array/garbage → empty list), matching `parseSearchUrl`.
- The component holds a thin adapter that reads/writes `localStorage` under
  `RECENT_SEARCH_KEY` and degrades to an empty list / no-op when storage is
  unavailable (private mode), so search never breaks. Storage access is a
  component concern; the testable logic is pure.

Recording happens on an **explicit submit**: Enter, activating a topic chip or
a suggestion, or activating a recent entry — **not** on the debounced as-you-type
search, which would fill the list with prefixes. A zero-result submit is still
recorded (it was a submitted query).

Of those explicit submits, only Enter currently enqueues the anonymous usage log
(`+page.svelte`'s `handleKeydown`); `searchTopic` and `selectSuggestion` run the
search and sync the URL but do not log today, and this change does not add
logging to them. Activating a recent entry is pinned to mirror the Enter submit
exactly — run the search, sync the URL, call `submitLog`, and record/reorder the
recent — so re-running an entry is an ordinary submitted search and is logged
anonymously under the existing PRD §7.4 behavior. The **stored list** is never
passed to `submitLog`/`fetch` or any sync path; only the activated query string
is logged, exactly as typing it and pressing Enter would.

Alternatives rejected: storing on every debounced keystroke (noisy, captures
partial words); `sessionStorage` (does not survive the next visit, and the PRD
already uses `localStorage` for the theme); a server/account-backed history
(forbidden by AGENTS.md and the "never transmitted/synced" requirement);
persisting full result/scroll state alongside queries (more surface than
needed).

### Back-to-search: keep the query in the URL, carry the scroll offset in a SvelteKit `snapshot`, apply it after render

- **Query**: unchanged — reproduced from `q`/`phrase`/`sources` in the URL.
- **Scroll**: export a `snapshot` from `+page.svelte`:
  `capture: () => window.scrollY` (runs when navigating away, at
  `capture_snapshot`, client.js ~1863) and a `restore` that assigns the value to
  `pendingScrollY` (runs for `popstate` at `restore_snapshot`, client.js ~2047).
  `pendingScrollY` MUST be a Svelte `$state` variable, because `restore` runs
  after `onMount` — assigning a plain `let` there would not re-trigger the
  `$effect` that applies the offset. This ties the offset to the history entry,
  which is exactly the "return to where I was" semantics.
- **Ignore persisted snapshots on first load**: `restore_snapshot` (and
  `persist_state`) also run during hydration, so a hard reload of `/?q=…` can
  restore a persisted offset from this tab's session. A restored value is
  accepted only after a history navigation, not on the initial `enter`
  navigation — the `afterNavigate` `type` distinguishes them and runs before
  `restore_snapshot` — so a fresh visit starts at the top.
- **Apply after render**: a `$effect` watches the restored offset and the
  rendered results/`debouncedQuery`; once the results for the restored query have
  been computed it does `await tick()` then `scrollTo(0, pendingScrollY)` (an
  instant scroll, so it cannot race), then clears the pending offset. The instant
  apply overrides SvelteKit's earlier clamped restore. A restored query whose
  results are empty has nothing to scroll to and lands at the top (consistent
  with the "approximately" allowance).
- A fresh navigation (no snapshot value) leaves `pendingScrollY` unset, so the
  page behaves as today (starts at the top).

Alternatives rejected: relying on SvelteKit's built-in restore alone (the root
cause — it runs before async content exists); `afterNavigate` +
`sessionStorage` scroll tracking (manual keying across entries; leaks beyond the
entry; snapshot is the framework's per-history-entry mechanism and needs no new
storage key); giving the results container a fixed min-height so the early
restore has room (brittle across varying result counts and window sizes);
`data-sveltekit-noscroll` / `disableScrollHandling()` (disables framework
handling broadly; SvelteKit discourages the latter).

This is deliberately **search-surface only**; the passage page's own
`afterNavigate` focus/scroll (for entering a passage) is unrelated and needs no
change for returning to the search.

### Page reference: one pure formatter, rendered as a sibling of the heading

Add `formatPageRef(pageRef: string | null | undefined): string | null` to
`src/lib/search/result-label.ts` (pure, no runtime imports): return `null` for
absent/empty/blank; otherwise normalize a leading `p`/`p.` to the displayed
`p.<n>` form (the same normalization `buildCitation` already applies). Render
the formatted reference as a **sibling of the chapter label, outside the
result's `<h3>`** (in a small flex row with it, so it sits visually next to the
heading), only when non-null — no separator or dangling punctuation is emitted
for a missing value. Keeping the reference out of the heading preserves the
standing `search-ui` requirement "Results are navigable by heading"
(`openspec/specs/search-ui/spec.md:190`): the `<h3>`'s announced text is exactly
the source/edition/chapter line it is today, so the delta stays ADDED-only and
no existing requirement is modified. `buildCitation` is not modified.

Alternatives rejected: rendering the reference **inside** the `<h3>` (changes
the heading's announced text and overlaps the standing "Results are navigable by
heading" requirement); rendering `passage.pageRef` raw (it may already carry
`p.`, and a stray/blank value would render punctuation); putting the formatter
in `kwic.ts` (pulls the pure test into the search loader; a small no-import
module keeps the test dependency-free, like `source-accent.ts`).

### Copy label: a pure selector, used for both the visible label and the accessible name

Add `copyLabelFor(displayMode): string` to `src/lib/search/result-label.ts`:
`'full-text' → 'Copy passage'`, `'snippet' | 'concordance-only' → 'Copy
excerpt'`. The result card uses it for the visible label and for the accessible
name (e.g. `Copy passage to clipboard` / `Copy excerpt to clipboard`, so the
accessible name contains the same payload description as the visible label).
The payload is unchanged: `result.citation` is still built by `buildExcerpt`, so
full-text copies the whole passage and protected sources still copy only the
clipped excerpt. The existing in-place confirmation (`Copied ✓`) still replaces
the label on success and reverts to the mode-appropriate label.

Alternatives rejected: leaving the visible label as `Copy` and only fixing
`aria-label` (the visible label would still not describe the payload, which is
what the task asks to fix); relabelling full-text to `Copy` and protected to
`Copy excerpt` (asymmetric and less clear); changing the payload to make the old
label true (would change required copy behavior); a tooltip-only explanation
(not exposed on touch, and does not fix the accessible name).

### Testing strategy

- `src/lib/search/recent-searches.ts` and `src/lib/search/result-label.ts` are
  pure and import-free, so new dependency-free scripts
  `scripts/test-recent-searches.mjs` (`pnpm run test:recent-searches`) and
  `scripts/test-result-label.mjs` (`pnpm run test:result-label`) import them
  directly with `await import('../src/lib/search/<file>.ts')`, exactly like
  `scripts/test-url-state.mjs`. The recents test covers add/dedupe (case), cap,
  parse-defensive, serialize, and clear; it also scans `recent-searches.ts` for
  `fetch`/`enqueueLog` as a cheap regression guard on the local-only contract.
  The label test covers page-ref normalization/omission and the display-mode
  label selector.
- Scroll restoration and the visible surfaces (recent row, page ref, Copy label)
  have no pure seam and no headless browser here, so they are verified
  `manual (browser)` in `pnpm run dev`, plus a recents persistence/clear check
  across a reload.

## Risks / Trade-offs

- [Async results may render shorter than when the user left (e.g. a source
  filter changed), so the stored offset clamps] → the requirement says
  "approximately"; clamping to the new maximum is acceptable and matches
  browser behavior, and the offset is applied only once.
- [`goto(..., { replaceState: true })` fires on every keystroke, which could
  interact with snapshots] → `replaceState` does not add a history entry and
  SvelteKit restores snapshots only for `popstate`, so typing does not reset
  scroll; capture happens when navigating away.
- [A persisted snapshot could restore an offset on a hard reload of `/?q=…`] →
  `restore` ignores values until a history navigation has set the accept flag,
  so the initial hydration restore is dropped and a fresh visit starts at the
  top.
- [Privacy reading of "never logged" vs the existing anonymous search log] →
  the guardrail applies to the **stored list**: the list itself is never
  transmitted, logged, or synced. Activating a recent query is an ordinary
  search submit and is logged anonymously under the existing PRD §7.4 behavior,
  exactly as typing it would be. This is called out for reviewer confirmation
  (see Open Questions).
- [`localStorage` unavailable (private mode, disabled)] → the adapter treats
  read/write as a no-op and search still works; a write failure never surfaces
  as a search error.
- [Case-insensitive dedupe could keep an unexpected casing] → the decision is
  explicit (keep the newest casing while moving the entry to the most recent
  position) and is pinned by the recents test.
- [A page ref could be malformed in the corpus] → the formatter only strips a
  leading `p`/`p.` and otherwise passes the value through; absent/blank renders
  nothing. `buildCitation`'s existing behavior is untouched.

## Migration Plan

No data, schema, dependency, or corpus migration. Changes are confined to
`src/routes/+page.svelte` plus the two new pure modules and two new test
scripts; `package.json` gains the two `test:*` entries. Rollback is reverting
those files. Because the recents key is new and namespaced, removing it leaves
no residue; the snapshot mechanism stores scroll only in browser history state.

## Open Questions

None that change the specs, approach, or task breakdown. One assumption is
recorded for review rather than left open: activating a recent query is logged
anonymously as a normal submitted search (the list itself is never logged).
