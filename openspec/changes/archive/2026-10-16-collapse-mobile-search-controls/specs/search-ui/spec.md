# Spec Delta

## ADDED Requirements

### Requirement: Mobile disclosure control

On viewports below the `md` breakpoint, the three secondary control clusters — Recent searches, Filter Sources + Exact phrase, and Popular Recovery Searches — SHALL be hidden by default behind a single labeled disclosure control directly beneath the search input. At `md` and above, the clusters SHALL render inline exactly as they do today.

#### Scenario: Home state on a narrow viewport hides the clusters

- **WHEN** the home/empty state renders at a viewport below `md`
- **THEN** the Recent searches row, Filter Sources chips, Exact phrase toggle, and Popular Recovery Searches chips are not visible by default
- **AND** a single disclosure toggle labeled for the collapsed state is shown beneath the search input

#### Scenario: Results state on a narrow viewport hides the filter cluster

- **WHEN** an active query and results render at a viewport below `md`
- **THEN** the Filter Sources chips and Exact phrase toggle are not visible by default
- **AND** a single disclosure toggle labeled for the collapsed state is shown beneath the search input
- **AND** the results continue to reflect the active filter and phrase settings

#### Scenario: Desktop viewport keeps the clusters inline

- **WHEN** the page renders at a viewport of `md` or wider
- **THEN** the Recent searches row, Filter Sources chips, Exact phrase toggle, and Popular Recovery Searches chips all render inline (not collapsed) beneath the search input
- **AND** the three clusters keep their existing relative order (Recent searches, then Filter Sources and Exact phrase, then Popular Recovery Searches)
- **AND** the mobile disclosure toggle is not visible
- **AND** the dashboard cards keep their existing content, order, and behavior

Note: grouping the clusters into one panel relocates the shortcut-hint line and the display-mode legend to below that panel on desktop. Neither loses any of its own guarantees, and the dashboard-card order contract in `home-dashboard` is unaffected.

#### Scenario: Crossing the breakpoint reveals the inline clusters

- **WHEN** the viewport is resized from below `md` to `md` or wider while the panel is open
- **THEN** the clusters render inline as before
- **AND** the disclosure toggle is no longer visible

#### Scenario: Submitting a search keeps the open panel open

- **WHEN** the user submits a search while the panel is open
- **THEN** the panel remains open
- **AND** the filter cluster stays reachable

#### Scenario: No filterable sources still opens the disclosure

- **WHEN** no source is filterable
- **THEN** the disclosure still opens and shows whatever clusters are available (Recent and/or Popular)
- **AND** no empty filter group is rendered

### Requirement: Disclosure toggle is accessible

The disclosure control SHALL be a native button with `aria-expanded` reflecting the current state, `aria-controls` referencing the panel container, and an accessible name that describes the action and the current state. The accessible name SHALL contain the control's visible label text ("More"), satisfying WCAG 2.5.3 Label in Name.

#### Scenario: Collapsed toggle exposes the collapsed state

- **WHEN** the disclosure panel is collapsed
- **THEN** the toggle has `aria-expanded="false"`
- **AND** the toggle has `aria-controls` pointing to the panel's `id`
- **AND** the toggle's accessible name contains the toggle's visible label text ("More") and indicates that search options are hidden and can be shown

#### Scenario: Expanded toggle exposes the expanded state

- **WHEN** the disclosure panel is expanded
- **THEN** the toggle has `aria-expanded="true"`
- **AND** the toggle's accessible name contains the toggle's visible label text ("More") and indicates that search options are visible and can be hidden

### Requirement: Hidden panel content leaves the keyboard and assistive-technology order

While the disclosure panel is collapsed, its controls SHALL NOT be reachable by keyboard or exposed to assistive technology. The panel SHALL remain in the document at all times and SHALL be hidden while collapsed (for example via the `hidden` attribute or an equivalent that removes it from the accessibility tree and tab order) rather than being removed from the DOM, so the toggle's `aria-controls` reference always has a valid target. When the panel is expanded, every existing per-control guarantee SHALL continue to apply.

#### Scenario: Collapsed controls are not focusable

