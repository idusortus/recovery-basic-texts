# Product Requirements Document
## basictexts.org — AA Literature Concordance & Reference Tool

**Version:** 1.1 (MVP)
**Status:** Active — implementation in progress
**Last updated:** 2026-06-28
**Repository:** github.com/[owner]/basictexts (public, open source)
**Domain:** basictexts.org — registered at Cloudflare Registrar ✓
**Prototype:** `proto/google-oneshot` — validated UI reference prototype (React/Vite); use for design guidance only (see §12)

---

## 1. Purpose & Vision

basictexts.org is a free, open-source web application and installable PWA that lets anyone search Alcoholics Anonymous literature by keyword or phrase, see every occurrence across all available sources with surrounding context, and navigate directly to official or free online versions of the text.

It is designed for AA members, newcomers, and sponsors who want to find a passage quickly — at a meeting, during step work, or in personal study — without owning a physical concordance, paying for an app, or navigating a website from 2005.

It improves on the existing landscape (164andMore, anonpress.org) by being:
- **Free** — no book to buy, no paywall
- **Full-text searchable** — any word or phrase, not a pre-printed keyword index
- **Multi-source** — concordance spans multiple texts in one search
- **Mobile-first** — works as an installable PWA with full offline support
- **Link-forward** — every result connects to official or free sources; the app drives traffic *to* AA, not away from it
- **Extensible** — adding a new corpus source requires only a config entry and a data file, no code changes

---

## 2. Target Audience

Primary: AA members at any stage of recovery — from newcomers unfamiliar with the literature to long-timers doing deep step work.

Secondary: Sponsors, group study facilitators, and anyone interested in recovery literature.

**Design implication:** Do not assume familiarity with all texts. Source labels should be clear (full name on first use, abbreviation thereafter). Avoid jargon in UI chrome. The tool itself should feel welcoming and unintimidating.

---

## 3. Deliverables

### 3.1 Web Application
- Responsive, mobile-first design
- Works in all modern browsers (Chrome, Safari, Firefox, Edge)
- Served over HTTPS (required for PWA and service workers)

### 3.2 Progressive Web App (PWA)
- Installable to home screen on Android and iOS (via "Add to Home Screen")
- Launches in standalone mode (no browser chrome)
- **Full offline support** — entire search index and app shell cached on first load/install
- Acceptable install size: 10–20MB (full index pre-cached)
- Service worker handles cache versioning and silent background updates
- Web App Manifest with app name, icons (192px, 512px), theme color, start URL

### 3.3 Shareable Links
- Every search result is deep-linkable: `basictexts.org/search?q=acceptance`
- Individual passage results are linkable: `basictexts.org/passage/big-book-1ed/p45-para2`
  - **Passage ID scheme (stable contract):** a passage's deep link is `/passage/<sourceId>/<passageId>`, where `<passageId>` is the `id` field from the corpus file. Once a specific source corpus (e.g. `big-book-1ed`) is ingested and published, its passage IDs are **frozen forever** — sources only ever expand with new passages, never renumber existing ones. This guarantees shared links never break.
- Web Share API integration — native share sheet on mobile, clipboard fallback on desktop
- Share button appears on individual result cards and on the search results page

---

## 4. Features — MVP (v1)

