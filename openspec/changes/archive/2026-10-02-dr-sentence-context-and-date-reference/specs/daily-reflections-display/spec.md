# Spec Delta

## MODIFIED Requirements

### Requirement: Local display is limited to the concordance-only KWIC teaser

For the date it is showing, the reflection surface SHALL render at most a KWIC teaser derived
from that date's indexed Daily Reflections entry, clipped by the source's display mode
(`concordance-only`) and its configured context bound (`contextSentences` whole sentences on
each side of the matched sentence, or `contextWords` words on each side when no sentence bound
is set), through the same KWIC machinery used for search results. The surface SHALL NOT render
the entry's full `text`, and no affordance on the surface SHALL copy the entry's full `text`.
The Daily Reflections date SHALL be presented as the primary lookup reference on every surface
that shows the entry, and every copied Daily Reflections excerpt SHALL lead with that date.

#### Scenario: The rendered teaser is a bounded KWIC window

- **WHEN** the reflection surface renders the date's indexed entry, whose `text` is longer than
  the KWIC window
- **THEN** the rendered prose is a window of at most the source's `contextSentences` whole
  sentences on each side of the matched sentence (or at most the source's `contextWords` words
  on each side when no sentence bound is set) and is a strict subset of the entry's `text`

#### Scenario: The date is the primary reference

- **WHEN** any Daily Reflections surface renders the date's entry
- **THEN** the reflection's date (for example "January 1") is rendered as the leading element of
  that result's heading, ahead of the source name (where the heading shows it) and the title, so the
  date is the first thing a visitor reads

#### Scenario: A copied excerpt leads with the date

- **WHEN** a Daily Reflections excerpt is copied
- **THEN** the copied citation begins with the reflection's date followed by the source name (for
  example "January 1 · Daily Reflections") and contains only the clipped excerpt, never the full
  `text`

#### Scenario: The full reflection text is never rendered

- **WHEN** any Daily Reflections surface renders
- **THEN** the entry's complete `text` is never present in the rendered output

#### Scenario: No copy path exposes the full reflection text

- **WHEN** the Daily Reflections surface is inspected for copy affordances
- **THEN** no affordance places the entry's full `text` on the clipboard (any copy path, if
  present, copies only the clipped KWIC teaser plus citation)

#### Scenario: A short entry is still not reproduced in full

- **WHEN** the date's indexed entry is short enough that a one-sentence-each-side window would
  cover its entire text
- **THEN** the displayed window drops a whole sentence on the side away from the match (or a word
  when the entry has only one sentence) and marks that side clipped, so the full `text` is never
  reproduced
