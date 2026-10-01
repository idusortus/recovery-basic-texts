# Spec Delta

## ADDED Requirements

### Requirement: Local recent searches are offered beneath the search input

The search surface SHALL persist a small list of the user's most recent
distinct submitted queries in local browser storage under a namespaced key, and
SHALL render that list as a compact "Recent" row beneath the search input on
the home/empty state only (when no query is active). A query SHALL be added to
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

### Requirement: Returning to the results restores the query and scroll position

After the user opens a passage from a scrolled result list and returns by
browser history navigation (Back), the search surface SHALL show the same
active query **and** approximately the same scroll position as when the user
left. The query SHALL continue to be reproduced from the URL (`q`, `phrase`,
`sources`) as it is today. Because results render asynchronously after the
search index loads, the restored scroll offset SHALL be re-applied only after
the restored results have rendered, not before; until then the offset SHALL be
held and applied once results are present. A restored query that produces zero
results has nothing to scroll to and SHALL land at the top (the
"approximately" allowance covers a missing or clamped position). A snapshot
persisted by an earlier visit SHALL be ignored on the initial load of the page,
so a fresh visit starts at the top. Restoration SHALL apply to history
navigation (back/forward) and SHALL NOT move a fresh visit to the search page
or an in-page search away from its normal starting position. The mechanism SHALL
use no account, no transmitted data, and no storage beyond what browser history
/session state already provides; it SHALL NOT introduce bookmarks, notes, or a
new server-side persistence surface.

#### Scenario: Back from a passage restores the query and scroll

- **WHEN** the user scrolls a result list, opens a passage, and presses browser Back
- **THEN** the search surface shows the same query and is scrolled to approximately the same position it had before the passage was opened

#### Scenario: Restoration happens after the results render

- **WHEN** the user returns to the results by history navigation
- **THEN** the restored scroll position is applied after the asynchronous result list has rendered, rather than being lost while the list is still empty

#### Scenario: A fresh search page starts at the top

- **WHEN** the user opens the search surface by a fresh navigation with no prior history entry to restore
- **THEN** the page is positioned normally (not scrolled to a stale offset)

#### Scenario: Back and forward reproduce the position

- **WHEN** the user navigates forward from and back to the results by history navigation
- **THEN** the query and approximate scroll position are reproduced on each visit

#### Scenario: No account or new persistence is introduced

- **WHEN** the scroll position is restored
- **THEN** no account, bookmark, note, or server-side persistence is created and no data is transmitted

### Requirement: A result card shows its passage page reference when available

Each search result card SHALL display its passage's page reference (for example
`p.58`) on the card header, next to the existing chapter/section label, whenever
the passage carries a page reference. When the passage has no page reference,
the card SHALL render no page-reference text and no empty separator or dangling
punctuation for the missing value. The page reference SHALL be rendered as a
sibling of the chapter/section label, outside the result's heading element, so
the heading's announced text is unchanged and the card still exposes the same
source/chapter heading. Showing the page reference SHALL NOT change existing
copy or citation behavior.

#### Scenario: A passage with a page reference shows it

- **WHEN** a result's passage carries a page reference (for example `p.58`)
- **THEN** the card header shows that page reference next to the chapter label

#### Scenario: A passage without a page reference omits it cleanly

- **WHEN** a result's passage has no page reference (for example a Daily Reflections entry)
- **THEN** the card shows no page-reference text and no leftover separator or punctuation where it would appear

#### Scenario: The page reference is outside the heading

- **WHEN** a result's passage carries a page reference
- **THEN** the page reference is rendered adjacent to, but outside, the result's heading, so the heading still announces only the source/chapter line

#### Scenario: Heading navigation is unchanged

- **WHEN** an assistive-technology user navigates the results by heading
- **THEN** each result is still reachable by the same source/chapter heading as before

#### Scenario: Copy and citation are unchanged

- **WHEN** the user copies a result
- **THEN** what is copied is exactly what the existing copy behavior produces, unaffected by the displayed page reference

### Requirement: The Copy control's label matches what it copies

The visible label of a result card's Copy control SHALL truthfully describe the
payload it places on the clipboard for the result's display mode: for a
`full-text` source, which copies the whole passage, it SHALL read "Copy
passage"; for a `snippet` or `concordance-only` source, which copies only the
clipped excerpt, it SHALL read "Copy excerpt". The control's accessible name
SHALL name the same payload description as the visible label (it MAY add
non-contradictory context such as "to clipboard"). This SHALL NOT change the
payload itself or the existing copyright guard (protected sources still copy
only the clipped excerpt), and the existing in-place success/failure
confirmation behaviour SHALL be preserved.

#### Scenario: A full-text result offers "Copy passage"

- **WHEN** a result from a `full-text` source is shown
- **THEN** its Copy control's visible label reads "Copy passage" and its accessible name names the same payload

#### Scenario: A protected result offers "Copy excerpt"

- **WHEN** a result from a `snippet` or `concordance-only` source is shown
- **THEN** its Copy control's visible label reads "Copy excerpt" and its accessible name names the same payload

#### Scenario: The payload is unchanged

- **WHEN** the user copies a full-text result and, separately, a protected result
- **THEN** the full-text copy contains the whole passage and the protected copy contains only the clipped excerpt, exactly as before

#### Scenario: Confirmation still replaces the label

- **WHEN** the Copy action succeeds
- **THEN** the control's label changes to the confirmation and later reverts to the mode-appropriate label
