# Spec Delta

## MODIFIED Requirements

### Requirement: Reference texts are discoverable through existing surfaces

Newly registered reference sources SHALL become discoverable without new
application code: each **search-indexed** reference source SHALL be reachable by
search through its indexed passage text and passage `title`/`chapterRef`, and
the `/sources` page SHALL list **all** registered reference sources, including
disabled ones, from the same registry. The source-filter chips are a
**presentation** surface separate from the search index: a source MAY be indexed
for search while being excluded from the chips, and that separation SHALL be
driven by a registry field rather than a hard-coded id list in application code.
The reference sources (`twelve-steps`, `twelve-traditions`, `twelve-concepts`,
`promises-and-prayers`) SHALL be excluded from the source-filter chips, while
remaining searchable where indexed and listed on `/sources`; the gated
`twelve-concepts` is registered disabled, so it is neither a chip nor indexed
and appears on `/sources` only. Adding a chip to the hard-coded topic-browse
list is NOT required and SHALL NOT be done as part of this capability.

#### Scenario: An enabled reference source gets a filter chip and a sources card

- **WHEN** a reference source is enabled in the registry
- **THEN** it appears as a card on `/sources`, with its title, copyright status, and display mode, and it is reachable by search through its indexed passage text and passage `title`/`chapterRef`, but it is excluded from the source-filter chips

#### Scenario: A reference source is excluded from the filter chips

- **WHEN** the search surface renders its "Filter Sources" chips
- **THEN** the four reference sources (`twelve-steps`, `twelve-traditions`, `twelve-concepts`, `promises-and-prayers`) are not rendered as chips, while other enabled sources are

#### Scenario: The chip exclusion is registry-driven, not hard-coded

- **WHEN** the source-filter chips are computed
- **THEN** they are derived from a registry field on each source and not from an id list embedded in the page or component

#### Scenario: A disabled reference source appears only on /sources

- **WHEN** a reference source is registered with `enabled: false` (for example the gated `twelve-concepts`)
- **THEN** it appears on `/sources` with its title, copyright status, and display mode, is not a source-filter chip, and its text is not indexed for search

#### Scenario: Search reaches a reference source by its named title

- **WHEN** a user searches a word that names a reference text (for example `promises`)
- **THEN** at least one passage from the matching reference source is still returned, because the passage's indexed `title`/`chapterRef` names the text and the source remains indexed even though it has no filter chip

#### Scenario: No topic-list change is required

- **WHEN** the reference texts are added or their filterability is changed
- **THEN** the hard-coded topic-browse list is unchanged and the reference texts remain reachable through search, `/sources`, and the reference reader

### Requirement: Reference sources stay within the MVP guardrails

Adding reference sources, and surfacing them through the reference reader,
SHALL NOT introduce authentication, accounts, bookmarks, notes, non-AA
literature, or any user-data surface, and SHALL NOT render full text for any
source that is not a documented-basis `full-text` source. The reference reader
is a permitted surface: the earlier prohibition on a dedicated reference page is
superseded by the `reference-reader` capability, and the reader SHALL be bound
by the same full-text guard — a source without a documented basis SHALL render
as a gated placeholder and no text from it SHALL be rendered, copied, or
announced.

#### Scenario: No new page, route, or account surface

- **WHEN** the reference texts are surfaced
- **THEN** the only new page or route is the `/reference` reader defined by the `reference-reader` capability, the reader introduces no authentication or user-data surface, and the texts otherwise remain reachable through the existing registry-driven search and `/sources` views

#### Scenario: Protected text is never rendered in full

- **WHEN** a reference source's basis is not documented
- **THEN** the source stays disabled and no text from it is rendered or copied on any surface, including the reference reader; only its `/sources` card, its gated reader placeholder, and its external link are offered

#### Scenario: The reader is not a user-data surface

- **WHEN** the reference reader is used
- **THEN** no authentication, account, bookmark, note, or server-side personal state is introduced

#### Scenario: No non-AA literature is introduced

- **WHEN** the reference reader and the reference sources are inspected
- **THEN** only AA literature already in the catalog is present, and no additional non-AA or non-Big-Book source is added
