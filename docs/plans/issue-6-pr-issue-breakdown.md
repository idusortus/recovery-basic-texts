# Issue #6 follow-up issue breakdown

This document provides ready-to-file GitHub issues for the approved **PDF → verified corpus → concordance search** plan in issue #6.

Each issue below is scoped to one PR from the parent plan, includes an implementation checklist that an LLM can execute, and recommends an LLM model.

## Issue A — PR 1: Corpus schema, pagemap artifacts, and citation verification

**Title:** `corpus: add locator/citation/checksum schema + pagemap + verify-citations`

**Suggested LLM:** Claude Sonnet 4.6

**Body:**

Implement the ingestion/corpus integrity foundation needed for reliable citations.

### Scope
- Extend corpus passage schema with:
  - `locator` (`chapter`, `chapterTitle`, `printedPage`, `paragraphIndex`)
  - `citation`
  - `checksum` (sha1 of normalized text)
- Add per-source pagemap artifact support at `corpus/sources/<source-id>.pagemap.json` (PDF page index → printed page).
- Add `corpus/scripts/verify-citations.mjs`.
- Add CI hook for citation verification checks.

### Implementation checklist
- [ ] Update shared TypeScript/domain types for the new fields.
- [ ] Update corpus validation script to enforce required fields and schema shape.
- [ ] Add pagemap loading/validation utility.
- [ ] Implement `verify-citations.mjs`:
  - [ ] validates chapter boundaries / structural anchors
  - [ ] verifies sampled page anchors against expected printed pages
  - [ ] exits non-zero on mismatches
- [ ] Document required source-edition metadata in `corpus/sources.json`.
- [ ] Update corpus guide with pagemap + verification workflow.

### Acceptance criteria
- [ ] Corpus validation fails when `locator/citation/checksum` is missing.
- [ ] Citation verification script can run in CI and fails on bad mappings.
- [ ] At least one source has a checked-in pagemap and passes verification.

---

## Issue B — PR 2: Concordance index builder (term → exact offsets)

**Title:** `search-index: emit concordance term-occurrence offsets`

**Suggested LLM:** Claude Sonnet 4.6

**Body:**

Add a deterministic concordance index artifact so results can only be returned when literal text exists and can be highlighted exactly.

### Scope
- Extend `corpus/scripts/build-index.mjs` to emit a term-occurrence index, e.g. `static/index/concordance.json`.
- Each term maps to occurrences with `{ passageId, offsets: [[start,end], ...] }`.
- Keep existing index artifacts working while this is introduced.

### Implementation checklist
- [ ] Add normalization/tokenization rules for deterministic term extraction.
- [ ] Build and emit term → occurrence offsets from corpus passages.
- [ ] Ensure offsets are character-accurate against stored passage text.
- [ ] Add a small fixture/golden test for offset correctness.
- [ ] Update search-loading code/types so the app can consume the concordance artifact.

### Acceptance criteria
- [ ] Query term with no literal occurrence has no concordance entries.
- [ ] Returned concordance entries always include valid highlight offsets.
- [ ] Build output remains deterministic for unchanged corpus input.

---

## Issue C — PR 3: D1 schema + Pages Function concordance API (feature-flagged)

**Title:** `search-api: add D1 FTS5 concordance endpoint behind feature flag`

**Suggested LLM:** Claude Sonnet 4.6

**Body:**

Introduce server-side FTS5 search on Cloudflare D1 while preserving incremental rollout.

### Scope
- Add D1 schema/migrations for passages and FTS5 virtual table.
- Add ingestion/import script path from verified corpus JSON into D1.
- Add Pages Function API route for search using FTS5 `MATCH`, `bm25`, and `highlight/snippet`.
- Gate usage behind a feature flag; default remains current path.

### Implementation checklist
- [ ] Add SQL migration(s) and reproducible seed/import script.
- [ ] Add API route with query parsing for phrase/keyword behavior.
- [ ] Implement ranking rules:
  - [ ] phrase > all-terms > prefix/stem fallback
  - [ ] no fuzzy fallback when exact hits exist
