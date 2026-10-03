# Design

## Context

See `proposal.md` — Why. Current state that shapes the approach (verified this
session):

- **The filter chips are registry-driven today, but "enabled" is the only
  gate.** `src/routes/+page.svelte` renders one chip per `enabledSources`
  (`{@each enabledSources as source}`) and seeds the default active set from
  `enabledSources.map((s) => s.id)` (line 52). `enabledSources` is
  `allSources.filter((s) => s.enabled)` in `src/lib/corpus/registry.ts:75`. So
  the four reference sources — all enabled except `twelve-concepts` — appear as
  chips automatically. There is no field that separates "searchable" from
  "shown as a filter chip".
- **Four separate places in `+page.svelte` assume "all enabled sources =
  the default filter set", and they must be changed together.** Changing only
  the chip `{#each}` (line 668) and the `$state` seed (line 52) is
  insufficient: `activeSourceList()` (line 224) has
  `if (activeSourceIds.size >= enabledSources.length) return null;` ("all
  selected ⇒ no source filter"), so with three filterable of six enabled the
  comparison `3 >= 6` is false and the default search filters results down to
  the three filterable ids — silently excluding `twelve-steps`,
  `twelve-traditions`, and `promises-and-prayers`. Separately,
  `parseSearchUrl($page.url.search, enabledSources.map((s) => s.id))` (line
  125) passes the enabled set as the known/default id list, so a load with no
  `sources` parameter also restores the enabled default. The fix must route
  **all four consumers** — the `$state` seed (~52), the sentinel (~224), the
  chip `{#each}` (~668), and the URL default (~125) — through **one** derived
  `filterableSources` list.
- **The registry schema is validated in two places.** `corpus/scripts/validate.js`
  (registry loop, lines 59–93) and the build-time loader
  `src/lib/corpus/registry.ts` (`validateSource`, lines 18–65); the TypeScript
  type is `Source` in `src/lib/types.ts:11`. A new field must be added in all
  three consistently, with a default that leaves every existing source
  unaffected.
- **Navigation is a single source of truth.**
  `src/lib/components/Nav.svelte` declares `navLinks` (line 32) and iterates it
  in both the desktop bar (line 108) and the mobile overlay (line 199). Adding
  one entry there adds it to both surfaces with active-state, `aria-current`,
  and the focus-trap behavior already handled.
- **The reference corpus is committed and small.** `twelve-steps` (2 passages),
  `twelve-traditions` (12 passages, long form), `promises-and-prayers` (3
  passages: Ninth Step Promises, Third Step prayer, Seventh Step prayer).
  `twelve-concepts` has **no corpus file** — it is registered disabled and
  `validate.js` passes for a disabled source with no file
  (`validate.js:108-111`).
- **The reader can load from data the app already ships.**
  `src/lib/search/index.ts` exposes `getPassages()` (the prebuilt
  `static/index/passages.json` lookup) and `getSourceById()` in the registry.
  The passage route already reads `getPassages()` + `getSourceById()` after
  `loadSearchIndex()`. That same path works offline because the index is
  precached (`+layout.svelte` / PWA; PRD §7.5). No aa.org fetch is needed or
  permitted.
- **A prior change forbade a dedicated page.** `openspec/specs/reference-texts/spec.md`
  requirement "Reference sources stay within the MVP guardrails" says
  "SHALL NOT ... a dedicated reference page", with scenario "No new page,
  route, or account surface". The prior proposal's non-goal is explicitly
  superseded here, so the delta MODIFIES that requirement (header must match
  exactly for `--strict`).
- **Existing reader affordances already exist on the passage page** —
  `src/lib/passage/reader-prefs.ts` (font size / line spacing, namespaced
  localStorage) and `src/lib/passage/tts.ts` (Listen). The new reader can reuse
  these rather than build parallel controls.

## Goals / Non-Goals

**Goals:**

- One explicit registry field that separates search-index/filter presentation
  without touching what is indexed.
- A single `/reference` route with one self-contained view per text, selected
  from the route and directly addressable.
- Offline content loading from existing shipped data, with the disabled
  Concepts rendered as a gated placeholder and no text available from it.
- Mobile-first, accessible, calm presentation consistent with the app.
- A spec delta that cleanly supersedes the "no dedicated page" non-goal.

**Non-Goals:**

- Changing index contents, search ranking, result rendering, or the URL state
  of the search surface.
- Any server-side load, API, dependency, or network fetch for reader content.
- Per-passage routes for the reference texts (the existing passage route already
  serves individual passages).
- Auth, accounts, bookmarks, notes, or any user-data persistence.

## Decisions

### Registry field: `filterable?: boolean`, default `true`

Add an optional boolean `filterable` to the registry `Source` (typed in
`src/lib/types.ts`, validated in `corpus/scripts/validate.js` and
`src/lib/corpus/registry.ts`). Semantics: **`filterable` controls only whether
the source appears as a source-filter chip on the search surface.** It does not
control `enabled` (whether the source is usable/indexed), `displayMode`
(rendering gate), or [`/sources`] listing (all sources). Default when absent is
`true`, so every existing entry and any future source is unaffected unless it
opts out. The four reference entries set `filterable: false`.

- **Why a new field rather than reusing `enabled` or `displayMode`?** The user's
  requirement is precisely "remove from the filter chips but keep in the
  search index". `enabled: false` would remove it from search (the index build
  and `enabledSources` both key on it); repurposing `displayMode` would conflate
  rendering with navigation. A dedicated, default-true flag expresses exactly
  the one behavior, keeps the change declarative, and satisfies the AGENTS.md
  registry-driven rule.
