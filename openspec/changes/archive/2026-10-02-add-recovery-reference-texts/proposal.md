# Proposal: Add recovery reference texts

## Why

The short texts most often read aloud and referenced by name in meetings — the Twelve Steps,
the long form of the Twelve Traditions, the Twelve Concepts for World Service, the Ninth Step
Promises, and the Third and Seventh Step prayers — are not called out as named collections.
Today a reader must already know the wording to find them (for example, the existing "The
Promises" hint tells users to search individual words). basictexts.org is registry-driven, so
these can be added as first-class, searchable corpus sources with no application code changes,
and surfaced through the existing source chips and `/sources` page. (The Eleventh Step prayer
is not public-domain Big Book text; it already lives in the copyrighted 12&12 source
`twelve-steps-traditions` and stays reachable there.)

## What Changes

- **Add reference-text corpus sources** through the existing registry path
  (`corpus/sources.json` + `corpus/sources/<id>.json`); no `src/` changes:
  - `twelve-steps` — the Twelve Steps as printed in the public-domain 2nd-edition Big Book
    (`full-text`).
  - `twelve-traditions` — **repurpose the disabled placeholder** into the long form of the
    Twelve Traditions, which is present in the 2nd-edition Big Book back matter
    (`full-text`).
  - `twelve-concepts` — the long form of the Twelve Concepts for World Service. Ships
    **disabled**; it is enabled as `full-text` only once a documented reproduction basis is
    recorded. There is no `snippet` fallback.
  - `promises-and-prayers` — one grouped source containing the Ninth Step Promises and the
    Third and Seventh Step prayers, derived from the public-domain 2nd-edition Big Book
    (`full-text`). The Eleventh Step prayer is deliberately **not** part of this source; it
    remains reachable through the existing `twelve-steps-traditions` (12&12) `snippet`
    source.
- **Record the copyright basis in writing before any full-text render.** Each new source's
  public-domain or reproducible basis is documented in `corpus/CORPUS-GUIDE.md` Part 3 and in
  the registry `copyright` field. A source is not enabled as `full-text` until its basis is
  recorded; a source whose basis cannot be substantiated stays disabled.
- **Address overlap with the Big Book explicitly.** The Steps, the long-form Traditions, the
  Promises, and the Third and Seventh prayers already appear in `big-book-2ed`. The new sources
  are convenience collections that reproduce that same public-domain text; their descriptions
  record the overlap and their Big Book provenance. Cross-source de-duplication is out of scope.
- **Make them discoverable without new app code.** New registry sources automatically gain a
  `/sources` card (including disabled ones). An *enabled* source additionally gains a
  source-filter chip, and its passage `title`/`chapterRef` are indexed so a search such as
  `promises` reaches it.
- **No dedicated reference page, no app code, no new dependencies.** The registry-driven
  corpus path and a rebuilt static index are the whole mechanism.

Non-goals:

- Do not add a dedicated reference/reader page, route, or component; the user chose the
  corpus-source path.
- Do not change search, filter, passage-view, or topic-browse application code, and do not add
  new topic chips (that would be app code).
- Do not add authentication, accounts, bookmarks, notes, non-AA literature, or any protected
  text as `full-text`.
- Do not de-duplicate text that appears in both `big-book-2ed` and a reference source.

## Capabilities

### New Capabilities

- `reference-texts`: The catalog of short, meeting-referenced recovery texts that are exposed
  as registry-driven corpus sources — with a documented reproduction basis for each, recorded
  Big Book provenance, explicit handling of overlap with the Big Book source, and
  discoverability through the existing source-filter and `/sources` surfaces. A source with a
  documented public-domain basis (`twelve-steps`, `twelve-traditions`, `promises-and-prayers`)
  is enabled as `full-text`; a source without one (`twelve-concepts`) stays disabled.

### Modified Capabilities

- None. Adding registry sources does not change any existing requirement: the source-filter
  chips, `/sources` page, and index build are already registry-driven, and no existing spec's
  behavior changes.

## Impact

- **Corpus data:** `corpus/sources.json` (three new entries plus the repurposed
  `twelve-traditions` entry), new `corpus/sources/<id>.json` files, new raw inputs under
  `corpus/raw/`, and `corpus/CORPUS-GUIDE.md` (Part 3 source sections and the `sortOrder`
  list).
- **Derived artifact:** `pnpm run build:index` must be re-run; the index version hash changes
  because `sources.json` and the corpus files changed.
- **Hint update:** `corpus/known-exceptions.json`'s stale "The Promises" hint should point at
  the new `promises-and-prayers` source instead of telling users to search individual words.
  That file's app-bundled mirror lives in `src/lib/corpus/exceptions.ts`, so changing running
  behavior is a code-adjacent change; this plan records the JSON update and the `src/` mirror
  as a **separate follow-up** outside the no-code path.
- **No source code, no API, no dependency, no runtime behavior change** beyond the newly
  indexed, display-mode-governed corpus sources.
- **Risk:** the Twelve Concepts short form carries an explicit "© 1962 Alcoholics Anonymous
  World Services, Inc. All rights reserved" notice, so it is not established as public domain;
  the source therefore ships **disabled** and is enabled as `full-text` only once a documented
  reproduction basis exists (see design.md).
