# about-page Specification

## Purpose
Defines the content the `/about` route presents to visitors, including which
reserved sections are shown and which are withheld while the project is not
soliciting support.

## Requirements

### Requirement: The About page does not display a support solicitation

While the project is not soliciting support, the `/about` route SHALL NOT display
the reserved financial-support section: no "Support this project" heading, no
explanatory support copy, and no donation or sponsorship links (including the
Ko-fi link and the GitHub Sponsors placeholder). Every other About section SHALL
continue to render.

#### Scenario: The support section is absent

- **WHEN** a visitor opens `/about`
- **THEN** no "Support this project" heading and no donation or sponsorship links are shown

#### Scenario: The rest of the About content still renders

- **WHEN** a visitor opens `/about`
- **THEN** the "What this is", "What this isn't", legal disclaimer, copyright, privacy, open source, how to contribute, and feedback sections still render

#### Scenario: No support link remains reachable from the About page

- **WHEN** a visitor loads `/about` and inspects its links
- **THEN** no link targets a donation or sponsorship destination such as Ko-fi or GitHub Sponsors