- **Naming:** `filterable` reads as a capability of the source. Alternative
  considered: `showInFilter` — rejected because the semantic is "may this source
  be used in filtering", not "force it into the filter"; a default-true
  `filterable` is the conventional positive flag.
- **Not `enabled && filterable` in the page?** The page will render chips from
  `enabledSources.filter((s) => s.filterable !== false)` — i.e. "enabled **and**
  filterable". A disabled source is already excluded by `enabledSources`, so the
  Concepts is excluded twice over (disabled, and non-filterable), which is
  correct and harmless.

### One derived `filterableSources` list is the single source of truth for the default filter set

The page SHALL derive one named list,
`const filterableSources = enabledSources.filter((s) => s.filterable !== false)`,
and ALL FOUR consumers below SHALL reference that list rather than
`enabledSources`:

1. **Default active set** — `src/routes/+page.svelte:52`:
   `let activeSourceIds = $state<Set<string>>(new Set(filterableSources.map((s) => s.id)))`.
2. **`activeSourceList()` sentinel** — `src/routes/+page.svelte:224`: the
   "all selected ⇒ no source filter" comparison SHALL be
   `if (activeSourceIds.size >= filterableSources.length) return null;` and the
   returned list SHALL be built from `filterableSources`, not `enabledSources`.
   This is the blocker: leaving the sentinel on `enabledSources.length` makes
   the default `3 >= 6` comparison false and applies a three-id source filter
   that excludes the reference sources from every default search.
3. **Chip `{#each}`** — `src/routes/+page.svelte:668`:
   `{#each filterableSources as source (source.id)}`.
4. **URL parse default** — `src/routes/+page.svelte:125`:
   `parseSearchUrl($page.url.search, filterableSources.map((s) => s.id))` so a
   load with no `sources` parameter restores the same default set the chips and
   sentinel use. Passing `enabledSources` here reintroduces the divergence even
   if only the sentinel is fixed.

Search reach itself is unchanged: the sentinel still means "no source filter
applied" when every filterable chip is selected, so results still include the
reference sources and any other indexed source. `activeSourceList()` continues
to resolve ids against the full indexed set; only the *default* filter set and
the chips narrow to `filterableSources`. No consumer SHALL compare against
`enabledSources` for the default filter set.

### Search indexing is unchanged

The index build reads `corpus/sources.json` and indexes enabled sources'
passage `text`/`title`/`chapterRef`; `filterable` is a presentation-only field
and the build script ignores it. No index contents change. The index *version
hash* will change because `sources.json` is an input to the hash
(`corpus/scripts/index-version.mjs`), so `pnpm run build:index` must be re-run —
but the searchable corpus and result behavior are identical. This is the
deliberate separation the spec MODIFIED block requires.

