Everything checks out. Here's a summary of what was built:

---

## process_pdfs.py

A Python pipeline that handles Steps 2–6 of the CORPUS-GUIDE ingestion process for PDF sources.

### What it does end-to-end

| Step | What happens |
|---|---|
| Extract | Uses `pymupdf` blocks mode (one block per paragraph) so paragraph and heading boundaries are respected |
| Header/footer stripping | Detects lines that appear on 3+ pages in header/footer position and strips them |
| Cleaning | Ligature fixes, hyphenated line-break joining, blank-line normalization |
| Chapter detection | All-caps headings + known AA patterns (`Step One`, `FOREWORD TO SECOND EDITION`, etc.) — with guards against TOC entries (4+ spaces) and typographic running headers (`S T E P  T W O`) |
| Structuring | Paragraph → passage; min 20 words; auto-split at ≈200 words at sentence boundaries |
| Validation | Unique IDs, cross-file ID collision, empty text, HTML tags, monotone sequence |
| Output | `corpus/sources/<source-id>.json` + upserts sources.json registry |

### Output

- twelve-steps-traditions.json — 575 passages, 28 sections
- big-book-2ed.json — 746 passages, 23 chapters
- sources.json — registry with both source entries

### Usage

```bash
py -3 corpus/scripts/process_pdfs.py              # process all PDFs in corpus/raw
py -3 corpus/scripts/process_pdfs.py --dry-run    # extract & validate, no writes
py -3 corpus/scripts/process_pdfs.py --file corpus/raw/SomePDF.pdf --source-id my-source
py -3 corpus/scripts/process_pdfs.py --check-deps
```