### 4.1 Home / Dashboard
- Displays today's Daily Reflections entry (date-keyed, concordance-only display per copyright rules — see §6)
- Link: "Read full reflection at aa.org →" opens official page
- Prominent search bar (autofocused on desktop)
- Quick-access topic chips: Fear · Acceptance · Resentment · Gratitude · Humility · God · Honesty · Anger · Ego · Self (matches 164andMore's top 10 as a familiar starting point)
- Light/dark mode toggle (respects system preference as default, persists user choice to localStorage)

### 4.2 Search
- Full-text keyword and phrase search across all indexed sources
  - Phrase search: wrap query in double-quotes (`"like this"`) for exact phrase matching
  - Keyword search (no quotes): AND logic — passage must contain all query words to match
  - Debounce: 150ms after last keystroke before executing search
- Results grouped by source, in source-registry order (Big Book → 12 Steps → 12 Traditions → Daily Reflections)
- Each result card shows:
  - Source label + chapter/section/date
  - KWIC display: full sentence or paragraph context with keyword(s) **highlighted**
  - For `full-text` sources: full sentence/paragraph shown
  - For `concordance-only` sources: ~8 words each side + "Read at [source] →" link
  - Copy button (copies passage text + citation to clipboard)
  - Share button (Web Share API / clipboard)
- Result count per source shown in group header
- Filter bar: toggle sources on/off (all on by default); prevent deselecting the last active source
- URL updates with search query for shareability
- Empty state: friendly message + suggested searches if no results found
- **Known-exceptions hints (§4.7):** when a query matches a curated list of well-known terms/passages that are *not* present in the public-domain corpus, show an informational hint above results pointing the user to the right place.

### 4.3 Browse by Topic
- Pre-built topic pages (same as quick-access chips)
- Each topic page is a pre-rendered search results view — not hand-curated, just a search for that term
- Topics page lists all available topics alphabetically

### 4.4 Today's Reflection
- Standalone `/reflection` route showing today's DR entry
- Same concordance-only display: title, date, short KWIC teaser, link to aa.org
- "Browse by date" calendar picker — navigate to any date's reflection within the app's own indexed corpus
- Previous / next day navigation buttons for step-by-step browsing
- Date stored in URL (`/reflection?date=MM-DD`) for shareability
- If no corpus entry for a selected date: show "No reflection available for [date]" — do not substitute another date's content
- **External link target:** always link to `https://www.aa.org/daily-reflections` (today's reflection only). aa.org resolves the current day server-side; there is no stable public URL for an arbitrary past/future month+day, so do not attempt to deep-link a specific date on aa.org.

### 4.5 Sources & Links
- `/sources` page listing all indexed sources with:
  - Full name, abbreviation, copyright status
  - Display mode explanation ("full text shown" vs "concordance only — link to official source")
  - Links to: official purchase page, free online version (if available)
- Curated free resources section:
  - aa.org/the-big-book
  - anonpress.org/bb (public domain full text)
  - anonpress.org/pdf (free PDF)
  - silkworth.net (AA history archive)
  - archive.org Big Book scan
  - aa.org/daily-reflections

### 4.6 About
- What this app is and isn't (not affiliated with AAWS, not a replacement for the books)
- Copyright basis — public domain editions, concordance fair use, links to buy official texts
- **Generic legal disclaimer** — plain-language, written for this app (not copied from another site): independent, non-commercial, not affiliated with or endorsed by AAWS/AA Grapevine; links out to official sources; will adjust content if AAWS requests. Author is an AA member building this in service of the fellowship.
- Privacy line: anonymous search terms are recorded to improve the app; no personal data, IPs, or cookies (§7.4)
- Open source statement + GitHub link
- How to contribute a new source corpus
- **Support section (reserved space):** a clearly delineated, non-intrusive area for "Buy me a coffee / Ko-fi" and "GitHub Sponsors" links. Built as a small, easily-removable component; calm styling, no nag, no ads. Placeholder links acceptable for v1 until accounts exist.

### 4.7 Known-Exceptions Hints
Some famous passages and terms people search for are **not** in the legally available v1 corpus (the public-domain 1st-edition Big Book). Rather than return a confusing empty/partial result, surface a curated hint. The list is data-driven (a small JSON file, e.g. `corpus/known-exceptions.json`) so it can grow as logging (§7.4) reveals more such gaps.

Seed entries for v1:
- **"acceptance" / "acceptance was the answer":** The well-known "Acceptance" passage ("And acceptance is the answer to all my problems today…") is from a personal story added in the **3rd edition**, which is **not** public domain and not in our corpus. Hint: "Looking for the well-known *Acceptance* passage? It's from a later edition we can't reproduce — read it at aa.org →".
- **"sponsor" / "sponsee" / "sponsorship":** The 1st-edition Big Book does **not** contain these words. Hint: "The 1st-edition Big Book predates the word *sponsor* — sponsorship is discussed in later AA literature."

Each exception entry shape: `{ "match": ["acceptance", "acceptance was the answer"], "title": "...", "body": "...", "link": { "label": "Read at aa.org →", "url": "https://www.aa.org/..." } | null }`. Matching is case-insensitive against the submitted query. The hint renders above the normal results, never replacing them.

---

## 5. Technical Architecture

### 5.1 Recommended Stack — Option B

| Layer | Technology | Rationale |
|---|---|---|
| Frontend framework | SvelteKit | Lean, excellent PWA support via `@vite-pwa/sveltekit`, file-based routing, SSR optional |
| Search | **Client-side `minisearch`** against a prebuilt index | Entire v1 corpus is small (~2–4MB text); in-browser search is instant, works offline by default, and eliminates a server round-trip. No database needed for v1. |
| Search index | Prebuilt at deploy time, shipped as a static asset | One serialized `minisearch` index + a passages lookup file; deterministic, cacheable, no client-side indexing cost on first load |
| Hosting | Cloudflare Pages | Unlimited bandwidth free tier, global CDN, git-push deploy, no billing surprises |
| Usage logging | Thin Cloudflare Pages Function (`/api/log`) writing to **Cloudflare KV** | Records anonymous submitted-search-term + result-count only. No PII, no IP storage, no cookies. Queued client-side and flushed when online (see §7.4). |
| PWA / Service Worker | `@vite-pwa/sveltekit` wrapping Workbox | Handles manifest, service worker lifecycle, pre-cache manifest automatically |
| Offline index | Pre-cached at install via Workbox | Full prebuilt index available offline; the same minisearch path serves online and offline |
| Analytics | Cloudflare Pages Analytics (built-in, no JS, privacy-preserving) + custom `/api/log` term log | Anonymous search term frequency only — no PII, no tracking pixels, no cookies |
| Domain | basictexts.org | Registered via Cloudflare Registrar ✓ |
| CI/CD | Cloudflare Pages GitHub integration | Push to `main` → build (includes index prebuild) → deploy. Preview deployments on PRs |
| Version control | GitHub (public) | Open source from day one |

**Why no D1 in v1:** Cloudflare D1 + a search Worker were evaluated and dropped. The corpus is small enough that a prebuilt client-side `minisearch` index is faster, simpler, fully offline-capable, and removes an entire server-side search engine (and its result-ordering drift vs. the offline path). D1 remains a clean future option if the corpus outgrows the client (see §5.2).

### 5.2 Future Migration Path (if needed)
If the corpus grows beyond what's reasonable to ship to the client, or user features are added (bookmarks, notes, user accounts, group/meeting mode), the architecture migrates to:
- **Cloudflare D1 (SQLite FTS5) + a search Worker** for server-side corpus search — reintroduced only when client-side `minisearch` stops being practical
- **Supabase** (Postgres + Auth + RLS) for user data, if/when user accounts are introduced
- The source-registry and corpus-file model (§6) is unchanged by either migration; only the ingest *target* changes

### 5.3 Alternative Stacks Considered
- **D1 + Worker from day one**: Dropped for v1 — doubles the search surface (server FTS5 + client minisearch must agree), adds a round-trip, and buys nothing while the corpus is small.
- **Option A** (Pagefind static): Simpler but less flexible than minisearch for our KWIC/display-mode needs
- **Option C** (Vercel + Neon): Better Postgres tooling but bandwidth cap and non-commercial friction
- **Option D** (Fly.io + SQLite): Clean but adds VM maintenance; CF Pages is zero-maintenance
- **Supabase from day one**: Overkill for v1 — no user data, no auth, no realtime needed

---

## 6. Source Registry Architecture

### 6.1 Design Principle
Adding a new source corpus requires:
1. A corpus data file in `/corpus/sources/<source-id>.json`
2. One entry added to `/corpus/sources.json` (the registry)
3. A build script run (`npm run build:index`) to regenerate the prebuilt search index from the corpus files
4. No application code changes

The file `corpus/CORPUS-GUIDE.md` is the authoritative reference for corpus sourcing, copyright evaluation, acquisition steps, and ingestion procedures. Consult it before adding or modifying any source.

### 6.2 Source Registry Schema (`sources.json`)
```json
{
  "id": "string — unique, kebab-case, stable (used in URLs)",
  "title": "string — full display name",
  "shortTitle": "string — abbreviation used in result labels",
  "description": "string — one sentence shown on /sources page",
  "copyright": "public-domain | protected | unknown",
  "displayMode": "full-text | concordance-only | snippet",
  "contextWords": "number — words each side for KWIC (ignored for full-text)",
  "linkTemplate": "string | null — URL template with {{variables}} for external links",
  "officialUrl": "string | null — link to buy or read officially",
  "freeUrl": "string | null — link to free legal version if available",
  "color": "string — hex, used as source badge accent",
  "sortOrder": "number — controls grouping order in results",
  "enabled": "boolean — false = indexed but not shown (staged rollout)"
}
```

### 6.3 Display Modes
| Mode | Behavior |
|---|---|
| `full-text` | Full sentence or paragraph shown in result card |
| `concordance-only` | ~8 words each side of keyword + mandatory external link button; full text never rendered |
| `snippet` | Short excerpt (fair use, ~30 words max) + external link |

### 6.4 v1 Source Registry

| ID | Title | Short | Copyright | Mode | Free URL |
|---|---|---|---|---|---|
| `big-book-1ed` | Alcoholics Anonymous (1st Edition) | Big Book | Public domain (US) | `full-text` | anonpress.org/bb |
| `twelve-steps-traditions` | Twelve Steps and Twelve Traditions | 12&12 | Needs verification — start as `snippet`, upgrade if PD confirmed | `snippet` | aa.org |
| `twelve-traditions` | The Twelve Traditions | Traditions | Likely PD (same vintage as Steps) | `full-text` or `snippet` | aa.org |
| `daily-reflections` | Daily Reflections | DR | Protected © AAWS | `concordance-only` | aa.org/daily-reflections |

**Note on Daily Reflections linking:** The `linkTemplate` for `daily-reflections` is the static URL `https://www.aa.org/daily-reflections`. aa.org serves the current day's reflection server-side and does not expose a stable public URL for an arbitrary month/day, so DR results and the `/reflection` view always link to that single URL rather than a date-specific deep link.

**Note on 12&12 copyright (launch decision):** Requires verification before launch. **Default for v1 if unresolved: ship as `snippet`** (~30-word fair-use excerpt). If later confirmed public domain, upgrade to `full-text`. For protected `snippet` results, the external action offers either a **purchase link** (`officialUrl`) or a **web-search passthrough** — a link of the form `https://www.google.com/search?q=aa+12x12+{{query}}` opened in the user's default browser — so the user can find the fuller context themselves without us reproducing it. Do not assume PD; verify per CORPUS-GUIDE.

### 6.5 Corpus File Schema
```json
[
  {
    "id": "string — unique passage ID, stable, used in deep-link URLs",
    "sourceId": "string — foreign key to sources.json",
    "title": "string — chapter name, section title, or date",
    "sequence": "number — for ordering within source",
    "date": "string | null — ISO date, DR entries only",
    "pageRef": "string | null — page number reference (e.g. 'p.58')",
    "chapterRef": "string | null — chapter name",
    "text": "string — full text (indexed; display controlled by displayMode)",
    "linkData": "object | null — key/value pairs interpolated into linkTemplate"
  }
]
```

---

## 7. Data & Search

### 7.1 No Database in v1
There is **no D1 database and no server-side search** in v1. The corpus lives entirely in the repository as JSON (§6.5) and is compiled into a static, prebuilt search index at deploy time. All search runs client-side via `minisearch`. The only server-side component is a thin logging function (§7.4).

### 7.2 Prebuilt Search Index
A build script (`npm run build:index`) reads `/corpus/sources.json` + every `/corpus/sources/<id>.json` and emits static assets into the app's `static/index/` directory:

- `minisearch.json` — the serialized `minisearch` index (fields indexed: `text`; stored/returned: `id`, `sourceId`). Built deterministically so output is stable across runs given the same input.
- `passages.json` — an `id → passage` lookup containing display metadata (`title`, `sequence`, `date`, `pageRef`, `chapterRef`, `sourceId`) plus the `text` needed to compute KWIC client-side.
- `index-meta.json` — `{ "version": "<contentHash>", "builtAt": "<iso>", "sources": [...] }`. The `version` is a hash of the corpus inputs, used for cache-busting (§7.6).

The app loads these once on startup, hydrates `minisearch` from `minisearch.json` (no client-side indexing cost), and keeps them in a Svelte store. They are pre-cached by the service worker for offline use.

### 7.3 Search Behavior
- Phrase search (`"quoted"`) → exact-phrase match; keyword search → AND across terms (§4.2)
- Results grouped by source in `sortOrder`; result count per group
- KWIC snippet + `<mark>` highlighting computed client-side per `displayMode` (§8.4 table)
- 150ms debounce; the same code path runs online and offline — **no result-ordering drift**

### 7.4 Usage Logging (anonymous, offline-queued)
Goal: visibility into **what users search**, to guide future corpus and feature work. **Usage data only — never user data.**

- On each *submitted* search (Enter / explicit submit, not every keystroke), enqueue a record `{ q, resultCount, sourceFilter, ts }` in IndexedDB.
- A flush routine `POST`s queued records to a **Cloudflare Pages Function `/api/log`** whenever the app is online (on load, on `online` event, and after each submit if connected), then clears the queue on success.
- `/api/log` appends to **Cloudflare KV** (or Pages Analytics custom events). It stores **only** the query string, result count, optional source filter, and a server-side timestamp.
- **Explicitly not collected:** IP address, user agent, any identifier, cookies, geolocation. No correlation across requests.
- If the user is permanently offline or `/api/log` is unreachable, records simply remain queued (capped, FIFO-evicted) — logging failure must never affect search UX.
- A short note in About / a privacy line discloses that anonymous search terms are recorded to improve the app.

### 7.5 Offline Strategy
- On install, Workbox pre-caches: app shell (HTML/CSS/JS), `static/index/*` (the prebuilt index + passages + meta).
- Search, KWIC, highlighting, topic browse, and DR browsing all work fully offline against the cached index.
- **Online-only actions degrade gracefully:** any action that requires the network (the `/api/log` flush, following an external "Read at aa.org →" / purchase / web-search link) must detect offline state and **inform the user** ("You're offline — this link needs an internet connection") rather than failing silently. Queued log records flush automatically when connectivity returns.
- Connectivity is surfaced in the nav (online/offline badge, §8.4).

### 7.6 Index Versioning & Cache Busting
- `index-meta.json` carries a content-hash `version`. On startup (when online) the app fetches `index-meta.json` (network-first, tiny) and compares to the cached version.
- If the version changed, the app refreshes the cached `static/index/*` and prompts a light "Updated library available — refresh" affordance. Corpus sources only ever **expand**; a few transiently stale results between deploys are acceptable.
- The service worker uses `@vite-pwa/sveltekit` versioned precache for the app shell; the index assets use a network-first-then-cache strategy keyed on `version`. Keep it pragmatic — no elaborate diffing.

---

## 8. UI / Design Direction

### 8.1 Design Principles
- **The text is the hero.** The UI exists to surface words, not to decorate them. Every chrome element should justify its presence.
- **Readable at a glance.** Results must be scannable — keyword highlighted, source clearly labeled, context generous.
- **Calm, not clinical.** Recovery literature carries weight. The aesthetic should feel considered and steady, not sterile or corporate.
- **Accessible.** Minimum AA contrast ratios, visible keyboard focus, reduced-motion respected, screen-reader friendly result cards.

### 8.2 Design Tokens (confirmed)
These values are confirmed through the `proto/google-oneshot` prototype and should be used directly.

- **Type:** System sans-serif (or Inter) for body; a restrained serif (Lora or Playfair Display) for headings, the logo monogram, and result card chapter labels. The serif nods to the age and gravity of the texts.
- **Icon library:** `lucide-svelte` — lightweight, consistent stroke width
- **Palette (light mode)**
  - Background body: `#F8F7F4` (off-white parchment)
  - Text primary: `#1A1A1A` (near-black)
  - Primary / nav active: `#2C4A6E` (muted navy)
  - Keyword highlight background: `#FFF4DC` (warm parchment)
  - Keyword highlight text / accent: `#C8902A` (warm gold)
  - Card background: `#FFFFFF`
  - Muted text: `stone-500`
  - Borders: `stone-200`
  - Nav background: `stone-50/90` with `backdrop-blur`
- **Palette (dark mode)**
  - Background body: `slate-950` (`#0F1923`)
  - Text primary: `slate-200` (`#E8E6E1`)
  - Active state: `slate-800` background, `#C8902A` / `amber-500` text
  - Keyword highlight background: `amber-950/40`
  - Keyword highlight text: `amber-400`
  - Card background: `slate-900/40`
  - Muted text: `slate-400`
  - Borders: `slate-800`
  - Nav background: `slate-950/90` with `backdrop-blur`
- **Signature element:** The `<mark>` highlight — `#C8902A` text on `#FFF4DC` background with a subtle `border-bottom: 1px solid rgba(200,144,42,0.3)`. It should feel like a physical highlighter on an old page, not a browser find-in-page blue. This is the one distinctive visual moment.
- **Border radius:** `rounded-sm` (4px). Cards feel like pages, not bubbles.
- **Shadows:** `shadow-sm` on cards; no heavy drop shadows.
- **Max widths:** `max-w-6xl` for the search/results view; `max-w-4xl` for content pages (Reflection, Sources, About)
- **Transitions:** `transition-colors duration-200` on all theme-sensitive containers
- **Text selection:** `background: #FFF4DC; color: #C8902A` (gold-on-parchment, matches the highlight)
- **Motion:** `animate-fade-in` on view mount. No bouncing. Respect `prefers-reduced-motion`.

### 8.3 Key Screens
1. **Home** — search bar (prominent), today's DR teaser card, topic chips
2. **Search results** — source group headers, KWIC result cards with highlight + share/copy, filter bar
3. **Passage detail** — full passage (public domain) or concordance view (protected) + navigation to adjacent passages
4. **Today's Reflection** — date display, title, KWIC preview, link to aa.org, date picker
5. **Sources** — source registry cards with copyright info and links
6. **About** — legal, attribution, open source, how to contribute

---

### 8.4 UI Component Patterns

The `proto/google-oneshot` prototype validated the core UI patterns described in §8.1–8.3. The patterns below are confirmed and should guide the SvelteKit implementation. Use the prototype as a live visual reference; do not copy its service worker, search logic, or framework code.

**Navigation bar**
- Sticky top with `backdrop-filter: blur` and a bottom border
- Logo: navy square badge with serif italic "bt" monogram + "basictexts.org" wordmark; sub-label "AA Concordance" in small-caps below
- Nav links: Concordance · Daily Reflection · Topics · Sources · About (with `lucide-svelte` icon per item)
- Active item: navy background / white text (light mode); `slate-800` background / gold text (dark mode)
- Online/offline badge: green + Wifi icon when online; amber + WifiOff + pulse animation when offline
- Theme toggle: sun/moon icon, right of nav
- Mobile: hamburger → slide-down overlay menu

**Search component (`/` route)**
- Welcome header (app name, tagline, description) visible only when query is empty; hidden once user types
- 56px-tall single-line input; search icon on left, clear (×) button on right when query is non-empty
- Source filter bar always visible below the search input — one toggle button per source with colored dot + `shortTitle`
  - All sources selected by default
  - Prevent deselecting the last remaining source (keep ≥ 1 selected at all times)
- Quick-access topic chips visible below filter bar only when query is empty; "Browse All A-Z →" link at end of chip row navigates to `/topics`
- Empty state when search returns no results: friendly message + suggested topic chips

**Topic chips (confirmed set)**
Acceptance · Resentment · Fear · Gratitude · Humility · God · Honesty · Anger · Ego · Self

**Result cards**
- Source badge: 8×8px colored dot (from `source.color`) + `shortTitle` in semibold
- Chapter / section label or date label below the badge
- KWIC passage rendered as sanitized HTML — escape raw text first, then inject `<mark>` tags
- **Accessibility:** each `<mark>` carries a visually-hidden label (e.g. `<mark><span class="sr-only">match: </span>word</mark>`) or an equivalent `aria` treatment so screen readers announce highlighted terms; highlight is never conveyed by color alone (the bottom-border + weight provide a non-color cue)
- Copy button: copies `"[clipped/full text per displayMode]"\n— [shortTitle], [chapter/title][, pageRef]\n(via basictexts.org)` to clipboard; shows ✓ for 2 s
- Share button: Web Share API with clipboard-URL fallback; shows ✓ for 2 s
- For `concordance-only`: "Read at [source] →" external link is **mandatory and visually prominent** (not secondary)
- **Copyright guard on copy:** for `concordance-only` and `snippet` passages, the copy action must copy only the clipped KWIC snippet — never the raw full `text` field
- **Online-only link guard:** external links ("Read at aa.org →", purchase, web-search passthrough) require connectivity; when offline, intercept the click and show "You're offline — this link needs an internet connection" instead of a dead navigation

**KWIC rendering — client responsibilities (no server in v1)**

All rendering is client-side. The `displayMode` field is the copyright gate at the **render and copy** layer: protected text is in the cached index (it must be, to be searchable offline) but is **never rendered in full and never copied in full**.

| Mode | Client renders | Copy / share |
|---|---|---|
| `full-text` | Full passage with `<mark>` highlights | Full text + citation |
| `snippet` | Text clipped to `contextWords` each side + `...`, with `<mark>` highlights + external link | Clipped snippet + citation only |
| `concordance-only` | Text clipped to `contextWords` each side + `...`, with `<mark>` highlights + **mandatory** external link | Clipped snippet + citation only |

**Copyright posture (client-side reality):** With no server, the protected text necessarily ships inside the cached index for offline search. The guarantee we enforce is that protected sources are **never rendered or copied in full** — only the KWIC window is ever shown or placed on the clipboard, and a prominent link drives the user to the official source. Every code path that touches passage text must branch on `displayMode`. This mirrors how other concordances surface protected works.

**Daily Reflection view (`/reflection`)**
- Previous / next day navigation buttons flank the current date display
- `<input type="date">` for direct date selection; date kept in `?date=MM-DD` URL param
- If no corpus entry for a date: show "No reflection available for [date]" — do not substitute another date's content
- External link to `https://www.aa.org/daily-reflections` is always visible and prominent (today's reflection only — no date-specific deep link exists)
- Display structure: date label → title → KWIC teaser → external link; never full reflection text

**Dark mode implementation**
- Detect via `window.matchMedia('(prefers-color-scheme: dark)')` on first render
- Persist user override to `localStorage` key `basictexts-theme` (`'dark'` | `'light'`)
- Apply by toggling `.dark` class on `<html>`; configure Tailwind with `darkMode: 'class'`
- All color transitions: `transition-colors duration-200`

**PWA install prompt**
- Listen for `beforeinstallprompt` event; store the deferred prompt
- Show "Install App" button in the search welcome header when prompt is available
- On click: call `prompt()`, clear stored reference when `outcome === 'accepted'`
- If prompt unavailable: show browser-specific "Add to Home Screen" guidance

---

## 9. Non-Goals (v1)

These are explicitly out of scope for MVP. Document them so the agent doesn't build them:
- User accounts, login, or authentication
- Bookmarks, highlights, or personal notes (v2 with Supabase)
- NA, Al-Anon, OA, or other fellowship literature (v2 — corpus files can be added, but don't build UI for it yet)
- Additional daily-reading sources (v2 — registry-ready, not built for v1): Al-Anon daily readers, *As Bill Sees It*, Hazelden's *Twenty-Four Hours a Day*. These fit the existing source-registry model and can be added later without code changes; do not source, ingest, or surface them in v1.
- Push notifications
- Community features (forums, sharing with specific users)
- Native iOS/Android apps (PWA is sufficient)
- Admin dashboard for corpus management (manage via GitHub + build script)
- Internationalization / non-English texts

---

## 10. Open Questions (resolve before or during build)

| # | Question | Priority | Notes |
|---|---|---|---|
| 1 | Is the 12&12 public domain? | Resolved default | **Ship `snippet` if unverified.** Verify per CORPUS-GUIDE; upgrade to `full-text` only on confirmed PD. |
| 2 | Are the Twelve Traditions (standalone) PD? | High | Likely yes — same vintage; treat the short list separately from 12&12 discussion |
| 3 | Does AAWS need to be notified? | **High / blocking for DR** | DR ingestion (Q4) is gated on this. Email ippolicy@aa.org (concordance-only, links back) before shipping DR. App can launch without DR if unresolved. |
| 4 | Daily Reflections corpus source? | High | Need clean machine-readable text; gated on Q3. If unresolved, launch with `daily-reflections` `enabled: false`. |
| 5 | Domain registration | **Done** | ✅ basictexts.org registered at Cloudflare Registrar |
| 6 | License for the repo | Low | MIT recommended (maximally permissive, fits the spirit of the project) |

---

## 11. Implementation Phases

> The detailed, work-unit-level breakdown lives in `docs/plans/basic-texts-implementation-plan.md`. The phases below are the high-level milestones.

### Phase 1 — Foundation (data + search core)
> **Design reference:** `proto/google-oneshot` is a working React/Vite prototype of the complete UI. Use it for visual design and component behavior reference as you build each SvelteKit equivalent. See §8.4 for the specific patterns to carry forward. Do not deploy it or adapt its service worker.

- [ ] Scaffold SvelteKit + TypeScript + Tailwind + `@vite-pwa/sveltekit`
- [ ] Define registry/passage/result TypeScript types (§6)
- [ ] Load Big Book 1st Edition corpus into `/corpus/sources/`
- [ ] `npm run build:index` prebuild script → `static/index/*` (§7.2)
- [ ] Client-side `minisearch` search service + KWIC/highlight per `displayMode`
- [ ] Functional search results page

### Phase 2 — PWA & Offline
- [ ] `@vite-pwa/sveltekit` manifest, icons, precache (app shell + index)
- [ ] Index versioning / cache-busting via `index-meta.json` (§7.6)
- [ ] Online/offline detection + online-only link guards (§7.5)
- [ ] Verify install prompt on Android and iOS; verify offline search

### Phase 3 — Full Corpus & UI
- [ ] Ingest remaining v1 sources (12&12 `snippet`, Traditions, DR `concordance-only` if Q3/Q4 resolved)
- [ ] DR home teaser card + `/reflection` route (date nav, no-substitution rule)
- [ ] Source filter bar, topic chips, `/topics` browse
- [ ] Apply design tokens, light/dark theme toggle
- [ ] KWIC highlight rendering + accessibility treatment
- [ ] Copy / Share (Web Share API) with copyright guard
- [ ] Known-exceptions hints (§4.7)

### Phase 4 — Logging, Polish & Launch
- [ ] `/api/log` Pages Function + Cloudflare KV; IndexedDB queue + flush (§7.4)
- [ ] `/sources` page + `/about` page (disclaimer, privacy line, Ko-fi/GitHub Sponsors reserved space)
- [ ] Deep-link URLs for search and passage detail (`/passage/<sourceId>/<passageId>`)
- [ ] Accessibility audit (contrast, keyboard nav, screen reader, reduced-motion)
- [ ] README + CONTRIBUTING.md; LICENSE (MIT)
- [ ] Connect Cloudflare Pages to GitHub; deploy to basictexts.org

---

## 12. Agent Implementation Notes

When implementing this PRD, the agent should:

1. **Read this document fully before writing any code.** Architecture decisions here are intentional and interdependent.
2. **Start with the source registry and the prebuilt-index pipeline** before building any UI. The data model is the foundation.
3. **The `displayMode` field is load-bearing.** Every place that renders or copies passage text must check `displayMode` and apply the correct path. Never render or copy full text for a `concordance-only` (or `snippet`) source.
4. **No server-side search in v1.** Search is client-side `minisearch` against a prebuilt static index. The only server code is the thin `/api/log` Pages Function (usage logging only — §7.4). Do not introduce D1, a search Worker, or any `/api/search` endpoint.
5. **Use TypeScript throughout.** Type the source registry, passage schema, search results, and log records explicitly.
6. **Corpus files are source of truth.** The prebuilt index (`static/index/*`) is a derived artifact — always rebuildable from `/corpus/` via `npm run build:index`. Document this clearly.
7. **Do not implement v2 features.** No auth, no user tables, no bookmarks, no extra daily-reading sources. If the schema tempts you to add them, resist.
8. **Test offline before declaring PWA done.** Chrome DevTools → Network → Offline. Every search should return cached results; every online-only link should warn instead of failing.
9. **`proto/google-oneshot` is a design reference, not deployable code.** The prototype uses React/Vite (wrong stack), has no backend, and uses a hand-rolled service worker that won't survive a production Vite build. Use it for: component interaction patterns, design token confirmation, KWIC rendering logic, and UI layout. Do not copy the service worker, search implementation, or `package.json`. Known prototype bugs to avoid replicating: Daily Reflection fallback silently substitutes the wrong date's content; copy handler copies full protected text regardless of display mode; `CMD+K` hint is displayed but not wired up.

---

## 13. Reference Links

- UI prototype (design reference only): `proto/google-oneshot` — see §8.4 for what to carry forward
- 164andMore (existing concordance, print/Kindle): https://www.164andmore.com
- Anonymous Press (public domain Big Book text): https://anonpress.org/bb
- AA Daily Reflections: https://www.aa.org/daily-reflections
- AAWS copyright policy: https://www.aa.org/terms-of-use
- Cloudflare Pages docs: https://developers.cloudflare.com/pages
- Cloudflare Pages Functions: https://developers.cloudflare.com/pages/functions
- Cloudflare KV docs: https://developers.cloudflare.com/kv
- minisearch docs: https://lucaong.github.io/minisearch
- SvelteKit docs: https://kit.svelte.dev
- vite-plugin-pwa: https://vite-pwa-org.netlify.app
- Workbox: https://developer.chrome.com/docs/workbox
- PWABuilder (optional App Store packaging): https://www.pwabuilder.com

---

*This document is the single source of truth for the basictexts.org MVP. All implementation decisions should trace back to a requirement here. Anything not mentioned is out of scope for v1.*