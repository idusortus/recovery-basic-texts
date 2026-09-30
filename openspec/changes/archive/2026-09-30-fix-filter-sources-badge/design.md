# Design

## Context

See `proposal.md` — Why for the backlog item and its promotion. The relevant current state,
established by reading `src/routes/+page.svelte`, `corpus/sources.json`,
`src/lib/corpus/registry.ts`, and `src/app.css`, and by compiling the component with the
Svelte compiler (`compile()` from `svelte/compiler`) and inspecting the emitted client code:

- The filter bar is the `enabledSources` chip row in `src/routes/+page.svelte` (~345–393).
  Each chip is a `<button type="button" aria-pressed={activeSourceIds.has(source.id)}>`
  containing a per-source badge `<span class="inline-block w-2 h-2 rounded-full shrink-0">`
  (an 8×8 colored dot) and the `source.shortTitle` label.
- **Selected chip:** class `border-transparent text-white`; the fill is applied only by an
  inline `style={… ? \`background-color: ${source.color};\` : ''}` (line 361).
- **Unselected chip:** class `… bg-white dark:bg-slate-900 … text-stone-500 dark:text-slate-400`
  with no inline fill.
- **Badge:** inline `style="background-color: {active ? 'white' : source.color};"` (line 364).
- The compiled client code confirms both inline styles are applied at runtime: the button
  receives `style.cssText = "background-color: <source.color>;"` when active, and the badge
  receives `style.cssText = "background-color: white;"` (or `source.color` when inactive).
  The only stylesheet (`src/app.css`) contains design tokens and highlight/focus rules and no
  rule targeting the chips or badges, so no class or cascade rule overrides the inline fill.
- Every committed source defines a hex `color` (`#1A5276`, `#7C5C3A`, `#4A7C6E` disabled,
  `#C8902A`), and `registry.ts` makes `color` a required string (it throws at load if
  absent). So a missing color is not observable in the current registry.
