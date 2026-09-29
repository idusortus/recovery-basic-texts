# Design

## Context

See `proposal.md` for motivation and the quantified defect; see
`specs/corpus-integrity/spec.md` for the requirements this design must satisfy.

Current state and constraints that shape the approach:

- **The defect is data-only.** The published corpus is `corpus/sources/big-book-2ed.json`
  (an array of 265 passage objects: `id`, `sourceId`, `title`, `sequence`, `date`, `pageRef`,
  `chapterRef`, `text`, `linkData`). 172 passages carry a leaked running-header prefix in
  `text`. Nothing else about the passages is wrong; `pageRef`, `chapterRef`, `id`, and
  `sequence` are correct.
- **`ingest.py` Stage 3 already knows how to detect these headers, but with gaps.** Lines
  151–161 define `_is_running_header` as a line that is *entirely* `^\d{1,4}\s+CAPS_RUN$` or
  `^CAPS_RUN\s+\d{1,4}$`, where `CAPS_RUN` is **two or more** ALL-CAPS tokens, and Stage 3
  (lines 603–605) only applies it to lines within 2 positions of a `<<<PAGE N>>>` marker. The
  committed corpus was produced by an earlier, weaker Stage 3 and has never been regenerated,
  so the headers persist. The current rule also would not catch the **15 roman-numeral
  front-matter headers** (`xii PREFACE`, `FOREWORD xvii`) — roman numerals fail its
  `\d{1,4}` and its 2+ all-caps-token requirement.
- **A full re-ingest is blocked in this environment.** The 3.12 dependencies are physically
  **present** in `.venv/lib/python3.12/site-packages` (`pdfplumber` 0.11.10, `ftfy` 6.3.1,
  `pyenchant` 3.3.0, `spacy` 3.8.14, `en_core_web_sm`), but they are **not importable by the
  only reachable interpreter**: `.venv/bin/python` reports Python 3.14.4 and its `sys.path`
  contains no site-packages, so `import pdfplumber` fails. The `.venv` `pip` scripts do exist,
  but their shebang points at an absent interpreter (a stale `#!/home/idus/…/.venv/bin/python3`
  path — `.venv/bin/pip` fails with `bad interpreter: No such file or directory`), so pip is not
  usable either; and the `.venv/bin/python3` that does resolve is that same Python 3.14 with no
  3.12 site-packages. The raw inputs do exist (`corpus/raw/BigBookSecondEdition.pdf`,
  `corpus/raw/big-book-2ed-chapters.json`), so a re-ingest is *theoretically* possible from a
  correctly paired Python 3.12 interpreter, but not reproducible here.
- **Structural integrity layers that a repair must not break.**
  - `corpus/scripts/validate.js` enforces the passage schema and — critically — an
    **index-freshness guard**: `static/index/index-meta.json`'s `version` must equal a fresh
    hash of the enabled corpus files (`corpus/scripts/index-version.mjs`). Any corpus text
    change therefore *requires* `npm run build:index`.
  - `corpus/scripts/verify-citations.mjs` checks that each pagemap `anchor` still appears at
    the **start** of the first passage for its `chapterRef` + `corpusPageRef`. All
    `big-book-2ed` anchors are chapter-opening pages (`p.1`, `p.22`, `p.38`, `p.51`, `p.65`,
    `p.79`) and **none** match a running-header pattern, so stripping header prefixes cannot
    disturb them — this was verified against the live data.
  - No committed passage currently has `locator`, `citation`, or `checksum` fields, so there
    are no stored hashes to invalidate (verify-citations reports "no passages have checksums").
- **Test conventions are dependency-free scripts**, not a framework: `validate.js`,
  `verify-citations.mjs`, `test-concordance-offsets.mjs`, and `test-ingest-headers.py`,
  wired via `package.json` scripts (`test:concordance`, `test:ingest`, `validate:corpus`,
  `verify:citations`). A new check must follow this pattern.
- **The text is preserved verbatim otherwise.** Passage `text` is a single whitespace-joined
  string; the running header is a prefix followed by a space and then the page's body (often
  beginning mid-sentence, and sometimes mid-word, at a page break).

## Goals / Non-Goals

**Goals:**

- Remove the leaked running-header prefix from all 172 affected `big-book-2ed` passages with a
  deterministic, reproducible mechanism whose detection logic can be re-run and tested.
