# Plan: PDF → Verified Corpus → Concordance Search

**Target repo:** idusortus/recovery-basic-texts
**Scope:** Replace the current fuzzy/blob search with a proper concordance (KWIC) pipeline, and rebuild the PDF→corpus ingestion process so citations are trustworthy.
**Non-goal:** Rewriting the frontend UI/UX beyond what's needed to support the new search behavior.

---

## 1. Diagnosis of current behavior

Per the repo's own README, search is: MiniSearch (client-side) against a prebuilt static JSON index, with a `known-exceptions.json` hint file layered on top, and a `kwic.ts` module that clips/highlights results.

Observed symptoms and likely root cause:

| Symptom | Likely cause |
|---|---|
| "Monkey" returns passages, none contain "monkey", nothing highlighted | Fuzzy/prefix matching in MiniSearch (`fuzzy`, `prefix` options) matching on edit-distance-adjacent tokens, combined with `OR` combination logic across multi-word queries. Highlighter can't find the literal string because the "match" was never literal. |
| "God" returns mostly noise with a few real hits | No real relevance ranking tuned for this corpus (BM25 field boosts, phrase-adjacency boost, document-frequency awareness for a term that appears hundreds of times). Everything above a low fuzzy threshold ranks similarly. |
| Formatting garbage | KWIC clipping likely doesn't respect sentence/paragraph boundaries, and/or is naively slicing token arrays without reconstituting whitespace/punctuation correctly. |
| References don't match printed material | Not a search bug — it's a **corpus data integrity problem**. Page/paragraph/chapter metadata was assigned during PDF extraction without validation against a paginated reference copy. |

This means the fix isn't "tune MiniSearch's fuzzy threshold" — it's **two separate corrective projects**: fixing the data (ingestion) and fixing the retrieval model (search).

---

## 2. Goals

1. A search for a word or short phrase returns **only passages that actually contain a matching form of that term** (or an explicitly curated cross-reference — see §6), with the literal match highlighted.
2. Results behave like a **concordance**: short KWIC (keyword-in-context) lines, not full passages, ranked by relevance, each with a citation the user can trust enough to write down or repeat at a meeting.
3. Every citation (source, edition, page/section, chapter) is **verified against the actual paginated text**, not inferred.
4. The app keeps working **offline as a PWA** — whatever we build has to ship a static, downloadable index; we are not required to keep it 100% client-side, but a fully server-dependent design would be a regression.
5. Contribution is incremental — mergeable in stages, not a big-bang rewrite.

## 3. Non-goals

