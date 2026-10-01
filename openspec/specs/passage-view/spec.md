# passage-view Specification

## Purpose

The passage page opens a source's chapter positioned on the passage a user clicked — every
search result links here, whatever its display mode — with the terms they searched for
highlighted and the highlighted passage focused and scrollable into view, previous/next
match navigation across the rendered highlights, and copy/share confirming in place. Full
text is rendered only for `full-text` sources; protected and concordance-only sources show
the official-source state instead, and the highlight and focus state is reproducible from a
shareable URL.

## Requirements

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

### Requirement: The passage page highlights the query terms in the rendered chapter text

When the passage page is loaded for a `full-text` source and the URL carries a non-empty `q`,
the rendered chapter text SHALL show every occurrence of the query's terms wrapped in a
highlight (`<mark>`), rendering each passage's text in full (not a clipped excerpt or
ellipsis). The highlighting SHALL use the same matching path as search — the same
normalized-token analysis that produces the search result's highlight offsets — so a term
highlighted in the search result is highlighted here, and query text can never be injected as
unescaped HTML (including inside the highlight markup). When `phrase=1` is present, the query
SHALL be highlighted as a single run of adjacent normalized tokens, consistent with the
token-adjacency matching of exact-phrase search. When `q` is absent or empty, no terms SHALL
be highlighted. The page SHALL NOT highlight or render the full text of a source whose
`displayMode` is not `full-text`.

#### Scenario: Query terms are highlighted in the chapter text

- **WHEN** the passage page loads for a full-text source at `?q=higher+power`
- **THEN** every occurrence of `higher` and `power` in the rendered chapter text appears inside a `<mark>` highlight

#### Scenario: The complete passage is rendered, not an excerpt

- **WHEN** the passage page loads for a full-text source and highlights a query whose terms occur in a chapter passage
- **THEN** that passage's complete text is rendered (no clipping or ellipsis), with every occurrence highlighted

#### Scenario: Highlighting uses search's matching path and is escaped

- **WHEN** a query term appears in the chapter text and the passage page highlights it
- **THEN** the highlight is produced by the same normalized-token match path used by search and all rendered text (inside and outside the highlight) is HTML-escaped

#### Scenario: Phrase mode highlights one adjacent token run

- **WHEN** the passage URL carries `phrase=1` with `q=higher+power`
- **THEN** the adjacent token run "higher power" is highlighted as a unit, matching exact-phrase search

#### Scenario: An empty query adds no highlight

- **WHEN** the passage page loads with no `q` parameter or an empty one
- **THEN** the chapter text renders with no highlight

#### Scenario: Non-full-text sources are not highlighted or rendered in full

- **WHEN** the passage page is loaded for a source whose `displayMode` is not `full-text`
- **THEN** it shows "Full text not available" and the official-source link, with no highlighted full text

### Requirement: The view scrolls to and focuses the highlighted passage

