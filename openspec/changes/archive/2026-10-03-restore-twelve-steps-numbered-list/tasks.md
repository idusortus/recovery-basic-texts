# Tasks

## 1. Rewrite the derivation script

- [x] 1.1 Replace `STEPS`/`buildTwelveSteps()` in `corpus/scripts/extract-reference-texts.mjs` so it slices steps 1–11 from `big-book-2ed-chapter-5-how-it-works-p0106` (after the lead-in marker) and step 12 from `...-p0107` (up to the step-12 sentence), joins the slices, then **splits the run-on string back into its twelve steps on the `N. ` markers (`/(?=\s\d+\.\s)/`), trims each piece, asserts exactly twelve pieces, and re-joins them with single `\n` separators** (preserving each `N. ` prefix, no trailing newline); verifies each slice with `requireSubstring` plus explicit marker checks, asserts the emitted text has exactly eleven `\n` and every line matches `^\d+\. `, and emits the single-passage spec from design Decision 3; verify with `node corpus/scripts/extract-reference-texts.mjs` (dry run) exiting 0 and printing one passage for `twelve-steps.json`
- [x] 1.2 Update the script's header comment block so it documents the new numbered-steps extraction (the split/join normalization that inserts `\n` between steps, the `pageRef` basis, and the single passage) instead of "unsplit, from p0106 + p0107"; verify the comment matches the emitted shape

## 2. Regenerate and validate the corpus

- [x] 2.1 Run `node corpus/scripts/extract-reference-texts.mjs --write` to regenerate `corpus/sources/twelve-steps.json`; verify the file contains exactly one passage with `id` `twelve-steps-list-1-12`, `sequence` 1, `pageRef` `p.80`, and text that (a) starts `1. We admitted we were powerless` and contains `12. Having had a spiritual awakening`, and (b) is twelve newline-separated step lines — exactly eleven `\n` characters, each line matching `^\d+\. ` numbered `1.`–`12.`, with no trailing newline
- [x] 2.2 Confirm each of the twelve step statements still matches its Big Book wording (each line's body is contiguous corpus text with only the `N. ` numbering added; the `\n` separators are inserted normalization, not corpus text) and that no "fling, powerful!" preamble or post-step-12 walkthrough prose remains; verify via the script's dry-run fidelity checks and a comparison against the two Big Book passages
- [x] 2.3 Verify `corpus/sources/big-book-2ed.json` is byte-identical before and after the change (`git diff --exit-code -- corpus/sources/big-book-2ed.json`)
- [x] 2.4 Run `pnpm run validate:corpus` and confirm it exits 0
- [x] 2.5 Run `pnpm run test:corpus-headers` and confirm the single new passage does not begin with a running header

## 3. Rebuild the search index

- [x] 3.1 Run `pnpm run build:index` and confirm `static/index/index-meta.json` records a version matching a fresh hash of the updated corpus inputs (the freshness guard passes)
- [x] 3.2 Verify `static/index/passages.json` contains the single `twelve-steps` passage with the clean list text (twelve `\n`-separated step lines, eleven newlines) and no stale `twelve-steps-list-1-11`/`twelve-steps-list-12` entries

## 4. Update tests and docs

> Ordering: these tasks assert on **generated** content, so run §4 only after §2 (`--write`
> regeneration) and §3 (`pnpm run build:index`) have completed. Do not update the
> `test-reference-reader.mjs` assertion against the pre-change corpus.

- [x] 4.1 (after §2 regen and §3 index rebuild) Update `scripts/test-reference-reader.mjs`: keep the `steps → twelve-steps` mapping assertions and adjust the header comment; add a content assertion that the `twelve-steps` corpus holds one passage whose text begins `1. We admitted we were powerless`, includes `12. Having had a spiritual awakening`, contains exactly eleven `\n` characters with every line matching `^\d+\. `, and excludes the "fling, powerful!" preamble; verify with `pnpm run test:reference-reader` passing
- [x] 4.2 Confirm `pnpm run test:source-filterable` still passes (the reference id set and `filterable:false` are unchanged)
- [x] 4.3 Update `corpus/CORPUS-GUIDE.md` Source 2b provenance/basis wording to describe the numbered-step extraction (still verbatim Big Book wording, pages 80–81); verify the guide no longer claims every passage is a whole page chunk
- [x] 4.4 Run the full unaffected guard sweep (`pnpm run test:ui-copy`, `pnpm run test:url-state`, `pnpm run test:source-link`) and confirm no regressions

## 5. Manual verification

- [ ] 5.1 [manual (browser)] Open `/reference?text=steps` and confirm the view shows a clean list rendered as twelve separate numbered lines (`1.` … `12.`, each step on its own line — not one run-on paragraph) under one "The Twelve Steps" heading, with no preamble before step 1 and no prose after step 12, in light and dark themes
- [ ] 5.2 [manual (browser)] Confirm the view selector still offers the Twelve Steps view, the selected view stays directly addressable on reload, and the Listen control reads only the step list
- [ ] 5.3 [manual (browser)] Search for a distinctive step phrase (for example "moral inventory") and confirm results still return the `twelve-steps` source and the `big-book-2ed` source under their own labels
