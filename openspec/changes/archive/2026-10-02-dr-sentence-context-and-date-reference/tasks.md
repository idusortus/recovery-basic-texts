# Tasks

> Ordered by dependency and file overlap. Phase 1 (engine/data) must land before
> Phase 2 (UI), which must land before Phase 3 (specs/tests) — the later phases
> depend on the earlier phases' interfaces and rendered strings.

## 1. Registry field and KWIC engine

- [x] 1.1 In `src/lib/types.ts`, add `contextSentences?: number | null` to the
      `Source` interface with a doc comment. In `src/lib/corpus/registry.ts`, parse
      it as an optional number (absent → `null`/`undefined`). In
      `corpus/scripts/validate.js`, add an optional-number check for
      `contextSentences` (mirroring the `contextWords` check) so
      `pnpm run validate:corpus` guards the field. Verify `pnpm run check` and
      `pnpm run validate:corpus`.
- [x] 1.2 In `corpus/sources.json`, add `"contextSentences": 1` to the
      `daily-reflections` entry. Note: `index-version.mjs` hashes `sources.json`, so
      the index version changes and `pnpm run build:index` is required (task 3.5 runs
      it via `test:search`, or run it explicitly).
- [x] 1.3 In `src/lib/search/kwic.ts`: add `concordanceSentenceWindow(text, anchor,
      contextSentences)` (whole sentences via `splitSentenceRanges` +
      `sentenceIndexAt`); thread an optional `contextSentences` through
      `resolveWindow()`, `buildKwicFromOffsets()`, and `buildExcerpt()`; for a
      `concordance-only` source with `contextSentences > 0`, use the sentence window
      (including in the `offsets.length === 0` head-clip branch), else keep
      `eachSideWindow()`. Extend `enforceProtectedClip()` so a sentence window that
      covers the whole text drops a whole sentence on the side away from the anchor
      (falling back to the existing word-drop for a single-sentence entry). Verify
      `pnpm run check` and the engine tests.
- [x] 1.4 In `src/lib/search/index.ts` (`_rankAndGroup`), pass
      `source.contextSentences` to both `buildKwicFromOffsets` and `buildExcerpt`.
      In `src/lib/corpus/reflection.ts` (`buildReflectionTeaser`), read and pass
      `source.contextSentences`. Verify `pnpm run check`.

## 2. Date as the leading reference

- [x] 2.1 In `src/lib/search/kwic.ts`, add an optional `date` parameter to
      `buildCitation` that, when provided, leads the attribution as
      `<date> · <source>` (instead of `From <source>, <chapterRef>`). Verify the
      helper produces `excerpt\n\nJanuary 1 · Daily Reflections` for a DR-shaped
      input (covered by 3.1).
- [x] 2.2 In `src/lib/search/index.ts` (`_rankAndGroup`), for a DR passage pass the
      formatted date (`formatReflectionDate(passage.date)`) and omit the duplicated
      `chapterRef` so the copied citation leads with the date. Import
      `formatReflectionDate` from `$lib/corpus/reflection-date` (the dependency-free
      module that breaks the `search/index` ↔ `corpus/reflection` cycle). Verify
      `pnpm run check`.
- [x] 2.3 In `src/routes/+page.svelte`, in the search result card header, render the
      date (`result.passage.chapterRef`, uppercased) ahead of the source short title
      for DR, e.g. `JANUARY 1 · DAILY REFLECTIONS`. Keep non-DR sources unchanged.
      Update `resultAriaLabel` so the accessible name still contains `DR` and the
      date (existing `article[aria-label*="DR"]` locators must keep matching) and the
      heading still exposes one source/reference line. Verify `pnpm run check` and the
      DR e2e.
- [x] 2.4 In the home "Today's Reflection" card (`src/routes/+page.svelte`) and the
      `/reflection` offline fallback (`src/routes/reflection/+page.svelte`), render
      the date as the leading element of the heading (ahead of the title/source), and
      confirm both render the expanded teaser. Keep the existing `<time>`/`Ref:`
      affordances; do not introduce truncation beyond the existing `line-clamp-5`.
      Verify by reading both route files and the DR e2e.

## 3. Specs, tests, and docs

- [x] 3.1 Update `scripts/test-reflection.mjs`: replace the `before/after <=
      contextWords` word assertions with sentence-based assertions (at most 1
      sentence each side via `splitSentences`), assert `contextSentences === 1` on
      the DR source, keep the "never the full text" assertions, and add a short
      (1-2 sentence) entry case asserting the guard drops a sentence. Verify
      `pnpm run test:reflection`.
- [x] 3.2 Update `scripts/test-search.mjs`: rewrite the `concordance-only` clipping
      test to assert sentence bounds and add an assertion that a DR search-result
      citation leads with the formatted date. Keep the synthetic no-`contextSentences`
      case to prove word-bounded `concordance-only` still works. Verify
      `pnpm run test:search`.
- [x] 3.3 Update the DR e2e that pins the old window: name and fix
      `e2e/search-copy-label.spec.ts` (it asserts the copied DR excerpt is
      `< 120` words — a 1-sentence-each-side window can exceed that; replace the
      numeric bound with a structural assertion such as "shorter than the full
      `text`, contains an ellipsis, and leads with the date"), and add an assertion
      that a DR result card leads with the date, without asserting protected prose.
      Check `e2e/search-integration.spec.ts` for any other DR-window assumption.
      Verify `pnpm run test:e2e`.
- [x] 3.4 Update `docs/plans/basic-texts-PRD.md` (the `concordance-only` description
      and the display-mode/KWIC tables) to the registry-driven word-or-sentence bound
      with DR at 1 sentence each side and the date as the leading reference.
- [x] 3.5 Run `pnpm run check`, `pnpm run lint` (no NEW errors), `pnpm run
      test:reflection`, `pnpm run test:search`, `pnpm run test:e2e`, and
      `pnpm run test:ui-copy`; all pass.