When the passage page is entered — whether by a full page load (including reload and a
shared URL opened directly) or by client-side navigation from a search result's "View
passage" affordance — with a non-empty `q` and the target passage's rendered text contains at
least one highlighted term, after the chapter has rendered the page SHALL scroll the first
highlighted term within the target passage so that it is **centered in the viewport** (clear
of the app's sticky header, which would otherwise occlude the top of the highlight) and SHALL
move keyboard focus to the target passage, so keyboard and screen-reader users land on the
highlighted text. The centered position SHALL hold on both entry paths. The focused
target passage SHALL show a visible focus indication that is not conveyed by color alone.
When the query yields no highlighted term in the target passage, or when `q` is absent or
empty, the page SHALL retain its prior behavior — scrolling to and ringing the target passage
— without attempting to focus a highlight. The focus/scroll application SHALL run after the
navigation's own scroll handling so that a client-side entry is positioned the same as a full
page load, and SHALL be a safe no-op before the target has rendered.

#### Scenario: Full page load centers the highlighted passage

- **WHEN** a passage URL carrying a query is loaded as a full page load
- **THEN** the first highlighted term within the target passage is centered in the viewport
  (not occluded by the sticky header) and keyboard focus is on the target passage

#### Scenario: Client-side navigation from a search result centers the highlighted passage

- **WHEN** the user activates "View passage" from a search result, entering the passage page by client-side navigation rather than a full page load
- **THEN** the page is not left scrolled to the top and the first highlighted term within the
  target passage is centered in the viewport (clear of the sticky header), with keyboard focus
  on the target passage

#### Scenario: The focused passage shows a visible focus indication

- **WHEN** the target passage has received programmatic focus
- **THEN** a visible focus indication (not color alone) is shown on it

#### Scenario: No match in the target passage falls back to prior behavior

- **WHEN** the query has no occurrence in the target passage
- **THEN** the page scrolls to and rings the target passage without focusing a highlight

#### Scenario: No query keeps the current passage behavior

- **WHEN** the passage page loads without a query
- **THEN** the page scrolls to and rings the target passage as it does today, with no highlight or programmatic focus change

### Requirement: Highlight and focus state are reproducible from the URL

The passage page SHALL reproduce the same highlight and focus state when its URL is
reloaded, shared to another browser session, or reached through back/forward navigation. The
URL SHALL be the only place this state is persisted; the page SHALL NOT use local storage,
cookies, accounts, bookmarks, or notes to remember it.

#### Scenario: Reload reproduces the highlight

- **WHEN** a passage URL carrying a query is reloaded
- **THEN** the same terms are highlighted and the same target passage is focused and scrolled to

#### Scenario: A shared URL reproduces the highlight elsewhere

- **WHEN** a passage URL carrying a query is opened in a different browser session
- **THEN** the same terms are highlighted and the same target passage is focused and scrolled to

#### Scenario: Back and forward reproduce the state

- **WHEN** the user navigates back to and forward from a passage URL carrying a query
- **THEN** the highlight and focus state are reproduced from the URL on each visit

### Requirement: Passage rendering stays within the MVP guardrails

Passage rendering SHALL remain restricted to public-domain `full-text` sources. The change
SHALL NOT render full text for any source whose `displayMode` is not `full-text`, SHALL NOT
add authentication, user accounts, bookmarks, or notes, and SHALL NOT introduce non-AA
literature or other fellowship content.

#### Scenario: Non-full-text sources are still never shown in full

- **WHEN** any passage page for a source whose `displayMode` is not `full-text` is viewed
- **THEN** no full text is rendered and only the official-source link is offered

#### Scenario: No persistence beyond the URL is introduced

- **WHEN** a highlighted passage is viewed
- **THEN** no account, bookmark, or note is created and no storage beyond the URL is used for the highlight/focus state; a single namespaced, device-local, never-transmitted display-preference key MAY be stored to remember the reader's font-size/spacing choice

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

### Requirement: Reader preferences adjust the full-text passage body

On the passage page for a source whose `displayMode` is `full-text`, a labeled
"reading settings" control SHALL let the reader adjust the passage **body** font
size across a finite set of steps and toggle line spacing between normal and
relaxed. The preferences SHALL affect only the passage body text, not the
surrounding chrome (citation header, actions, match/navigation controls). When
local browser storage is available, the chosen preferences SHALL persist under a
namespaced key; they SHALL require no account and SHALL NOT be transmitted or
synced. When storage is unavailable, the control SHALL still function in memory
and SHALL NOT error. When the reader has never changed the setting, the page
SHALL NOT apply an explicit font-size override, so the browser/user's own
text-size setting still applies.
The control SHALL be keyboard-operable; its controls SHALL be a labeled group
with descriptive accessible names; the current state SHALL be conveyed by more
than color alone; and a change SHALL be able to return to the default step. The
preferences SHALL NOT alter the existing query highlighting, the entry
scroll/focus, or match navigation on that page. A source whose `displayMode` is
not `full-text` SHALL NOT offer the control.

#### Scenario: A full-text passage page offers reading settings

- **WHEN** the passage page is opened for a `full-text` source
- **THEN** a labeled reading-settings control is present and adjusts the passage body font size and line spacing

#### Scenario: A non-full-text passage page offers no reading settings

- **WHEN** the passage page is opened for a source whose `displayMode` is not `full-text`
- **THEN** no reading-settings control is present, and no passage body text is rendered

#### Scenario: The default does not override the browser's text size

- **WHEN** the passage page is opened and the reader has never changed the setting
- **THEN** the passage body carries no explicit font-size override, so the browser/user's own text-size setting applies

#### Scenario: Returning to the default removes the override

- **WHEN** the reader steps the font size back to the default step (or steps the spacing back to normal)
- **THEN** the passage body no longer carries that explicit override and the default appearance is restored

#### Scenario: A changed preference applies to the body and persists

- **WHEN** the reader increases the font size and toggles line spacing to relaxed
- **THEN** the passage body renders at the chosen size and spacing, and the choice is still applied after a reload on the same browser

#### Scenario: The preference is local only

- **WHEN** the reader changes the preference
- **THEN** no network request, account, sync, or usage-log record carries it, and no account is required

#### Scenario: The control is keyboard-operable, labeled, and not color-only

- **WHEN** a keyboard or assistive-technology user reaches the reading-settings group
- **THEN** the controls are keyboard-operable, the group is labeled with descriptive accessible names, and the current state is conveyed by more than color alone

#### Scenario: Chrome is unaffected by the preference

- **WHEN** the reader changes the font size or line spacing
- **THEN** the citation header, actions, and match/navigation controls render unchanged

#### Scenario: Existing highlight and focus behavior is preserved

- **WHEN** a passage URL carrying a query is shown and the reader changes the reading preference
- **THEN** the existing query highlighting, entry scroll/focus, and match navigation continue to work unchanged

### Requirement: A Listen control reads the rendered full-text passage aloud

On the passage page for a source whose `displayMode` is `full-text`, the page
SHALL offer a "Listen" control that reads the rendered passage text aloud using
the browser's built-in speech-synthesis capability, with no external service,
no network request, and no data leaving the device. The control SHALL play and
pause playback; the playing/paused state SHALL be announced accessibly; and
playback SHALL stop when the page is left (unmount or navigation) and whenever
the passage being viewed changes, including within-route chapter/passage
navigation, so speech never continues into a different passage. Listen SHALL
read only the passage text the page renders for a `full-text` source — never
protected text and never hidden or non-rendered content. When the browser's
speech-synthesis capability is unavailable, the page SHALL NOT present a working
Listen control (the affordance is absent or clearly disabled) and SHALL NOT
error. Listen SHALL NOT alter the existing query highlighting, entry
scroll/focus, or match navigation. A source whose `displayMode` is not
`full-text` SHALL NOT offer Listen.

#### Scenario: A full-text passage page offers Listen

- **WHEN** the passage page is opened for a `full-text` source
- **THEN** a Listen control is present and reads the rendered passage text aloud

#### Scenario: A non-full-text passage page offers no Listen

- **WHEN** the passage page is opened for a source whose `displayMode` is not `full-text`
- **THEN** no Listen control is present, and no passage text is read

#### Scenario: Play and pause with an announced state

- **WHEN** the reader activates Listen and then pauses it
- **THEN** playback starts, then pauses, and the playing/paused state is announced to assistive technology

#### Scenario: Playback stops when leaving the page

- **WHEN** the reader navigates away from (or unmounts) the passage page while it is speaking, or navigates within the route to a different passage/chapter
- **THEN** playback stops and does not continue into the newly shown passage

#### Scenario: Only rendered full-text passage content is read

- **WHEN** Listen is activated on a `full-text` passage page
- **THEN** only the passage text rendered for that full-text source is spoken — no protected text and no hidden or non-rendered content

#### Scenario: Unavailable speech synthesis degrades gracefully

- **WHEN** the browser does not provide speech synthesis
- **THEN** no working Listen control is shown (absent or clearly disabled), nothing is spoken, and no error is surfaced to the reader

#### Scenario: No external service or network is used

- **WHEN** Listen is used
- **THEN** no network request is made and no data leaves the device

#### Scenario: Match navigation is not disrupted

- **WHEN** a passage URL carrying a query with multiple matches is shown and Listen is used
- **THEN** the existing match navigation and its focus/scroll behavior remain available and unchanged
