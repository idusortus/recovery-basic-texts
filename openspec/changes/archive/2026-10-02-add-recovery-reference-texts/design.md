# Design

## Context

See `proposal.md` — Why. Current state that shapes the approach:

- **The registry path is the no-code extension point.** `corpus/sources.json` is an array of
  source metadata; `corpus/sources/<id>.json` is a passage array; `pnpm run build:index`
  compiles every *enabled* source into `static/index/*`. `node corpus/scripts/validate.js`
  enforces the registry and passage schema. The PRD §6.1 and README "Adding a corpus source"
  both state that a new source needs only these two files and a rebuild.
- **The registry schema** (validated by `corpus/scripts/validate.js`) requires `id`, `title`,
  `shortTitle`, `description`, `displayMode` (`full-text` | `snippet` | `concordance-only`),
  `copyright` (`public-domain` | `protected` | `unknown`), `contextWords`, `sortOrder`,
  `enabled`, and `officialUrl`/`freeUrl`/`color`/`linkTemplate`. A disabled source needs no
  corpus file; a pagemap requires an `edition` block.
- **Existing sources and order:** `big-book-2ed` (1, full-text, public domain),
  `twelve-steps-traditions` (2, the 12&12 *book*, snippet, copyright unknown),
  `twelve-traditions` (3, **disabled** placeholder described as the 1950 short form, snippet),
  `daily-reflections` (4, concordance-only). The `sortOrder` guide reserves 10+ for future
  sources.
- **The requested texts already exist, in whole or part, in `big-book-2ed`:**
  - the Twelve Steps list — `big-book-2ed-chapter-5-how-it-works-p0106` (`p.80`) continuing
    into `...-p0107` (`p.81`);
  - the long form of the Twelve Traditions — `big-book-2ed-appendices-p0254` through
    `...-p0258` (`p.189`–`p.192`), and the short form at `...-p0253` (`p.187`);
  - the Ninth Step Promises — chapter 6 "Into Action" passage
    `big-book-2ed-chapter-6-into-action-p0144` (`p.104`, the "new freedom" text) and its
    continuation `...-p0145` (`p.105`);
  - the Third Step prayer — `big-book-2ed-chapter-5-how-it-works-p0112` (`p.84`); the Seventh
    Step prayer — `big-book-2ed-chapter-6-into-action-p0131` (`p.97`).
  - The Eleventh Step prayer (the "channel of thy peace" / St. Francis prayer) is **not**
    public-domain Big Book text: `...-p0131` contains only the Seventh prayer. It lives in the
    copyrighted 12&12 at `twelve-steps-traditions-step-nine-p0113` (`p.99`) and remains
    reachable through that existing `snippet` source; it is **not** part of the new
    `promises-and-prayers` source.
  - The Twelve Concepts do **not** appear anywhere in the corpus.
- **Copyright findings (verified this session):** the Big Book 2nd edition is public domain
  (copyright lapsed 1983, documented in `CORPUS-GUIDE.md` Part 2/3), so the Steps, long-form
  Traditions, Promises, and the Third and Seventh Step prayers are reproducible from it. The
  Twelve Traditions long form was first published in the April/May 1946 AA Grapevine and
  appears in the 2nd-edition back matter. By contrast, aa.org's Twelve Concepts short form
  carries an explicit
  "© 1962 Alcoholics Anonymous World Services, Inc. All rights reserved" notice, and the long
  form is printed in the copyrighted *A.A. Service Manual*. The Concepts are therefore **not
  established as public domain** and the user-facing claim that all of these are "open source
  and reproducible legally" does not hold for them without a documented basis.
- **`corpus/known-exceptions.json` has an app-bundled mirror** in
  `src/lib/corpus/exceptions.ts` ("Mirrors corpus/known-exceptions.json"). Editing the JSON
  alone does not change running behavior, so hint-driven discoverability would require a
  `src/` change and is outside this change's no-app-code path. The existing `promises` hint is
  now stale: it tells users to "search for individual words" instead of pointing at the new
  `promises-and-prayers` source. A task updates the JSON hint; the `src/` mirror is a separate
  follow-up.
- **The search index indexes passage `text`, `title`, and `chapterRef`**
  (`corpus/scripts/build-index.mjs`), but not the source `title`/`shortTitle`. A reference
  source is therefore searchable by naming its text in each passage's `title`/`chapterRef`.

## Goals / Non-Goals

**Goals:**

- Fix the concrete source taxonomy (ids, display modes, order, colors, links, enabled state)
  so the corpus work is unambiguous.
- Guarantee that no reference text renders full-text without a written, registry-reflected
  reproduction basis.
