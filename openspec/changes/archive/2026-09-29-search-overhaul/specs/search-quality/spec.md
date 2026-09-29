# Spec Delta

## Purpose

Defines the behavior of search over the prebuilt, client-side index: how queries and corpus
text are normalized and tokenized, how snippets are clipped and highlighted, how suggestions
and synonym/concept expansion broaden a query, and how results are ranked — while honoring
each source's display mode and never rendering protected full text.

## ADDED Requirements

### Requirement: Contraction- and punctuation-insensitive matching

The system SHALL match queries against the corpus under one shared normalization applied
identically to the query and to the indexed text, so that contractions and single-term
quote/punctuation variants are equivalent. Apostrophe and quote variants (straight `'`, curly
`’`, modifier `ʼ`, and the absence of an apostrophe) and trailing or surrounding punctuation on
a single term SHALL NOT change which passages match; a hyphenated compound SHALL be equivalent
to its space-separated terms (so `face-to-face` and `face to face` match the same passages).
Because search runs over both the MiniSearch path and the concordance path, both paths SHALL
apply the same normalization and SHALL return the same passage set for these cases.

#### Scenario: Contraction variants return the same passages

- **WHEN** a user searches `Havent got` and, separately, `Haven't got`
- **THEN** both queries return the same non-empty set of passages, including the passage(s) whose text contains that contraction

#### Scenario: Curly, straight, and absent apostrophes are equivalent

- **WHEN** the same contraction is searched with a straight apostrophe, with a curly apostrophe, and with no apostrophe
- **THEN** all three queries return the same passage set

#### Scenario: Punctuation around a term does not change the result

- **WHEN** a term is searched bare, and the same term appears in the corpus surrounded by punctuation (for example a hyphenated `face-to-face` or a trailing `god.` / `god,`)
- **THEN** the bare query matches those passages

#### Scenario: Both search paths agree on contraction matches

- **WHEN** the same contraction query is executed while the MiniSearch path is active and again once the concordance path is active
- **THEN** both paths return the same passages for that query

### Requirement: The `tornado` miss and the merged-passage defect are corrected

The system SHALL return passage `big-book-2ed-chapter-6-into-action-p0142` for the query
`tornado` in any letter case. The tokenization/normalization path SHALL be corrected so that a
word present in the corpus is retrievable, and the passage's corpus text SHALL NOT contain a
leaked page header and its page reference SHALL correspond to the page the text actually
occupies.

#### Scenario: `tornado` returns the passage

- **WHEN** `tornado` or `Tornado` is searched
- **THEN** passage `big-book-2ed-chapter-6-into-action-p0142` appears in the results

#### Scenario: Every indexed word is retrievable

- **WHEN** a word that is tokenized anywhere in the corpus is searched
- **THEN** at least the passage(s) containing that word are returned (no present word is silently un-indexed)

#### Scenario: No leaked page header in passage text

- **WHEN** `big-book-2ed-chapter-6-into-action-p0142`'s corpus text is inspected
- **THEN** it does not contain the leaked page header `82 ALCOHOLICS ANONYMOUS`

#### Scenario: Page reference matches the passage's page

- **WHEN** `big-book-2ed-chapter-6-into-action-p0142` is displayed
- **THEN** its page reference names the page the passage text actually appears on

### Requirement: Query parsing, sentence splitting, and snippet correctness

The system SHALL parse a quoted span as an exact adjacent phrase and bare words as AND-matched
terms, SHALL tokenize text and split it into sentences without breaking at known abbreviations,
numbered lists, or page headers, and SHALL produce KWIC snippets whose highlighted spans cover
exactly the matched occurrences within the shown window. The snippet window SHALL respect the
source's display mode and its excerpt-size limit: `full-text` shows whole-sentence context,
while `snippet` and `concordance-only` are word-bounded (see the display-mode scenarios below).

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
- **THEN** the KWIC window is clipped to at most the source's `contextWords` on each side of the match and never renders the full passage text

