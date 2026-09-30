# Design

## Context

See `proposal.md` — Why. This is a cross-cutting batch across the search surface,
the passage surface, the shell, feedback, and analytics. Current state that
shapes the approach (line numbers are approximate as of authoring):

- **Result cards** live in `src/routes/+page.svelte` (~662–725): an `<article>`
  per result containing a non-heading source/chapter `<p>`, a `{@html}` KWIC
  paragraph, and Copy / View passage / Read at official source / Share controls.
  Copy and Share only call `showToast` for confirmation.
- **Filter bar and phrase toggle** (~366–417): source chips are driven by
  `toggleSource` (~215–225), which silently returns when `next.size === 1` and,
  unlike typing/Enter, calls neither `syncUrl` nor `enqueueLog` — so a source
  selection is not shareable and is absent from the log. The exact-phrase toggle
  *does* call `syncUrl` (which writes `phrase`, ~166), so it is already
  shareable, but it too never logs; its label `Exact phrase` is visible and
  `aria-pressed` is set (~405–414), while its only on/off cue is the
  `""` / `"…"` glyph.
- **Zero-result state** (~626–638): gated on `results.length === 0 && hints.length === 0`,
  so a hint suppresses the "No results for …" message; no recovery suggestions.
- **Index loading** (`src/lib/search/index.ts` ~124–172): three parallel fetches
  plus a background concordance load; failures set `searchError` and reset
  `loadPromise` (so a retry is already possible) but the UI shows a static
  message with no retry control.
- **Suggestions** (`src/lib/search/suggestions.ts`): prefix + bounded-edit-distance
  `didyoumean` over the loaded concordance term dictionary — already fit to back
  the zero-result "Did you mean".
- **Passage page** (`src/routes/passage/[sourceId]/[passageId]/+page.svelte`):
  Copy/Share are toast-only; only one highlighted occurrence is scrolled to, via
  `applyQueryFocusAndScroll` (~157–172); chapter rendering for `full-text` and a
  "Full text not available" card for protected sources already exist.
- **Passage link affordance**: `passage-view` currently *forbids* "View passage"
  for non-`full-text` results (`openspec/specs/passage-view/spec.md`), while the
  result card (~701–712) shows "Read at official source" instead — so protected
  results have no deep link.
- **`linkTemplate` / `linkData`** are parsed (`registry.ts:54`, `types.ts:25,107`,
  emitted by `corpus/scripts/build-index.mjs:98`) but referenced nowhere in the UI. `12&12`
  defines `https://www.google.com/search?q=aa+12x12+{{query}}`; `daily-reflections`
  defines a static template; committed passage `linkData` is currently all `null`.
- **Nav** (`src/lib/components/Nav.svelte`): the "Daily Reflection" entry is
  `external: true` → `https://www.aa.org/daily-reflections`, bypassing
  `/reflection`; the mobile overlay has `role="dialog" aria-modal="true"` but no
  Escape handling or focus trap.
- **Home reflection card** (`+page.svelte` ~507, ~526) links straight to aa.org.
- **Feedback** (`src/routes/feedback/+page.svelte` + `+page.server.ts`): exactly
  three fields (`type`, `summary`, `details`), URL/context-free.
- **Toasts** (`src/lib/components/Toasts.svelte`): container `aria-live="polite"`
  and each toast `role="status"` — nested live regions.
- **Stats** (`src/routes/stats/+page.svelte`, `functions/api/stats.ts`): public,
  unauthenticated, returns every logged query and aggregates.
- **No `+error.svelte`** anywhere under `src/routes/`.
- **No headless browser** exists in this repo: `package.json` has only
  Node-based `test:*` scripts. Anything visual must be verified manually.
- **Sticky header**: `Nav.svelte:53` is `sticky top-0 z-40` (~56px);
  `decisions.md` (2026-09-30) already establishes `scrollIntoView({ block: 'center' })`
  for highlights, so match navigation reuses that.
- Guardrails (`AGENTS.md`): no auth/accounts/bookmarks/notes; no non-AA content;
  never render or copy protected full text — every path touching passage text
  branches on `displayMode`.

