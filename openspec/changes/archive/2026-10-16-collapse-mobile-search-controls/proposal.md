# Proposal

## Why

On narrow viewports the search surface on `src/routes/+page.svelte` presents three horizontal control clusters between the search input and the content below:

- Recent searches ("Recent:" + chips + Clear)
- Filter Sources chips + the Exact phrase toggle
- Popular Recovery Searches topic chips

Together these clusters consume significant vertical space on phones, pushing the home dashboard cards and search results far down the screen. The change reduces that chrome to a single, calm "More" disclosure so the primary content is visible first, while keeping every control one tap away.

## What Changes

- Add a single inline disclosure control ("More" button + chevron) directly under the search input on viewports below the `md` breakpoint (768 px).
- The disclosure opens one combined inline panel containing, in order:
  1. Recent searches row (home/empty state only, when non-empty)
  2. Filter Sources chips + Exact phrase toggle (always)
  3. Popular Recovery Searches topic chips (home/empty state only)
- At `md` and above the existing inline rows continue to render exactly as today; no desktop layout changes.
- The collapsed toggle shows a small count badge when filters are non-default (e.g., a source is deselected and/or Exact phrase is on), and no indicator at defaults.
- The panel is collapsed on every fresh load; no open/closed state is persisted.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `search-ui` (`openspec/specs/search-ui/spec.md`)

The `search-ui` capability already governs the per-control behavior of the filter chips, the exact-phrase toggle, and the Recent searches row. This change adds a disclosure requirement that scopes those existing guarantees to the expanded panel on mobile without altering their behavior, and it scopes the existing "Local recent searches are offered beneath the search input" placement guarantee: the row renders inline beneath the search input at `md` and above, and on viewports below `md` it sits inside the search-options disclosure panel and is therefore not visible until that panel is expanded.

## Impact

- Primary file: `src/routes/+page.svelte`
- Reuse: `src/lib/focus-trap.ts` and the focus/escape/tab pattern from `src/lib/components/Nav.svelte`
- New e2e coverage: a Playwright spec for the disclosure behavior at mobile and desktop viewports
- No backend, storage, or API changes
- No impact on `home-dashboard` (dashboard card presence and stacking order are unchanged)
