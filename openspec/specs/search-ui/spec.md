# search-ui Specification

## Purpose

Defines the presentation and interaction guarantees of the search surface: the source-filter
chips keep a visible, legible per-source badge in both light and dark themes, the source
accent degrades to a defined fallback rather than an absent background when its configured
color is missing or invalid, and selection is conveyed by more than color alone. Beyond the
filter chips, the surface's controls behave predictably: filter and exact-phrase state is
synced to the URL and logged as a submitted search, the last enabled source cannot be
silently deselected, the exact-phrase state is legible beyond its glyph, results are
navigable by heading, a zero-result search confirms and offers recovery, first-load index
progress advances through stages with a retry on failure, a dismissible legend explains the
display modes, keyboard shortcuts are fully wired with a matching hint, copy and share
confirm in place, and non-full-text external actions resolve the source link template.

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

### Requirement: Filter and exact-phrase changes update the URL and are logged as submitted searches

Toggling a source filter or the exact-phrase mode SHALL update the browser URL so
the resulting state — the query, the phrase flag, and the active source set — is
reproducible from and shareable as that URL, and SHALL run the search for the new
state. A filter or phrase change SHALL be treated as an explicit submit for the
anonymous usage log, consistent with pressing Enter (it SHALL enqueue a log
record for a non-empty query), so filtered searches are represented in the log.
An unchanged selection SHALL NOT emit a log record.

#### Scenario: A source toggle is shareable

- **WHEN** the user deselects a source from the default all-selected state
- **THEN** the URL names the active source set, and opening that URL reproduces the same selected sources and results

#### Scenario: A phrase toggle is shareable

- **WHEN** the user turns exact-phrase mode on
- **THEN** the URL carries the phrase flag, and reloading it restores exact-phrase mode and its result set

#### Scenario: A toggle logs the submitted search

- **WHEN** the user toggles a source or phrase mode with a non-empty query
- **THEN** one log record is enqueued for that query and active source set

#### Scenario: A no-op toggle does not log

- **WHEN** a toggle action leaves the selection unchanged (for example attempting to deselect the last source)
- **THEN** no log record is emitted

### Requirement: The last enabled source cannot be deselected, and the blocked toggle says so

When deselecting a source would leave no enabled source selected, the system
SHALL keep the selection unchanged and SHALL expose the control as unavailable
for that action by setting `aria-disabled="true"` — rather than native `disabled`,
which would remove it from the tab order — together with a non-color disabled
visual state and an accessible description of why the last source cannot be
deselected. The control SHALL remain reachable in the tab order, and its reason
SHALL remain available to assistive technology. When two or more sources are
selected, deselecting any of them SHALL work as normal.

#### Scenario: Deselecting the last source is a no-op with feedback

- **WHEN** exactly one source is selected and the user activates its toggle
- **THEN** the selection is unchanged and the control conveys that the last source cannot be deselected

#### Scenario: The blocked toggle is reachable and described

- **WHEN** exactly one source is selected and a keyboard or assistive-technology user reaches that source's toggle
- **THEN** the toggle remains focusable, exposes `aria-disabled`, and makes the reason it cannot be deselected available

#### Scenario: Deselecting is normal with two or more selected

- **WHEN** two or more sources are selected and the user activates one source's toggle
- **THEN** that source is deselected and the search re-runs without it

### Requirement: The exact-phrase toggle shows a legible non-glyph state indicator

The exact-phrase control SHALL indicate its on/off state with a visible, legible
indicator that is not the `""` / `"…"` glyph alone (for example a state word or an
icon that names the state), in addition to `aria-pressed`, so the state is legible
without interpreting the glyph and is not conveyed by color alone. Its active
styling SHALL be consistent with the active state of the source-filter chips, and
its accessible name SHALL continue to describe the action it performs.

#### Scenario: The active state shows a non-glyph indicator

- **WHEN** exact-phrase mode is on
- **THEN** the control shows a visible on-state indicator other than the glyph alone (a state word or state icon)

