# basictexts.org — Feature Backlog

**Not in here:** architectural changes, user accounts, v2 scope.

---

## Quick wins (< 2 hours each)

### F1 — Fix filter-source badge visibility
**Problem:** Colored dot disappears when source is active — same color as the button background.
**Fix:** When button is active, render the dot as white instead of `source.color`.
**File:** `src/routes/+page.svelte` — the `<span style="background-color: {source.color};">` inside the active filter button.

### F2 — PWA icon: use the "bt" monogram
**Problem:** Installed PWA shows a gray square with "P" (generic default).
**Fix:** Regenerate `static/icons/icon-192.png` and `icon-512.png` as the navy "bt" monogram matching the nav badge.

### F3 — Suggest a change → GitHub Issue link
**Approach:** Link only — no code, no PAT.
URL: `https://github.com/idusortus/recovery-basic-texts/issues/new?template=suggestion.md&title=[Suggestion]`
**Where:** `/about` page, near the open-source section.
**Also needed:** `.github/ISSUE_TEMPLATE/suggestion.md` with a lightweight template.

---

## Small features (~half-day each)

### F4 — Apostrophe normalization + fuzzy search

**4a. Normalize contractions in indexer + query pipeline**
Configure MiniSearch's `processTerm` to strip apostrophes before indexing (`haven't` → `havent`). Apply the same normalization to the query in `src/lib/search/index.ts` before the MiniSearch call.

**4b. Enable MiniSearch fuzzy for non-phrase queries**
Pass `fuzzy: 0.2` to `search()` for bare keyword queries. Quoted phrase queries stay exact.
Files: `corpus/scripts/build-index.mjs`, `src/lib/search/index.ts`.

### F5 — Synonym expansion map
**Problem:** `God` doesn't return `Higher Power`, `Creator` — lexically unrelated; fuzzy can't help.
**Approach:** Static `corpus/synonyms.json`. At query time, expand terms before MiniSearch, then merge + deduplicate results by passage ID.

v1 clusters:
```json
{
  "god": ["higher power", "creator", "spirit of the universe", "god of our understanding"],
  "fear": ["anxiety", "afraid", "dread", "terror", "fright"],
  "resentment": ["anger", "rage", "bitterness", "grudge"],
  "acceptance": ["surrender", "willingness", "letting go"],
  "sobriety": ["recovery", "abstinence", "sober", "clean"]
}

New files: corpus/synonyms.json, src/lib/corpus/synonyms.ts. Edit: index.ts.

Medium features (~1 day)
F6 — Daily Reflection: live fetch from aa.org with corpus fallback
Approach:

New Pages Function functions/api/reflection.ts — fetches https://www.aa.org/daily-reflections, parses HTML, returns title + body JSON.
/reflection route: fetch live when online; fall back to corpus text if fetch fails or offline. No caching of the live fetch.
Risk: aa.org HTML structure can change — the parser needs occasional maintenance. Document the decision in CORPUS-GUIDE.

Corpus work (no code changes)
C1 — Complete Big Book 1st Edition corpus
42-passage stub. The "tornado" passage (Into Action, p.82) and hundreds of others are simply not in the corpus yet. Source the full text from anonpress.org/bb per CORPUS-GUIDE, then pnpm run build:index.

C2 — Add Big Book 2nd Edition as a second source
big-book-2ed.json stub exists but has no registry entry. Source 2nd-edition text (PD, copyright lapsed 1983), add registry entry, ingest. The 2nd ed adds ~200 pages of personal stories not in the 1st edition — meaningful concordance coverage gain.

Backburnered
B1 — AI-generated static semantic index
Use an LLM offline at build time to generate topic clusters/sentiment tags; ship as a static JSON. Separate build pipeline. Revisit after corpus is complete. F5 covers the most common cases without any AI dependency.