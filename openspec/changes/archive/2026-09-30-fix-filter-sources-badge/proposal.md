# Proposal: Fix filter-sources badge

## Why

The filter bar's per-source colored badge is reported as hidden once a source is selected,
in both light and dark themes. This promotes item 2.3 of the `product-backlog` change
(tracked in `openspec/changes/product-backlog/`), which reads:

> "FILTER SOURCES" badge/count is hidden when a source is selected (reproduced on light and
> dark themes). Investigate the selected-state styling in the filter bar. Done when the
> badge is visible and legible in both themes with a source selected.

The raw note behind the item is `docs/plans/todo.md` ("'FILTER SOURCES' little circle/badge
is hidden when the source is selected (true on both light and dark themes)"), and
`docs/plans/features-001-plan.md` F1 records an earlier remedy: render the badge white when
its chip is active. That remedy is present in the current source, so the item is **not
reproducible as literally written on `HEAD`**; what remains is that the badge's visibility
depends on a hard-coded white fill landing on a chip fill that is applied only by a single
inline style with no fallback, and that the selected state is legible only for some source
colors. This change makes the badge robustly visible and legible instead of merely patched.
See `design.md` for the evidence and the observed-versus-hypothesis split.

## What Changes

- **Make the selected filter chip's badge unconditionally visible and legible.** Keep the
  per-source badge (the small colored dot) on the chip in both the selected and unselected
  states, and give it a contrast-derived ring so it never merges with the chip's fill,
  in light and dark themes.
- **Harden the source-accent styling.** Resolve the chip fill, the badge fill, and the
  label foreground through one small pure helper that validates `source.color` (a hex) and
  falls back to the theme navy when it is missing or invalid, so no chip can render an
  absent/transparent fill with a hard-coded white badge.
- **Choose the label foreground by contrast** instead of always `text-white`, so the active
  chip's label meets WCAG AA against every committed source color (white on the
  `daily-reflections` gold `#C8902A` is only ~2.8:1).
- **Keep the selected state signalled by more than color** — `aria-pressed` plus the badge
  ring/border — so the state is not conveyed by color alone (WCAG 1.4.1).
- **Add a dependency-free regression test** asserting the helper always returns a valid
  fill plus a contrast-compliant foreground for every committed source color and for
  missing/invalid input, following the project's `scripts/test-*.mjs` convention.

Non-goals:

- Not changing the filter's selection semantics, `toggleSource`, or which sources appear.
- Not implementing the badge in the results header/group dots (`+page.svelte` ~631, ~432):
  those dots sit on neutral card surfaces, not on a fill of their own color, so the same
  defect does not apply. The helper is location-agnostic so they may adopt it later.
- Not altering the palette, typography, or general "calm" visual design.
- Not adding a browser/headless test dependency; no automated browser exists in this repo.
- Not adding auth, accounts, bookmarks, or non-AA content (MVP guardrails in `AGENTS.md`).

## Capabilities

### New Capabilities

- `search-ui`: The presentation guarantees of the search surface — notably that the
  source-filter chips show a visible, legible per-source badge in both themes, that the
  source accent degrades safely when a color is missing/invalid, and that selection is not
  signalled by color alone.

### Modified Capabilities

- None. No existing capability's requirements change (`search-quality` covers query
  behavior, not the filter bar's presentation; `corpus-integrity` and `feedback-to-github`
  are unaffected).

## Impact

- **App UI:** `src/routes/+page.svelte` — the filter bar (the `enabledSources` chips,
  ~lines 345–393) gains the helper-driven fill, badge, and label foreground.
- **New module:** a small pure `src/lib/corpus/source-accent.ts` helper (hex validation,
  fallback, and WCAG contrast selection).
- **Tooling:** a new dependency-free `scripts/test-source-badge.mjs` plus a `package.json`
  script (e.g. `test:source-badge`).
- **No runtime/API/data/dependency changes.** No corpus, registry loading, search, worker,
  service-worker, or network behavior is touched; `corpus/sources.json` is unchanged.
- **Lifecycle:** on promotion, the `product-backlog` change annotates item 2.3 with
  `→ promoted to fix-filter-sources-badge` per `specs/product-backlog/spec.md`. This
  proposal records the promotion; it does not edit `product-backlog`.