- Change only the `text` field of affected passages; preserve every other field and the
  pagemap/citation guarantees.
- Rebuild and commit the derived index, and add a dependency-free regression test that fails
  if a leaked header ever returns.
- Extend the pipeline's own detection so a future ingest does not reintroduce the same gaps.

**Non-Goals:**

- Regenerating the corpus from PDF, or changing the extraction/segmentation pipeline output.
- Rewriting `pageRef` values or reconciling the PDF-page vs printed-page convention (see
  `proposal.md` — Non-goals).
- Repairing truncated leading word fragments, hyphenation, or paragraph joins that the PDF
  extraction left behind (a separate defect class, ~15–20 passages); recorded as a follow-up so
  it is not lost (see Open Questions and `proposal.md` — Non-goals).
- Any app, search, or rendering code change.

## Decisions

### Decision 1: Repair the committed JSON programmatically; do not re-ingest or hand-fix

**Chosen: (b) programmatic strip of the existing JSON using extended detection logic.**

| Option | Assessment |
| --- | --- |
| **(a) Re-ingest with the fixed pipeline** | **Blocked / high-risk.** The 3.12 dependencies are present but not importable by the only reachable interpreter (Python 3.14), so it is not reproducible here. Even with deps, a re-ingest re-derives PDF extraction and paragraph segmentation, producing a large diff across all 265 passages and risking new anchor/segmentation drift for a fix that only needs 172 prefix removals. Not recommended. |
| **(b) Programmatic strip of existing JSON** | **Recommended.** Deterministic and reviewable; the diff is exactly the 172 `text` prefixes; `id`/`sequence`/`pageRef`/`chapterRef`/`linkData` are untouched, so pagemap anchors and citations stay valid. Detection can reuse and extend the `ingest.py` Stage 3 pattern family. |
| **(c) Hand-fix** | Rejected. 172 edits are error-prone and leave no reproducible mechanism or test. |

### Decision 2: Detection rules (the exact prefix patterns)

Detection is **prefix-only**: it never scans mid-text, because mid-text all-caps runs from
legitimate content (e.g. `ALCOHOLICS ANONYMOUS, p. 25`, `WORLD SERVICES, INC. BOX 459`,
`…AS WE UNDERSTOOD HIM. 4`) would false-positive. The rules are applied **only** to the start
of each passage's whitespace-normalised text and matched prefixes are stripped from the front.

Rules are tried in **strict priority order**; the first that matches wins. `CAPS` = one all-caps
token (`[A-Z][A-Z0-9.'’\-]*`); `CAPS_RUN` = two or more `CAPS` tokens; `NUM` = `\d{1,4}`;
`ROMAN` = a lowercase roman numeral of two or more characters (`[ivxlcdm]{2,}`).

1. **Rule 1 — Number-first:** `^NUM CAPS_RUN` → strip. e.g. `82 ALCOHOLICS ANONYMOUS`,
   `60 ALCOHOLICS ANONYMOUS`, `1 THERE IS A SOLUTION`. (matches 79)
2. **Rule 2 — Title-last:** `^CAPS_RUN NUM` → strip. e.g. `BILL'S STORY 3`, `INTO ACTION 81`,
   `TO WIVES 105`. (matches 78)
3. **Rule 3 — Roman front-matter, either order:** `^ROMAN (CAPS )*CAPS` or `^(CAPS )+ROMAN` →
   strip. e.g. `xii PREFACE`, `FOREWORD xvii`, `xxiv THE DOCTOR'S OPINION`. (matches 15)
4. **Rule 4 — Trailing-page-number cleanup (conditional; runs only after Rule 1/2/3 matched).**
   After a header prefix is stripped, if the **remainder begins with a standalone number token**
   — `^\d{1,4}` **immediately followed by whitespace** — strip that token too, because it is the
   header's offset page number. Do **not** strip when the number is followed by `.` or any list
   / ordinal punctuation, because that is a list marker, not a page number. (matches 1)

Every match must end at a non-word boundary (whitespace or end of string), so a header never
swallows the first body word.

**Rule 4 in practice — the only two passages that look like `^NUM CAPS_RUN NUM`:**