### Reader route shape: one route, selected view via URL parameter, not sub-routes

A single `src/routes/reference/+page.svelte` (plus small components) with the
selected text held in the URL as a query parameter, e.g.
`/reference?text=steps`, `?text=traditions`, `?text=concepts`,
`?text=promises`. Alternatives and why rejected:

- **Sub-routes (`/reference/steps`, `/reference/concepts`, ...):** more files
  and duplicated shell/markup; a shared `+layout.svelte` under `reference/`
  would be needed to avoid duplication. No functional gain.
- **A path segment (`/reference/[textId]`):** makes the default/redirect case
  and validation of unknown ids more awkward than a query param, and the
  parameter is presentation state, not a resource hierarchy.
- **One route with in-memory state only:** not directly addressable or
  shareable, violating the spec's addressability requirement.

A query parameter keeps one page, one shell, direct addressability, easy
validation (unknown/missing → default to `steps`), and matches the app's
existing pattern of encoding viewer state in the URL (search uses `q`/`phrase`/
`sources`). The parameter name `text` is explicit.

### Reader view structure and content source

The page reads the views from a **small declarative view table** keyed by the
`text` parameter. Each view names a source id and a title. Rendering branches
only on registry state — never a hard-coded id list of which to gate:

1. Look up the source with `getSourceById(sourceId)`.
2. If absent → treat as not found under the reader's own heading.
3. If the source is **disabled**, render the **gated placeholder** (title,
   copyright notice, link to `officialUrl` from the registry) and skip all text.
4. Else if `displayMode === 'full-text'` and the source is enabled, gather its
   passages from `getPassages()` sorted by `sequence` and render them as
   formatted paragraphs, preserving paragraph breaks and the source's accent
   color for the header.
5. Else (enabled but not full-text — not the case for reference texts today)
   render the same gated placeholder, so the guard cannot be bypassed by a
   future registry edit.

**Fourth view decision:** the reader's fourth view is **"Promises & Prayers" as
one view**, rendering all three `promises-and-prayers` passages in sequence.
Rationale: the source is one registry entry with one chip (now removed) and one
`/sources` card; splitting the prayers into their own views would invent views
the corpus does not model and contradict "each of which should be a self
contained view after being selected" — the Promises and the Third/Seventh
prayers are one source. The Twelve Concepts is necessarily its own view because
it is a distinct source and a distinct gate. (The Eleventh Step prayer is out of
scope entirely — it is copyrighted 12&12 text, per `reference-texts`.)

### Offline loading

Content comes from `loadSearchIndex()` + `getPassages()` + `getSourceById()` —
the same offline-precached data the passage route uses. No `fetch()` to aa.org
or any host; the reader makes no network request for text. `loadSearchIndex()`
already handles the loading/error states the app uses. This satisfies the
offline spec requirement and the PWA guarantee without new caching
configuration.

### Nav label: "Reference"

The main nav already has "Sources" (`/sources`) and "Daily Reflection"
(`/reflection`). A bare "Steps & Traditions" would omit the Concepts and the
Promises/prayers and would read as two texts. "Reader" is ambiguous with the
passage view. **"Reference"** names the whole set (these are the
meeting-referenced texts) without colliding with an existing label or route,
and pairs naturally with the registry term "reference sources" already used in
the spec and corpus guide. Icon: `BookMarked` from `@lucide/svelte` (distinct
from `BookOpen` used by Daily Reflection and `Library` used by Sources) so the
nav stays scannable.

### Accessibility and reuse of existing reader controls