#### Scenario: Both search paths highlight identically

- **WHEN** the same passage is returned by the MiniSearch path and by the concordance path
- **THEN** the highlighted spans in its snippet are the same

### Requirement: Search-box suggestions

The system SHALL offer ranked suggestions as the user types — autocomplete from the indexed
term dictionary and did-you-mean / related terms — derived from locally loaded index data,
without blocking, delaying, or replacing the existing debounced search. Selecting a suggestion
SHALL run the corresponding search. Until the term dictionary has loaded, the system SHALL offer
no suggestions and SHALL leave search behavior unchanged.

#### Scenario: A typed prefix surfaces ranked suggestions

- **WHEN** the user types a term prefix
- **THEN** ranked suggestions that begin with that prefix (or share it) appear

#### Scenario: A misspelling surfaces a did-you-mean

- **WHEN** the user types a term that matches no indexed term but is a near-match for an indexed term
- **THEN** a suggestion naming the closest indexed term is offered

#### Scenario: Suggestions do not block the debounced search

- **WHEN** suggestions are being shown or updated
- **THEN** the existing debounced search still runs on its current schedule and continues to return results

#### Scenario: Choosing a suggestion runs the search

- **WHEN** the user selects a suggestion
- **THEN** a search is executed for that suggestion's term

#### Scenario: Suggestions never expose protected text

- **WHEN** suggestions are drawn from a `snippet` or `concordance-only` source
- **THEN** only indexed terms are shown, never a passage's full text

#### Scenario: Suggestions wait for the term dictionary

- **WHEN** the term dictionary has not yet loaded
- **THEN** no suggestions are offered and search behavior is unchanged

### Requirement: Synonym and concept grouping

The system SHALL expand a bare-keyword query using the curated synonym/concept map so that
searching one member of a concept group surfaces passages that use another member, and vice
versa. Synonym-matched results SHALL remain visibly marked as such. Expansion SHALL apply to
bare-keyword queries only and SHALL NOT alter display-mode or copyright rendering.

#### Scenario: `God` surfaces its concept group

- **WHEN** `God` is searched
- **THEN** passages containing `Higher Power`, `Creator`, or `Spirit of the Universe` are surfaced alongside the direct matches

#### Scenario: A synonym surfaces the same related set

- **WHEN** one of `Higher Power`, `Creator`, or `Spirit of the Universe` is searched
- **THEN** passages containing `God` are surfaced as related matches

#### Scenario: Synonym matches are visibly marked

- **WHEN** a result matched only through synonym expansion (not by a direct term match)
- **THEN** the result is marked as a synonym match in the UI

#### Scenario: Phrase search is not expanded

- **WHEN** a quoted phrase is searched
- **THEN** no synonym expansion is applied to that query

#### Scenario: Existing concept groups still expand

- **WHEN** a keyword already in the synonym map (for example `fear`, `resentment`, `acceptance`, or `sobriety`) is searched
- **THEN** its existing synonyms still expand the search

### Requirement: Ranking and snippet quality

The system SHALL order results by relevance within each source group rather than by corpus
sequence alone, with the strongest match first, and SHALL show each result's snippet centered
on its match. Ordering SHALL be deterministic for a given query and index.

#### Scenario: The strongest match ranks first

- **WHEN** a query matches several passages in one source, some containing all query terms and some containing fewer
- **THEN** passages matching all query terms (and any quoted phrase) rank above passages matching fewer terms

#### Scenario: Ordering is deterministic

- **WHEN** the same query is run repeatedly against the same index
- **THEN** the result order is identical each time

#### Scenario: Ties fall back predictably

- **WHEN** two results are equally relevant
- **THEN** source order, then corpus sequence, breaks the tie

#### Scenario: Snippet centers on the match

- **WHEN** a result is rendered
- **THEN** its snippet window contains the matched occurrence rather than a clipped window that omits it
