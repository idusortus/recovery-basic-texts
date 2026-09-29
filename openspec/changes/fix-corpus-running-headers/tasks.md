# Tasks

## 1. Detection and repair tooling

- [ ] 1.1 Add `corpus/scripts/running-header-utils.mjs` exporting the prefix-header detector with the explicit **priority order** from design.md Decision 2 — Rule 1 `^NUM CAPS_RUN` first, then Rule 2 `^CAPS_RUN NUM`, then Rule 3 roman front-matter, then the conditional Rule 4 trailing-page-number cleanup; done when it returns a match for `82 ALCOHOLICS ANONYMOUS`, `INTO ACTION 81`, `xii PREFACE`, `FOREWORD xvii`, and `1 THERE IS A SOLUTION 29`, returns no match for `Chapter 5 HOW IT WORKS Rarely`, `STEP 12`, and `ALCOHOLICS ANONYMOUS, p. 25`, and strips the two `^NUM CAPS_RUN NUM` fixtures to `enough, we find` and `12. Having had a spiritual awakening` respectively.
- [ ] 1.2 Add a re-runnable repair script (e.g. `corpus/scripts/fix-running-headers.mjs`) that reads a source file, strips only the matched leading prefix (including Rule 4's trailing page number when present), and supports `--dry-run`; done when `--dry-run` reports 172 passages with a header prefix stripped for `big-book-2ed`, exactly one extra Rule 4 trailing page number (`…chapter-2-there-is-a-solution-p0067`), and 0 matches for the other enabled sources, without writing any file.
- [ ] 1.3 Have the dry-run report assert the **exact expected header string per passage** (not merely a count), so a matching "172 stripped" figure cannot mask a wrong strip; include a hard check that **no stripped remainder begins with `[.,;:)]`**. Done when the report lists each of the 172 `id` → expected-header pairs with 0 mismatches, flags exactly one Rule 4 trailing-number strip (`…p0067` → `… 29`), and shows `…chapter-5-how-it-works-p0107` stripping to `12. Having had a spiritual awakening…` with its `12.` intact.
- [ ] 1.4 Have the repair script also emit unmatched start-of-text candidates (an all-caps run adjacent to a number that the rules did NOT strip); done when the list is empty or every entry is confirmed as legitimate page content.

## 2. Apply the repair

- [ ] 2.1 Run the repair on `corpus/sources/big-book-2ed.json`; done when `git diff --stat` shows only that file changed and the change is confined to `text` values.
- [ ] 2.2 Confirm every non-text field is unchanged; done when a before/after comparison reports zero differences in `id`, `sourceId`, `title`, `sequence`, `date`, `pageRef`, `chapterRef`, and `linkData`, and the passage count is still 265.
- [ ] 2.3 Confirm no start-of-text header remains and the twelfth-step list number survives; done when the regression test from task 5.1 reports 0, the sampled passages previously beginning `84 ALCOHOLICS ANONYMOUS` and `INTO ACTION 81` no longer begin with those strings, and `…chapter-5-how-it-works-p0107` still begins with `12.`.

## 3. Verify corpus integrity

- [ ] 3.1 Run `node corpus/scripts/validate.js`; done when it exits 0 with no schema or pagemap errors.
- [ ] 3.2 Run `node corpus/scripts/verify-citations.mjs`; done when all `big-book-2ed` and `twelve-steps-traditions` pagemap anchors still verify and it exits 0.
- [ ] 3.3 Confirm the unaffected sources were not touched; done when `git diff --name-only` lists only `corpus/sources/big-book-2ed.json`.

## 4. Rebuild and commit the index

- [ ] 4.1 Run `npm run build:index`; done when it regenerates `static/index/*` without error and `index-meta.version` differs from the pre-repair value `98c0f92389937aaf`.
- [ ] 4.2 Re-run `node corpus/scripts/validate.js`; done when the index-freshness guard passes (emitted version equals a fresh hash of the corpus inputs).
- [ ] 4.3 Confirm the rebuild is deterministic; done when building the index twice yields byte-identical `static/index/*` files.

## 5. Regression test

- [ ] 5.1 Add `corpus/scripts/test-corpus-headers.mjs` that loads every enabled corpus source and exits non-zero, naming offending passage IDs, when any passage `text` begins with a running-header pattern; done when it exits 0 on the repaired corpus.
- [ ] 5.2 Add a fixed, hand-written fixture list of header shapes to the test, asserted **independently of the shared `running-header-utils.mjs` logic** (to avoid correlated blindness), with exact expected remainders — including `1 THERE IS A SOLUTION 29 enough, we find` → `enough, we find` and `60 ALCOHOLICS ANONYMOUS 12. Having` → unchanged `12. Having`; done when the fixture assertions pass and would fail if the detector's priority order or its `[.,;:)]` guard regressed.
- [ ] 5.3 Add a `test:corpus-headers` script to `package.json`; done when `npm run test:corpus-headers` exits 0.
- [ ] 5.4 Prove the test catches a regression; done when temporarily prefixing a passage with `82 ALCOHOLICS ANONYMOUS …` (and, separately, breaking p0107's `12.` handling) makes the test exit non-zero and name the passage, then revert the temporary change.

## 6. Pipeline hardening (prevent reintroduction)

- [ ] 6.1 Extend `corpus/scripts/ingest.py` header detection to cover roman-numeral front-matter headers (`xii PREFACE`, `FOREWORD xvii`). **Note:** Rule 3's `ROMAN` is currently lowercase-only (`[ivxlcdm]{2,}`), so future ingest hardening should also (a) accept uppercase roman headers such as `XII PREFACE`, and (b) avoid matching ordinary English words that look roman, e.g. `did`/`CIVIL` — require a plausible numeral form (II+, IV/IX/XL…) and/or an adjacency/allowlist signal; done when fixtures cover uppercase roman headers and non-header words like `did`/`CIVIL` and pass.
- [ ] 6.2 Extend `corpus/scripts/test-ingest-headers.py` with the roman-numeral and single-word-adjacent cases, plus a fixture asserting the Rule 1 → Rule 4 priority (`60 ALCOHOLICS ANONYMOUS 12.` keeps `12.`); done when `npm run test:ingest` passes.

## 7. Documentation

- [ ] 7.1 Record the repair mechanism and the residual leading-word-fragment artifact (~15–20 passages) in `corpus/CORPUS-GUIDE.md`, and annotate the follow-up for it; done when the guide describes the start-of-text header rules and their priority, the repair script, the regression test, and the follow-up.