#### Scenario: The state is readable without the glyph

- **WHEN** a user who does not interpret the `""` / `"…"` glyph views the control in either state
- **THEN** the current on/off state is still legible from the non-glyph indicator

#### Scenario: State and action stay available to assistive technology

- **WHEN** the control is read by assistive technology
- **THEN** `aria-pressed` reflects the current state and the accessible name describes the action

### Requirement: Results are navigable by heading

Each search result card SHALL expose a heading (the source/edition/chapter line
already shown on the card) whose level is one below the source group's heading,
so assistive-technology users can move between results by heading. Every result
card in every group SHALL expose such a heading, and the heading levels SHALL be
consistent across groups.

#### Scenario: Each result exposes a heading

- **WHEN** a search returns results grouped by source
- **THEN** each result card contains a heading for its source/chapter line, nested one level below the group heading

#### Scenario: Heading navigation reaches every result

- **WHEN** an assistive-technology user navigates the results page by heading
- **THEN** each result is listed as an individually reachable heading

### Requirement: The zero-result state confirms no results and offers recovery

Whenever a search for a non-empty query returns zero results, the surface SHALL
show the "No results for …" confirmation regardless of whether a known-exception
hint is also shown. When recovery data is available, the zero-result state SHALL
additionally offer suggested searches drawn from the quick-access topic chips and
the indexed term dictionary, including at most one "Did you mean" term when the
query is a near-match for an indexed term. Activating a suggested search SHALL
run that search through the same path as typing it.

#### Scenario: A hint does not hide the no-results message

- **WHEN** a query returns zero results and a known-exception hint is shown
- **THEN** the "No results for …" message is still shown alongside the hint

#### Scenario: Suggested searches are offered

- **WHEN** a query returns zero results and recovery data is available
- **THEN** the state offers suggested searches, and activating one runs a search for it

#### Scenario: At most one did-you-mean is offered

- **WHEN** the query is a near-match for an indexed term
- **THEN** at most one "Did you mean" term is offered, and activating it runs a search for that term

#### Scenario: Recovery is absent but the message remains

- **WHEN** a query returns zero results and no suggested search or did-you-mean is available
- **THEN** the "No results for …" message is still shown

### Requirement: First-load index state advances through stages and offers retry

While the search index is loading — including on the first-load/home state before any
search — the surface SHALL show progress that advances through at least two
distinguishable named stages rather than a single static label. When loading fails, the
surface SHALL show an error state with a Retry control on both the home/first-load state and
the search state; activating Retry SHALL re-attempt loading and, when it succeeds, SHALL
clear the error and run the pending query (if the user had entered one).

#### Scenario: Loading advances through stages

- **WHEN** the search index is loading on first load
- **THEN** the surface shows progress that advances through at least two named stages

#### Scenario: A failed load offers retry

- **WHEN** loading the index fails
- **THEN** the surface shows an error and a Retry control instead of only a static failure message

#### Scenario: The failure state is visible without a query

- **WHEN** loading fails before the user has entered a query
- **THEN** the error and Retry control are shown on the home/first-load state, not only after a search

#### Scenario: Retry recovers the pending query

- **WHEN** the user activates Retry after a failure and loading then succeeds
- **THEN** the error clears and the search for the entered query runs

### Requirement: The display-mode legend explains why some results link forward

The search surface and the sources page SHALL render a compact, dismissible legend
that distinguishes Full-Text, Snippet, and Concordance display and explains that
Snippet and Concordance results link to the official source rather than showing
the full text. Dismissing the legend SHALL hide it, SHALL be remembered locally
for subsequent visits on the same browser, and SHALL require no account and
collect no personal data. The two surfaces SHALL present the same explanation.

#### Scenario: The legend names the display modes

- **WHEN** the legend is shown
- **THEN** it distinguishes Full-Text, Snippet, and Concordance display and explains that Snippet/Concordance results link to the official source

#### Scenario: Dismissal hides and is remembered