| Passage | Text prefix | Rule 1 strips | Rule 4 outcome | Result |
| --- | --- | --- | --- | --- |
| `big-book-2ed-chapter-2-there-is-a-solution-p0067` | `1 THERE IS A SOLUTION 29 enough, we find…` | `1 THERE IS A SOLUTION` | remainder `29 ` is a standalone number followed by whitespace → strip `29` | `enough, we find…` |
| `big-book-2ed-chapter-5-how-it-works-p0107` | `60 ALCOHOLICS ANONYMOUS 12. Having had a spiritual awakening…` | `60 ALCOHOLICS ANONYMOUS` | remainder `12.` has the number followed by `.` (a list marker) → do **not** strip | `12. Having had a spiritual awakening…` (the twelfth-step list number survives) |

So exactly **one** passage (p0067) is a genuinely malformed stray-digit header; p0107 is a
normal Rule 1 header whose trailing `12.` is the **twelfth-step list number**, not a page
number. Rule 4 is therefore no longer a standalone `^NUM CAPS_RUN NUM` matcher — it is a
conditional cleanup applied to the remainder, which is what preserves the list number. Keeping
it conditional (rather than dropping it for a one-off hard-coded entry for p0067) is preferred
because it generalizes to any future header that leaves an offset page number behind, while its
whitespace requirement keeps list markers safe.

**Why this is safe (guards against false positives):**

- **Positional signal.** Body prose in this corpus never begins with `<number> <two all-caps
  words>` or `<two all-caps words> <number>`, and roman numerals are not used as body line
  numbers. Requiring a page number adjacent to a multi-word all-caps run is therefore a strong
  header signal.
- **Prefix-only.** Rules are anchored to the start of `text` and strip only the matched prefix.
  Mid-text runs are never touched — notably `daily-reflections`' **165** passages that mention
  the title (case-insensitively): 123 singular `ALCOHOLICS ANONYMOUS, p. N` attributions, 8
  plural `pp. …` variants, 3 references to the different book `ALCOHOLICS ANONYMOUS COMES OF
  AGE`, and 31 prose mentions with no page citation. A literal whole-text scan would false-
  positive on these and on content such as `WORLD SERVICES, INC. BOX 459`, which is why
  detection is prefix-only. `daily-reflections` has no `pageRef` and zero prefix matches anyway.
- **Chapter openings are excluded by construction.** Chapter-opening passages start with
  `Chapter N <TITLE> …` and do not match any rule. Confirmed: applying the rules to the first
  passage of all six `big-book-2ed` pagemap entries yields zero matches, so the anchors are
  unaffected.
- **Optional allowlist cross-check.** As a belt-and-braces guard, the repair can additionally
  require that the all-caps run is one of the observed running titles
  (`ALCOHOLICS ANONYMOUS`, the eleven chapter titles, `PREFACE`, `FOREWORD`,
  `THE DOCTOR'S OPINION`). The dry-run report shows any match that fails the allowlist so the
  operator can confirm or exclude it before writing.

**Gap in `ingest.py` to close:** extend `_is_running_header` (or add a companion) to cover the
roman-numeral and single-word-adjacent-to-a-number cases, and extend
`corpus/scripts/test-ingest-headers.py` fixtures accordingly, so future ingests cannot
reintroduce the front-matter leaks.

### Decision 3: Share one detector between the repair and the regression test

Extract the rules into a small dependency-free module (e.g.
`corpus/scripts/running-header-utils.mjs`) used by **both** the one-off repair script and the
regression test. This guarantees the stripper and the test agree, so the test cannot pass while
the stripper silently misses a variant (or vice versa).

Sharing one detector, however, risks **correlated blindness**: a bug in the detector would make
both the stripper and the test "agree" on the wrong answer. To break that correlation, the
regression test additionally asserts against a **fixed, hand-written fixture list of header
shapes** (the strings below and their expected stripped remainders) that does not depend on the
shared module's logic — so a detector regression fails the fixture assertions even when the
corpus scan and the stripper share the same faulty code.

### Decision 4: Regression test is a standalone script, wired like the other tests

