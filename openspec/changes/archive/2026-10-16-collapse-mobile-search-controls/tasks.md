# Tasks

## 1. Implement the disclosure in `src/routes/+page.svelte`

- [x] 1.1 Add a reactive boolean (e.g., `let moreOpen = $state(false);`) to control the panel state.
- [x] 1.2 Add a "More" toggle button directly beneath the search input, visible only below `md` (`md:hidden`), using an icon from `@lucide/svelte` (e.g., `SlidersHorizontal` or `Settings2`) plus `ChevronDown`/`ChevronUp`. Bind `aria-expanded={moreOpen}`, `aria-controls="search-more-panel"`, and a stateful accessible name that contains the visible label "More": collapsed `aria-label="More, show search options"`, expanded `aria-label="More, hide search options"`.
- [x] 1.3 Keep the existing Recent searches block, Filter Sources + Exact phrase block, and Popular Recovery Searches block inside a single panel container that is always in the DOM, with `id="search-more-panel"` and `role="region" aria-label="Search options"`. Its visibility is controlled by responsive + state classes (`{moreOpen ? 'flex' : 'hidden'} flex-col md:flex md:flex-col`), NOT by an `{#if}` block, so the toggle's `aria-controls` target always exists. The container stacks its clusters vertically (`flex-col`), so the three clusters keep their existing top-to-bottom order rather than laying out in a row.
- [x] 1.4 Preserve the existing per-control markup inside the panel: source-chip `aria-pressed`/`aria-disabled`/`aria-describedby`, exact-phrase "On"/"Off" badge and `aria-pressed`, Recent group `aria-label`, and topic chip labels.
- [x] 1.5 Use the same single panel node at every breakpoint: below `md` it is hidden by the `hidden` class until `moreOpen` is true, and at `md` and up it is always visible as a column via `md:flex md:flex-col`. Do not render a second copy of the controls, so there are no duplicate ids (such as `filter-last-source-note`).

## 2. Accessibility and mobile CSS

- [x] 2.1 Import `focusFirstWithin` and `trapTabKey` from `$lib/focus-trap`.
- [x] 2.2 On opening the panel, `await tick()` then call `focusFirstWithin(panel)`.
- [x] 2.3 On `Escape` while focus is inside the panel, close the panel and return focus to the toggle.
- [x] 2.4 While the panel is open, call `trapTabKey(panel, event)` on `Tab`/`Shift+Tab` so focus cycles within the panel.
- [x] 2.5 Stop propagation on the panel's keydown handler so global shortcuts (e.g., `/`) do not fire while focus is inside the panel, mirroring `Nav.svelte`.
- [x] 2.6 Verify that when collapsed on mobile the panel is not visible and its controls are not focusable: assert `toBeHidden()` on `#search-more-panel`, and walk the Tab sequence to confirm focus never lands inside the panel. Do NOT assert `toHaveCount(0)`.
- [x] 2.7 Apply calm, token-consistent styling (`rounded-sm`, `border-stone-200 dark:border-slate-700`, `bg-white dark:bg-slate-900`, `transition-colors duration-200`) to the toggle and panel.

## 3. Count badge logic

- [x] 3.1 Compute a derived count of changed (non-default) filters: `filterableSources.length - activeSourceIds.size` (when positive) plus `1` if `phraseMode` is true.
- [x] 3.2 Render the count badge on the toggle only when the count is greater than zero, in the compact format "More · {count}" (no em dash; the separator is a middle dot). The new label must not introduce an em dash (U+2014), per the `ui-copy` capability.
- [x] 3.3 Include the count in the toggle's accessible name when present, e.g., "More, show search options, 2 filters changed". The name keeps the visible label "More" (WCAG 2.5.3 Label in Name) and describes the count as filters changed rather than "active filters".
- [x] 3.4 Verify no badge is rendered when all filterable sources are selected and exact-phrase mode is off.

## 4. Tests

- [x] 4.1 Create `e2e/search-disclosure.spec.ts` with a `test.describe('Mobile disclosure')` block that uses `test.use({ viewport: { width: 390, height: 844 } })`.
- [x] 4.2 Test that at 390 px the Recent, Filter Sources, Exact phrase, and Popular Recovery Searches clusters are hidden by default and a "More" toggle is visible.
- [x] 4.3 Test that expanding the panel reveals the clusters and that the first focusable control inside the panel receives focus.
- [x] 4.4 Test that `Escape` closes the panel and returns focus to the toggle.
- [x] 4.5 Test that deselecting a source inside the panel updates the URL (`?sources=...`) and that the results still honor the filter after the panel is collapsed.
- [x] 4.6 Test that enabling exact phrase inside the panel updates the URL (`?phrase=1`) and that the toggle shows a count badge.
- [x] 4.7 Test the `md` boundary: at 767 px (below) the disclosure toggle is visible; at 768 px (`md`) and at 1024 px (`lg`) the toggle is not visible and the clusters render inline without expansion.
- [x] 4.8 Add regression assertions to `e2e/search-disclosure.spec.ts` (the task originally named `e2e/search-recent.spec.ts`, but the Recent-row assertions were placed alongside the disclosure tests, where the expanded-panel setup already exists) confirming the Recent row is still exposed as a labeled group with descriptive accessible names when the panel is expanded on mobile.
- [x] 4.9 Update or add a test in `e2e/search-integration.spec.ts` to verify the disclosure does not cause horizontal overflow at the phone viewport.
- [x] 4.10 Update `e2e/search-integration.spec.ts` (which runs at 390x844) so its mobile assertions expand the disclosure before asserting on the Recent row/entry (or move those Recent-row assertions to `e2e/search-disclosure.spec.ts`), then confirm the file passes again. The existing horizontal-overflow check (4.9) stays.

## 5. Verification

- [x] 5.1 Run `pnpm check` and confirm `svelte-check` passes with no errors.
- [x] 5.2 Run `pnpm lint` and confirm ESLint reports no NEW errors beyond the 4 pre-existing ones (`corpus/scripts/source-daily-reflections.mjs`, `corpus/scripts/verify-citations.mjs`, `ExternalLink.svelte`, and `websiteSchema` in `+page.svelte`).
- [x] 5.3 Run `pnpm test:ui-copy` and confirm the new "More" label and count badge introduce no em dash (U+2014).
- [x] 5.4 Run `pnpm test:e2e` (Playwright) and confirm all tests pass, including the new disclosure spec.
- [x] 5.5 Manually verify in a mobile viewport (Chrome DevTools 390 x 844) that the toggle, panel, count badge, focus, and filter behavior work in both light and dark modes. (Verified by headless Chromium screenshots at 390x844 in both themes, plus e2e focus/behavior assertions.)
- [x] 5.6 Manually verify at `md` and `lg` viewports that the existing inline layout is unchanged. (Verified at 1024px by screenshot; the 768px `md` boundary is asserted by the e2e suite. The accepted reflow moves the shortcut hint and the display-mode legend below the panel.)
- [x] 5.7 Make the one-line scoping edit to `docs/plans/basic-texts-PRD.md` §8.4 so the filter bar's "always visible below the search input" wording no longer contradicts the shipped mobile behavior, then verify the wording is consistent (this PRD edit is implementation work, not part of this planning change).
