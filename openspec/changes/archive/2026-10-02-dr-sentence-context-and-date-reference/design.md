# Design

## Context

See `proposal.md` - Why. Daily Reflections is the only protected `concordance-only`
source (`corpus/sources.json`: `contextWords: 8`, `displayMode: "concordance-only"`).
All clipping funnels through `resolveWindow()` in `src/lib/search/kwic.ts`, which
`buildKwicFromOffsets()` (rendered snippet) and `buildExcerpt()` (clipboard) share;
`fullTextWindow()` already does whole-sentence context for `full-text`, while
`eachSideWindow()` does `contextWords` words/side for `concordance-only`.
`enforceProtectedClip()` guarantees a protected passage's full text is never shown.
DR entries carry `date` (`MM-DD`) and `chapterRef` (human date, e.g. `January 1`);
all 366 entries have both; `pageRef` is null. DR entries: 53-234 words (median 149);
2-16 sentences (per `splitSentenceRanges`), with no single-sentence entry (one
2-sentence entry, `dr-07-23`, the shortest).

## Goals / Non-Goals

**Goals:**

- DR results show 1 whole sentence each side of the matched sentence.
- The date is the leading reference on every DR surface and in copied citations.
- Behavior stays registry-driven (AGENTS.md), not hard-coded per source.
- The protected-full-text guard holds for short entries.

**Non-Goals:**

- Changing `full-text` or `snippet` clipping behavior.
- Making `contextSentences` apply to `full-text` (stays `SENTENCE_CONTEXT = 2`).
- Changing DR ingestion, the link-forward redirect, or which sources are enabled.

## Decisions

### D1: New optional registry field `contextSentences` (not reinterpreting `contextWords`)

Add `contextSentences?: number | null` to `Source`, parse it in `registry.ts`, and
set `"contextSentences": 1` on `daily-reflections`. In `resolveWindow`, a
`concordance-only` source with `contextSentences > 0` uses a new
`concordanceSentenceWindow()` (via `splitSentenceRanges`/`sentenceIndexAt`); sources
without it keep `eachSideWindow()` (word-bounded). `contextWords` remains the fallback.

Alternatives rejected: reinterpreting `contextWords` as sentences (loses the word
knob for `snippet` and is semantically confusing); hard-coding 1 in code (violates
registry-driven design); a per-source field for `full-text` too (out of scope).

### D2: Sentence window + the fair-use guard drop a whole sentence

`concordanceSentenceWindow(text, anchor, contextSentences)` returns whole sentences
from `max(0, idx - n)` to `min(last, idx + n)`. `enforceProtectedClip` gains a
sentence-aware branch: when a `concordance-only`+`contextSentences` window covers the
whole text, drop the first or last sentence (the side away from the anchor) and mark
it clipped; a single-sentence entry falls back to the existing word-drop. This makes
short entries show the matched sentence alone, with an ellipsis — the guard overrides
the sentence target, and the spec says so explicitly.

### D3: Date is the leading reference, on screen and in the citation

- **Search result card** (`src/routes/+page.svelte`): for DR, render the date
  (`chapterRef`, uppercased) ahead of the source short title, e.g.
  `JANUARY 1 · DAILY REFLECTIONS`, instead of `DR · JANUARY 1`. Keep the accessible
  name (`resultAriaLabel`) containing `DR` and the date, so existing
  `article[aria-label*="DR"]` locators keep matching; the heading still exposes a
  single source/reference line, satisfying `search-ui`'s heading-navigation
  requirement (the line is now date-led for DR).
- **Copied citation**: add an optional `date` parameter to `buildCitation` and, for
  DR, pass the formatted date and `null`/omit the duplicated `chapterRef`, producing
  `excerpt\n\nJanuary 1 · Daily Reflections`.
- **Home card and offline fallback**: render the date as the leading element of the
  heading (ahead of the title/source) so every DR surface satisfies the "date is the
  primary reference" scenario; route both through the same expanded teaser. The home
  card's `line-clamp-5` may still truncate very long windows visually; that is
  acceptable and unchanged. The middle dot `·` is not an em dash, so the `ui-copy`
  no-em-dash requirement is unaffected.

`formatReflectionDate` already produces `January 1` from `MM-DD`.

### D4: The no-offset head-clip honors `contextSentences`

`resolveWindow`'s `offsets.length === 0` branch (head clip) is not currently reachable
from the DR teaser — `buildReflectionTeaser` always passes the first-term offset — but
it is hardened for consistency: for `concordance-only`+`contextSentences` it uses the
first `2n` sentences before `enforceProtectedClip`. Note the teaser's own
`teaserWords(html).length < words.length` post-check (`reflection.ts`) is what actually
enforces the strict-subset for the home/fallback teaser; the new sentence-drop makes it
return non-empty for a 2-sentence entry where the old word window could have yielded `''`.

### D5: One change, three phases

Both the sentence expansion and the date reference touch the same files, so they are
one change. Implementation phases by file overlap: Phase 1 engine/data (kwic, index,
reflection, registry, types, sources.json); Phase 2 UI (two route files, depends on
Phase 1's `SearchResult`/citation shape); Phase 3 specs/PRD/tests. Phases 2 and 3 are
sequential after Phase 1 because they depend on its interfaces/strings.

## Risks / Trade-offs

- [Short DR entries show only the matched sentence] → the fair-use guard overrides
  the 1-sentence target for entries a window would reproduce in full; the spec records
  this so it is intended behavior, not a bug.
- [Matches near the start/end yield an asymmetric window] → acceptable; only available
  context is shown, with an ellipsis on the clipped side.
- [`buildExcerpt` (clipboard) and `buildKwicFromOffsets` (display) drift] → both go
  through the same `resolveWindow`, so they cannot drift by construction; the search
  test asserts the DR citation omits the full text and is a clipped excerpt.
- [Date duplication in the citation] → pass `chapterRef: null` for DR and the formatted
  `date` instead, so the citation never reads `..., January 1, January 1`.
- [Fair-use posture change] → explicitly accepted by the user; PRD and the two specs
  are updated, and the guard still forbids rendering full text.

## Migration Plan

No schema/data migration; DR corpus text is untouched. Deploy with the copy/clipping
change. Rollback is `git revert`; the registry field is additive and inert if unset.

## Open Questions

None.