- The view selector is a labeled group of buttons/links with `aria-pressed` (or
  a `tablist`-free, simple pattern consistent with the app's chip buttons) and a
  non-color active cue, matching the existing chip/`aria-pressed` convention.
- Content uses one `<h1>` for the page and an `<h2>` per text, with paragraphs
  in document order, so heading navigation works.
- The page reuses `reader-prefs.ts` and `tts.ts` where it adds value (font
  size / line spacing / Listen) **only for full-text views**; the gated
  placeholder renders neither control.
- Focus is visible throughout; the nav entry inherits the existing active-state
  and mobile focus-trap behavior from `Nav.svelte`.
- Contrast follows the established `navy`/`amber-400` and stone/slate tokens.

### Superseding the `reference-texts` non-goal

The delta MODIFIES two requirements in `openspec/specs/reference-texts/spec.md`,
with headers copied verbatim:

1. **"Reference texts are discoverable through existing surfaces"** — updated to
   define chip exclusion as a registry-driven presentation choice that leaves
   search and `/sources` intact.
2. **"Reference sources stay within the MVP guardrails"** — updated to remove
   the blanket "no dedicated reference page" prohibition and instead bind the
   reader to the existing full-text guard (protected/disabled stays
   placeholder-only; no user-data surface; no non-AA literature).

The header text and scenario names are preserved (headers match exactly, so
`openspec validate --strict` accepts the MODIFIED block); the content is the
full updated requirement, not a partial edit.

**Intentionally misleading preserved scenario name (do not "fix" it).** The
MODIFIED requirement "Reference texts are discoverable through existing
surfaces" retains the scenario name **"An enabled reference source gets a
filter chip and a sources card"** even though its body now states the source is
excluded from the filter chips. OpenSpec's MODIFIED semantics require every
scenario name that the main spec still contains to be preserved verbatim;
renaming or dropping it makes the delta invalid under `--strict` (the same
constraint recorded in `decisions.md` 2026-09-30 for `passage-view`). The name
is therefore a **forced, intentional artifact of MODIFIED semantics, not an
oversight or a contradiction to resolve.** The body is authoritative: it says
the enabled reference source appears on `/sources`, stays searchable, and is
excluded from the chips. A future reviewer must not "correct" the name to match
the body; changing it requires a `REMOVED` + `ADDED` delta, as decided for the
analogous `passage-view` scenario, not a rename inside this MODIFIED block.

## Risks / Trade-offs

- **A user searching may wonder why the reference sources have no chip.** →
  Search results still show them grouped under their own source label; the
  reader and `/sources` remain the discovery surfaces for the texts themselves.
  The `known-exceptions.json` "Promises" hint already points users to the
  source by name.
- **`filterable` added but never read in some surface** → the page reads it;
  validate.js and the loader validate it as an optional boolean when present,
  so an unknown value fails loudly. Default `true` means no existing source
  changes behavior.
- **Index version hash changes with no content change** → expected; the
  freshness guard requires the rebuild, which the task list includes.
- **The gated placeholder must not leak text** → the viewer only ever reads
  passages for `enabled && full-text` sources; the disabled branch returns
  before touching `getPassages()`. A test/task asserts no `twelve-concepts` text
  is reachable.
- **Color/contrast of a new nav item and reader header** → reuse existing navy/
  amber tokens; a browser check verifies both themes.
- **"Reference" could be mistaken for `/sources`** → the nav entry sits beside
  Sources and the page heading explains it is the text reader; `/sources` stays
  the metadata/index listing.

## Migration Plan

1. Add `filterable` to the `Source` type, both validators, and set
   `filterable: false` on the four reference entries in `corpus/sources.json`.
   Re-run `node corpus/scripts/validate.js` and `pnpm run build:index` (the
   version hash changes because `sources.json` changed).
2. In `+page.svelte`, derive one `filterableSources` list
   (`enabledSources.filter((s) => s.filterable !== false)`) and use it in all
   four consumers: the default active set (~52), `activeSourceList()`'s
   sentinel and returned ids (~224), the chip `{#each}` (~668), and the
   `parseSearchUrl` default id list (~125). Do not leave any of the four on
   `enabledSources`.
3. Add the `Reference` entry to `Nav.svelte` and create
   `src/routes/reference/+page.svelte` (+ a view table / component as needed),
   reusing `reader-prefs.ts`/`tts.ts` for full-text views.
4. Verify mobile, keyboard, contrast, offline, and the Concepts placeholder;
   run `pnpm run check`, `pnpm run build`, the test scripts, and
   `openspec validate add-reference-reader --strict`.

Rollback: revert the change directory's corresponding code/corpus commit; the
next build regenerates the previous index from the reverted `sources.json`.

## Open Questions

- None blocking. Whether the reader should also offer copy/share per text is a
  small additive decision that does not change the specs or the approach; it can
  be settled during implementation.
