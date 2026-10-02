# Spec Delta

## MODIFIED Requirements

### Requirement: Query parsing, sentence splitting, and snippet correctness

The system SHALL parse a quoted span as an exact adjacent phrase and bare words as AND-matched
terms, SHALL tokenize text and split it into sentences without breaking at known abbreviations,
numbered lists, or page headers, and SHALL produce KWIC snippets whose highlighted spans cover
exactly the matched occurrences within the shown window. The snippet window SHALL respect the
source's display mode and its excerpt-size limit: `full-text` shows whole-sentence context,
`snippet` is word-bounded, and `concordance-only` is sentence-bounded when the source sets
`contextSentences` and word-bounded otherwise (see the display-mode scenarios below).

#### Scenario: A quoted phrase matches only adjacent words

- **WHEN** a quoted phrase is searched
- **THEN** passages where those words appear adjacently match, and passages where the words merely both appear non-adjacently do not

#### Scenario: Bare keywords are AND-matched

- **WHEN** multiple bare words are searched
- **THEN** only passages containing every one of those words match

#### Scenario: Sentence splitting does not break at abbreviations or numbered lists

- **WHEN** text containing `Dr.`, `A.A.`, `p.58`, or a numbered item such as `1. We admitted` is split into sentences
- **THEN** each of those spans stays within a single sentence

#### Scenario: Highlight covers exactly the matched span

- **WHEN** a result snippet is rendered
- **THEN** each highlighted region covers exactly the matched term or contiguous phrase, with no missing, extra, or partial adjacent characters

#### Scenario: Snippet window is sentence-aligned and marks clipped sides

- **WHEN** a `full-text` source's result snippet is clipped
- **THEN** the window contains whole sentences from the matching sentence outward and an ellipsis marks each side that was clipped

#### Scenario: Snippet respects the source display mode

- **WHEN** the source's display mode is `snippet`
- **THEN** the KWIC window contains at most the source's `contextWords` words in total (and in no case more than the ~30-word excerpt cap) — sentence-aligned only when that fits within the word bound, otherwise clipped at a word boundary — and never renders the full passage text

#### Scenario: Concordance-only snippets are clipped on each side

- **WHEN** the source's display mode is `concordance-only`
- **THEN** the KWIC window is clipped to at most the source's `contextSentences` whole sentences on each side of the matched sentence when the source sets `contextSentences`, or to at most the source's `contextWords` on each side of the match otherwise, and never renders the full passage text

#### Scenario: A sentence window never reproduces a short protected passage

- **WHEN** a `concordance-only` source with `contextSentences` set is short enough that the sentence window would cover its entire text
- **THEN** the window drops a whole sentence on the side away from the match (or a word when the passage has only one sentence) and marks that side clipped, so the full text is never rendered

#### Scenario: Both search paths highlight identically

- **WHEN** the same passage is returned by the MiniSearch path and by the concordance path
- **THEN** the highlighted spans in its snippet are the same
