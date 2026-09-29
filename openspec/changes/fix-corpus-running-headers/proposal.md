# Proposal: Fix leaked running headers in the corpus

## Why

Roughly two-thirds of the committed `big-book-2ed` passages begin with a page's **running
header** — a page number plus the ALL-CAPS running title the printer put at the top of that
page — because the Stage 3 header stripper that produced the committed corpus was too weak
(headers vary page to page, so the "repeated line" heuristic never matched them). The defect
is user-visible (search snippets and full-text passages open with `82 ALCOHOLICS ANONYMOUS …`
or `INTO ACTION 81 …` instead of prose) and it silently pollutes the search index and
concordance, because the header words and page numbers are tokenized and indexed as if they
were body text. The pipeline has since been strengthened for *future* ingests, but the
committed corpus was never regenerated, so the leaked headers remain in `main`.

## What Changes

- **Strip leaked running headers from `corpus/sources/big-book-2ed.json`.** Remove only the
  leading running-header prefix of affected passages; leave `pageRef`, `chapterRef`, `title`,
  `sequence`, `id`, and `linkData` untouched, and leave pagemap anchors (which point at
  chapter-opening pages, not header pages) valid.
- **Rebuild and re-verify the derived artifacts.** Regenerate `static/index/*` (the header
  words disappear from the term index and concordance) and re-run corpus validation and
  citation verification; the index-version guard will fail until the rebuild is committed.
- **Requantify the defect across every source** as part of the fix so the scope is explicit.
- **Add a dependency-free regression test** that asserts no passage in any enabled,
  full-text corpus begins with a running-header pattern, and wire it into the existing
  Node/Python test-script convention (no test framework is introduced).
- **Record the residual, separate pagination artifact** that stripping exposes (~15–20
  passages then begin mid-word because the PDF's page break truncated the first word, e.g.
  `cial reference service.`): observed and recorded as a follow-up, not fixed here.

**BREAKING:** none. Passage `id`s, ordering, page refs, and the corpus schema are unchanged;
only the `text` string of affected passages changes.

## Capabilities

### New Capabilities

- `corpus-integrity`: The committed corpus is free of non-content artifacts — no passage
  **begins** with a leaked running header (page number plus running title), and regenerating
  or repairing the corpus leaves page refs, citations, and validation guarantees intact.

### Modified Capabilities

- None. The header defect concerns the corpus artifact itself, so it is captured as a new
  `corpus-integrity` capability rather than a change to an existing spec. (An existing
  `search-quality` requirement independently speaks to search not surfacing leaked headers;
  that spec is unchanged by this change.)

## Non-goals

- **Not** addressing the separate **pageRef-convention** mismatch: the Big Book corpus
  numbers PDF pages while the 12&12 corpus numbers printed pages. This change leaves every
  `pageRef` exactly as-is. Reconciling the conventions is a distinct issue.
- **Not** changing any app, display-mode, search, or rendering behavior. The impact on
  search is a consequence of the corpus text changing and the index being rebuilt, not a code
  change.
- **Not** re-running the full `ingest.py` pipeline (see `design.md`): the fix repairs the
  committed corpus in place rather than regenerating it from PDF.
- **Not** repairing truncated first words left by the PDF's own page breaks, nor other
  pre-existing extraction artifacts (hyphenation, paragraph joins) unrelated to headers. A
  **follow-up** is recorded (`design.md` — Open Questions) for the ~15–20 passages that then
  begin with a truncated word, so it is not lost.
- **Not** touching `twelve-steps-traditions` or `daily-reflections` text: neither has leaked
  running headers (their mid-text `ALCOHOLICS ANONYMOUS, p. N` strings are legitimate
  attribution, not headers, and must be preserved).

## Impact

- **Corpus data:** `corpus/sources/big-book-2ed.json` — the `text` field of 172 of 265
  passages (65%). See below for the quantified breakdown.
- **Index:** `static/index/minisearch.json`, `passages.json`, `concordance.json`, and
  `index-meta.json` must be rebuilt; `index-meta.version` changes (invalidating cached
  clients) because the corpus input hash changes.
- **Tests/tooling:** a new regression test alongside `corpus/scripts/`; no new dependency or
  framework.
- **Unaffected:** `pageRef`/`chapterRef` values, passage `id`s and `sequence`, both pagemaps,
  and `corpus/sources.json`.

### Quantified defect (measured against the committed corpus)

| Source | Passages | Start with a leaked header | Notes |
| --- | --- | --- | --- |
| `big-book-2ed` | 265 | **172 (65%)** | 157 arabic page-number headers — 79 number-first (77 pure, e.g. `82 ALCOHOLICS ANONYMOUS`, plus the 2 that also carry a trailing number) and 78 number-last (e.g. `BILL'S STORY 3`, `INTO ACTION 81`) — plus 15 front-matter roman-numeral headers (`xii PREFACE`, `FOREWORD xvii`, `xxiv THE DOCTOR'S OPINION`). Exactly **one** is a genuinely malformed stray-digit header (`1 THERE IS A SOLUTION 29`, `…chapter-2-there-is-a-solution-p0067`); the other trailing-number case (`60 ALCOHOLICS ANONYMOUS 12.`, `…chapter-5-how-it-works-p0107`) is a normal header whose `12.` is the twelfth-step list number and must survive. Headers leak **only at the start** of a passage — no mid-passage occurrences. |
| `twelve-steps-traditions` | 213 | 0 | No leaked headers. |
| `daily-reflections` | 366 | 0 | 165 passages mention the title (case-insensitively) **mid-text** as legitimate source attribution — 123 with a singular `ALCOHOLICS ANONYMOUS, p. N` citation, 8 with a plural `pp. …` citation, 3 referencing the different book *Alcoholics Anonymous Comes of Age*, and 31 with no page citation — and must be preserved, not stripped. |
| `twelve-traditions` | 0 | n/a | Disabled in the registry (`enabled: false`); no corpus file present. |

The review's "roughly 80" corresponds to the number-first `n ALCOHOLICS ANONYMOUS` variety
alone (79 passages — 77 pure plus the 2 with a trailing number); counting the `TITLE n` and
roman-numeral front-matter variants as well raises the true figure to 172 of 265.