- **The "white badge when active" remedy already exists.** `git blame` attributes the badge
  line to commit `5731f797` ("fuzzy search, fix badges"), and `docs/plans/features-001-plan.md`
  F1 documents exactly this fix ("When button is active, render the dot as white instead of
  `source.color`").

### Diagnosis (observed vs hypothesis)

**Observed:**

1. On the current source, an active chip renders a white badge over a fill of `source.color`
   — i.e. the literal defect the backlog describes ("badge same color as the chip
   background") is **not present on `HEAD`**.
2. The badge's active fill is a **hard-coded `white`**, and the chip fill is applied by a
   **single inline style with no class-level or registry-level fallback**. If that inline
   fill is absent (a source without a valid color, or inline styles stripped), the active
   chip falls back to a transparent fill and the hard-coded white badge disappears over the
   light theme's parchment background (`--color-bg: #F8F7F4` in `src/app.css`).
3. The selected state is conveyed **primarily** by the fill color, with only a weak
   non-color cue: the unselected chip carries a visible `border-stone-200 dark:border-slate-700`
   while the selected chip sets `border-transparent` (line 359), so border presence/absence
   already differs between states — but it is subtle and is not paired with a deliberate
   non-color selection signal. The label is always `text-white`. White on the
   `daily-reflections` gold `#C8902A` is ≈**2.8:1** — below the
   4.5:1 WCAG AA threshold for the label, and below 3:1 for a UI component.

**Hypothesis (best-supported):**

- **H1 — stale bundle.** The most likely explanation for the report is that it was observed
  against a build predating `5731f797` (or a service-worker/PWA-cached bundle of it), since
  the reported mechanism is impossible on current `HEAD`. This is not verifiable from the
  repository (no browser automation, no deployed-bundle access), so it is recorded as a
  hypothesis, not a claim; the change still hardens the styling and adds a deterministic
  guard so the remedy cannot silently regress.
- **H2 — fragile fill/badge coupling (residual).** Even with the white swap, correctness
  depends on the inline `source.color` fill always painting. A missing/invalid color produces
  the "white badge on an absent background" failure the task hypothesizes; today's registry
  prevents it, but the styling has no fallback.
- **H3 — contrast/legibility defect (residual).** Even when visible, the badge and label
  fail contrast for lighter source colors, so they are not reliably "legible" as the
  done-when condition requires.

The design targets H2 and H3 directly (they are real, code-evidenced gaps) and adds a
guard against H1's regression.

## Goals / Non-Goals

**Goals:**

- Guarantee the per-source badge is visible and distinguishable on the filter chip in both
  themes and both selection states.
- Remove the dependency on a valid `source.color` and on the inline fill always painting.
- Make the selected label AA-compliant and the selection signal non-color-only.
- Add a deterministic, dependency-free regression test for the accent/contrast logic.

**Non-Goals:**

- Changing filter semantics (`toggleSource`, the last-source-remains rule, which sources
  appear) or the source colors themselves.
- Redesigning the chip (e.g. switching the active chip from a filled pill to a neutral
  bordered pill) — rejected in favor of the smaller, design-preserving change.
- Changing the results-header/group dots (`+page.svelte` ~631, ~432) or pinned/notable
  labels: they draw `source.color` on neutral card surfaces rather than on a fill of their
  own color, so the defect does not apply. The helper is location-agnostic so they can adopt
  it later.
- Introducing a browser/headless test dependency or changing any runtime/data behavior.

## Decisions

### D1 — Keep the badge in the source accent and separate it with a contrast-derived ring, instead of a hard-coded white fill

The badge keeps `background-color: <resolved source accent>` at all times; the active/inactive
distinction is carried by a 1–1.5px ring/border whose color is chosen for contrast against
the chip fill (contrast-selected from relative luminance: a light ring on dark accents, a
dark ring on the light/gold accent; a neutral token on the white inactive chip). This removes the "badge equals its background" class of bug entirely, keeps each
source's color identity, and stays robust when the fill is absent (the accent dot still shows
even if the ring's surface color matches the page).

The ring is the mechanism that carries the required contrast: because the badge fill is
deliberately allowed to equal the chip fill (on a selected chip both are `source.color`), the
spec's ≥3:1 requirement applies to the **ring against the chip fill**, not to the badge fill.
The two-state expectation is: **selected** — chip fill == badge fill == source accent, ring
contrast-selected from relative luminance (light on dark accents, dark on the light/gold
accent) for ≥3:1 on the accent; **unselected** — chip fill is the neutral surface (`#fff` light /
`slate-900` dark), badge fill is the source accent, ring neutral for ≥3:1 on that surface.

- *Alternative — keep white-on-active (current):* rejected; hard-coded white vanishes on a
  light/absent fill and the gold `#C8902A` badge is only ~2.8:1 on the white chip — and on a
  selected chip the white badge fill would merge with a `source.color` chip fill.
- *Alternative — make the active badge fill differ from the chip fill and darken/ring the
  inactive gold badge:* rejected; it re-couples correctness to the badge fill and reintroduces
  the merge failure whenever a source accent is light, and it is a larger change than the item
  calls for. The ring approach keeps the contract on the ring, where it holds for every
  committed accent in both states.
- *Alternative — neutral active chip with a colored dot (no filled pill):* the cleanest
  guarantee, but a larger visual change than the item calls for; noted as a fallback if the
  ring approach proves insufficient in review.

### D2 — Resolve accent styling through one pure helper with a hex-validated fallback

Add a small pure module (e.g. `src/lib/corpus/source-accent.ts`) exporting the accent
resolution used by the chip: it validates the configured accent as a hex (`#rgb`/`#rrggbb`),
substitutes a defined fallback (the theme navy `#2C4A6E`) when missing/invalid, and returns
the chip fill, the badge fill, and the foreground/ring color. One source of truth avoids the
component inventing inline fallbacks and keeps the logic testable without a browser.

- *Alternative — inline fallbacks in `+page.svelte`:* rejected; untestable and easy to
  regress, and duplicates the registry's validation intent.

### D3 — Choose the label foreground by WCAG relative luminance, not a fixed `text-white`

The helper computes relative luminance and returns a foreground of `#FFFFFF` or `#1A1A1A`
(the repo's light text token) whichever yields the higher contrast on the resolved fill, so
the active label meets ≥4.5:1 for every committed color, including the gold accent. The same
luminance result drives the badge ring color.

- *Alternative — keep `text-white`:* fails AA on `#C8902A`; rejected.

### D4 — Keep `aria-pressed` and add a non-color selection cue

`aria-pressed` continues to reflect `activeSourceIds.has(source.id)`. The badge ring/border
is the added non-color cue, so selection is not conveyed by color alone (WCAG 1.4.1) and the
"visible and legible" done-when holds for users who cannot perceive the color difference.

### D5 — Dependency-free regression test in the project's existing test convention

Add `scripts/test-source-badge.mjs` following the repo's `scripts/test-*.mjs` pattern (no test
framework), wired as a `package.json` script. It asserts, for every committed source color
and for `null`/empty/non-hex inputs, that the helper returns a valid fill, a ring color that
meets ≥3:1 against the chip fill (both the accent-filled selected chip and the `#fff` light /
`slate-900` dark unselected chip surface), and a foreground meeting the label (≥4.5:1)
threshold, and that the fallback is used for invalid input.

- *Alternative — browser/headless test:* rejected; no such tooling exists in this repo
  (`package.json` has only node-based test scripts).

## Risks / Trade-offs

- [The symptom cannot be reproduced in a browser from here] → Reason from the compiled
  component output (done, above) and add a deterministic source-level test; keep the manual
  two-theme check as an explicit verification task.
- [Adding a ring/contrast logic could disturb the calm design] → Keep the existing palette
  and chip layout; only add a thin ring and a contrast-picked foreground, no new colors
  beyond the existing navy/white/dark-text tokens.
- [A hard-coded white badge might still be expected by reviewers] → The spec's ≥3:1
  ring-vs-chip-fill scenario is the observable contract; the accent+ring approach is the
  chosen way to satisfy it.
- [Sibling dots share the accent value] → They are out of behavioral scope (neutral
  surfaces); the helper can be adopted later without a spec change, because the helper's
  contract is presentation-only.

## Migration Plan

No data, schema, API, or runtime migration. The change is a client-only UI adjustment plus a
new helper and test. Deployment is the normal static build; rollback is reverting the commit.
No service-worker or cache-version behavior changes are required.

## Open Questions

None — the remaining choices (preserving the filled active chip; excluding the sibling dots)
are resolved above because they would change the specs or task breakdown.
