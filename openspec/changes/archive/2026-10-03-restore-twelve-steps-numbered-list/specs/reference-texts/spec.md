# Spec Delta

## ADDED Requirements

### Requirement: The Twelve Steps source carries the clean numbered steps

The `twelve-steps` reference source SHALL present the Twelve Steps as a single clean numbered
list (1–12), not as raw Big Book page chunks. Each step's wording SHALL be reproduced verbatim
from the committed public-domain 2nd-edition Big Book corpus (Chapter 5 "How It Works", corpus
passages `big-book-2ed-chapter-5-how-it-works-p0106` and `...-p0107`), with only the list
numbering (`1.`–`12.`) and the inter-step newline separators added as framing; no text outside
those steps and no new or non-Big-Book content SHALL be introduced. The steps SHALL be emitted
as twelve newline-separated lines, one step per line, in order: the passage text SHALL contain
eleven `\n` separators, each of the twelve lines SHALL begin `N. ` with its step number `1.`
through `12.`, and the text SHALL NOT end with a trailing newline. The source SHALL remain an enabled, documented-basis `full-text` source and SHALL
carry its Big Book provenance and edition basis unchanged; its single passage SHALL cite the
printed page where the list begins (p.80), and no claim is made that every step's original
printed page is preserved. The derivation SHALL be reproducible: a committed script SHALL
regenerate `corpus/sources/twelve-steps.json` from the Big Book corpus, verifying each step
against its source passage, so re-running it is idempotent. `corpus/sources/big-book-2ed.json`
SHALL NOT be modified; the Big Book prose walkthrough remains searchable there.

#### Scenario: The Twelve Steps view shows a clean 1–12 list

- **WHEN** the Twelve Steps view of the reference reader is rendered
- **THEN** it shows twelve lines, one step per line, numbered `1.` through `12.` in order, with
  no unrelated Chapter 5 prose before step 1 and no walkthrough prose after step 12

#### Scenario: The emitted passage text is twelve newline-separated step lines

- **WHEN** the `text` of the single `twelve-steps` passage in
  `corpus/sources/twelve-steps.json` is inspected
- **THEN** it contains exactly eleven `\n` characters separating twelve lines, each line begins
  `N. ` with its step number `1.` through `12.` in ascending order, and the text does not end
  with a trailing newline (so a `whitespace-pre-line` renderer draws twelve separate lines
  rather than one run-on paragraph)

#### Scenario: Each step's wording is verbatim from the Big Book

- **WHEN** each of the twelve steps in `corpus/sources/twelve-steps.json` is compared with the
  Big Book corpus passages `big-book-2ed-chapter-5-how-it-works-p0106` and `...-p0107`
- **THEN** every step statement's body matches its Big Book wording contiguously, with only the
  list numbering (`1.`–`12.`) and the `\n` separators between steps added

#### Scenario: The source keeps its public-domain basis and provenance

- **WHEN** the `twelve-steps` registry and corpus are inspected
- **THEN** the source remains `enabled` with `displayMode: "full-text"` and
  `copyright: "public-domain"`, its Big Book edition basis is unchanged, and its single passage
  cites the printed page where the list begins (`p.80`) as its `pageRef`

#### Scenario: Re-running the derivation is idempotent

- **WHEN** `corpus/scripts/extract-reference-texts.mjs` is run with `--write` against the
  unchanged Big Book corpus, twice
- **THEN** both runs emit byte-identical `corpus/sources/twelve-steps.json`, and the default
  dry run verifies each step against its source passage

#### Scenario: The Big Book source is untouched

- **WHEN** `corpus/sources/big-book-2ed.json` is compared before and after this change
- **THEN** it is unchanged, so the step statements and their surrounding Chapter 5 prose remain
  searchable in the Big Book source
