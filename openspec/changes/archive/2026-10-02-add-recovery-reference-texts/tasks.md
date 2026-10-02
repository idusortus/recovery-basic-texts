# Tasks

> Planning-only change: nothing below is implemented yet. Per this repo's convention, only
> genuinely automatable tasks are checked as they land; manual/browser checks stay unchecked
> and are labelled `[manual]`. The two Twelve Concepts tasks gated on a written reproduction
> basis are **2.4** (build the corpus file) and **3.4** (flip the source to enabled); if no
> basis is documented they stay undone and the source stays disabled. There is no `snippet`
> fallback for the Concepts.

## 1. Copyright basis and guide

- [x] 1.1 In `corpus/CORPUS-GUIDE.md` Part 3, add a section for each Big Book-derived
      reference source (`twelve-steps`, `twelve-traditions` long form, `promises-and-prayers`)
      recording the public-domain basis: the 2nd-edition Big Book (copyright lapsed 1983)
      and the appendix/page where each text appears. Verify by reading the sections and
      comparing them with the new registry `copyright` values.
- [x] 1.2 In `corpus/CORPUS-GUIDE.md`, record the Twelve Concepts finding: the aa.org short
      form carries an explicit "© 1962 Alcoholics Anonymous World Services, Inc. All rights
      reserved" notice and the long form is in the copyrighted *A.A. Service Manual*, so
      `full-text` requires a documented reproducible basis (permission or verified
      non-renewal). Verify the finding is written and states that, absent a basis, the source
      stays disabled with no `snippet` fallback.
- [x] 1.3 In `corpus/CORPUS-GUIDE.md` Part 3 / the `sortOrder` list, document the long-form
      Traditions provenance (originally published 1946) and the final `sortOrder` assignments
      (3, 5, 6, 7). Verify by reading the updated list.

## 2. Corpus files