Add `corpus/scripts/test-corpus-headers.mjs` (or equivalently named) that loads every enabled
corpus source and fails with a non-zero exit, naming offending passage IDs, when any passage
begins with a running-header pattern. It also asserts the fixed fixture list from Decision 3
(each known header shape strips to the expected remainder, and no remainder begins with
`[.,;:)]`). Wire it as a `package.json` script (e.g. `test:corpus-headers`) alongside
`test:concordance` and `test:ingest`, and run it in the same pass as `validate:corpus`. No test
framework is introduced.

### Decision 5: Index must be rebuilt as part of the change

Because `validate.js` hashes the corpus files, the repair invalidates `static/index/*`. The
change rebuilds the index (`npm run build:index`) and commits `static/index/{minisearch,passages,
concordance,index-meta}.json`. The version changing is what invalidates cached clients.

## Risks / Trade-offs

- **[Over-stripping] A rule removes legitimate opening text.** → Prefix anchoring to a
  page-number-adjacent all-caps run, plus the optional running-title allowlist, plus a dry-run
  report reviewed before writing. Rule 4's whitespace requirement protects list markers — the
  twelfth-step `12.` after p0107's header is the canonical case. Chapter openings and pagemap
  anchors are explicitly excluded and re-verified after the edit.
- **[Under-stripping] A header variant the rules miss survives.** → The dry-run emits a
  "candidate headers not matched" report; the regression test would fail on the repaired
  corpus if a start-of-text header remains, so the fix cannot silently ship incomplete.
- **[Exposed word fragments] Stripping reveals truncated first words from the PDF's own page
  breaks** (e.g. `cial reference service.`, `ter chance`, `tions we have found`,
  `holics throughout`). Roughly 135 of the 172 remainders begin mid-sentence (expected page
  continuations); **~15–20** of those begin in an incomplete word or a word-looking fragment.
  Clear fragments include `cial`, `ter`, `tions`, `holics`, `cal`, `ing`, `fling`, `tion`,
  `tirely`, `ent`, `ers`, `cessful`, `tended`, `selves`, `pensed`; ambiguous dictionary-word
  cases such as `fused` (confused), `differ` (indifferent), `cuss` (discuss), and `react`
  cannot be classified without a dictionary. → Explicitly a separate, pre-existing defect
  class; recorded as a known artifact / follow-up, not fixed here (see `proposal.md` —
  Non-goals).
- **[Attribution false positives] `daily-reflections` attribution strings stripped.** → Rules
  are prefix-anchored with page-number adjacency; `daily-reflections` has zero matches, and the
  regression test asserts it stays clean.
- **[Stale index] Corpus edited but index not rebuilt.** → `validate.js`'s freshness guard fails
  on a stale `index-meta.version`; the task list makes the rebuild a required step.
- **[Checksums] If pass-level checksums are added later, text edits invalidate them.** → None
  exist today; the repair script and task list note that any future checksums must be
  recomputed after a text change.

## Migration Plan

1. Land the shared detector (`running-header-utils.mjs`) and the repair script with a
   **dry-run** mode; run it and review the report (expect 172 Big Book passages with a header
   prefix stripped, 1 additional trailing page number removed by Rule 4 on p0067, the
   twelfth-step `12.` preserved on p0107, 0 matches in the other sources, and no allowlist
   exceptions).
2. Apply the repair to `corpus/sources/big-book-2ed.json`.
3. Run `node corpus/scripts/validate.js` and `node corpus/scripts/verify-citations.mjs`; confirm
   all pagemap anchors still verify.
4. Run `npm run build:index` and commit the regenerated `static/index/*`.
5. Add the regression test and run it in the same pass as the other tests.
6. **Rollback:** a single `git revert` of the one commit restores the corpus and index; there is
   no schema change, no data migration, and no app deployment coupling.

## Open Questions

- Whether the regression test should additionally be invoked from `validate.js` (so it runs in
  the default validation path) or stay a standalone `test:` script run beside it. Deferrable;
  either satisfies the spec's observable scenarios.
- Whether to add per-passage `checksum` fields now (stronger integrity, but a larger change) or
  leave that to a future corpus-integrity change. Deferrable and does not affect this approach.
- **Follow-up owed by this change (recorded so it is not lost):** repair the residual mid-word
  artifacts that stripping exposes (~15–20 passages, e.g. `cial reference service.`). These are
  a page-break/pagination defect, not a header defect, and are out of scope here; the follow-up
  should decide whether to repair them in place or fix them in the ingest pipeline.
