# Spec Delta

## Purpose

Keeps the committed corpus free of the leaked page furniture that search surfaces first: no
passage begins with a leaked running header, and repairing the corpus never changes passage
identity, locators, or page references. Repairing other extraction artifacts — such as the
mid-word page-break fragments a header strip can expose — is deferred and tracked separately.

## ADDED Requirements

### Requirement: No passage begins with a leaked running header

No passage in the committed corpus SHALL begin with a leaked running header — a page number
(arabic or roman) adjacent to an ALL-CAPS running title, in either order. This covers
number-first headers (`82 ALCOHOLICS ANONYMOUS`), title-last headers (`BILL'S STORY 3`,
`INTO ACTION 81`), and roman-numeral front-matter headers (`xii PREFACE`, `FOREWORD xvii`,
`xxiv THE DOCTOR'S OPINION`). Detection is prefix-only: a passage's body may legitimately
contain all-caps runs and citations such as `ALCOHOLICS ANONYMOUS, p. 25`, which SHALL NOT be
treated as headers.

#### Scenario: Every previously headered Big Book passage is repaired

- **WHEN** every passage in `corpus/sources/big-book-2ed.json` is inspected
- **THEN** none of the 172 passages that previously began with a leaked running header still begins with one

#### Scenario: A representative number-first header is gone

- **WHEN** the passage whose text previously began `84 ALCOHOLICS ANONYMOUS` is inspected
- **THEN** its text no longer begins with `84 ALCOHOLICS ANONYMOUS`

#### Scenario: A representative title-last header is gone

- **WHEN** the passage whose text previously began `INTO ACTION 81` is inspected
- **THEN** its text no longer begins with `INTO ACTION 81`

#### Scenario: Front-matter roman-numeral headers are gone

- **WHEN** a front-matter passage whose text previously began `xii PREFACE` or `FOREWORD xvii` is inspected
- **THEN** its text no longer begins with the roman-numeral header

#### Scenario: A separated trailing page number is stripped with the header

- **WHEN** the passage whose text previously began `1 THERE IS A SOLUTION 29 enough, we find` is inspected
- **THEN** its text no longer begins with `1 THERE IS A SOLUTION 29` and now begins with `enough, we find`

#### Scenario: Unaffected sources stay clean

- **WHEN** `twelve-steps-traditions` and `daily-reflections` are scanned for a passage beginning with a running header
- **THEN** neither contains a passage beginning with a running header

### Requirement: Header repair preserves passage identity, locators, and ordering

Repairing the corpus SHALL change only the `text` of affected passages. Every passage SHALL keep
its `id`, `sourceId`, `title`, `sequence`, `date`, `pageRef`, `chapterRef`, and `linkData`, and
the number, order, and identity of passages SHALL be unchanged.

#### Scenario: Only text differs

- **WHEN** `corpus/sources/big-book-2ed.json` before and after the repair are compared
- **THEN** every passage has the same `id`, `sequence`, `pageRef`, `chapterRef`, and `linkData`, and only `text` differs

#### Scenario: Page references are not rewritten

- **WHEN** any passage's `pageRef` after the repair is inspected
- **THEN** it is byte-identical to its pre-repair value (the PDF-page versus printed-page convention is out of scope)

### Requirement: Legitimate headings and in-text attributions are preserved

The repair SHALL remove only leaked page furniture, never passage content. Chapter-opening
headings and in-text attribution strings SHALL remain intact.

#### Scenario: Chapter-opening heading survives

- **WHEN** the chapter-opening passage that begins `Chapter 5 HOW IT WORKS` is inspected
- **THEN** its text still begins with `Chapter 5 HOW IT WORKS`

#### Scenario: In-text attributions survive

- **WHEN** a `daily-reflections` passage containing `ALCOHOLICS ANONYMOUS, p. 25` mid-text is inspected
- **THEN** that attribution is still present

#### Scenario: A header's trailing list number survives

- **WHEN** the passage whose text previously began `60 ALCOHOLICS ANONYMOUS 12. Having had a spiritual awakening` is inspected
- **THEN** its text still begins with `12.` — the twelfth-step list number is preserved, not stripped with the header

#### Scenario: The first body word is not swallowed

- **WHEN** the passage whose text previously began `2 ALCOHOLICS ANONYMOUS I took a night law course` is inspected
- **THEN** its text still contains `I took a night law course` — the strip does not consume the single-letter body word `I` that follows the header

### Requirement: Corpus validation and citation verification pass after repair

After the repair, corpus schema and referential validation SHALL pass, and pagemap citation
verification SHALL pass, for every source with a pagemap.

#### Scenario: Schema and pagemap validation pass

- **WHEN** corpus validation runs over the repaired corpus
- **THEN** it exits successfully with no errors, including registry, passage-schema, and pagemap checks

#### Scenario: Citation verification passes

- **WHEN** citation verification runs for `big-book-2ed` and `twelve-steps-traditions`
- **THEN** every pagemap anchor is still found at the expected passage and it exits successfully

### Requirement: Derived search index is rebuilt and consistent after repair

The prebuilt search index and concordance SHALL be regenerated from the repaired corpus so they
no longer carry terms contributed by leaked headers, and the recorded index version SHALL match
a fresh hash of the corpus inputs.

#### Scenario: Index version reflects the repaired corpus

- **WHEN** the freshness guard compares `index-meta.version` with a hash re-derived from the repaired corpus
- **THEN** they match, because the index was rebuilt after the repair, and the version differs from the pre-repair version

#### Scenario: Rebuild is deterministic

- **WHEN** the index is built twice from the repaired corpus
- **THEN** the three searchable outputs (`minisearch.json`, `passages.json`, `concordance.json`) and the `version` hash are byte-identical across both builds, while `index-meta.builtAt` is non-deterministic metadata stamped from the wall clock (and therefore is the only expected cross-build difference)

#### Scenario: Header-only terms no longer pollute results

- **WHEN** the concordance is inspected after the rebuild
- **THEN** no term occurrence is drawn from a stripped running header, so a running-title word does not return a passage on the basis of a leaked header alone

### Requirement: Automated regression test rejects leaked running headers

A dependency-free automated test SHALL scan the committed, enabled corpus sources and fail when
any passage's text begins with a running-header pattern. The test SHALL follow the project's
existing test-script convention and SHALL NOT introduce a test framework.

#### Scenario: Test passes on the repaired corpus

- **WHEN** the regression test runs against the repaired corpus
- **THEN** it reports zero leaked headers and exits successfully

#### Scenario: Test fails on a regressed corpus

- **WHEN** a passage beginning with a running-header pattern (for example `82 ALCOHOLICS ANONYMOUS …`) is present
- **THEN** the test exits non-zero and names the offending passage
