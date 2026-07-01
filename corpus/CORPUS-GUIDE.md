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

> **Big Book 1st Edition removed (v1.1):** The 1st edition corpus was removed pending a proper re-ingestion via the `ingest.py` pipeline. The 2nd edition (1955) is the active full-text Big Book source. When re-adding the 1st edition, source a clean plain-text from anonpress.org and run `ingest.py --input big-book-1ed.txt`. The 1939 text is confirmed public domain (copyright lapsed 1967).

### Source 1 — The Twelve Steps and Twelve Traditions (12&12)
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

### Source 2 — The Twelve Traditions (standalone)
**Registry ID:** `twelve-traditions`
**Display mode:** `full-text` (likely) — verify same as 12&12
**Copyright status:** 🔍 NEEDS VERIFICATION — likely public domain

#### Notes
It is readily available online.

---

### Source 3 — Daily Reflections
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

**There is no date-specific deep link.** aa.org renders the current day's reflection server-side and does not expose a stable public URL for an arbitrary month/day. Do not attempt to construct one. The registry `linkTemplate` for `daily-reflections` is simply `https://www.aa.org/daily-reflections`. Every DR result and the reflection dashboard card link to that single URL. The `/reflection` route on basictexts.org is a client-side redirect to that URL — we do not display the full Daily Reflections text locally.

---

## Part 4 — General Ingestion Process (Any Source)

Follow these steps for every new source, v1 or future.

### Step 0 — Python dependency setup (one-time)

The `ingest.py` pipeline requires Python 3.11+ and the following packages:

```bash
pip install -r corpus/scripts/requirements.txt
python -m spacy download en_core_web_sm
```

On Ubuntu/Debian, pyenchant also needs the system hunspell dictionary:
```bash
sudo apt-get install python3-enchant enchant-2 libenchant-2-dev hunspell-en-us
```

On macOS:
```bash
brew install enchant && pip install pyenchant
```

### Step 1 — Evaluate copyright (Part 2 above)
Do not proceed until you have documented the copyright basis in this file under the source's section. Add a note like:
> "Copyright verified public domain: no renewal record found in Copyright Office database, searched [date]. Screenshotted and saved to /corpus/legal/[source-id]-copyright-check.png"

### Step 2 — Acquire the raw text
Preferred formats in order:
1. **PDF (text-based)** — the `ingest.py` pipeline handles PDF extraction natively via pdfplumber
2. **Plain text (.txt)** — pass directly to `ingest.py --input` (skips PDF extraction stage)
3. **Clean HTML / EPUB** — convert to .txt first, then use `--input .txt`
4. **PDF (scanned/image)** — requires OCR pre-processing (Tesseract); save result as .txt

Save the raw acquired file to `corpus/raw/<source-id>.<ext>` and commit it.

### Step 3 — Create a chapter map JSON file

The chapter map tells the pipeline which page ranges belong to which chapter. It is required for accurate `chapterRef` assignment.

Save the file as `corpus/raw/<source-id>-chapters.json`:

```json
[
  {
    "chapterRef": "Chapter 5 — How It Works",
    "title": "How It Works",
    "startPage": 79,
    "endPage": 92
  },
  ...
]
```

`startPage` and `endPage` are **physical PDF page numbers** (1-based, as reported by pdfplumber), not printed book page numbers.

**Calibration workflow:** If you don't know the exact page numbers, run `ingest.py` without `--chapter-map` first (passages will get `chapterRef: "Unknown"`). Examine `pipeline-artifacts/<source-id>/<ts>/05-paragraphs.jsonl` to find the PDF page number where each chapter begins. Then create the chapter map and re-run.

### Step 4 — Run the ingest pipeline

```bash
# From the repo root:
python corpus/scripts/ingest.py \
  --source-id <source-id> \
  --input corpus/raw/<source-id>.pdf \
  --chapter-map corpus/raw/<source-id>-chapters.json \
  --output corpus/sources/<source-id>.json
```

For a plain-text input:
```bash
python corpus/scripts/ingest.py \
  --source-id <source-id> \
  --input corpus/raw/<source-id>.txt \
  --chapter-map corpus/raw/<source-id>-chapters.json \
  --output corpus/sources/<source-id>.json
```

Optional: if Stage 3 WARNING output shows uncaught running headers, create a strip-patterns file:
```bash
# corpus/raw/<source-id>-strip.json — array of regex strings
["^ALCOHOLICS ANONYMOUS$", "^HOW IT WORKS$"]

# Then re-run with:
python corpus/scripts/ingest.py ... --strip-patterns corpus/raw/<source-id>-strip.json
```

**After each run, review:**
- `pipeline-artifacts/<source-id>/<ts>/08-audit-report.txt` — flagged passages and vocabulary check
- `pipeline-artifacts/<source-id>/<ts>/04-hyphen-decisions.log` — all hyphen repair decisions; spot-check the DEFAULT-rule joins listed in the audit report

Each run is self-contained in a timestamped directory and never overwrites previous runs.

**The passage schema produced by ingest.py:**

