# basictexts

A free, open-source, mobile-first progressive web app for searching Alcoholics Anonymous literature by keyword or phrase. Results appear with surrounding context, source labels, and links to official or freely available versions of the text.

Live at: **basictexts.org**

---

## What it does

- Full-text keyword and phrase search across multiple AA literature sources in one experience
- KWIC (keyword-in-context) results with source labels, chapter/date references, and highlights
- Search-box suggestions (prefix + did-you-mean) and synonym/concept grouping, all offline
- Local recent searches — kept only in this browser (clearable, one-tap re-run), never transmitted
- Back-to-search restoration: browser Back returns to the same query and approximately the same scroll position
- Result cards show the passage page reference (`p.NN`) when the corpus has one, and label Copy truthfully ("Copy passage" vs "Copy excerpt")
- Passage reader controls on full-text pages: an "Aa" reading-settings group (font size + line spacing, remembered locally) and a browser-only Listen (text-to-speech) control — no external service, no data sent
- Installable PWA — works fully offline after first load
- Shareable search and passage deep-links
- Reference reader at `/reference`: each short meeting-referenced AA text (Twelve Steps, long-form Twelve Traditions, Twelve Concepts, and the Promises and step prayers) as its own self-contained, offline view. The Twelve Concepts renders a gated placeholder (title, copyright notice, aa.org link) with no text
- Source-filter chips are registry-driven: a source can stay indexed/searchable and listed on `/sources` while being excluded from the chips (the four reference texts do exactly this)
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
pnpm run test:source-filterable # registry-driven chips: filterable flag, default filter set, default-search reach, /sources listing
pnpm run test:reference-reader # reader view table, offline/no-fetch guard, full-text gating, no user-data surface
pnpm run test:install-prompt # PWA install prompt initialized exactly once
pnpm run test:source-link  # non-full-text "read at official source" link template resolution
pnpm run test:url-state    # shareable search URL (q / phrase / sources) serialize + parse
pnpm run test:recent-searches # local recent-search list (add/dedupe/cap/parse/clear) + local-only guard
pnpm run test:reader-prefs # passage reader display prefs (default = no override, steps, defensive parse)
pnpm run test:tts          # Listen gating (full-text + supported) + speech-text/chunk assembly, no network
pnpm run test:result-label # result-card page reference + Copy label by display mode
pnpm run test:zero-result  # zero-result recovery suggestions (topics + one did-you-mean)
pnpm run test:report-prefill # "report this passage" feedback prefill (no PII, no new fields)
pnpm run test:reflection   # Daily Reflections teaser bound + offline fallback (no aa.org fetch)
pnpm run test:ui-copy      # app-authored visible copy contains no em dash (U+2014)
pnpm run test:ingest       # ingest Stage 3 running-header stripping (python3)
```

`pnpm run report:jev` prints a usage summary from the Jev tier-router journal
(`.opencode/journals/jev-tier-router.log`): real System One API calls (prompt
classifications + spawn-gate evaluations) versus free cached injections, the tier
and source distributions, and spawn-gate decisions. Accepts an optional path
argument or `CLI_FIVE_LOGFILE`. Token usage is not journaled by the plugin, so the
report counts calls only.

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

App-authored copy shown to visitors must not contain an em dash (U+2014).
`test:ui-copy` asserts the copied-citation helper (`buildCitation` in
`src/lib/search/kwic.ts`) uses a plain lead-in, then scans `src/**/*.{svelte,ts,js}`
for U+2014 after stripping every comment form (HTML, line, block, JSDoc), allowing
only the corpus-matching data literal in `src/lib/search/index.ts`. Corpus text,
comments, and the reserved (unrendered) support section are out of scope.

### Browser E2E tests (Playwright)

Headless-browser tests live under `e2e/` and exercise the UI behaviors that the
dependency-free `test:*` scripts cannot (recent searches, back-to-search scroll
restoration, result-card page references and Copy labels, the passage reader
controls, and the protected-source guardrails). They automate the **interactive
subset** of the `manual (browser)` acceptance checks from the archived
`search-qol-improvements` and `passage-reader-controls` changes.

```bash
npx playwright install chromium   # one-time: download the test browser
pnpm run test:e2e                 # Chromium headless; starts a fresh `pnpm run dev`
```

This suite also runs in CI on pushes and pull requests that touch app, E2E,
corpus, or build-tooling files (`.github/workflows/e2e.yml`); a failing test
fails the check.

Set `PLAYWRIGHT_PORT` to run the dev server and tests on a different port
(default `5173`). `playwright.config.ts` runs one Chromium project and always
starts a **fresh** dev server (`reuseExistingServer: false`); because the dev
server runs with `--strictPort`, an occupied port fails loudly rather than
silently reusing a server from another checkout. Artifacts are captured on
failure only: `trace` on the first retry and `screenshot` `only-on-failure`. The
suite is deterministic: `speechSynthesis` and the clipboard are mocked via
`page.addInitScript`, it never depends on the current date, and the
zero-network-request tests abort non-localhost requests so third-party assets
(Google Analytics/Fonts) cannot leak into the measured window (aborted requests
still raise `request` events, so an app-initiated external call is still
detected).

Residual **manual** gaps (not covered by the automated suite):

- **Real audio output** — the Listen tests assert the play/pause/resume/stop and
  speak/cancel contract against a mocked `speechSynthesis`; no audible sound is
  produced or verified.
- **Pixel-level visual/contrast review** — layout, focus-ring visibility, and
  color contrast are checked by DOM/style assertions, not image diffs.
- **OS clipboard integration** — Copy behavior is exercised against a mocked
  `navigator.clipboard`; the actual system clipboard is not inspected.

If `static/index/*` is missing or stale, run `pnpm run build:index` first so
search returns real results.

### Daily Reflections (link-forward, protected)

Daily Reflections is a protected, concordance-only source. Local display never
reproduces the day's reflection prose in full: the home card and the offline
`/reflection` fallback show at most a bounded KWIC window (`contextSentences`
whole sentences each side of the anchor — DR sets `contextSentences: 1`) built
from the date's indexed entry via the shared KWIC
machinery (`src/lib/corpus/reflection.ts`). The reflection's date leads the
heading on every surface and leads every copied citation (`January 1 · Daily
Reflections`). While online, `/reflection` stays a
client-side redirect to `https://www.aa.org/daily-reflections`; while offline it
renders the indexed entry for the date (or `?date=MM-DD`) instead, and reports
"No reflection available for [date]" when the local index has no entry. Nothing
is fetched or scraped from aa.org — it appears only as a navigation link/redirect.
`test:reflection` guards the window bound, the never-full-text rule, the date
resolver, and the no-aa.org-fetch contract.

### Passage reader controls (full text)

On a `full-text` passage page the reader gets two accessibility controls, and
neither exists on a `snippet`/`concordance-only`/protected page:

- **Reading settings ("Aa")** — a labeled, keyboard-operable group that steps the
  passage **body** font size (default / large / larger / largest) and toggles
  line spacing (normal / relaxed). At the default step no inline style is
  applied, so the browser/user's own text size and the page's existing leading
  win; the end buttons stay focusable and use `aria-disabled` rather than
  `disabled`, and the current step is announced via a live region, so state is
  never color-only. The choice persists in `localStorage` under the namespaced
  key `basictexts-reader-prefs` (device-local, never transmitted or synced);
  when storage is unavailable it still works in memory. Logic lives in the pure,
  import-free `src/lib/passage/reader-prefs.ts` and is covered by
  `test:reader-prefs`.
- **Listen (text-to-speech)** — plays the rendered passage text through the
  browser's built-in `speechSynthesis`, chunked into sentence-sized utterances;
  play/pause/resume/stop with an announced state. It makes **no network
  request** and reads only what the `full-text` branch renders. The control is
  gated by `canOfferListen(source.displayMode, …)` (an explicit `displayMode`
  check, not the `copyright`-derived `chapterPassages`) and is absent when the
  API is unavailable, so nothing errors. Speech is cancelled on Stop, on a true
  unmount, and whenever the driving params change — same-route chapter/passage
  navigation changes only the params and does **not** fire `onDestroy`, so the
  param-change stops prevent speech reading into the next passage. Logic lives in
  the pure, import-free `src/lib/passage/tts.ts` and is covered by `test:tts`.

### Reference reader (`/reference`)

The `/reference` route presents each short meeting-referenced text as its own
self-contained view, selected by the `?text=` parameter (`steps`, `traditions`,
`concepts`, `promises`; an unknown/missing value defaults to `steps`). The view
key → source id mapping lives in the declarative, import-free
`src/lib/reference/views.ts`, and the reader renders only from the shipped
registry and the already-precached index (`loadSearchIndex()` + `getPassages()` +
`getSourceById()`) — no `fetch` to aa.org or any host, so it works offline like
search. Rendering branches only on registry state: an enabled `full-text` source
renders its passages sorted by `sequence` (reusing `reader-prefs.ts` and
`tts.ts`); a missing, disabled, or non-`full-text` source renders a gated
placeholder (title, copyright notice, and the registry `officialUrl` link) and
**the guard returns before `getPassages()` is read**, so no protected text can
leak — this is how the disabled `twelve-concepts` is presented. `test:reference-reader`
guards the view mapping, the no-fetch/offline loading, the guard-before-read
order, and the no-user-data contract.

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
`concordance-only` = `contextSentences` whole sentences each side when set, else
`contextWords` each side) and never renders a protected
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
    twelve-steps.json       — the Twelve Steps, derived from the 2nd-ed. Big Book (public domain)
    twelve-traditions.json  — the long-form Twelve Traditions, derived from the 2nd-ed. Big Book (public domain)
    promises-and-prayers.json — the Ninth Step Promises + Third/Seventh Step prayers, derived from the 2nd-ed. Big Book (public domain)
    daily-reflections.json
  known-exceptions.json     — curated hints for common search terms not in corpus
  scripts/
    build-index.mjs         — prebuilds the search index
    extract-reference-texts.mjs — derives the reference-text corpus files from the Big Book
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
    reference/views.ts      — declarative `/reference` view table (key → source id)
    stores/                 — online/offline, toast, version check, PWA install
    components/             — Nav, ExternalLink, Toasts
  routes/
    +page.svelte            — home / concordance search
    reflection/             — today's Daily Reflection
    reference/              — reference-text reader (one view per text, offline)
    topics/                 — topic browse
    sources/                — source registry display (all sources, unfiltered)
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

An optional `"filterable": false` on a registry entry excludes that source from
the search-surface filter chips while leaving it indexed, searchable, and listed
on `/sources` (default when absent is `true`).

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
