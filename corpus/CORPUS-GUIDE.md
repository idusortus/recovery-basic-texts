# basictexts.org — Corpus Sourcing & Ingestion Guide

**Purpose:** This document explains how to find, evaluate, clean, and ingest a text corpus into basictexts.org. It covers the v1 sources needed at launch and serves as the permanent reference for adding any future source.

---

## Part 1 — How the Corpus System Works

Every source in basictexts.org consists of two things:

1. **A registry entry** in `/corpus/sources.json` — metadata, copyright status, display rules
2. **A corpus file** in `/corpus/sources/<source-id>.json` — the actual passages as structured JSON

> **Repo structure (confirmed):** The `corpus/` directory exists at the repository root alongside this guide. The `corpus/sources/` subdirectory should be created when adding the first corpus file. Sample JSON showing the correct schema is available in `proto/google-oneshot/public/corpus/` — those are prototype files, not authoritative data.

The build script (`pnpm run build:index`) reads both and compiles the passages into a **prebuilt static `minisearch` index** under the app's `static/index/` directory. The index is a **derived artifact** — it can always be rebuilt from scratch by re-running the build against the corpus files. The corpus files in the repository are the source of truth. (There is no database in v1; see PRD §7.)

The display mode in the registry entry controls what users see:

| Display Mode | What it means | Who decides |
|---|---|---|
| `full-text` | Full sentence or paragraph shown | Public domain or explicit permission |
| `snippet` | ~30 word excerpt shown + external link | Fair use, protected text |
| `concordance-only` | ~8 words each side of keyword + external link | Protected text, conservative approach |

**Never change a source from `concordance-only` to `full-text` without confirming the copyright basis in writing in this document.**

---

## Part 2 — Copyright Evaluation Framework

Before sourcing any text, answer these four questions:

### Q1 — Is it in the public domain?
For U.S. works, the main triggers for public domain status are:
- Published before 1928 (automatic PD in the US as of 2024)
- Published 1928–1963 **and** copyright was not renewed with the Copyright Office
- Published with a defective copyright notice (no © symbol or missing year/owner)

For AA literature specifically: the 1st and 2nd editions of the Big Book entered the public domain because AAWS failed to renew their copyrights — the 1st edition in 1967, the 2nd edition in 1983. This is not a legal gray area; it is settled and confirmed by AAWS themselves.

**How to verify:** Search the U.S. Copyright Office renewal records at https://cocatalog.loc.gov. Search the Stanford Copyright Renewal Database at https://exhibits.stanford.edu/copyrightrenewals. If a copyright renewal is not on record, the work is public domain.

### Q2 — If protected, does the organization permit concordance use?
164andMore established the precedent that AAWS will informally permit concordance-style use (short KWIC snippets, not full text reproduction). Other fellowships (NA, Al-Anon) have their own policies. Always:
- Check the organization's IP/copyright policy page
- Email their permissions department before launch (document the exchange)
- Use `concordance-only` mode until permission is confirmed

### Q3 — What display mode is legally safe?
| Scenario | Safe display mode |
|---|---|
| Confirmed public domain | `full-text` |
| Protected, permission granted for excerpts | `snippet` |
| Protected, concordance precedent only | `concordance-only` |
| Unknown / unresolved | `concordance-only` (most conservative) |

### Q4 — Is there a clean digital text available?
A clean digital text means:
- Machine-readable plain text or HTML (not a scanned PDF with OCR errors)
- Paragraph structure intact
- No footnotes or page headers intermixed with body text
- Ideally, an authoritative source (official website, established archive)

If only a scanned PDF exists, OCR cleanup is required before ingestion (see Part 4).

---

## Part 3 — v1 Sources: Status & Acquisition

### Source 1 — Big Book, 1st Edition
**Registry ID:** `big-book-1ed`
**Display mode:** `full-text`
**Copyright status:** ✅ Public domain in the United States (copyright lapsed 1967)

#### Where to get it
The best clean digital text is at **Anonymous Press**: https://anonpress.org/bb/