- [ ] Return payload with source metadata and verified citation fields.
- [ ] Add integration tests for API result correctness.

### Acceptance criteria
- [ ] Feature flag off: existing behavior unchanged.
- [ ] Feature flag on: API returns ranked literal matches with stable citations.
- [ ] Endpoint returns explicit not-found state for zero literal hits.

---

## Issue D — PR 4: Frontend cutover + offline SQLite/WASM fallback

**Title:** `search-ui: switch to concordance API with offline sqlite fallback`

**Suggested LLM:** Claude Sonnet 4.6

**Body:**

Switch the search experience to concordance-first retrieval while keeping offline functionality in the PWA.

### Scope
- Update search client and `+page.svelte` integration to use new concordance result shape.
- Add offline fallback path using bundled SQLite/WASM DB with matching query semantics.
- Remove MiniSearch usage after successful migration.

### Implementation checklist
- [ ] Implement unified search adapter (online D1 API + offline SQLite fallback).
- [ ] Ensure results render as concordance/KWIC rows with exact highlighting.
- [ ] Keep display-mode guardrails (`full-text`, `concordance-only`, `snippet`) intact.
- [ ] Cache required offline DB assets via service worker.
- [ ] Remove old MiniSearch runtime dependencies once parity is confirmed.

### Acceptance criteria
- [ ] Online and offline query paths produce equivalent ranking/shape.
- [ ] No-result queries show explicit "not found in corpus".
- [ ] PWA offline search continues to function after first cache.

---

## Issue E — PR 5: Known exceptions repurpose to explicit related terms

**Title:** `search-ui: separate curated related terms from literal matches`

**Suggested LLM:** MAI-Code-1-Flash

**Body:**

Repurpose `corpus/known-exceptions.json` into clearly labeled related-term/cross-reference results instead of blending them into literal matches.

### Scope
- Keep literal concordance matches separate and first-class.
- Render curated related terms in a distinct UI section with clear labeling.
- Preserve existing content intent from known exceptions.

### Implementation checklist
- [ ] Update known-exceptions data shape if needed for related-term labeling.
- [ ] Render related terms section only when configured/matched.
- [ ] Ensure related terms never affect literal ranking/order.
- [ ] Add tests for separation of literal vs curated related results.

### Acceptance criteria
- [ ] Users can clearly distinguish literal corpus hits from curated suggestions.
- [ ] Literal zero-hit queries may still show related terms, but never disguised as literal hits.

---

## Human-only issue(s) (stand-alone)

These are tasks an LLM cannot safely finalize without maintainer decisions or external account access.

### Issue H1 — Architecture decision: approve D1 for v1 search path

**Title:** `decision: confirm D1/FTS5 adoption for issue #6 rollout`

**Suggested owner:** Maintainer

**Body (checklist):**
- [ ] Confirm D1 is acceptable despite PRD v1 "no DB" note, or approve PRD amendment.
- [ ] Confirm rollout policy (feature flag duration, cutover criteria, rollback plan).
- [ ] Confirm whether MiniSearch should be fully removed after PR 4.

### Issue H2 — Source edition provenance + pagemap references

**Title:** `corpus-governance: lock source editions and verification references`

**Suggested owner:** Maintainer

**Body (checklist):**
- [ ] Provide exact edition/printing provenance for Twelve & Twelve and Daily Reflections sources currently used.
- [ ] Provide/approve independent reference copies for citation verification.
- [ ] Approve citation policy where structural locators supersede page numbers for unstable paginations.

---

## Recommended order of execution

1. **H1** — D1 architecture decision (blocking for PR 3/4).
2. **H2** — source-edition provenance (blocking for robust citation verification).
3. **Issue A / PR 1** — schema + pagemap + verification foundation.
4. **Issue B / PR 2** — concordance offsets index.
5. **Issue C / PR 3** — D1 + API behind feature flag.
6. **Issue D / PR 4** — frontend cutover + offline SQLite fallback.
7. **Issue E / PR 5** — related terms separation.
