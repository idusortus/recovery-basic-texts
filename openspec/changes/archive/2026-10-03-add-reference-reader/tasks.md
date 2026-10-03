# Tasks

> Tasks tagged **manual (browser)** need a running browser session (nav
> behavior, focus/keyboard, contrast in both themes, offline/installed PWA,
> audio playback) and have no automated harness in this repo, so they must be
> left unchecked honestly if not run (see `decisions.md` 2026-09-30).
> Automatable (no browser): 1.1–1.5, 2.1–2.2, 2.4–2.5, 4.1, 5.3.

## 1. Registry flag: filter vs. search

- [x] 1.1 Add optional `filterable?: boolean` to `Source` in `src/lib/types.ts`,
      documented as "controls only whether the source appears as a source-filter
      chip; does not affect indexing, display mode, or the /sources listing".
      Verify `pnpm run check` type-checks the new field usage once 1.2–1.4 land.
- [x] 1.2 In `src/lib/corpus/registry.ts` `validateSource`, read
      `filterable` as an optional boolean, defaulting to `true` when
      absent/null; throw on a non-boolean present value. Verify by adding a
      focused assertion in the task-1.5 test.
- [x] 1.3 In `corpus/scripts/validate.js`, validate `filterable` only when
      present (`typeof source.filterable === 'boolean'`), failing loudly
      otherwise; do not require the field. Verify `node corpus/scripts/validate.js`
      exits 0.
- [x] 1.4 Set `"filterable": false` on the four reference entries in
      `corpus/sources.json` (`twelve-steps`, `twelve-traditions`,
      `twelve-concepts`, `promises-and-prayers`) and leave every other entry
      unchanged (no field, so they default true). Verify
      `node corpus/scripts/validate.js` exits 0.
- [x] 1.5 Add `scripts/test-source-filterable.mjs` (`pnpm run test:source-filterable`
      entry in `package.json`) importing `src/lib/corpus/registry.ts` and
      `corpus/sources.json` directly, asserting: the four reference ids are
      non-filterable; every other enabled source is filterable; an absent
      `filterable` defaults to true; a present non-boolean value is rejected;
      the derived `filterableSources` default set excludes the four reference
      ids while the full source set still includes them; and no `src/` file
      hard-codes an id list for chip exclusion. (Tasks 2.4 and 2.5 add the
      default-search sentinel assertion and the `/sources` all-sources
      assertion here.) Verify the script exits 0.
- [x] 1.6 Re-run `pnpm run build:index` so the index-meta version matches the
      changed `sources.json`, then verify `node corpus/scripts/validate.js`
      passes its index-freshness guard.

## 2. Filter chips exclude non-filterable sources

- [x] 2.1 In `src/routes/+page.svelte`, derive **one** named
      `filterableSources` list
      (`enabledSources.filter((s) => s.filterable !== false)`) and route ALL
      FOUR consumers through it, so no consumer keeps comparing against
      `enabledSources`:
      - the default `activeSourceIds` seed (line ~52) —
        `new Set(filterableSources.map((s) => s.id))`;
      - the `activeSourceList()` sentinel (line ~224) —
        `if (activeSourceIds.size >= filterableSources.length) return null;`
        and the returned ids built from `filterableSources`, NOT
        `enabledSources`;
      - the "Filter Sources" chip `{#each}` (line ~668) —
        `{#each filterableSources as source (source.id)}`;
      - the `parseSearchUrl` default/known id list (line ~125) —
        `parseSearchUrl($page.url.search, filterableSources.map((s) => s.id))`.
      Rationale (blocker): changing only the chips and the seed makes the
      sentinel's `activeSourceIds.size >= enabledSources.length` comparison
      `3 >= 6` → false and applies a three-id source filter to every default
      search, silently excluding `twelve-steps`, `twelve-traditions`, and
      `promises-and-prayers`; leaving the URL default on `enabledSources`
      reintroduces the same divergence on any load without a `sources`
      parameter. Verify by inspection that none of the four consumers still
      references `enabledSources` for the default filter set and that no
      reference id is named in the page.
- [x] 2.2 Confirm search reach is unchanged: the search/index paths still use
      the full indexed corpus, `activeSourceList()` still resolves returned ids
      against the full indexed set, and the "all filterable chips selected ⇒
      null (no filter)" sentinel still means an unfiltered search. Verify with
      the existing search test scripts (`pnpm run test:search`), including a
      query for `promises`, and by asserting the reference source ids are not
      referenced in the filter-chip markup.
- [ ] 2.3 **manual (browser)** — on the home surface, confirm the four
      reference sources have no chip, that all remaining sources show and are
      selected by default, that deselect/reselect still works, and that a search
      for `promises` still returns `promises-and-prayers` results.
