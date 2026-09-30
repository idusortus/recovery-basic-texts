# Spec Delta

## REMOVED Requirements

### Requirement: Full-text results link to the passage with the query carried

**Reason**: The "View passage" affordance is no longer restricted to `full-text`
sources. The passage page already renders the protected "Full text not
available" state plus the official link, so every result — including `snippet`
and `concordance-only` results — can expose its passage page rather than only
linking out. This reverses the old requirement's explicit "non-full-text results
SHALL NOT gain that affordance" clause, so it is replaced rather than modified.

**Migration**: Superseded by "Every result links to its passage page with the
query carried" below, which keeps the query-carrying behavior for `full-text`
results and extends the affordance to all results while still never rendering
protected full text.

## ADDED Requirements

### Requirement: Every result links to its passage page with the query carried

The "View passage" affordance SHALL be offered for every search result,
regardless of the source's display mode. Activating it SHALL navigate to
`/passage/{sourceId}/{passageId}` carrying the current query in the URL: a
non-empty query as the `q` parameter, and, when exact-phrase mode is active,
`phrase=1` as well. An empty query SHALL carry neither parameter. The link SHALL
be an ordinary navigation link (a shareable URL), not a script-only action. For a
source whose `displayMode` is not `full-text`, the destination passage page SHALL
present the "Full text not available" state and the official-source link and
SHALL NOT render the passage's text. The result card's share affordance SHALL
share the passage page URL for every result.

#### Scenario: A full-text result carries its query

- **WHEN** a full-text result is shown for the query `higher power` and the user activates "View passage"
- **THEN** the browser navigates to `/passage/{sourceId}/{passageId}?q=higher+power`

#### Scenario: Exact-phrase mode is carried

- **WHEN** exact-phrase mode is active for the query `higher power` and the user activates "View passage"
- **THEN** the destination URL carries both `q=higher+power` and `phrase=1`

#### Scenario: An empty query adds no parameters

- **WHEN** a result's "View passage" link is built while the active query is absent or empty
- **THEN** its `href` carries neither `q` nor `phrase`

#### Scenario: A protected result also links to its passage page

- **WHEN** a result comes from a source whose `displayMode` is not `full-text`
- **THEN** it still offers "View passage", navigating to that passage's page

#### Scenario: The protected passage page never renders full text

- **WHEN** the passage page is opened for a source whose `displayMode` is not `full-text`
- **THEN** it shows "Full text not available" and the official-source link, with no passage text rendered or copied

#### Scenario: The share affordance targets the passage page

- **WHEN** a result's share affordance is used
- **THEN** it shares the result's passage page URL, for both full-text and protected sources

### Requirement: Copy and share confirm in place on the passage page

When the passage page shows its Copy and Share controls (the `full-text`
controls), a successful Copy SHALL change that control's own label to a
confirmation for a short period before reverting, and a Share that copies a link
to the clipboard SHALL likewise change its label to a link-copied confirmation.
The in-place confirmation SHALL NOT depend on a toast being present, and a failed
action SHALL convey failure rather than a success confirmation. This change
introduces no copy affordance for a source whose `displayMode` is not `full-text`;
protected sources continue to render no copyable passage text.

#### Scenario: Copy confirms on the control

- **WHEN** the user activates Copy on the passage page and the copy succeeds
- **THEN** the control's label changes to a confirmation and later reverts

#### Scenario: Share-copy confirms on the control

- **WHEN** the user activates Share and the link is copied to the clipboard
- **THEN** the control's label changes to a link-copied confirmation

#### Scenario: Failure is not reported as success

- **WHEN** a copy action on the passage page fails
- **THEN** the control conveys failure and does not show a success confirmation

#### Scenario: Confirmation does not require a toast

- **WHEN** a Copy action succeeds while the toast surface is unavailable
- **THEN** the control still shows its in-place confirmation

#### Scenario: No copy affordance for protected sources

- **WHEN** the passage page is shown for a source whose `displayMode` is not `full-text`
- **THEN** no copy control that could place the passage text on the clipboard is present

### Requirement: Previous and next match navigation cycles the highlighted occurrences

When the passage page shows one or more highlighted (`<mark>`) occurrences, it
SHALL offer Previous and Next controls that move through those occurrences in
document order, scrolling the selected occurrence to the center of the viewport
(clear of the app's sticky header) and indicating the current match to assistive
technology. The initial current match SHALL be the first highlighted occurrence
within the target passage — the occurrence the entry scroll centers — so the
indicator and the initial scroll agree; occurrences are ordered in document order
across the rendered chapter. The controls SHALL be unavailable when there are
fewer than two occurrences, and SHALL stop at the first and last occurrence
rather than wrap. The controls SHALL be a transient view affordance: they SHALL
NOT require or write any persistence beyond the current URL's existing highlight
state.

#### Scenario: The initial current match follows the entry scroll

- **WHEN** the passage page enters with a query whose terms occur in the target passage
- **THEN** the current match indicator names the first occurrence within the target passage, the occurrence the entry scroll centers

#### Scenario: Next centers the following occurrence

- **WHEN** the page shows at least two highlighted occurrences and the user activates Next
- **THEN** the next occurrence in document order is centered in the viewport and announced as the current match

#### Scenario: Previous centers the preceding occurrence

- **WHEN** the page shows at least two highlighted occurrences and the user activates Previous
- **THEN** the previous occurrence in document order is centered in the viewport and announced as the current match

#### Scenario: Fewer than two occurrences has no navigation

- **WHEN** the page shows zero or one highlighted occurrence
- **THEN** the Previous/Next controls are unavailable

#### Scenario: Navigation clamps at the ends

- **WHEN** the current match is the first occurrence and the user activates Previous, or the last occurrence and the user activates Next
- **THEN** the current match does not move and does not wrap to the other end

#### Scenario: Navigation does not introduce persistence

- **WHEN** the user moves between matches
- **THEN** no account, bookmark, note, or storage beyond the existing URL highlight state is created