- Full NLP/semantic ("meaning-based") search. This is a fact-checking/lookup tool for people mid-conversation at a meeting; literal + light stemming + curated synonyms covers the real use case. Semantic search would reintroduce the "returns stuff that isn't there" problem in a fancier form.
- Changing which sources are included (that's a corpus-content decision for the maintainer/CORPUS-GUIDE.md process, not this plan).

---

## 4. Corpus ingestion pipeline (PDF → verified JSON)

This is the foundation; nothing downstream matters if the source-of-truth JSON is wrong.

### 4.1 Pipeline stages

```
PDF (public-domain edition)
  → text extraction (pdftotext -layout, or pdfplumber for column-aware extraction)
  → page-anchored raw text (every extracted block keeps its source PDF page number)
  → structural segmentation (chapter/section detection, paragraph boundaries)
  → passage records (one JSON object per paragraph/reflection-day/step-section)
  → citation verification pass (see 4.3)
  → corpus/sources/<source-id>.json  (unchanged schema location, stricter schema)
```

### 4.2 Why extraction needs to be page-anchored from the start

The current pipeline (Python scripts exist already per the repo's language breakdown) likely flattens the PDF to text and re-derives page/chapter numbers heuristically afterward. Instead:

- Extract with a library that reports the **source PDF page number for every text block** (e.g. `pdfplumber`, `PyMuPDF`/`fitz`). Store that raw page number on every passage *before* any cleanup.
- Only after that, apply an offset/mapping table (`corpus/sources/<id>.pagemap.json`) that converts **PDF page index → printed page number**, since public-domain PDFs almost always have front matter (title page, forewords, prefaces) that shifts the printed pagination relative to the PDF's own page count. This mapping is the single most common source of "reference doesn't match the printed material" bugs, and it's a one-time, reviewable artifact per source — not something to leave implicit in code.

### 4.3 Citation verification pass (this is the actual fix for "references don't match")

Add a script, `corpus/scripts/verify-citations.mjs`, that:

- Spot-checks a sampled set of passages (and, ideally, every chapter boundary and every Daily Reflections date) against a second, independently-sourced plain-text or page-image copy of the same public-domain edition.
- Fails CI if a passage's recorded page number doesn't match a checksum/anchor phrase expected on that page.
- For **Twelve Steps and Twelve Traditions** and **Daily Reflections**, where pagination can vary release-to-release, key citations by **structural location** (Step number, Tradition number, Reflection date) rather than raw page number wherever the org is fine with that — it's a more durable citation than a page number that will drift across print runs.

### 4.4 Passage schema (tightened)

```jsonc
{
  "id": "bb2-ch3-p12",
  "sourceId": "big-book-2ed",
  "text": "Actually we were fooling ourselves...",
  "locator": {
    "chapter": "3",
    "chapterTitle": "More About Alcoholism",
    "printedPage": 30,
    "paragraphIndex": 12
  },
  "citation": "Alcoholics Anonymous, 2nd ed., p. 30",
  "checksum": "sha1 of normalized text, for drift detection on re-ingest"
}
```

Every source's `sources.json` registry entry should record **which specific public-domain edition/printing** was used (you flagged that Edition 2 is the current free edition for the Big Book — that needs to be an explicit, versioned field, not implied by filename).

### 4.5 Concordance index build (replaces naive tokenizing)

Alongside the passage JSON, build a **term → occurrence index** at index-build time:

```
{
  "monkey": [],                     // term simply doesn't occur — search should say so
  "god": [
    { "passageId": "bb2-ch4-p3", "offsets": [[45,48]] },
    { "passageId": "bb2-ch5-p1", "offsets": [[12,15],[203,206]] },
    ...
  ]
}
```

Building this at **index time** (not query time) is what guarantees the frontend can never show a "match" with nothing to highlight — the offsets are precomputed against the literal, verified passage text, character-exact.

---

## 5. Search/ranking layer

### 5.1 Recommendation: move from ad-hoc MiniSearch config to **SQLite FTS5**, via Cloudflare D1

You're already on Cloudflare Pages + KV. Cloudflare **D1** (managed SQLite) is the natural next step and keeps you inside the same platform:

- **FTS5** gives you a real, well-understood BM25 ranker, phrase queries (`"one day at a time"`), prefix queries, and — critically — the `snippet()`/`highlight()` SQL functions, which return **byte-exact match offsets** instead of you hand-rolling substring matching in `kwic.ts`.
- This directly answers your "maybe they need to adopt a database" instinct: yes, a small embedded database (D1/SQLite) is a better fit than a hand-tuned client-side fuzzy index for a corpus this size (a few thousand paragraphs). It's still nearly free to host and still fast.
- Query flow becomes: Pages Function hits D1 → FTS5 MATCH query → ranked passage IDs + verified offsets → join against passage JSON (or a `passages` table) → return.

### 5.2 Keep the offline PWA story intact

- The **build step** that currently produces `static/index/` (MiniSearch index) instead produces a **compact prebuilt trigram/term index** (or ships FTS5 as a **downloadable SQLite file** via `sql.js` / `wa-sqlite` in the browser — this is a well-trodden pattern: Pagefind and similar static-site search tools already do "static file + WASM SQLite in the browser").
- Practically: **online** users hit the D1-backed API (fast, best ranking, always current). **Offline** users fall back to a WASM SQLite file bundled by the service worker, using the *same* schema and the *same* FTS5 queries — so there's one ranking implementation, not two.
- This also means MiniSearch can be dropped entirely rather than kept as a second, divergent code path.

### 5.3 Ranking rules specific to this corpus

- **Exact phrase match** ranks above **all-terms-present** ranks above **stemmed/prefix match**.
- Zero-hit terms return **"not found in the corpus"** explicitly — never silently fall through to fuzzy matches. This alone fixes the "Monkey" bug: no literal occurrences → no results, or a clearly-labeled "Did you mean…" suggestion instead of disguised fuzzy hits.
- Common-word queries like "God" get **no fuzzy expansion at all** (fuzzy/prefix only kicks in for queries with zero exact hits) and get **KWIC-clipped, short context windows** so the user is scanning ranked citations, not full paragraphs.
- `known-exceptions.json` gets repurposed as an explicit **"related terms" layer** ("resentment" → also surface "Step Four," "Fourth Step inventory," etc.) that's clearly labeled as a curated cross-reference in the UI, never silently merged into literal-match results.

### 5.4 Result/UI shape (concordance-style, like 164andmore)

- Each row: **source + citation** (e.g. "Big Book, 2nd ed., p. 30") · a short KWIC line with the term bolded in context · a link to the full passage page.
- No walls of unhighlighted prose. If the corpus doesn't contain the term, say so plainly rather than returning something to fill the space.

---

## 6. Suggested PR breakdown (mergeable increments)

1. **PR 1 — Corpus schema + pagemap + verification script.** No frontend change. Adds `locator`, `citation`, `checksum` fields and `verify-citations.mjs` to CI. This alone should surface (and let you fix) most of the bad reference data.
2. **PR 2 — Concordance index builder.** Extends `build-index.mjs` to emit the term→offsets index described in §4.5, still feeding the *existing* MiniSearch frontend for now (so you get an immediate accuracy win — no more non-existent "monkey" matches — before touching the DB layer).
3. **PR 3 — D1 schema + Pages Function search endpoint.** Adds the SQLite/FTS5 backend behind a new API route, frontend still defaults to old path (feature-flagged).
4. **PR 4 — Frontend switch-over + offline WASM-SQLite fallback.** Cut over `+page.svelte` and `search/index.ts` to call the new endpoint/offline engine; delete MiniSearch dependency.
5. **PR 5 — `known-exceptions.json` → "related terms" UI treatment**, clearly separated from literal matches.

## 7. Test plan / definition of done

Add a **golden query set** (`corpus/scripts/golden-queries.json`) checked in CI against the live index, e.g.:

- `"monkey"` → zero results, explicit "not found" message (documents the known bug as a regression test).
- `"God"` → every returned passage contains a literal (or declared-stemmed) match, highlighted, ranked with exact/phrase matches first.
- `"one day at a time"` → phrase match ranks top, citation matches a manually verified page number.
- A handful of hand-verified citations per source (Big Book, Twelve and Twelve, Daily Reflections) checked against the actual printed page.

CI fails if any golden query regresses.

## 8. Open questions for the maintainer

- Is Cloudflare D1 acceptable given the "no database" architecture note in the PRD, or was that constraint specifically about avoiding a *hosted server-side DB dependency* (in which case D1's serverless model may satisfy the original intent)?
- Which specific print/PDF copies were used for Twelve and Twelve / Daily Reflections, so a pagemap can be built against the same printing?
- Is there appetite to drop MiniSearch entirely, or should it remain as the offline fallback and D1/FTS5 stay online-only?