The text is presented as one HTML page per book page. The full chapter list is:
- Ch. 1 Bill's Story — Page_1.htm
- Ch. 2 There Is A Solution — Page_17.htm
- Ch. 3 More About Alcoholism — Page_30.htm
- Ch. 4 We Agnostics — Page_44.htm
- Ch. 5 How It Works — Page_58.htm
- Ch. 6 Into Action — Page_72.htm
- Ch. 7 Working With Others — Page_89.htm
- Ch. 8 To Wives — Page_104.htm
- Ch. 9 The Family Afterward — Page_122.htm
- Ch. 10 To Employers — Page_136.htm
- Ch. 11 A Vision For You — Page_151.htm
- Foreword — foreword.htm
- The Doctor's Opinion — docsopin.htm
- Doctor's Nightmare (Dr. Bob's story) — drbob.htm
- Spiritual Experience appendix — Spiritualexperience.htm

Also available as a full plain-text file via Internet Archive:
https://archive.org/details/bigbookofalcohol0000smit
(Download the .txt version if available; prefer this over scraping HTML pages)

#### Acquisition process
1. Download the plain text version from Internet Archive, **or**
2. Scrape each chapter page from anonpress.org/bb/ (they have no stated objection to this for the public domain text — it is their explicit purpose)
3. anonpress.org is a small volunteer site; be respectful — add a 1–2 second delay between requests if scraping, and do it once, saving the result locally

#### What to verify
- The anonpress text is the **1st edition** (164 pages of program text + original personal stories). Confirm it does not include 2nd/3rd/4th edition additions.
- The "Acceptance" passage (page 417/449) is **not** in the 1st edition — it was added in the 3rd edition personal stories. Do not include it. Link to aa.org for that passage instead.

---

### Source 2 — The Twelve Steps and Twelve Traditions (12&12)
**Registry ID:** `twelve-steps-traditions`
**Display mode:** ⚠️ `snippet` until copyright verified — potentially `full-text`
**Copyright status:** Free for public use, keep it to snippet. You may link to https://www.portlandeyeopener.com/AA-12-Steps-12-Traditions.pdf for information beyond snippets.

#### The copyright question
This is available for public use.

#### Where to get it (if PD confirmed)
- Internet Archive likely has a scanned copy
- anonpress.org may have a text version
- Silkworth.net: https://silkworth.net — extensive AA archive, check for 12&12 text

#### If it remains protected
Use `snippet` mode (30-word excerpts) and link to:
- Official purchase: https://www.aa.org/twelve-steps-twelve-traditions
- Read online (AAWS provides some content): https://www.aa.org/the-twelve-steps

---

### Source 3 — The Twelve Traditions (standalone)
**Registry ID:** `twelve-traditions`
**Display mode:** `full-text` (likely) — verify same as 12&12
**Copyright status:** 🔍 NEEDS VERIFICATION — likely public domain

#### Notes
It is readily available online.

---

### Source 4 — Daily Reflections
**Registry ID:** `daily-reflections`
**Display mode:** `concordance-only` (permanently — this is protected text)
**Copyright status:** ❌ Protected © Alcoholics Anonymous World Services, Inc.

#### The challenge
Daily Reflections is a 366-entry book (one per day including Feb 29). Each entry has:
- A date
- A title
- A short quote from AA literature (itself usually from the Big Book or 12&12)
- A reflection paragraph written by AA members
- A source citation

You need all 366 entries as structured data. You will **index the full text** for search purposes but **never display it** — only the KWIC snippet (8 words each side) is shown to users, with a mandatory link to aa.org.

#### Acquisition options (in order of preference)

