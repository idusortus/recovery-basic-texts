# Spec Delta

## Purpose

Defines the short, meeting-referenced recovery texts that basictexts.org exposes as named,
searchable corpus sources — the Twelve Steps, the long form of the Twelve Traditions, the
Twelve Concepts for World Service, and the Ninth Step Promises and step prayers — together
with the copyright-basis, provenance, overlap, and discoverability guarantees those sources
carry. The Eleventh Step prayer is not public-domain Big Book text and is deliberately outside
this catalog; it already remains reachable through the existing `twelve-steps-traditions`
(12&12) `snippet` source.

## ADDED Requirements

### Requirement: Reference texts are registry-driven corpus sources

Each reference text SHALL be exposed as an ordinary corpus source through the existing
registry path — one entry in `corpus/sources.json` and one passage array in
`corpus/sources/<source-id>.json` — and SHALL require no application code change to add or
remove. The catalog SHALL consist of the following sources, each with a stable kebab-case id,
a display mode, and a `sortOrder` that groups it with the existing sources:

- `twelve-steps` — the Twelve Steps, `full-text`
- `twelve-traditions` — the long form of the Twelve Traditions, `full-text`
- `twelve-concepts` — the Twelve Concepts for World Service; shipped **disabled** and enabled
  as `full-text` only once the copyright-basis precondition is met (its display mode is
  `full-text` at enablement, and there is no `snippet` fallback)
- `promises-and-prayers` — the Ninth Step Promises and the Third and Seventh Step prayers,
  `full-text`

#### Scenario: Each reference text appears as a source

- **WHEN** `corpus/sources.json` is read
- **THEN** it contains an entry for each of `twelve-steps`, `twelve-traditions`,
  `twelve-concepts`, and `promises-and-prayers`, each with its own display mode, color,
  `officialUrl`/`freeUrl`, and `sortOrder`

#### Scenario: Adding a reference text needs no application code

- **WHEN** a reference source is added or removed through the registry and its corpus file
- **THEN** the application builds, the source filter and `/sources` page reflect the change,
  and no file under `src/` had to change

#### Scenario: The disabled placeholder is repurposed, not duplicated

- **WHEN** the Twelve Traditions sources are inspected
- **THEN** there is a single enabled `twelve-traditions` entry carrying the long-form text,
  with no second near-duplicate Traditions entry left behind

#### Scenario: The Eleventh Step prayer is not reproduced in the reference catalog

- **WHEN** the `promises-and-prayers` passages are inspected
- **THEN** they contain the Ninth Step Promises and the Third and Seventh Step prayers only;
  the Eleventh Step prayer is not reproduced there and remains reachable through the existing
  `twelve-steps-traditions` (12&12) `snippet` source

### Requirement: A reproduction basis is documented before any reference text is full-text

