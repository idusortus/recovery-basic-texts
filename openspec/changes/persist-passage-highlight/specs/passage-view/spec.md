# Spec Delta

## Purpose

The passage page opens a full-text source's chapter positioned on the passage a user
clicked, with the terms they searched for highlighted and the highlighted passage focused
and scrollable into view, reproducible from a shareable URL.

## ADDED Requirements

### Requirement: Full-text results link to the passage with the query carried

The "View passage" affordance SHALL be offered only for search results whose source display
mode is `full-text`. Results from a source whose `displayMode` is not `full-text` SHALL NOT
gain that affordance and SHALL keep linking to the source's official site instead.
Activating "View passage" SHALL navigate to `/passage/{sourceId}/{passageId}` carrying the
current query in the URL:
a non-empty query as the `q` parameter, and, when exact-phrase mode is active, `phrase=1` as
well. An empty query SHALL carry neither parameter. The link SHALL be an ordinary
navigation link (a shareable URL), not a script-only action.

#### Scenario: A full-text result carries its query

- **WHEN** a full-text result is shown for the query `higher power` and the user activates "View passage"
- **THEN** the browser navigates to `/passage/{sourceId}/{passageId}?q=higher+power`

#### Scenario: Exact-phrase mode is carried

- **WHEN** exact-phrase mode is active for the query `higher power` and the user activates "View passage"
- **THEN** the destination URL carries both `q=higher+power` and `phrase=1`

#### Scenario: An empty query adds no parameters

- **WHEN** a full-text result's "View passage" link is built while the active query is absent or empty
- **THEN** its `href` carries neither `q` nor `phrase`

#### Scenario: Non-full-text results do not gain a passage link

- **WHEN** a result comes from a source whose `displayMode` is not `full-text`
- **THEN** it shows "Read at official source" and does not show a "View passage" link

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
highlighted term within the target passage into view and SHALL move keyboard focus to the
target passage, so keyboard and screen-reader users land on the highlighted text. The focused
target passage SHALL show a visible focus indication that is not conveyed by color alone.
When the query yields no highlighted term in the target passage, or when `q` is absent or
empty, the page SHALL retain its prior behavior — scrolling to and ringing the target passage
— without attempting to focus a highlight. The focus/scroll application SHALL run after the
navigation's own scroll handling so that a client-side entry is positioned the same as a full
page load, and SHALL be a safe no-op before the target has rendered.

#### Scenario: Full page load lands on the highlighted passage

- **WHEN** a passage URL carrying a query is loaded as a full page load
- **THEN** the first highlighted term within the target passage is scrolled into view and keyboard focus is on the target passage

#### Scenario: Client-side navigation from a search result lands on the highlighted passage

- **WHEN** the user activates "View passage" from a search result, entering the passage page by client-side navigation rather than a full page load
- **THEN** the page is not left scrolled to the top: the first highlighted term within the target passage is scrolled into view and keyboard focus is on the target passage

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
- **THEN** no account, bookmark, or note is created and no storage beyond the URL is used