- [x] 2.4 Assert the default search is not narrowed by the chip exclusion:
      after 2.1, a default (no `sources` parameter) search over the full corpus
      must still reach non-filterable sources. Add an automated assertion to
      `scripts/test-source-filterable.mjs` (task 1.5) or the search test that
      drives the default `activeSourceList()` path and confirms it returns
      `null` (unfiltered) when every filterable chip is selected — i.e. the
      sentinel compares against `filterableSources.length`, not
      `enabledSources.length`. Verify the script exits 0.
- [x] 2.5 Confirm `/sources` is unaffected by `filterable`: assert `/sources`
      still lists **all** registered sources — including the four reference
      sources (`twelve-steps`, `twelve-traditions`, `promises-and-prayers`, and
      the disabled `twelve-concepts`) — proving `filterable` affects the
      search-surface chips only and not the `/sources` listing. Add this
      assertion to the source-filterable test (task 1.5) or a focused check, and
      verify it passes.

## 3. Reader route, nav entry, and view table

- [x] 3.1 Add a `Reference` entry to `navLinks` in
      `src/lib/components/Nav.svelte` pointing at `/reference`, importing a
      distinct icon (`BookMarked`), so it appears in both the desktop bar and
      the mobile overlay with the existing active-state/`aria-current`/focus-trap
      behavior. Verify by inspection that both `{#each navLinks}` loops render
      it.
- [x] 3.2 Create `src/routes/reference/+page.svelte` with a declarative view
      table keyed by a `text` query parameter mapping each key to an exact
      source id and display title: `steps` → `twelve-steps`, `traditions` →
      `twelve-traditions`, `concepts` → `twelve-concepts`, `promises` →
      `promises-and-prayers`; unknown/missing keys default to `steps`. The
      key → source id mapping is asserted by task 4.1 so it cannot drift. Verify
      the page renders one `<h1>` and a view selector.
- [x] 3.3 Implement the view selection as accessible controls (labeled group,
      `aria-pressed`, non-color active cue), updating the URL via `goto` with
      `replaceState` + `keepFocus` so a selected view is directly addressable.
      Verify by loading `/reference?text=concepts` directly.
- [x] 3.4 Render full-text views from `loadSearchIndex()` + `getSourceById()` +
      `getPassages()`: look up the source, filter passages by `sourceId` and sort
      by `sequence`, render each `text` as a paragraph under an `<h2>`, using the
      source accent for the header and preserving paragraph breaks. Verify the
      Twelve Steps, Twelve Traditions, and Promises & Prayers views render all
      their passages.
- [x] 3.5 Render the gated placeholder when the source is missing, disabled, or
      not `full-text`: show the registry title, a copyright notice, and a link to
      the registry `officialUrl` (aa.org), and render no passage text. Verify the
      Twelve Concepts view shows only the placeholder.
- [x] 3.6 Reuse the existing `src/lib/passage/reader-prefs.ts` (font size /
      line spacing) and, where useful, `src/lib/passage/tts.ts` (Listen) for
      full-text views only; render neither control on the gated placeholder.
      Verify no aa.org or other network request is made by the reader.

## 4. Offline and guard verification

- [x] 4.1 Add `scripts/test-reference-reader.mjs`
      (`pnpm run test:reference-reader`) that source-scans the reader page and
      asserts: no `fetch`/`XMLHttpRequest`/`sendBeacon` to an external host; the
      reader reads passages only after an `enabled`/`full-text` guard; the
      gated branch returns before touching `getPassages()`; no `twelve-concepts`
      text is referenced; and no auth/bookmark/note persistence is introduced.
      It SHALL also assert the reader's **view key → source id mapping** so it
      cannot drift: each view key (`steps`, `traditions`, `concepts`,
      `promises`) maps to the exact source id (`twelve-steps`,
      `twelve-traditions`, `twelve-concepts`, `promises-and-prayers`) declared
      for that view in the reader's view table, and the four reference source
      ids appear in that table exactly once. Verify the script exits 0.
- [ ] 4.2 **manual (browser)** — with DevTools Network open, open each reader
      view and confirm no request fetches reference text; then take the app
      offline (or use the installed PWA offline) and confirm all three full-text
      views still render.

## 5. Validation and guardrails

- [ ] 5.1 **manual (browser)** — verify the reader at a mobile viewport: no
      horizontal scroll, adequate tap targets, legible type; verify keyboard
      operation and visible focus on the view selector; verify the active view is
      announced (not color alone) and heading navigation reaches each text.
- [ ] 5.2 **manual (browser)** — verify light and dark themes meet contrast
      expectations for the nav entry, view selector, and text; verify the
      Concepts placeholder shows the title, copyright notice, and aa.org link
      with no text; verify no account/bookmark/note surface appears.
- [x] 5.3 Run `pnpm run check`, `pnpm run build`, all `pnpm run test:*` scripts,
      `node corpus/scripts/validate.js`, and
      `openspec validate add-reference-reader --strict`; verify all pass.