Before a reference source renders its text in full, its public-domain or reproducible
copyright basis SHALL be recorded in writing in `corpus/CORPUS-GUIDE.md` (Part 3, under the
source's own section) and reflected in the source's registry `copyright` field. The guide's
rule that full text is never shown without a documented basis SHALL apply to reference
sources exactly as to other sources.

#### Scenario: Documented basis precedes full-text enablement

- **WHEN** a reference source is `enabled` with `displayMode: "full-text"`
- **THEN** `corpus/CORPUS-GUIDE.md` contains a written basis for that source and its registry
  `copyright` is not `unknown`

#### Scenario: The Big Book-derived texts cite the public-domain Big Book

- **WHEN** the basis recorded for `twelve-steps`, `twelve-traditions`, or
  `promises-and-prayers` is inspected
- **THEN** it identifies the public-domain 2nd-edition Big Book (copyright lapsed 1983) as
  the source edition and states the page or appendix in which the text appears

#### Scenario: An unverified text is not rendered full-text

- **WHEN** a reference source's reproduction basis cannot be substantiated
- **THEN** that source stays disabled and does not render its text in full

### Requirement: The Twelve Concepts is gated on a documented basis

The Twelve Concepts for World Service SHALL remain disabled (`enabled: false`) unless and
until a reproducible basis is documented. Because the published short form carries an explicit
AAWS copyright notice, the source SHALL NOT be enabled in any non-`full-text` mode and there
is no `snippet` fallback: it is either disabled or, once the basis is recorded, enabled as
`full-text`.

#### Scenario: Concepts stays disabled without a basis

- **WHEN** no reproducible basis for the Twelve Concepts has been recorded
- **THEN** `twelve-concepts` is not enabled and no text from it is rendered or served, in
  `full-text` or in any `snippet`/`concordance` form

#### Scenario: Concepts enables full-text only after the basis is recorded

- **WHEN** a reproducible basis for the Twelve Concepts is recorded in `corpus/CORPUS-GUIDE.md`
- **THEN** the source may be enabled with `displayMode: "full-text"` and its registry
  `copyright` reflects the recorded basis

### Requirement: Reference sources record provenance and Big Book overlap

Every reference source SHALL carry a description that names the edition or publication its
text comes from, and, for text that also appears in `big-book-2ed`, SHALL state that overlap
and its Big Book provenance. The system SHALL NOT promise or imply de-duplication of text that
appears in more than one source.

#### Scenario: Overlapping text names its Big Book provenance

- **WHEN** the description of `twelve-steps`, `twelve-traditions`, or `promises-and-prayers`
  is read
- **THEN** it names the public-domain 2nd-edition Big Book as the origin of the text and
  states that the same text also appears in the Big Book source

#### Scenario: Overlap is visible but labeled, not hidden

- **WHEN** a query matches text that exists in both `big-book-2ed` and a reference source
- **THEN** results are returned from each matching source under that source's own label, and
  the reference source's description explains the overlap

### Requirement: Reference texts are discoverable through existing surfaces

Newly registered reference sources SHALL become discoverable without new application code:
each **enabled** reference source SHALL appear as a source-filter chip automatically from the
registry and SHALL be reachable by search through its indexed passage text and passage
`title`/`chapterRef`. The `/sources` page SHALL list **all** registered reference sources,
including disabled ones, from the same registry. A disabled source (for example, the gated
`twelve-concepts`) is therefore shown on `/sources` but is not a filter chip and is not indexed
for search. Adding a chip to the hard-coded topic-browse list is NOT required and SHALL NOT be
done as part of this capability.

#### Scenario: An enabled reference source gets a filter chip and a sources card

- **WHEN** a reference source is enabled in the registry
- **THEN** it appears as a filter chip in the search surface and as a card on `/sources`,
  with its title, copyright status, and display mode

#### Scenario: A disabled reference source appears only on /sources

- **WHEN** a reference source is registered with `enabled: false` (for example, the gated
  `twelve-concepts`)
- **THEN** it appears on `/sources` with its title, copyright status, and display mode, but it
  is not a source-filter chip and its text is not indexed for search

#### Scenario: Search reaches a reference source by its named title

- **WHEN** a user searches a word that names a reference text (for example `promises`)
- **THEN** at least one passage from the matching reference source is returned, because the
  passage's indexed `title`/`chapterRef` names the text

#### Scenario: No topic-list change is required

- **WHEN** the reference texts are added
- **THEN** the hard-coded topic-browse list is unchanged and the reference texts remain
  reachable through search and the source filter

### Requirement: Reference corpus passes validation and rebuilds a consistent index

The reference corpus files SHALL pass the existing schema and referential validation, and the
prebuilt search index SHALL be regenerated from the updated corpus so that the recorded index
version matches a fresh hash of the inputs.

#### Scenario: Validation passes with the reference sources

- **WHEN** corpus validation runs over the registry and the new corpus files
- **THEN** it exits successfully with no errors, including the registry and passage-schema
  checks

#### Scenario: The index version reflects the new sources

- **WHEN** the freshness guard compares the recorded index version with a hash re-derived
  from the corpus inputs after adding the reference sources
- **THEN** they match, because the index was rebuilt after the corpus changed

### Requirement: Reference sources stay within the MVP guardrails

Adding reference sources SHALL NOT introduce authentication, accounts, bookmarks, notes,
non-AA literature, or a dedicated reference page, and SHALL NOT render full text for any
source that is not a documented-basis `full-text` source.

#### Scenario: No new page, route, or account surface

- **WHEN** the reference texts are added
- **THEN** no route, page, component, authentication, or user-data surface is introduced, and
  the texts surface only through the existing registry-driven search and `/sources` views

#### Scenario: Protected text is never rendered in full

- **WHEN** a reference source's basis is not documented
- **THEN** the source stays disabled and no text from it is rendered or copied; only its
  `/sources` card and external link are offered