- **WHEN** the disclosure panel is collapsed
- **THEN** the panel remains in the document but is hidden
- **AND** no control inside the panel is in the Tab sequence
- **AND** no control inside the panel is announced by a screen reader

#### Scenario: Expanded controls retain their accessible markup

- **WHEN** the disclosure panel is expanded
- **THEN** source filter chips continue to expose `aria-pressed`
- **AND** the last active source chip continues to expose `aria-disabled="true"` with its reason via `aria-describedby`
- **AND** the Exact phrase toggle continues to show its non-glyph "On"/"Off" state indicator and `aria-pressed`
- **AND** the Recent searches row continues to be exposed as a labeled group with descriptive accessible names

### Requirement: Collapsed toggle indicates non-default filters

The collapsed disclosure toggle SHALL display a small count badge when the filter set is non-default, and SHALL display no indicator when the filter set is at defaults. The indicator SHALL be conveyed to assistive technology and SHALL NOT rely on color alone.

#### Scenario: Count badge appears when a source is deselected

- **WHEN** one or more sources are deselected while the panel is collapsed
- **THEN** the collapsed toggle shows a count reflecting the number of non-default filter conditions
- **AND** the count is included in the toggle's accessible name

#### Scenario: Count badge appears when exact-phrase mode is on

- **WHEN** exact-phrase mode is enabled while the panel is collapsed
- **THEN** the collapsed toggle shows a count reflecting the non-default exact-phrase state
- **AND** the count is included in the toggle's accessible name

#### Scenario: No indicator at defaults

- **WHEN** all filterable sources are selected and exact-phrase mode is off
- **THEN** the collapsed toggle shows no count badge
- **AND** the toggle's accessible name does not mention changed filters

### Requirement: Filtering behavior is unchanged by the disclosure

Toggling a source filter or the Exact phrase control inside the expanded panel SHALL update the URL, re-run the search, and enqueue the anonymous usage log exactly as those controls do today. A collapsed panel SHALL NOT disable, clear, or otherwise alter the active filter set.

#### Scenario: Source toggle inside the panel updates state

- **WHEN** the user deselects a source from inside the expanded panel
- **THEN** the URL names the active source set
- **AND** the search re-runs with the new source set
- **AND** a log record is enqueued as for an explicit submit

#### Scenario: Exact-phrase toggle inside the panel updates state

- **WHEN** the user turns exact-phrase mode on from inside the expanded panel
- **THEN** the URL carries the phrase flag
- **AND** the search re-runs in exact-phrase mode
- **AND** a log record is enqueued as for an explicit submit

#### Scenario: Results honor filters while the panel is collapsed

- **WHEN** the user has active filters and then collapses the panel
- **THEN** the results continue to reflect the active filters
- **AND** the URL continues to carry the active filter state

### Requirement: Expanded panel manages keyboard focus

Expanding the panel SHALL move focus to its first focusable control. Collapsing the panel SHALL return focus to the disclosure toggle. While the panel is open, keyboard focus SHALL remain inside the panel, and pressing `Escape` SHALL close it.

#### Scenario: Opening moves focus into the panel

- **WHEN** the user expands the disclosure panel
- **THEN** focus moves to the first focusable element inside the panel

#### Scenario: Escape closes the panel and returns focus

- **WHEN** the panel is expanded and the user presses `Escape`
- **THEN** the panel collapses
- **AND** focus returns to the disclosure toggle

#### Scenario: Tab cycles within the open panel

- **WHEN** the panel is expanded and the user presses `Tab` or `Shift+Tab`
- **THEN** focus cycles among the focusable controls inside the panel
- **AND** focus does not move to controls outside the panel until it is closed

### Requirement: Disclosure state is not persisted

The open/closed state of the disclosure panel SHALL NOT be persisted across page loads, sessions, or devices. The panel SHALL be collapsed by default on every fresh load. No account, personal data, or new storage key SHALL be introduced for this feature.

#### Scenario: Fresh load starts collapsed

- **WHEN** the user loads the page with no prior interaction
- **THEN** the disclosure panel is collapsed by default
- **AND** no localStorage or other client-side storage entry is created for the panel state