```json
{
  "id": "big-book-2ed-chapter-5-how-it-works-p0001",
  "sourceId": "big-book-2ed",
  "title": "How It Works",
  "sequence": 1,
  "date": null,
  "pageRef": "p.79",
  "chapterRef": "Chapter 5 — How It Works",
  "text": "Rarely have we seen a person fail who has thoroughly followed our path. Those who do not recover are people who cannot or will not completely give themselves to this simple program, usually men and women who are constitutionally incapable of being honest with themselves.",
  "linkData": null
}
```

**Daily Reflections exception:** The DR source uses `parse_daily_reflections.py` (not `ingest.py`) because its schema requires `date: "MM-DD"` and a non-null `linkData` field that `ingest.py` does not produce. See Part 3, Source 3 for the DR ingestion process.

### Step 5 — Validate the structured JSON

The `ingest.py` pipeline performs its own validation before writing the output file and exits with code 1 if validation fails. After the pipeline completes, also run:

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

`validate.js` is already committed and runs as part of `pnpm run build:index`.

### Step 6 — Update the source registry

Add the new source entry to `/corpus/sources.json`. All fields are required:

```json
{
  "id": "big-book-2ed",
  "title": "Alcoholics Anonymous (2nd Edition)",
  "shortTitle": "Big Book (2nd Ed.)",
  "description": "The 1955 second edition of Alcoholics Anonymous, public domain in the United States.",
  "copyright": "public-domain",
  "displayMode": "full-text",
  "contextWords": 15,
  "linkTemplate": null,
  "officialUrl": "https://www.aa.org/the-big-book",
  "freeUrl": "https://www.portlandeyeopener.com/AA-Big-Book-2nd-Edition.pdf",
  "color": "#1A5276",
  "sortOrder": 1,
  "enabled": true
}
```

`sortOrder` controls the grouping order in search results. Current assignments:
- 1 — Big Book (2nd Edition)
- 2 — 12&12
- 3 — 12 Traditions (disabled until ingested)
- 4 — Daily Reflections
- 10+ — future sources (leaves room to insert between existing ones)

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
| pdfplumber | Python PDF text extraction (used by ingest.py) | `pip install pdfplumber` |
| ftfy | Python Unicode fixing library | `pip install ftfy` |
| pyenchant | Python spellcheck (hyphen repair) | `pip install pyenchant` |
| spaCy | Python NLP for sentence segmentation | `pip install spacy && python -m spacy download en_core_web_sm` |
| pdftotext (poppler) | CLI PDF extraction (used by parse_daily_reflections.py) | `brew install poppler` / `apt install poppler-utils` |
| Tesseract | OCR for scanned PDFs | https://tesseract-ocr.github.io |
| minisearch | Client-side FTS for offline index | https://lucaong.github.io/minisearch |

## Appendix B — Directory Structure

```
/corpus/
  sources.json                          ← source registry (one entry per source)
  CORPUS-GUIDE.md                       ← this file
  synonyms.json                         ← synonym expansion rules
  known-exceptions.json                 ← known-exception hints shown in search UI
  sources/
    big-book-2ed.json                   ← structured passage array (ingest.py output)
    twelve-steps-traditions.json        ← structured passage array (ingest.py output)
    daily-reflections.json              ← structured passage array (parse_daily_reflections.py output)
  raw/
    BigBookSecondEdition.pdf            ← raw PDF, committed as-is
    AA-12-Steps-12-Traditions.pdf       ← raw PDF
    AA-Daily-Reflections.pdf            ← raw PDF
    big-book-2ed-chapters.json          ← chapter map for ingest.py (PDF page ranges)
    twelve-steps-traditions-chapters.json
    <source-id>-strip.json              ← optional: regex patterns to strip headers/footers
  scripts/
    ingest.py                           ← primary ingestion pipeline (PDF/TXT → corpus JSON)
    requirements.txt                    ← Python dependencies for ingest.py
    parse_daily_reflections.py          ← DR-specific ingestion (date/linkData schema)
    scan_raw_sources.py                 ← audits raw/ against the registry
    build-index.mjs                     ← builds MiniSearch index from corpus/ sources
    validate.js                         ← schema + integrity validation
  pipeline-artifacts/
    <source-id>/
      <YYYYMMDD-HHMMSS>/
        01-extracted.txt                ← Stage 1 output
        02-normalized.txt               ← Stage 2 output
        03-stripped.txt                 ← Stage 3 output
        04-repaired.txt                 ← Stage 4 output
        04-hyphen-decisions.log         ← all hyphen repair decisions
        05-paragraphs.jsonl             ← Stage 5 output
        05-discarded-fragments.log      ← paragraphs discarded (<20 words)
        06-chaptered.jsonl              ← Stage 6 output
        07-final.json                   ← Stage 7 output (same content as sources/<id>.json)
        08-audit-report.txt             ← passage flags + default-join hyphens
        pipeline-run.log                ← full pipeline log with timestamps
  legal/
    README.md                           ← one-line note per source on legal basis
```

> `pipeline-artifacts/` is gitignored — it is a local audit trail, not a build artifact.

---

*This document should be committed to the repository at `/corpus/CORPUS-GUIDE.md` and kept up to date as sources are added. It is both a how-to guide and a legal record of decisions made.*