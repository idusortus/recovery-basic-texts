# Spec Delta

## ADDED Requirements

### Requirement: Contextual report links prefill the form with passage context and no PII

Search result cards and the passage page SHALL offer a "report this passage" link to
`/feedback` that prefills the existing form's `details` field with the passage ID, the
source ID, and the current query only. The submitted field set SHALL remain exactly
`type`, `summary`, and `details`; the context SHALL NOT be submitted as a new form field. No
name, email address, IP address, user agent, or Turnstile token SHALL be added by the report
link. Because the context is submitted as the visitor's own `details` text, it SHALL be
subject to the same validation, length limit, and server-side fencing as any other visitor
text.

#### Scenario: A report link prefills the passage context

- **WHEN** a visitor activates the report link on a search result or a passage page
- **THEN** the feedback form opens with its `details` field prefilled with that passage's ID, source ID, and the current query

#### Scenario: The form still submits exactly three fields

- **WHEN** a submission originating from a report link is filed
- **THEN** the submitted fields are `type`, `summary`, and `details` only, with the passage context carried inside `details`

#### Scenario: No PII is introduced

- **WHEN** the report link builds its prefill
- **THEN** it adds no name, email address, IP address, user agent, or Turnstile token

#### Scenario: Report links are offered for every display mode

- **WHEN** a result card is shown for a source whose display mode is `full-text`, `snippet`, or `concordance-only`
- **THEN** it offers the report link

#### Scenario: Prefilled context is treated as visitor text

- **WHEN** the prefilled `details` are submitted
- **THEN** they pass through the same validation, length limit, and fenced issue-body construction as any other visitor text