- [x] 2.1 Add a small committed extraction script that derives `corpus/sources/twelve-steps.json`
      from the Twelve Steps passages in `corpus/sources/big-book-2ed.json`
      (`...how-it-works-p0106`–`...-p0107`), setting `sourceId`, unique `id`s,
      `title`/`chapterRef` naming the text, monotonic `sequence`, and preserving the Big Book
      `pageRef` as provenance. For this unsplit source, verify every derived passage's `text`
      is byte-identical to its source passage. (For a source split across passages — the
      long-form Traditions in 2.2, split into twelve — the corresponding check is instead that
      each derived passage's `text` is a contiguous substring of its source passage.)
- [x] 2.2 Derive `corpus/sources/twelve-traditions.json` (the long form) from
      `big-book-2ed-appendices-p0254` through `...-p0258` (`p.189`–`p.192`), split into the
      twelve numbered traditions, with the short form left in the Big Book source. Verify all
      twelve traditions are present in order and each `text` is a contiguous substring of the
      Big Book source passages.
- [x] 2.3 Derive `corpus/sources/promises-and-prayers.json` from the Ninth Step Promises
      (`...into-action-p0144`, `p.104`, and its continuation `...-p0145`, `p.105`) and the
      Third Step prayer (`...how-it-works-p0112`, `p.84`) and Seventh Step prayer
      (`...into-action-p0131`, `p.97`), each as its own passage with a descriptive
      `title`/`chapterRef` so search reaches it. Do not include the Eleventh Step prayer — it is
      not public-domain Big Book text and stays in `twelve-steps-traditions`. Verify each
      passage's `text` is a contiguous substring of the Big Book source and the passage titles
      name Promises / Third / Seventh.
- [ ] 2.4 **(Conditional, gated on 1.2)** Only after a reproducible basis is recorded, acquire
      the Twelve Concepts long-form input under `corpus/raw/` and build
      `corpus/sources/twelve-concepts.json` with one passage per Concept. Verify the file
      validates and its source text matches the acquired input. If no basis is documented,
      leave this task undone and `twelve-concepts` disabled.

## 3. Registry

- [x] 3.1 Add `twelve-steps` (full-text, public-domain, sortOrder 5) and
      `promises-and-prayers` (full-text, public-domain, sortOrder 7) to `corpus/sources.json`
      with colors, `contextWords: 15`, `linkTemplate: null`, and `officialUrl`/`freeUrl`.
      Verify `node corpus/scripts/validate.js` reports the registry valid.
- [x] 3.2 Repurpose the disabled `twelve-traditions` entry into the long-form source:
      update `title`/`shortTitle`/`description` to name the long form, set
      `displayMode: "full-text"`, `copyright: "public-domain"`, keep `sortOrder: 3`,
      `enabled: true`, and a long-form `freeUrl`. Verify no second near-duplicate Traditions
      entry remains and validation passes.
- [x] 3.3 Register `twelve-concepts` as **disabled**: `enabled: false`,
      `displayMode: "full-text"` (the intended mode at enablement; there is no `snippet`
      fallback), `copyright: "unknown"`, `sortOrder: 6`, with a description pointing at the
      copyright review. Verify validation treats the missing corpus file as acceptable for a
      disabled source.
- [ ] 3.4 **(Conditional, gated on 1.2/2.4)** If and only if the basis is documented in 1.2,
      enable `twelve-concepts`: set `enabled: true` and `copyright` as documented (its
      `displayMode` is already `full-text`, with no `snippet` fallback). Verify validation and
      the index build include it.

## 4. Validation and index

- [x] 4.1 Run `node corpus/scripts/validate.js` and confirm zero errors across the registry
      and all enabled corpus files, including the new reference sources.
- [x] 4.2 Run `pnpm run build:index` and confirm it reports the new per-source passage counts
      and emits `static/index/{minisearch.json,passages.json,index-meta.json}` with an
      index version that changed from the pre-change value.
- [x] 4.3 Run `pnpm run test:search`, `pnpm run test:result-label`, and
      `pnpm run test:ui-copy` and confirm they still pass with the new sources indexed.
- [x] 4.4 Confirm the change stayed on the corpus path: `git diff --name-only` lists no file
      under `src/` (and no new route, component, or dependency).

## 5. Manual verification

- [ ] 5.1 `[manual]` With `pnpm run dev`, confirm each enabled reference source appears as a
      filter chip and as a `/sources` card with its title, copyright status, and display mode,
      and that searching `promises`, `traditions`, `steps`, and `prayers` returns results from
      the expected source.
- [ ] 5.2 `[manual]` Confirm shared-text queries (for example `common welfare`, `new freedom`)
      return both the Big Book result and the reference-source result, each under its own
      label, and that the reference source's description names the Big Book provenance.
- [ ] 5.3 `[manual]` Open the passage pages for enabled reference sources and confirm full
      text renders, Copy copies the passage, and the external links resolve; confirm
      `twelve-concepts` shows no text while disabled (its `/sources` card is marked
      "Coming soon"/under review) and does not appear as a search filter chip.
- [ ] 5.4 `[manual]` Spot-check 20 reference passages against the 2nd-edition Big Book text
      for accuracy, and confirm the offline PWA path returns the new sources after a rebuild.
- [ ] 5.5 `[manual]` Confirm the `promises-and-prayers` source badge/chip (`#2E6F95`) remains
      distinguishable from the Big Book source (`#1A5276`) and meets WCAG AA non-text contrast
      in both themes; change the color if it does not.

## 6. Documentation and ship

- [x] 6.1 Update `README.md` (source list) and, if the maintainer wants the source table
      current, `docs/plans/basic-texts-PRD.md` §6.4 to list the new reference sources and
      their display modes/copyright status.
- [ ] 6.2 Open the `corpus: add recovery reference texts` PR and confirm the corpus
      validation step and CI e2e checks pass; the Cloudflare Pages build regenerates the
      index on merge, and reverting the PR rolls the sources back.
- [x] 6.3 Update the stale `promises` hint in `corpus/known-exceptions.json` to point at the
      new `promises-and-prayers` source instead of telling users to search individual words.
      Note: the hint's running-behavior mirror is `src/lib/corpus/exceptions.ts`, which needs a
      `src/` change and is therefore a **separate follow-up task**, not part of this
      no-app-code change. Verify the JSON hint text is updated and the mirror is left untouched.