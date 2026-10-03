# Proposal: Add a reference reader and trim the source-filter chips

## Why

Two related problems make the reference texts hard to actually read. First, the
search surface's "Filter Sources" row now carries four convenience collections
(`twelve-steps`, `twelve-traditions`, `twelve-concepts`, `promises-and-prayers`)
alongside the core literature; the row is getting crowded and these four are
better reached as texts than as search filters. Second, a reader who wants "the
Twelve Steps" as a clean, mobile page currently has to search, open a passage,
and read corpus fragments mixed with Big Book chapter text. The user asked for
a nicely formatted mobile view of each reference text as its own self-contained
page. This change supersedes the `add-recovery-reference-texts` non-goal that
forbade a dedicated reference page: the texts have shipped, the copyright bases
are recorded, and a calm reader is now the right surface.

## What Changes

- **Remove the four reference sources from the source-filter chips only.** A new
  registry field makes "filterable" an explicit, registry-driven property rather
  than a hard-coded id list in `src/routes/+page.svelte`. The four reference
  sources are marked non-filterable; every other source keeps its chip and its
  default selected state. The sources remain fully indexed and searchable, so a
  search still returns results labeled with those sources. `/sources` still
  lists them.
- **Add a new top-level "Reference" nav item and a `/reference` route** — a
  mobile-first reader with one self-contained view per text:
  - Twelve Steps;
  - Twelve Traditions (long form);
  - Twelve Concepts (a **gated placeholder**: title, copyright notice, and a
    link to aa.org only — no full text, consistent with the source shipping
    disabled);
  - Promises & Prayers (treated as **one** view containing the Ninth Step
    Promises and the Third and Seventh Step prayers, matching the single
    source; the Concepts is its own gated view).
- **Load the reader's content offline from existing data.** Views are rendered
  from the registry plus the already-shipped corpus data (the same data the
  search index is built from), not fetched from aa.org, so the reader works
  offline like the rest of the PWA.
- **Keep all existing guardrails.** No authentication, accounts, bookmarks, or
  notes; no non-AA literature; no protected or disabled source ever renders full
  text (hence the Concepts placeholder).
- **Update the `reference-texts` capability.** Its "no dedicated page" non-goal
  is superseded by a MODIFIED requirement, and new requirements define the
  reader and the filter/search separation.

Non-goals:

- Do not change what is indexed for search or alter search result content; the
  four sources stay searchable and their passages stay in the index.
- Do not add auth, accounts, bookmarks, notes, or any persistence beyond what
  the existing reader already provides.
- Do not reproduce any text for `twelve-concepts` while it is disabled; the
  reader shows a gated placeholder only.
- Do not add non-AA literature or any new corpus source.

## Capabilities

### New Capabilities

- `reference-reader`: The formatted, mobile-first reader at `/reference` that
  presents each reference text as a self-contained view selected from the
  route; defines the gated Twelve Concepts placeholder, offline content loading,
  and the reader's accessibility guarantees.

### Modified Capabilities

- `reference-texts`: Supersede the "no dedicated reference page" non-goal and
  separate "filterable" from "indexed" so the four reference sources are
  removed from the source-filter chips while remaining searchable and listed on
  `/sources`.

## Impact

- **Registry:** `corpus/sources.json` gains one field on the four reference
  entries; `corpus/scripts/validate.js` validates the field; `src/lib/types.ts`
  and `src/lib/corpus/registry.ts` expose it. The index version hash changes
  because `sources.json` changed, so `pnpm run build:index` must be re-run.
- **Search surface:** `src/routes/+page.svelte` renders chips from the new
  filterable set; the default active set follows it. Search behavior and indexed
  content are unchanged.
- **App shell:** `src/lib/components/Nav.svelte` gains a nav entry (desktop and
  mobile). The chosen label is "Reference".
- **New route:** `src/routes/reference/+page.svelte` (plus a small set of
  components/modules as decided in design.md). No server load; client-side,
  offline-capable.
- **No new dependency, no API, no runtime network call.** The reader is
  additional client-side rendering over data the app already ships.
