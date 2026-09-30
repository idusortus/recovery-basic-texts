# basictexts

A free, open-source, mobile-first progressive web app for searching Alcoholics Anonymous literature by keyword or phrase. Results appear with surrounding context, source labels, and links to official or freely available versions of the text.

Live at: **basictexts.org**

---

## What it does

- Full-text keyword and phrase search across multiple AA literature sources in one experience
- KWIC (keyword-in-context) results with source labels, chapter/date references, and highlights
- Search-box suggestions (prefix + did-you-mean) and synonym/concept grouping, all offline
- Installable PWA — works fully offline after first load
- Shareable search and passage deep-links
- Today's Daily Reflection on the home dashboard: a bounded concordance-only KWIC teaser that links out to aa.org, with a matching offline `/reflection` fallback
- Light / dark mode, mobile-first layout

## Stack

| Layer | Technology |
|---|---|
| Frontend | SvelteKit 5 + TypeScript + Tailwind CSS |
| Search | Client-side [MiniSearch](https://lucaong.github.io/minisearch) against a prebuilt static index |
| Hosting | Cloudflare Pages |
| Usage logging | Cloudflare Pages Function + Cloudflare KV (anonymous search terms only) |
| PWA / offline | `@vite-pwa/sveltekit` (Workbox) |

There is no database and no server-side search in v1. The entire corpus lives in this repository as JSON files, compiled into a prebuilt search index at deploy time. See [docs/plans/basic-texts-PRD.md §7](docs/plans/basic-texts-PRD.md) for the architecture rationale.

## Quick start

See [QUICKSTART.md](QUICKSTART.md) — the full local setup takes about 2 minutes.

```bash
pnpm install
pnpm run build:index
pnpm run dev
```

### Tests (no test framework, no extra dependencies)

```bash
pnpm run test:search       # shared normalization + MiniSearch/concordance two-path parity
pnpm run test:concordance  # concordance tokenizer offsets
pnpm run test:feedback     # feedback issue builder
pnpm run test:source-badge # filter-chip accent contrast (fill / label / badge ring)
pnpm run test:install-prompt # PWA install prompt initialized exactly once
pnpm run test:source-link  # non-full-text "read at official source" link template resolution
pnpm run test:url-state    # shareable search URL (q / phrase / sources) serialize + parse
pnpm run test:zero-result  # zero-result recovery suggestions (topics + one did-you-mean)
pnpm run test:report-prefill # "report this passage" feedback prefill (no PII, no new fields)
pnpm run test:reflection   # Daily Reflections teaser bound + offline fallback (no aa.org fetch)
pnpm run test:ingest       # ingest Stage 3 running-header stripping (python3)
```

`test:search` rebuilds `static/index` first, then imports the real app search
service (`src/lib/search/index.ts`) through a tiny Node loader
(`scripts/search-test-loader.mjs`) and exercises both search paths. It also runs
the golden-file suite (`scripts/fixtures/search-golden.json`) over sentence
boundaries and highlighted spans.

The filter-bar source chips resolve their color through
`src/lib/corpus/source-accent.ts`: the chip fill and the label foreground are
contrast-selected from the source accent, and each per-source badge keeps a
contrast-carrying ring so it stays visible and legible on both selected and
unselected chips in either theme. `test:source-badge` guards that contract,
including the gold `Daily Reflections` accent.

### Daily Reflections (link-forward, protected)

Daily Reflections is a protected, concordance-only source. Local display never
reproduces the day's reflection prose in full: the home card and the offline
`/reflection` fallback show at most a bounded KWIC window (`contextWords` each
side of the anchor) built from the date's indexed entry via the shared KWIC
machinery (`src/lib/corpus/reflection.ts`). While online, `/reflection` stays a
client-side redirect to `https://www.aa.org/daily-reflections`; while offline it
renders the indexed entry for the date (or `?date=MM-DD`) instead, and reports
"No reflection available for [date]" when the local index has no entry. Nothing
is fetched or scraped from aa.org — it appears only as a navigation link/redirect.
`test:reflection` guards the window bound, the never-full-text rule, the date
resolver, and the no-aa.org-fetch contract.

### Search normalization, ranking, and snippets

`src/lib/search/normalize.js` is the single canonical normalizer used by the
index builder (`corpus/scripts/build-index.mjs`), the concordance tokenizer
(`corpus/scripts/concordance-utils.mjs`) and the query side
(`src/lib/search/index.ts`). It lowercases, strips apostrophes (so `Haven't` ==
`Havent`), folds quotes/dashes, and treats hyphens as separators, so both search
paths match contractions, punctuation and hyphenation identically. It is a plain
ESM module with JSDoc types, so the Node build scripts import it natively (no
TypeScript type-stripping needed at build/deploy time) and Vite bundles the same
file into the app.

The prebuilt index version (`static/index/index-meta.json`) is a hash of the
corpus inputs **and** the tokenizer/index-schema code
(`corpus/scripts/index-version.mjs`), so a normalizer or format change bumps it;
`npm run validate:corpus` fails if the emitted index is stale.

`src/lib/search/match.ts` is the single source of truth for where and how well a
query matches a passage: merged match offsets, the best-match anchor, and the
shared relevance score. Both paths rank with it, so ordering and highlighting
agree. `src/lib/search/kwic.ts` clips per display mode (`full-text` = whole
sentences; `snippet` = at most `contextWords` words total, capped at ~30;
`concordance-only` = `contextWords` each side) and never renders a protected
passage in full. Copying a result copies that same clipped excerpt for protected
sources (full text only for `full-text`).

`src/lib/search/suggestions.ts` derives ranked prefix and did-you-mean
suggestions from the loaded concordance term dictionary — offline, no extra
artifact. `src/lib/corpus/synonyms.ts` treats `corpus/synonyms.json` as an
undirected concept graph, so searching any member of a group (for example `God`,
`Higher Power`, `Creator`, `Spirit of the Universe`) surfaces the others;
synonym expansion applies to bare-keyword queries only.

## Feedback form (maintainers)

The anonymous `/feedback` page files each report as a GitHub issue. It is
optional for local search work — the rest of the app runs without it.

Local development:

1. `cp .env.example .env` (the file is gitignored).
2. `.env.example` ships with Cloudflare's published Turnstile **test** keys, so
   the form works locally with no Cloudflare account. Never use test keys in
   production — the server logs a loud warning when it sees one.

Production setup (secrets are per-environment, never committed):

```bash
wrangler pages secret put TURNSTILE_SECRET_KEY --project-name basictexts
wrangler pages secret put GITHUB_TOKEN --project-name basictexts
```

- `PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_HOSTNAMES` are non-secret runtime
  `vars` in `wrangler.jsonc`.
- `FEEDBACK_RATE_LIMIT` is the KV binding behind the best-effort per-IP limit;
  it is declared under `kv_namespaces` in `wrangler.jsonc` alongside `SEARCH_LOG`.
  Local `wrangler`/`vite dev` state is written to `.wrangler/` (gitignored).
- The repo must already define the issue labels `from-app` plus `suggestion`
  (for suggestions) or `bug` (for bug reports). A missing label makes GitHub
  return 422 and the form shows the "not set up" message instead of filing. Both
  labels (and `bug`) already exist on this repository.

Run the dependency-free feedback-logic tests with `pnpm run test:feedback`.

## Search analytics (maintainers)

Anonymous submitted searches are queued client-side and flushed to
`functions/api/log.ts`, which appends them to the `SEARCH_LOG` KV namespace.
There is intentionally **no public stats surface**: the former `/stats` page and
`/api/stats` endpoint were removed because they exposed every logged query to any
visitor without authentication.

Maintainers read the log out-of-band with Wrangler:

```bash
# List recent log keys (keys are ISO-timestamp-prefixed and sortable)
wrangler kv key list --binding SEARCH_LOG --remote

# Read one record
wrangler kv key get "<key>" --binding SEARCH_LOG --remote
```

Records contain only `{ q, resultCount, sourceFilter, ts }` — no IP address, user
agent, cookie, or identifier. `POST /api/log` remains an unauthenticated write
endpoint that accepts only those bounded fields, and it never affects search.

## Project structure

```
corpus/                     — source data (source of truth)
  sources.json              — source registry (metadata, copyright, display mode)
  sources/
    big-book-2ed.json       — Big Book 2nd edition passages (public domain)
    twelve-steps-traditions.json
    daily-reflections.json
  known-exceptions.json     — curated hints for common search terms not in corpus
  scripts/
    build-index.mjs         — prebuilds the search index
    validate.js             — corpus schema validation
    test-ingest-headers.py  — Stage 3 running-header stripping test
  CORPUS-GUIDE.md           — authoritative guide for sourcing and ingesting corpus

docs/
  plans/
    basic-texts-PRD.md      — product requirements (source of truth)
    basic-texts-implementation-plan.md

src/
  lib/
    types.ts                — core domain types
    corpus/registry.ts      — loads and validates sources.json
    corpus/exceptions.ts    — known-exception hint matcher
    search/index.ts         — MiniSearch hydration + search
    search/normalize.js     — canonical normalization/tokenization (shared with build scripts)
    search/match.ts         — shared match offsets + relevance score (both search paths)
    search/suggestions.ts   — prefix + did-you-mean suggestions from the concordance
    search/kwic.ts          — KWIC clipping + highlight (XSS-safe)
    stores/                 — online/offline, toast, version check, PWA install
    components/             — Nav, ExternalLink, Toasts
  routes/
    +page.svelte            — home / concordance search
    reflection/             — today's Daily Reflection
    topics/                 — topic browse
    sources/                — source registry display
    about/                  — legal, privacy, open source
    passage/[sourceId]/[passageId]/ — passage detail

functions/api/log.ts        — Cloudflare Pages Function: anonymous usage logging
static/index/               — generated by build:index (gitignored)
```

## Adding a corpus source

1. Add a corpus file to `corpus/sources/<source-id>.json`
2. Add a registry entry to `corpus/sources.json`
3. Run `pnpm run build:index`
4. No application code changes required

See [corpus/CORPUS-GUIDE.md](corpus/CORPUS-GUIDE.md) for copyright evaluation, acquisition steps, and ID conventions.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).

## Links

- [Product requirements (PRD)](docs/plans/basic-texts-PRD.md)
- [Implementation plan](docs/plans/basic-texts-implementation-plan.md)
- [Corpus guide](corpus/CORPUS-GUIDE.md)
- [QUICKSTART](QUICKSTART.md)
