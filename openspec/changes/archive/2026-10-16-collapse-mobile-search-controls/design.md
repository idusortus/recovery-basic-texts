# Design

## Context

See `proposal.md` for the motivation and scope. The search surface on `src/routes/+page.svelte` currently renders three control clusters inline. On narrow viewports this pushes the primary content too far down. The selected design is a single inline disclosure ("More" button + chevron) below the search input that opens one combined panel.

## Goals / Non-Goals

**Goals:**

- Reclaim vertical space on mobile viewports by hiding secondary search controls behind a single disclosure.
- Keep the desktop clusters inline and in their existing relative order at `md` and above (see the desktop-reflow decision below).
- Preserve every existing per-control behavior (source toggle, last-source guard, exact-phrase toggle, Recent searches group, topic chips).
- Make the disclosure accessible via `aria-expanded`, `aria-controls`, focus management, and `Escape`/Tab containment.
- Surface active non-default filters on the collapsed toggle with a count badge.
- Avoid any new persistence surface.

**Non-Goals:**

- No new capability or spec file; this is a change within `search-ui`.
- No changes to `home-dashboard` (dashboard card presence, content, or mobile stacking order).
- No bottom sheet, drawer, or modal overlay.
- No new `localStorage` key or user preference.
- No changes to filter logic, URL sync, logging, or search execution.

## Decisions

- **Inline disclosure over bottom sheet.** A bottom sheet or modal drawer was considered but rejected: it adds overlay/backdrop/scroll-lock complexity, can conflict with the existing mobile nav overlay, and is unnecessary for a small set of toggle controls. The inline panel keeps the change local to `+page.svelte` and reuses existing focus utilities.
- **Icon-bar option rejected.** Splitting the clusters into three separate icon toggles was considered but rejected: it gives the user three decisions before tapping, adds chrome, and contradicts the brief for a single "More" affordance.
- **Breakpoint: below `md` (768 px).** This matches the existing codebase convention: the nav hamburger uses `md:hidden` and the dashboard grid reorders at `md`. At `md` and up the inline rows render unchanged.
- **Toggle placement:** directly beneath the search input, right-aligned or full-width, consistent with the existing calm left-to-right reading order.
- **Toggle label and icon:** "More" text plus `SlidersHorizontal` or `Settings2` icon and a `ChevronDown`/`ChevronUp` chevron. The accessible name keeps the visible label and adds the state and count, so it always contains "More" and satisfies WCAG 2.5.3 Label in Name: collapsed reads "More, show search options", expanded reads "More, hide search options", and with a count "More, show search options, 2 filters changed".
- **Panel stays in the DOM; visibility is class-driven.** The panel is a single node that is always rendered, so the toggle's `aria-controls` reference always resolves. Its classes are `{moreOpen ? 'flex' : 'hidden'} flex-col md:flex md:flex-col`: collapsed below `md` via the `hidden` class (`display: none`), and always visible as a column at `md` and up (the `flex-col` keeps the three clusters stacked rather than laid out in a row, matching today's layout). There is no `{#if}`, so there is no second copy of the controls and no duplicate ids. This keeps hidden controls out of the tab order and screen-reader tree while following the WAI-ARIA Disclosure pattern.
- **Focus/keyboard handling reuses `src/lib/focus-trap.ts`.** On open, call `focusFirstWithin(panel)` after `tick()`. On `Escape`, close and return focus to the toggle. While open, `trapTabKey` keeps Tab inside the panel. This mirrors `src/lib/components/Nav.svelte`.
- **Exact phrase toggle travels with Filter Sources.** The Exact phrase toggle currently lives in the same group as the source filter chips and uses the same active-state styling. It is moved into the panel as part of that group rather than being treated as a separate cluster.
- **Count badge indicator.** When fewer than all filterable sources are selected and/or exact-phrase mode is on, the collapsed toggle shows a compact count badge, e.g., "More · 2". The count is described as the number of filters changed from the default (for example "2 filters changed") and is included in the accessible name, avoiding any implication that deselected sources are "active filters". No indicator is shown at defaults.
- **No persistence.** The panel starts collapsed on every load. No `localStorage` key, no account, no personal data.
- **Desktop reflow accepted.** Grouping the three clusters into one panel moves the shortcut-hint line and the display-mode legend to below the panel at `md` and up; the clusters themselves keep their existing relative order (Recent, Filter Sources/Exact phrase, Popular Recovery Searches) and stay inline. Today those two elements sit between the clusters (hint/loading above the filter group, legend between the filter group and the topic chips), which cannot be preserved once the clusters are one contiguous node, short of a `display:contents` + CSS-`order` trick. The maintainer accepted the reflow on 2026-10-16; the trick was rejected as fragile for no mobile-visible gain. Neither the hint nor the legend loses its own guarantees, and the `home-dashboard` card-order contract is untouched.
- **PRD §8.4 "always visible" language superseded on mobile.** The PRD describes the filter bar as "always visible below the search input." On viewports below `md` that guidance is superseded by this design: the filter bar is reachable via the disclosure. The spec delta carries the authoritative requirement, and implementation includes a small scoping edit to `docs/plans/basic-texts-PRD.md` §8.4 so its wording no longer contradicts the shipped mobile behavior.

## Risks / Trade-offs

- **Recent searches and topics are hidden by default on mobile.** A returning user with recent searches must tap "More" to see them. This is acceptable because the primary goal is reducing clutter, and the controls remain one tap away.
- **Inline panel pushes content down.** Expanding the panel shifts the dashboard or results downward. This is less jarring than a modal on a simple page but still worth verifying in a mobile viewport.
- **Count badge adds width to the toggle.** On very narrow screens a long count string could wrap or truncate. Using a compact format ("More · 2") mitigates this.
- **Focus management must not break the existing search input flow.** The toggle is a separate focus stop; opening the panel should not steal focus unexpectedly from a user who is typing.

## Migration Plan

- Implement the disclosure in `src/routes/+page.svelte`.
- Wrap the existing Recent searches, Filter Sources + Exact phrase, and Popular Recovery Searches blocks in a single panel block that is always in the DOM, with visibility driven by class (no `{#if}`).
- Add the toggle above the panel, visible only below `md`.
- Add the count-badge logic and state.
- Wire focus/escape/tab handling using `focus-trap.ts`.
- Add Playwright e2e coverage for mobile and desktop viewports.
- Run `pnpm check`, `pnpm lint`, `pnpm test:ui-copy`, and `pnpm test:e2e` before merging.
- No data migration or storage changes are required.

## Open Questions

None remaining. The maintainer has locked the pattern, breakpoint, indicator, persistence, panel contents, and grouping of the Exact phrase toggle.
