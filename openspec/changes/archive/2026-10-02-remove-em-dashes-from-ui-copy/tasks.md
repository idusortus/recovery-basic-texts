# Tasks

> Line numbers are approximate (they may drift); treat the quoted string as the
> source of truth. In scope: app-authored copy a visitor reads, hears, or copies.
> Out of scope: corpus text, source comments/JSDoc, and the data literal
> `'Chapter 5 — How It Works'` in `src/lib/search/index.ts`.

## 1. Format helpers and copied text

- [x] 1.1 In `src/lib/search/kwic.ts`, change `buildCitation()` (the
      `return \`${text}\n\n— ${parts.join(', ')}\`;` at ~line 530) so the
      attribution lead-in is `From ` instead of `— `, and update the format
      example in its JSDoc (~line 519). Verify the returned string for a
      representative input contains no U+2014 in its app-authored portion
      (covered by task 4.1).
- [x] 1.2 In `src/routes/passage/[sourceId]/[passageId]/+page.svelte`, apply the
      same `From ` lead-in to the copy citation (~line 420), change the
      `formatCitationHeader` separator (~line 408) from ` — ` to `: `, and
      update the header comment (~line 402). Verify the copied citation has no
      em dash in its app-authored portion (covered by task 4.2).
- [x] 1.3 In `src/lib/corpus/exceptions.ts`, make a punctuation-only edit to the
      `body` notice (~line 34): replace both em dashes with a comma and/or
      parentheses as the sentence reads best. Leave the en dash in `83–84`
      untouched. Verify by eye, then `pnpm run check`.

## 2. Components

- [x] 2.1 In `src/lib/components/DisplayModeLegend.svelte`, replace the three em
      dashes after the **Full-Text**, **Snippet**, and **Concordance** labels
      (~lines 39, 43, 47) with a colon or a comma clause so each definition reads
      naturally. Verify `pnpm run lint`.
- [x] 2.2 In `src/lib/components/ExternalLink.svelte` (~line 21) and
      `src/lib/components/Nav.svelte` (~lines 135 and 225), replace the em
      dashes (offline messages and the offline `title`) with a colon or a
      sentence break. Verify by eye.

## 3. Routes: visible copy and metadata

- [x] 3.1 In `src/routes/+error.svelte` (~line 11) and `src/routes/+layout.svelte`
      (~line 134 toast; ~lines 169, 181, 189 titles), apply the `|` document-title
      separator and a sentence break in the toast. Verify `pnpm run check`.
- [x] 3.2 In `src/routes/+page.svelte`, apply the mapping to ~lines 415 and 434
      (toasts), 458 (result announcement), 477 (title), 717 and 718 (mode
      labels), 1141, 1149, 1154, and 1156 (result chrome separators), and 1203
      (aria-label). Verify by eye and with `pnpm run check`.
- [x] 3.3 In `src/routes/about/+page.svelte`, apply the mapping to ~line 6
      (title) and ~lines 34, 49, 86, 106, 122, and 179 (prose). Do **not** edit
      ~line 204, which is inside the support section owned by the sibling
      `hide-support-project-info` change. Verify `pnpm run check`.
- [x] 3.4 In `src/routes/sources/+page.svelte` (~lines 14, 15, 37),
      `src/routes/topics/+page.svelte` (~line 27),
      `src/routes/reflection/+page.svelte` (~lines 43, 83), and
      `src/routes/feedback/+page.svelte` (~lines 63, 89, 235, 260), apply the
      mapping (titles use `|`, prose uses contextual punctuation). Verify by eye.

## 4. Regression guard and verification

- [x] 4.1 Add `scripts/test-ui-copy.mjs` and a `test:ui-copy` entry to
      `package.json`. Import `buildCitation` directly from
      `src/lib/search/kwic.ts` and assert its app-authored attribution has no
      U+2014; then scan `src/**/*.{svelte,ts,js}` for U+2014 after stripping
      every comment form: HTML comments (`<!-- -->`), line comments (`//`,
      mid-line as well as line-start), block comments (`/* */`), and JSDoc
      (`/** */`). Allow only the known data literal in
      `src/lib/search/index.ts`. Verify the script exits 0.
- [x] 4.2 Add a Playwright check (extend or add an e2e spec) asserting that
      `document.title` and visible chrome across the deterministic static routes
      contain no U+2014. Do not scan passage body text, which may contain corpus
      em dashes. Verify with `pnpm run test:e2e`.
- [x] 4.3 Run `grep -rn $'\u2014' src` and confirm every remaining hit is a
      comment/JSDoc, the `index.ts` data literal, or intentional corpus text;
      then run `pnpm run test:ui-copy`, `pnpm run check`, `pnpm run lint`, and
      `pnpm run test:e2e`. All pass.