## Goals / Non-Goals

**Goals:**

- Ship the 19 documented items as behavior contracts, with pure where possible
  so they are testable without a browser.
- Preserve the display-mode copyright gate on every new path (deep links, share,
  copy confirmation, match navigation).
- Keep the change additive: no new runtime dependency, no schema/corpus change,
  no auth, no index-format change.

**Non-Goals:**

- Redesigning the visual system; the changes reuse existing tokens and the
  established chip/active styling.
- Introducing a router-level persistence layer for match navigation; the URL's
  existing highlight state remains the only persisted state.
- Replacing the anonymous logging pipeline; only its public exposure changes.
- Adding shared abstractions beyond what two call sites need (a tiny focus-trap
  utility is the only extracted primitive).

## Decisions

### D1 — Copy/Share confirmation is local component state, with the toast retained as a secondary cue

Each surface keeps a small per-control state (the acting control's key plus a
timer) and swaps that control's label to `Copied ✓` / `Link copied` for ~2s
before reverting; the existing toast remains as a secondary announcement but is
no longer the only confirmation (PRD §8.4 already specifies the ✓ swap). A
result card tracks one acting control per card; the passage page tracks its own
Copy/Share. Alternatives: a single global "which button just confirmed" store
(rejected — more coupling than two call sites warrant); toast-only (rejected —
that is the defect).

### D2 — The exact-phrase toggle gains a legible non-glyph state indicator

The control already renders the visible label `Exact phrase`, an `aria-pressed`
state, and a descriptive `aria-label` (`+page.svelte:405–414`). The defect is that
its only *state* cue is the cryptic `""` / `"…"` glyph, so this change adds a
visible on/off indicator that is not the glyph (a state word such as `On`/`Off`,
or a state icon) and keeps the active styling consistent with the source chips.
`aria-pressed`, the label, and the `phrase=1` URL flag are unchanged.
Alternatives: an added tooltip (rejected — not visible on touch and does not make
the state legible at a glance); replacing the label (rejected — the label is
already correct; only the state cue is missing).

### D3 — "View passage" is offered for every result; the destination enforces the copyright gate

The result card always renders its passage link (item 3). For `full-text`
sources this is today's behavior. For `snippet` / `concordance-only` sources the
destination is the existing passage page's protected state ("Full text not
available" + official link), which already branches on `displayMode`; no passage
text is fetched or rendered there. The card's Share affordance shares the
passage-page URL for every result. This deliberately replaces the `passage-view`
requirement that forbade the affordance for non-`full-text` results — written as
`## REMOVED` + `## ADDED` rather than `MODIFIED` because the old requirement
carries a scenario ("Non-full-text results do not gain a passage link") whose
name the new behavior falsifies, and the validator refuses a `MODIFIED` block
that drops or renames an existing scenario. Alternatives: keep the lockout
(rejected — the whole point is a deep link per result); `MODIFIED` keeping the
false scenario name (rejected — leaves a contradictory contract).

### D4 — Result headings: the source/chapter line becomes an `<h3>`

Promote the existing source/edition/chapter `<p>` inside each `<article>` to
`<h3>` (the group header stays `<h2>`), preserving its classes, and give the
`<article>` an `aria-label` such as `Result {n} of {total}: {source} — {chapter}`
so a screen reader can announce position while the heading gives heading-
navigation structure. Alternatives: `role="heading"` on the `<p>` (rejected —
native `<h3>` is simpler and robust); an `<h3 class="sr-only">` plus the visible
`<p>` (rejected — duplicates content).

### D5 — Zero-result recovery reuses the topic chips and the existing suggestion index

Always render the "No results for …" block on zero results (drop the
`hints.length === 0` gate), and add below it: "Try these searches" built from
`TOPIC_CHIPS` (excluding any equal to the query) and a single "Did you mean"
taken from the first `didyoumean` suggestion returned by the existing
`getSuggestionTerms` / `suggestions.ts` path. No new search behavior is
introduced; the suggestion dictionary is already loaded and offline-capable. The
selection is extracted into a pure `pickZeroResultSuggestions(topics, query,
suggestions)` helper — `TOPIC_CHIPS` is page-local (`+page.svelte:37–40`), so the
helper takes the topic list as an argument and is unit-testable without the
component. Alternatives: a new did-you-mean implementation (rejected — duplicates
Area 4); embedding suggestions in the search box only (rejected — the box is
empty in the zero-result state on reload).

