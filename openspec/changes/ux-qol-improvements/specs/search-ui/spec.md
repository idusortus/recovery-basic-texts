# Spec Delta

## ADDED Requirements

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
