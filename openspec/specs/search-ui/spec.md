# search-ui Specification

## Purpose

Defines the presentation guarantees of the search surface: the source-filter chips keep a
visible, legible per-source badge in both light and dark themes, the source accent degrades
to a defined fallback rather than an absent background when its configured color is missing
or invalid, and selection is conveyed by more than color alone.

## Requirements

### Requirement: Filter-chip badge stays visible and legible in both themes

Every enabled source rendered in the filter bar SHALL show a per-source badge (the small
colored dot beside the source's name) in both the selected and unselected states, in both
the light and dark themes. The badge SHALL remain visually distinguishable from the chip
background it is drawn on. The badge's fill SHALL NOT be required to contrast with the chip
background; instead, the badge SHALL be separated from the chip background by a
contrast-carrying ring, and the **ring's** effective color SHALL have a contrast of at least
3:1 against the chip fill it sits on, in both themes and in both states. The badge fill MAY
equal the chip fill (e.g. the source accent on a selected chip); the ring, not the fill,
carries the required contrast. Selecting or deselecting a source SHALL NOT cause its badge
to disappear or to merge into the chip background.

The two selection states are expected to differ as follows:

- **Selected chip** — the chip fill is the source accent and the badge fill is the same
  source accent (fill == chip fill); the ring color is contrast-selected from relative
  luminance — a light ring on dark accents (navy/brown/green) and a dark ring on the
  light/gold accent — so it has ≥3:1 contrast against that accent fill and the badge reads
  as a ringed dot rather than a solid mass.
- **Unselected chip** — the chip fill is the neutral chip surface (white in light theme,
  slate-900 in dark theme) and the badge fill is the source accent; the ring is a neutral
  color chosen for ≥3:1 contrast against that surface.

#### Scenario: Badge is visible on a selected chip in light theme

- **WHEN** a source is selected and the light theme is active
- **THEN** that source's badge is rendered and its separating ring has at least 3:1 contrast against the chip fill (the source accent)

#### Scenario: Badge is visible on a selected chip in dark theme

- **WHEN** a source is selected and the dark theme is active
- **THEN** that source's badge is rendered and its separating ring has at least 3:1 contrast against the chip fill (the source accent)

#### Scenario: Badge is visible on an unselected chip

- **WHEN** a source is not selected, in either theme
- **THEN** that source's badge is still rendered and its separating ring has at least 3:1 contrast against the chip surface (white in light theme, slate-900 in dark theme)

#### Scenario: Badge is separable from its immediate background

- **WHEN** any filter chip is rendered in either theme and in either selection state
- **THEN** a separating ring is present between the badge and the chip background, and that ring's color has at least 3:1 contrast against the chip fill behind it (even where the badge fill equals the chip fill)

### Requirement: Source accent degrades safely when its color is missing or invalid

The chip fill and the badge SHALL be derived from the source's configured accent color only
when that value is a valid hex color. When the configured accent is absent, empty, or not a
valid hex color, the system SHALL substitute a defined fallback accent and SHALL still
render a visible chip fill and a visible, contrast-distinguishable badge (via its separating
ring) in both themes. A chip SHALL NOT render an empty, transparent, or unstyled background
as a result of a missing or invalid accent.

#### Scenario: Missing accent falls back to a defined color

- **WHEN** a source's configured accent is missing
- **THEN** the chip renders the defined fallback accent as its fill and the badge remains visible in both themes

#### Scenario: Invalid accent falls back to a defined color

- **WHEN** a source's configured accent is not a valid hex color
- **THEN** the defined fallback accent is used and no transparent or unstyled chip background results

#### Scenario: Valid committed accents are preserved

- **WHEN** every committed source defines a valid hex accent
- **THEN** each chip uses its own accent, and the fallback is not triggered

### Requirement: Selection is not signalled by color alone, and the selected label meets contrast

The selected state of a filter chip SHALL be conveyed by at least one non-color cue (for
example a ring, border, weight change, or icon) in addition to color, and the chip SHALL
continue to expose its selected state to assistive technology via `aria-pressed`. The text
label of a selected chip SHALL meet at least 4.5:1 contrast against the chip fill in both
themes.

#### Scenario: Selected state has a non-color cue

- **WHEN** a source is selected, in either theme
- **THEN** the chip shows a non-color indication of selection (such as the badge ring or border) in addition to its color

#### Scenario: Selected chip label meets contrast

- **WHEN** a source is selected in either theme
- **THEN** the chip's text label meets at least 4.5:1 contrast against the chip fill

#### Scenario: Assistive technology can read the selected state

- **WHEN** a filter chip is read by assistive technology in either state
- **THEN** `aria-pressed` reflects whether the source is currently selected