### D6 — Index loading exposes named stages and reuses the loader's existing retry

`index.ts` gains a small progress/status store set at the loader's real
boundaries — at minimum `fetching` (before the parallel fetches) and `preparing`
(after `MiniSearch.loadJSON`, before/while the concordance loads) — plus a
`retryLoad()` that clears `loadPromise` and calls the loader again (the catch
already resets `loadPromise`; `retryLoad` makes it explicit). The search view
renders the stage text and, on `searchError`, a Retry button wired to
`retryLoad()`. Because the loading/error UI currently lives inside the `{:else}`
search branch (`+page.svelte:594–605`), the indicator is hoisted so it renders
whenever the index has not loaded or has failed — including the home/first-load
state — so first-load progress and failure+Retry are visible without a query
(the spec and task 2.5 both require this). Because the page's `$effect` re-runs
on `searchReady`, a successful retry automatically runs the pending query.
Alternatives: a fake timer-driven progress bar (rejected — dishonest,
untestable); leaving retry to a page reload (rejected — the request is an
in-place affordance).

### D7 — Keyboard shortcuts come from one registry, so the hint cannot advertise an unwired key

A single shortcut registry (module-level map of key → description → action) is
wired in the shell: `/` focuses `#search-input` when focus is not in an
input/textarea/contenteditable and no modifier is held; `?` opens a shortcut-help
dialog. The visible hint is rendered from the same registry, and the design
forbids a hint entry without a corresponding wired action (the PRD warns against
exactly this). The help dialog and the mobile overlay share one small focus-trap
utility (D16). Alternatives: hard-coded hint text (rejected — can
drift, which is the PRD's stated failure mode).

### D8 — Display-mode legend is one shared component with local dismissal

A small `DisplayModeLegend` component describes Full-Text / Snippet /
Concordance from the registry's `displayMode` values and explains the link-forward
behavior; it renders on the search surface and the `/sources` page. Dismissal is
stored in `localStorage` under a single key (mirroring the theme preference) and
involves no account or personal data — it is a UI preference, not user content,
so it does not touch the bookmarks/notes guardrail. Alternatives: session-only
dismissal (rejected — the legend would reappear every navigation); an About-page
section only (rejected — the request is in-context explanation).

### D9 — Filter and phrase state sync through a `sources` URL parameter and log as explicit submits

Extend `syncUrl` to write `sources` (comma-joined enabled source ids) only when
the selection differs from the all-enabled default, and parse it on mount into
`activeSourceIds`; ordering is the registry `sortOrder`, so the URL is
deterministic. The phrase toggle already calls `syncUrl` (only the `sources`
parameter is new); `toggleSource` gains the same `syncUrl` call, and both toggles,
for a non-empty query, call the `enqueueLog` path Enter uses (treating a toggle as
an explicit submit) — except a no-op toggle (deselecting the last source), which
logs nothing. The blocked last-source toggle exposes `aria-disabled="true"` plus
an accessible reason and stays in the tab order (not native `disabled`, which
would remove it from focus order and hide the reason). URL serialize/parse lives
in a pure helper pair so it is unit-testable. Alternatives: one query param per
source (rejected — noisy, harder to read); relying on `q`/`phrase` only
(rejected — the filter is not shareable).

### D10 — Wire `linkTemplate` through one pure resolver instead of deleting the fields

Add a pure `resolveSourceLink(source, passage, query)` helper returning the
destination for the non-`full-text` external action: substitute `{{query}}` with
the URL-encoded query and other placeholders from `passage.linkData`; if any
placeholder cannot be resolved, fall back to `officialUrl` (then `freeUrl`); if no
template exists, return `officialUrl`. A dependency-free test covers the `12&12`
query template, a static template, a missing-placeholder fallback, and the
no-template case. Deleting the fields was rejected because PRD §6.4 specifies the
web-search passthrough for protected `snippet` results, so the fields encode
intended behavior.

### D11 — Match navigation operates on the rendered `<mark>`s, centered, announced, clamped

After the chapter renders, the passage page collects the `<mark>` elements in
document order, exposes Previous/Next controls plus an `aria-live` "Match k of n"
status, and scrolls the selected match with `scrollIntoView({ block: 'center' })`
(reusing the decisions.md 2026-09-30 centering rule), moving a visible focus
indicator. The initial current match is the first `<mark>` within the target
passage — the occurrence `applyQueryFocusAndScroll` centers on entry — so the
indicator and the entry scroll agree even when earlier chapter passages also
contain highlights. Controls are unavailable with fewer than two matches and
clamp at the ends. Scope is the rendered chapter view (which contains the target
passage's highlights). Alternatives: URL-persisted match index (rejected — the
URL surface stays `q`/`phrase`); wrapping navigation (rejected — clamping is
clearer).

### D12 — Contextual report links carry context as URL params consumed into `details`, not as new fields

`reportHref(sourceId, passageId, query)` links to `/feedback` with non-submitted
URL params (e.g. `?source=…&passage=…&q=…&type=bug`). The feedback page reads
those params on mount, builds a plain-text context block, truncates it to the
`details` limit, and prefills `details` (leaving `type` user-editable). Nothing
new is submitted: the existing allow-list (`type`, `summary`, `details`) and
server-side fencing are unchanged, and the params never reach the issue as
fields. No PII is added. Alternatives: a client store handoff (rejected — not
reloadable/shareable); a hidden form field (rejected — changes the submitted
field set).

### D13 — `/reflection` becomes the navigation target for the nav entry and home card actions

Change the Nav "Daily Reflection" entry to the internal `/reflection` route (drop
`external: true`; `isActive` then matches it) and point the home reflection card's
actions at `/reflection`. This preserves link-forward behavior: online,
`/reflection` redirects to `https://www.aa.org/daily-reflections`; offline it
renders the indexed fallback (built by `fix-daily-reflections-formatting`). No
external-link guard is needed for the internal link. Alternatives: keep the
external nav and add a second `/reflection` link (rejected — still bypasses the
fallback from the primary entry point).

### D14 — Retire the public stats surface; maintainer access moves out-of-band

Delete `src/routes/stats/+page.svelte` and `functions/api/stats.ts`. Anonymous
logging (`functions/api/log.ts`, the `SEARCH_LOG` binding, the IndexedDB queue)
is unchanged. Maintainer access becomes out-of-band via `wrangler kv`
documented in `README.md`. The `search-analytics` spec's first requirement
documents the logging the app already implements; only the public-surface removal
is new behavior. Alternatives considered: a shared-secret bearer gate
(rejected — introduces an auth-like secret for a surface the app does not need,
against the spirit of the no-accounts guardrail); aggregating away the raw query
text (rejected — still exposes what users searched, which is the concern);
leaving it (rejected — any visitor can read every logged query).

### D15 — Error page is self-contained and styled, not reliant on the layout

Add `src/routes/+error.svelte` rendering the status-appropriate heading, a
plain-language message, and a link back to the concordance using the shell's
tokens. It is written to stand alone because a root-level error can render
outside the normal layout. For 404 it explains the page does not exist; for other
statuses it shows a generic message; it never renders raw error text or stack
traces. Alternatives: rely on the default page (rejected — the defect);
embed the full nav/footer (rejected — fragile if the error originates in the
layout).

### D16 — Mobile overlay and shortcut help share one focus-trap, Escape, and focus-restore utility

A small utility stores the previously focused element, focuses the first
focusable node in the dialog on open, cycles Tab/Shift+Tab within it, closes on
Escape, and restores focus on close. The mobile overlay (`role="dialog"
aria-modal="true"` already present) and the `?` help dialog both use it.
Alternatives: per-component handlers (rejected — duplicated a11y logic).

### D17 — Toasts keep one live region

Keep the container as the single `aria-live="polite"` region and remove
`role="status"` from each nested toast, eliminating the double announcement.
Dismiss buttons remain ordinary buttons. Alternatives: keep per-toast
`role="status"` and drop the container live region (workable, but multiple
toasts then become independent regions; the explicit single-region contract in
the spec is easier to verify).

### D18 — Make `initInstallPrompt()` idempotent and remove the redundant page call

Add a module-level `initialized` guard so repeated calls register listeners once,
and remove the home page's second call (the layout owns it). The guard makes the
guarantee hold even if a future surface calls it again. Alternatives: only
remove the duplicate call (rejected — leaves a latent trap); `{ once: true }`
alone (rejected — does not prevent a second registration).

### D19 — Capability homes for the batch

Existing capabilities are extended where the delta fits their surface:
`search-ui` (result cards, filter bar, phrase toggle, zero-result, loading state,
legend, shortcuts, link template), `passage-view` (every-result link, in-place
confirmation, match navigation), `daily-reflections-display` (routing),
`feedback-to-github` (context prefill). New capabilities are created for genuinely
new app-wide surfaces: `app-shell` (error page, mobile overlay/toast a11y, and
single install-prompt initialization) and `search-analytics` (logging exposure).
The install-prompt fix (item 15) is placed in `app-shell` — a new capability this
change introduces — because `pwa-icon`'s Purpose is icon artwork and a listener
lifecycle requirement does not belong there.

## Risks / Trade-offs

- [Extending `search-ui` broadens it well beyond its current badge-focused Purpose, which archive will not rewrite] → Accept and record; the capability is the search surface's presentation contract, and a future dedicated Purpose refresh can be folded into a later change. Do not silently edit the main spec during planning.
- [Every UI item is unverifiable headlessly; this repo has no browser automation] → Mark each visual task `manual (browser)` and add dependency-free tests only for pure logic (link-template resolution, URL serialization, zero-result suggestion selection).
- [`/` is a browser quick-find shortcut in some browsers; `?` needs Shift on many layouts] → `preventDefault` only when focus is not in a text field and no modifier is held; match `e.key === '?'` rather than the physical key. Document the shortcut in the visible hint.
- [Syncing filters into the URL adds a `sources` parameter that could surprise] → Write it only when the selection differs from all-enabled; parse defensively (unknown ids ignored) so a hand-edited URL never breaks search.
- [Logging on every toggle could inflate the log] → Only non-empty queries are logged, one record per toggle, matching the existing explicit-submit rule; logging failure cannot affect UX.
- [Removing `/stats` costs the maintainer in-app visibility] → Keep logging; document the out-of-band `wrangler kv` read in `README.md`.
- [Contextual report links put a query in the feedback URL] → The query is an anonymous search term already in the search URL; it is consumed client-side into `details` and never added as a submitted field or PII.
- [Prev/next match navigation focuses non-interactive `<mark>` elements] → Scroll and announce the current match via an `aria-live` status rather than moving DOM focus to a non-focusable node; keep a visible indicator.
- [Deleting the public stats files is irreversible in a deploy] → It is a source deletion under version control; rollback is a revert. KV data is untouched.
- [The `passage-view` Purpose still says the page "opens a full-text source's chapter", which the every-result change makes stale] → Record it for archive-time cleanup; do not edit the main spec during planning.
- [`POST /api/log` remains an unauthenticated write endpoint] → It is unchanged by this change and accepts only bounded anonymous fields; hardening or removing it is out of scope, but this residual write surface is called out so the `/stats` removal is not mistaken for closing it.

## Migration Plan

Normal static build and git-push deploy; no data, schema, API, or dependency
migration. Deletions (`src/routes/stats/+page.svelte`, `functions/api/stats.ts`)
take effect on deploy. The `SEARCH_LOG` binding and `functions/api/log.ts` stay.
Rollback is reverting the commit(s). Because `static/index/*` is unaffected, no
index rebuild or cache-version bump is required.

## Open Questions

None. The remaining choices (URL parameter name, exact confirmation labels,
legend copy) are cosmetic and do not change the specs, the approach, or the task
breakdown.