- **WHEN** the user dismisses the legend
- **THEN** it is hidden, and a later visit on the same browser does not show it again

#### Scenario: No account is required

- **WHEN** the legend is dismissed
- **THEN** no account, sign-in, or personal data is involved

#### Scenario: Both surfaces show the same explanation

- **WHEN** the legend is rendered on the search surface and on the sources page
- **THEN** both present the same set of display-mode explanations

### Requirement: Keyboard shortcuts for search are fully wired with a visible hint

The system SHALL provide a `/` shortcut that moves focus to the search input when
focus is not already inside a text-entry control, and a `?` shortcut that opens a
shortcut-help affordance. It SHALL show a visible hint naming the available
shortcuts, and SHALL NOT advertise any shortcut that is not implemented. The help
affordance SHALL close on Escape and SHALL manage focus (moving focus into the
help and returning it to the invoking context on close).

#### Scenario: `/` focuses search

- **WHEN** the user presses `/` while focus is not inside a text-entry control
- **THEN** keyboard focus moves to the search input

#### Scenario: `/` inside a field is literal

- **WHEN** focus is inside a text-entry control and the user presses `/`
- **THEN** the character is entered normally and focus does not move

#### Scenario: `?` opens help and Escape closes it

- **WHEN** the user presses `?`
- **THEN** the shortcut help opens with focus moved into it, and pressing Escape closes it and restores focus

#### Scenario: Only wired shortcuts are advertised

- **WHEN** the visible hint is read
- **THEN** every shortcut it names performs its advertised action

### Requirement: Copy and share confirm in place on the result card

When a result card's Copy action succeeds, that control's own label SHALL change
to a confirmation for a short period before reverting; when its Share action
copies a link to the clipboard, its label SHALL likewise change to a link-copied
confirmation. The in-place confirmation SHALL NOT depend on a toast being
present. When the action fails, the control SHALL convey the failure and SHALL
NOT show a success confirmation.

#### Scenario: Copy confirms on the control

- **WHEN** the user activates a result card's Copy action and the copy succeeds
- **THEN** the control's label changes to a confirmation and later reverts

#### Scenario: Share-copy confirms on the control

- **WHEN** the user activates Share and the link is copied to the clipboard
- **THEN** the control's label changes to a link-copied confirmation

#### Scenario: Failure is not reported as success

- **WHEN** a copy action fails
- **THEN** the control conveys failure and does not show a success confirmation

#### Scenario: Confirmation does not require a toast

- **WHEN** a Copy action succeeds while the toast surface is unavailable
- **THEN** the control still shows its in-place confirmation

### Requirement: The non-full-text external action resolves the source link template

For a result from a source whose display mode is not `full-text`, the external
"read at official source" action SHALL use the source's configured link template
when one is defined, resolving its placeholders: `{{query}}` against the current
query (URL-encoded) and any other placeholder against the passage's link data. A
placeholder that cannot be resolved SHALL cause the action to fall back to the
source's `officialUrl` (or, when that is absent, its `freeUrl`) rather than emit a
broken or partially-substituted link. When the source defines no link template,
the action SHALL offer the source's `officialUrl` (falling back to `freeUrl` when
absent), exactly as before. This requirement consumes the previously unused
`linkTemplate`/`linkData` fields rather than removing them.

#### Scenario: A templated source resolves the query

- **WHEN** a result from a source that defines a search-template link is shown for a query
- **THEN** its external action's URL is the template with the query URL-encoded into the `{{query}}` position

#### Scenario: A static template still resolves

- **WHEN** a source defines a template with no placeholders
- **THEN** the action uses that URL

#### Scenario: An unresolvable placeholder falls back

- **WHEN** a template references a placeholder that the passage's link data does not provide
- **THEN** the action falls back to the source's `officialUrl` (or `freeUrl` when absent)

#### Scenario: No template keeps the official URL

- **WHEN** a source defines no link template and has an official URL
- **THEN** the action offers the source's `officialUrl` (or `freeUrl` when absent) as before