#### Scenario: Reload resets to collapsed

- **WHEN** the user expands the panel and then reloads the page
- **THEN** the page loads with the panel collapsed

## MODIFIED Requirements

### Requirement: Local recent searches are offered beneath the search input

The search surface SHALL persist a small list of the user's most recent
distinct submitted queries in local browser storage under a namespaced key, and
SHALL render that list as a compact "Recent" row on
the home/empty state only (when no query is active). The row SHALL render inline
beneath the search input at `md` and above; on viewports below `md` it SHALL be
inside the search-options disclosure panel and therefore SHALL NOT be visible
until that panel is expanded. Every other guarantee below (recording,
deduplication, the cap, tapping to re-run, clearing, local-only storage, the
accessible group, and the no-results and blank cases) is unchanged. A query SHALL be added to
the list when a search is explicitly submitted — pressing Enter, activating a
topic chip or suggestion, or activating a recent item — and SHALL NOT be added
by the as-you-type debounced search. Blank or whitespace-only input SHALL NOT
be recorded. The list SHALL hold at most the most recent 8 distinct queries;
adding a query already present SHALL deduplicate case-insensitively and move
that entry to the most-recent position, keeping the newest casing. Activating a
recent item SHALL behave as an ordinary explicit submit — running the search,
updating the URL, enqueuing the same anonymous usage log an Enter submit would
(the activated query only, never the stored list), and moving that query to the
most-recent position. The row SHALL offer a control that clears the list, which
SHALL both empty the persisted list and hide the row, and the cleared state
SHALL persist across reloads on the same browser.

The recent list is **local only**: the stored list SHALL NOT be transmitted to
any server, included in the anonymous usage log, or synced across devices or
accounts, and it SHALL require no account. The row SHALL be accessible — a
labeled group of controls with visible keyboard focus and descriptive
accessible names — and SHALL follow the existing calm, mobile-first
presentation.

#### Scenario: A submitted query is recorded

- **WHEN** the user submits a non-empty search (for example by pressing Enter)
- **THEN** that query appears in the recent list beneath the search input on the home/empty state

#### Scenario: Debounced typing is not recorded

- **WHEN** the user types a query and the debounced as-you-type search runs without an explicit submit
- **THEN** that query is not added to the recent list by the keystrokes alone

#### Scenario: Duplicates dedupe case-insensitively, keeping the most recent

- **WHEN** the user submits `Fear` and later `fear`
- **THEN** the list contains a single entry for that query, positioned as the most recent, and it uses the newer casing

#### Scenario: The list is capped

- **WHEN** more than the cap of distinct queries have been submitted
- **THEN** only the most recent queries up to the cap are kept and the oldest are evicted

#### Scenario: Tapping a recent query re-runs it

- **WHEN** the user activates an entry in the recent row
- **THEN** a search runs for that query as an ordinary explicit submit — the URL reflects the query, the query is enqueued to the anonymous usage log exactly as an Enter submit would, and the entry moves to the most-recent position

#### Scenario: The row shows only on the home/empty state

- **WHEN** a query is active and results are shown
- **THEN** the recent row is not rendered

#### Scenario: The row is an accessible, labeled group

- **WHEN** the recent row is shown and a keyboard or assistive-technology user reaches it
- **THEN** it is exposed as a labeled group of controls whose entries have visible keyboard focus and descriptive accessible names, and the clear control is reachable and described

#### Scenario: Clearing empties and hides the row

- **WHEN** the user activates the clear control
- **THEN** the persisted list is emptied and the recent row is no longer shown, and a later visit on the same browser does not show it again

#### Scenario: The list is never transmitted, logged, or synced

- **WHEN** queries are added to or cleared from the recent list
- **THEN** no network request, usage-log record, or account/sync operation carries the stored list itself, and no account is required

#### Scenario: No results still records the submitted query

- **WHEN** the user explicitly submits a query that returns zero results
- **THEN** that query is still added to the recent list

#### Scenario: Blank input is not recorded

- **WHEN** the user attempts to submit a blank or whitespace-only query
- **THEN** no entry is added to the recent list