- Handle the Big Book overlap deliberately rather than by accident.
- Keep the whole change on the registry path: no `src/` edits, no new page.

**Non-Goals:**

- Any application code change, route, component, or topic-list edit.
- Cross-source de-duplication of text that appears in both the Big Book and a reference
  source.
- Deciding the Twelve Concepts' legal fate; the design makes the decision a gated,
  documented step rather than assuming an answer.
- Adding non-Big-Book AA literature beyond the Concepts/Traditions reference texts.

## Decisions

### Capability: a new `reference-texts` capability, not `corpus-integrity`

`corpus-integrity` owns extraction hygiene (running headers) and passage identity during
repair. The reference texts are a **content** concern: which short texts are catalogued, on
what legal basis, with what provenance and overlap labeling, and how they stay discoverable.
Putting those requirements in `corpus-integrity` would conflate page-furniture cleanup with
sourcing decisions, and `search-ui`/`search-quality` change only in that new sources flow
through them (no requirement text changes). A dedicated `reference-texts` capability keeps the
copyright-basis and provenance contracts together and reusable for any future reference text.
Alternative considered: modify `corpus-integrity` — rejected as a category error.

### Source taxonomy

| id | displayMode | copyright | sortOrder | color | notes |
|---|---|---|---|---|---|
| `twelve-steps` | `full-text` | `public-domain` | 5 | `#6B4E8C` | Twelve Steps list, derived from the 2nd-ed. Big Book |
| `twelve-traditions` | `full-text` | `public-domain` | 3 | `#4A7C6E` | long form, derived from the 2nd-ed. Big Book back matter |
| `twelve-concepts` | `full-text` (source **disabled**) | `unknown` | 6 | `#B0563A` | gated; no `snippet` fallback — see below |
| `promises-and-prayers` | `full-text` | `public-domain` | 7 | `#2E6F95` | Ninth Step Promises + Third and Seventh Step prayers, derived from the 2nd-ed. Big Book |

All four use `contextWords: 15` (ignored for full-text, matching `big-book-2ed`) and
`linkTemplate: null` (full-text sources link to their `officialUrl`/`freeUrl`). Each carries
`officialUrl` to the corresponding aa.org page and, where one exists, a `freeUrl`
(`twelve-steps` and `promises-and-prayers` → the free 2nd-edition Big Book PDF;
`twelve-traditions` → the aa.org long-form PDF). `sortOrder` 3, 5, 6, 7 keeps the reference
texts grouped in the existing order rather than at 10+, because the user's intent is to call
them out next to the Big Book and 12&12.

> **Contrast check owed:** `promises-and-prayers` `#2E6F95` is a close blue to the
> `big-book-2ed` source `#1A5276`. Verify the two source badges/chips remain distinguishable
> (WCAG AA non-text contrast, both themes) before publish; adjust the color if they do not.

### Repurpose the disabled `twelve-traditions` entry; add new ids for the rest

The existing `twelve-traditions` entry is disabled, was never ingested or published, and
already reserves `sortOrder` 3 — so no passage ids are frozen and nothing is orphaned by
giving it the long-form content. We update its `title`/`description`/`displayMode`/`copyright`
and set `enabled: true`, and add `twelve-steps`, `twelve-concepts`, and
`promises-and-prayers` as new ids. Alternative considered: add a separate
`twelve-traditions-long` id and delete the placeholder — rejected because it leaves a stale
near-duplicate concept and burns a reserved order slot for no benefit.

### Group the Promises and the Third and Seventh Step prayers into one source

The Ninth Step Promises and the Third and Seventh Step prayers are all short, non-contiguous
public-domain Big Book excerpts read aloud in meetings, and the user named them together. One
source (`promises-and-prayers`) gives them a single filter chip and a single `/sources` card
while keeping each text as its own passage (so search still reaches the specific text). The
Eleventh Step prayer is excluded: it is copyrighted 12&12 text and stays in the existing
`twelve-steps-traditions` source, so `promises-and-prayers` is public-domain-only. Alternative
considered: separate `ninth-step-promises` and `step-prayers` sources — rejected as
proliferation: they share provenance, display mode, and audience, and two more chips/cards add
no discovery value.

### Derive the Big Book-based texts from the committed corpus; acquire the Concepts separately

The Steps, long-form Traditions, Promises, and the Third and Seventh Step prayers are
extracted from `big-book-2ed.json` by a small committed script that selects the source
passages, rewrites `sourceId`/`id`/`title`/`chapterRef`/`sequence`, and preserves `pageRef` as
provenance. This avoids a second OCR/ingest pass and guarantees the reference text matches the
corpus exactly.
The Twelve Concepts, absent from the corpus, requires a separate acquired input under
`corpus/raw/` and a `CORPUS-GUIDE.md` basis entry before it can be enabled.

