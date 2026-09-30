# Tasks

## 1. Accent helper

- [x] 1.1 Add `src/lib/corpus/source-accent.ts`: a pure function that accepts a configured accent (string, or null/undefined), validates it as a hex (`#rgb`/`#rrggbb`), and returns the chip fill, a contrast-selected foreground, and the ring color; use the theme navy `#2C4A6E` as the fallback (Design: D2, D3); verify with `pnpm run check` (no type errors)
- [x] 1.2 Add and export the fallback constant and a WCAG relative-luminance helper that returns `#FFFFFF` or `#1A1A1A` whichever contrasts better with a fill; verify the fallback drives the result for `null`, `''`, and non-hex inputs in the test from 3.1

## 2. Filter bar selected state

- [x] 2.1 In the `enabledSources` chip in `src/routes/+page.svelte` (~345–393), drive the chip fill from the helper instead of the raw `source.color`; verify by compiling the component and confirming the active chip still receives an inline `background-color` and that a fallback color is used when the accent is invalid (Design: D2)
- [x] 2.2 Render the per-source badge with the resolved accent fill at all times, and give it a ring/border colored by the helper so it never merges with the chip fill; verify the badge fill and ring are both present in the compiled output in the active and inactive branches (Design: D1, D4)
- [x] 2.3 Set the selected chip's label foreground from the helper (contrast-picked) rather than the fixed `text-white`; verify the label foreground resolves to `#1A1A1A` for the `#C8902A` gold accent and to `#FFFFFF` for `#1A5276` (Design: D3)
- [x] 2.4 Confirm the chip still exposes `aria-pressed={activeSourceIds.has(source.id)}` and that the badge ring/border is a non-color selection cue; verify the attribute is unchanged in the compiled output (Design: D4)

## 3. Regression test

- [x] 3.1 Add `scripts/test-source-badge.mjs` (dependency-free, Node) asserting that for every `color` in `corpus/sources.json` and for missing/empty/invalid inputs the helper returns a valid fill, a contrast-selected `onFill` label foreground, and a ring color; assert the **ring** meets ≥ 3:1 against the chip fill it sits on in both chips states — the accent-filled selected chip and the unselected chip surface (`#fff` in light theme, `slate-900` in dark theme) — and that the label `onFill` foreground meets ≥ 4.5:1 against the fill, and that missing/invalid input yields `#2C4A6E`; wire it as `test:source-badge` in `package.json` and verify `pnpm run test:source-badge` passes
- [x] 3.2 Ensure the test covers the committed `daily-reflections` gold `#C8902A` case explicitly (the known low-contrast case); verify it fails if the foreground is forced back to white

## 4. Verification

- [x] 4.1 Run `pnpm run build` and `pnpm run check`; verify both succeed with the new helper, chip markup, and test script
- [ ] 4.2 Run `pnpm run dev` and manually verify the done-when condition in both themes: select each of the enabled sources and confirm the badge is visible and legible on the selected chip, and that the label is readable (backlog item 2.3)
- [x] 4.3 Confirm scope: the results-header dot (~631) and per-source group dot (~432) are behaviorally unchanged, `corpus/sources.json` and the registry are untouched, and no search/worker/service-worker logic changed