**Option A — Scrape aa.org/daily-reflections directly**
The daily reflections are publicly accessible at:
`https://www.aa.org/daily-reflections` (today's)
`https://www.aa.org/daily-reflections/en/{month}/{day}` (by date — verify URL pattern)

Scraping for the purpose of building a search index (not reproducing the content) is a legal gray area. AAWS's Terms of Use at aa.org/terms-of-use prohibit reproduction but do not explicitly address indexing. **Before scraping:**
- Email AAWS at ippolicy@aa.org explaining your intent (concordance-only, links back to aa.org)
- Reference the 164andMore precedent
- Wait for a response before launch

If AAWS does not respond or declines: do not include DR at launch. Add it later if the situation resolves. It is better to launch without DR than to launch in violation.

**Option B — Community-sourced dataset**
Search GitHub for existing datasets:
- Search: `"daily reflections" "alcoholics anonymous" filetype:json`
- Search: `aa daily reflections dataset`
- Check: https://github.com/topics/alcoholics-anonymous

If a community dataset exists and its creator obtained or assumed PD status — be cautious. The text is protected. Verify the dataset's provenance before using it.

**Option C — Manual entry**
If all else fails, the 366 entries can be manually transcribed from a physical copy of the book. This is labor-intensive but legally unambiguous for the purpose of building a search index that never displays the full text. A volunteer contributor effort (the repo is open source) could accomplish this.

#### Link template
When DR results appear in search, the external link should go to the static URL:
```
https://www.aa.org/daily-reflections
```

**There is no date-specific deep link.** aa.org renders the current day's reflection server-side and does not expose a stable public URL for an arbitrary month/day (e.g. there is no working `/daily-reflections/en/june/28` style path). Do not attempt to construct one. The registry `linkTemplate` for `daily-reflections` is simply `https://www.aa.org/daily-reflections`, and `linkData` is not required for this source. Every DR result and the in-app `/reflection` view link to that single URL.

---

## Part 4 — General Ingestion Process (Any Source)

Follow these steps for every new source, v1 or future.

### Step 1 — Evaluate copyright (Part 2 above)
Do not proceed until you have documented the copyright basis in this file under the source's section. Add a note like:
> "Copyright verified public domain: no renewal record found in Copyright Office database, searched [date]. Screenshotted and saved to /corpus/legal/[source-id]-copyright-check.png"

### Step 2 — Acquire the raw text
Preferred formats in order:
1. **Plain text (.txt)** — easiest to process, minimal cleanup
2. **Clean HTML** — strip tags, preserve paragraph breaks
3. **EPUB** — unzip and extract XHTML content files
4. **PDF (text-based)** — use `pdftotext` (poppler) or `pdf-parse` npm package
5. **PDF (scanned/image)** — requires OCR; use Tesseract or Adobe Acrobat; expect errors

Save the raw acquired file to `/corpus/raw/<source-id>.<ext>` and commit it. This preserves the exact source used for the corpus.

### Step 3 — Clean the text
Common issues to fix before structuring:

| Issue | Fix |
|---|---|
| Page headers/footers repeated mid-text | Remove lines matching the header/footer pattern |
| Hyphenated line breaks (`recov-\nery`) | Join: `recovery` |
| Ligature characters (`ﬁ`, `ﬂ`) | Replace with `fi`, `fl` |
| Smart quotes / curly apostrophes | Optionally normalize to straight quotes (or keep — either is fine) |
| Multiple blank lines | Normalize to single paragraph breaks |
| Chapter headings embedded in body text | Extract as metadata, remove from body |
| Footnotes / endnotes | Remove or store separately — do not include in passage text |
| OCR errors (common: `l` → `1`, `0` → `O`, `rn` → `m`) | Manual review of high-frequency words; spot-check 10–20 random passages |

Write a cleaning script in Node.js and save it to `/corpus/scripts/clean-<source-id>.js`. This makes the process repeatable if the source text is updated.

### Step 4 — Structure into passages

A "passage" is the unit of text that appears in a search result. For most AA literature, a **paragraph** is the right granularity — long enough to give context, short enough to scan.

Rules:
- One paragraph = one passage
- Minimum passage length: 20 words (discard shorter fragments — they are usually headers or section labels, which become `chapterRef` metadata instead)
- Maximum passage length: no hard limit, but if a paragraph exceeds ~200 words consider splitting at a natural sentence boundary
- Preserve paragraph order via the `sequence` field (integer, monotonically increasing per source)

The structured output for each passage must conform to this schema:

```json
{
  "id": "big-book-1ed-ch5-p001",
  "sourceId": "big-book-1ed",
  "title": "How It Works",
  "sequence": 142,
  "date": null,
  "pageRef": "p.58",
  "chapterRef": "Chapter 5 — How It Works",
  "text": "Rarely have we seen a person fail who has thoroughly followed our path. Those who do not recover are people who cannot or will not completely give themselves to this simple program, usually men and women who are constitutionally incapable of being honest with themselves.",
  "linkData": null
}
```

**ID convention:** `<source-id>-<chapter-slug>-p<zero-padded-sequence>`
Example: `big-book-1ed-ch5-p001`, `daily-reflections-jan-15`

For Daily Reflections, the ID and linkData should encode the date:
```json
{
  "id": "daily-reflections-jan-15",
  "sourceId": "daily-reflections",
  "title": "January 15",
  "sequence": 15,
  "date": "2000-01-15",
  "pageRef": null,
  "chapterRef": "January",
  "text": "full text here — indexed but never displayed to user",
  "linkData": { "month": "january", "day": "15" }
}
```

Use year 2000 as the canonical year for DR dates (it is a leap year, so Feb 29 is valid).

Write a structuring script in Node.js and save it to `/corpus/scripts/structure-<source-id>.js`. It should read the cleaned text file and output the structured JSON array to `/corpus/sources/<source-id>.json`.

### Step 5 — Validate the structured JSON

Before ingesting, run a validation pass:

Checks to perform:
- [ ] All `id` values are unique within the file
- [ ] All `id` values are unique across all corpus files (no collisions)
- [ ] All `sourceId` values match an entry in `sources.json`
- [ ] No `text` field is empty or whitespace-only
- [ ] No `text` field contains raw HTML tags
- [ ] `sequence` values are monotonically increasing with no gaps
- [ ] For DR entries: all 366 dates present (Jan 1 – Dec 31 + Feb 29), no duplicates
- [ ] Spot-check 20 random passages against the source text for accuracy

A validation script should be committed to `/corpus/scripts/validate.js` and run as part of `pnpm run build:index`.

### Step 6 — Update the source registry

Add the new source entry to `/corpus/sources.json`. All fields are required:

```json
{
  "id": "big-book-1ed",
  "title": "Alcoholics Anonymous (1st Edition)",
  "shortTitle": "Big Book",
  "description": "The original 1939 text of Alcoholics Anonymous, in the public domain in the United States.",
  "copyright": "public-domain",
  "displayMode": "full-text",
  "contextWords": 8,
  "linkTemplate": null,
  "officialUrl": "https://www.aa.org/alcoholics-anonymous-big-book-4th-edition",
  "freeUrl": "https://anonpress.org/bb/",
  "color": "#2C4A6E",
  "sortOrder": 1,
  "enabled": true
}
```

`sortOrder` controls the grouping order in search results. Use:
- 1 — Big Book
- 2 — 12 Steps
- 3 — 12 Traditions
- 4 — 12&12
- 5 — Daily Reflections
- 10+ — future sources (leaves room to insert between existing sources)

### Step 7 — Build the search index

```bash
# Validate all corpus files
node corpus/scripts/validate.js

# Build the prebuilt minisearch index from all corpus files
pnpm run build:index
```

The build script should:
1. Read `sources.json` and validate every registry entry
2. For each enabled source, read its corpus file
3. Build a deterministic `minisearch` index over passage `text`
4. Emit `static/index/minisearch.json`, `static/index/passages.json`, and `static/index/index-meta.json` (with a content-hash `version`)
5. Report passage count per source on completion

The build runs automatically as part of the app's `pnpm run build` (Cloudflare Pages deploy), so a `git push` to `main` regenerates the index from the corpus files.

### Step 8 — Verify in the app

After ingesting:
1. Run the app locally (`pnpm run dev`)
2. Search for 3–5 known passages from the new source
3. Verify: correct source label, correct chapter/page reference, correct display mode (full text vs. KWIC only), correct external link
4. Test the offline path: run the ingest, build the PWA, go offline in DevTools, search again
5. Commit the corpus file and registry update as a single PR with the title: `corpus: add [Source Name]`

---

## Part 5 — Future Sources: Evaluation Checklist

Use this checklist when considering any new source beyond v1.

### Legal checklist
- [ ] Copyright status researched and documented
- [ ] Public domain verified via Copyright Office records, **or**
- [ ] Permission email sent to rights holder and response received and saved, **or**
- [ ] Display mode set to `concordance-only` as conservative fallback
- [ ] Legal basis documented in this file under the source's section

### Data quality checklist
- [ ] Clean digital text obtained (not scanned PDF without OCR review)
- [ ] Raw file saved to `/corpus/raw/`
- [ ] Cleaning script written and committed
- [ ] Structuring script written and committed
- [ ] Validation passes with zero errors
- [ ] 20-passage spot-check against source text completed

### Registry checklist
- [ ] Unique `id` chosen (kebab-case, stable — will appear in URLs)
- [ ] `displayMode` matches copyright determination
- [ ] `sortOrder` chosen to position correctly in results
- [ ] `officialUrl` and `freeUrl` verified as live links
- [ ] `linkTemplate` tested with sample `linkData` values
- [ ] `color` chosen to distinguish from existing source badges

### App checklist
- [ ] Ingested to dev D1 and searched successfully
- [ ] Source appears correctly on `/sources` page
- [ ] External links open correct pages
- [ ] Display mode renders correctly (full text / KWIC only)
- [ ] Offline search returns results for new source
- [ ] PR merged and production ingest run

---

## Part 6 — Potential Future Sources

These are candidates for v2+. Each needs its own copyright research.

| Source | Fellowship | Likely Status | Notes |
|---|---|---|---|
| Narcotics Anonymous Basic Text | NA | Protected | NA World Services; email permissions@na.org |
| As Bill Sees It | AA | Likely protected | AAWS publication; check renewal |
| Came to Believe | AA | Likely protected | AAWS publication |
| Living Sober | AA | Likely protected | AAWS publication |
| Al-Anon's Twelve Steps & Twelve Traditions | Al-Anon | Protected | Al-Anon Family Group Headquarters |
| Overeaters Anonymous literature | OA | Protected | OA World Service; permissions@oa.org |
| AA Grapevine articles | AA | Protected | AA Grapevine, Inc.; separate from AAWS |
| Bill W. personal writings / letters | AA | Research needed | Some may be PD; others held by AAWS |
| Original AA Manuscript (1938) | AA | Public domain | Pre-publication draft; anonpress.org/manu has it |

**Important:** This app is named `basictexts.org` — not `AAbooks.org`. The name leaves room to grow beyond AA literature. If non-AA sources are added, update the `/about` page and source labels to make the scope clear to users.

---

## Appendix A — Useful Tools

| Tool | Purpose | Link |
|---|---|---|
| Copyright Office catalog | Search copyright registrations and renewals | https://cocatalog.loc.gov |
| Stanford Copyright Renewal DB | Searchable 1923–1963 renewal records | https://exhibits.stanford.edu/copyrightrenewals |
| Internet Archive | Source texts, scans, plain text downloads | https://archive.org |
| pdftotext (poppler) | Extract text from PDF | `brew install poppler` |
| pdf-parse | Node.js PDF text extraction | `pnpm add pdf-parse` |
| Tesseract | OCR for scanned PDFs | https://tesseract-ocr.github.io |
| htm (Node) | Lightweight HTML parser for scraping | `pnpm add node-html-parser` |
| minisearch | Client-side FTS for offline index | https://lucaong.github.io/minisearch |

## Appendix B — Directory Structure

```
/corpus/
  sources.json                  ← source registry (one entry per source)
  sources/
    big-book-1ed.json           ← structured passage array
    twelve-steps-traditions.json
    twelve-traditions.json
    daily-reflections.json
  raw/
    big-book-1ed.txt            ← raw acquired text, committed as-is
    daily-reflections-scraped/  ← raw HTML pages, one per date
  scripts/
    clean-big-book-1ed.js       ← cleaning script
    structure-big-book-1ed.js   ← structuring script
    clean-daily-reflections.js
    structure-daily-reflections.js
    validate.js                 ← runs across all corpus files
    ingest.js                   ← loads corpus into D1
  legal/
    big-book-1ed-copyright-check.png   ← screenshot of Copyright Office search
    README.md                          ← one-line note per source on legal basis
```

---

*This document should be committed to the repository at `/corpus/CORPUS-GUIDE.md` and kept up to date as sources are added. It is both a how-to guide and a legal record of decisions made.*