### Overlap: labeled duplication, no de-duplication

A search matching shared text will return a Big Book result and a reference-source result, each
under its own source label, and the reference source's `description` names the Big Book origin
and the overlap. The alternative — suppressing the duplicate at search time — is an
application-code change (and would need a rule for which source wins), which this change
excludes. The duplication is intentional and bounded: these are four small, named collections,
and the extra results are exactly what "worth calling attention to" asks for.

### Copyright: gate full-text on a written basis, per source

`CORPUS-GUIDE.md` Part 3 gains a subsection for each reference source recording its basis, and
the registry `copyright` field mirrors it. For the Big Book-derived texts the basis is the
2nd-edition public-domain determination already recorded. For the Twelve Concepts the source is
registered **disabled** (`enabled: false`, `copyright: "unknown"`) and carries
`displayMode: "full-text"` as its intended mode; because there is no `snippet` fallback it is
never enabled in a non-`full-text` mode. Only after a reproducible basis (documented
permission, or a verified non-renewed publication) is written does a task flip it to
`enabled: true`. If no basis can be documented, the source stays disabled (or is dropped)
rather than shipping an unverified full text. This is a deliberate deviation from a naive
"add all four as enabled full-text": the evidence contradicts an unqualified public-domain
claim for the Concepts, and `AGENTS.md`/`CORPUS-GUIDE.md` forbid full text without a
documented basis.

### Discoverability: dynamic surfaces only

Enabled registry sources automatically produce source-filter chips, and `/sources` lists all
registry sources via `allSources` (including disabled ones, marked "Coming soon"). Passages
are indexable by `text`/`title`/`chapterRef`, so naming each text in its passage metadata makes
`promises`, `traditions`, and `steps` reach them. The hard-coded `src/routes/topics/+page.svelte`
list and the `src/lib/corpus/exceptions.ts` mirror are app code and are explicitly out of
scope.

## Risks / Trade-offs

- **Twelve Concepts cannot be substantiated as reproducible** → it ships disabled with a
  recorded finding; `full-text` is enabled only after a documented basis, and there is no
  `snippet` fallback. The user's intent for the Concepts is realized only if that basis exists.
- **Duplicate results for shared Big Book text** → intended and labeled; each reference
  source's `description` names its Big Book provenance. If it proves noisy, a future change can
  add source-scoped de-duplication.
- **The existing "The Promises" hint cites printed pages, not corpus pageRefs.** The
  2nd-edition pagemap offset is a constant 21, so the hint's `pp. 83–84` are printed pages that
  correspond to corpus pageRefs `p.104`–`p.105` (passages `...-p0144`/`...-p0145`), not to
  "modern edition" numbering. The reference corpus records its own `pageRef` and citations; the
  hint should be updated to point at the new `promises-and-prayers` source (a task in
  `tasks.md`), with the app-bundled `src/` mirror as a separate follow-up.
- **`promises-and-prayers` color proximity to the Big Book** → `#2E6F95` is a close blue to
  `big-book-2ed` `#1A5276`; a contrast check (and a color change if it fails) is required before
  publish so the source badges stay distinguishable.
- **Derived text drift from the Big Book** → extraction is a deterministic script over the
  committed `big-book-2ed.json`; the corpus validation and a spot-check guard it.
- **Index size growth** → four small sources add negligible size; the PWA budget (10–20MB) is
  unaffected.

## Migration Plan

1. Add the registry entries and the derived corpus files; record the copyright basis for the
   Big Book-derived sources in `CORPUS-GUIDE.md` (Part 3 and the `sortOrder` list).
2. Register `twelve-concepts` disabled (`enabled: false`, `displayMode: "full-text"`, no
   `snippet` fallback) with its finding recorded; acquire its raw input only if a basis is being
   pursued.
3. Run `node corpus/scripts/validate.js` and `pnpm run build:index`; the index version changes
   because `sources.json` and the corpus changed.
4. Ship as a `corpus: add recovery reference texts` PR; Cloudflare Pages rebuilds the index on
   push. Rollback is reverting the PR (corpus files plus registry), after which the next build
   regenerates the previous index.

## Open Questions

- Which edition/wording of the Twelve Concepts long form to use if a basis is documented
  (the *A.A. Service Manual* vs. a service-material PDF) — deferrable; it changes only the
  acquired input, not the approach or the spec.
- Whether to also include the Twelve Traditions short form in the long-form source, since the
  Big Book already carries both — deferrable content decision that does not change the
  capability's guarantees.
