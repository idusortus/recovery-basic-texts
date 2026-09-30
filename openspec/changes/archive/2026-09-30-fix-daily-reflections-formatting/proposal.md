# Proposal: Fix Daily Reflections formatting

## Why

The Daily Reflections (DR) surface reproduces the day's protected reflection prose.
The home "Today's Reflection" card prints a 250-character quoted lead excerpt of the entry's
`text` (`reflectionTeaser(todaysReflection.text, 250)` in `src/routes/+page.svelte`), which is
neither link-forward nor the concordance-only window the source's `displayMode` requires.
Meanwhile `/reflection` is a bare client-side redirect (`window.location.replace` + a
`<meta http-equiv="refresh">` to `https://www.aa.org/daily-reflections`) that does nothing
useful when AAWS is unreachable. This promotes backlog item 2.1 in
`openspec/changes/product-backlog/tasks.md`: make the concordance view link-forward rather than
reproducing the day's text, with local display limited to the concordance-only KWIC teaser for
the date's indexed entry, and a defined fallback to that indexed entry when AAWS is unavailable.
`corpus/CORPUS-GUIDE.md` (Part 3, Source 3) and PRD §4.4/§8.4 already define the intent: index
the full text for search, never display or copy it, and always link to
`https://www.aa.org/daily-reflections`.

## What Changes

- **Stop reproducing the day's reflection text locally.** Replace the character-based
  `reflectionTeaser` lead excerpt on the home "Today's Reflection" card with the
  concordance-only KWIC teaser for the date's indexed DR entry, produced through the existing
  KWIC machinery (`buildKwicFromOffsets` with `displayMode: 'concordance-only'` and the
  source's `contextWords`). No new text source is introduced; the teaser is derived from the
  already-indexed entry.
- **Make the reflection surface link-forward.** The home card keeps (`/reflection` gains) a
  prominent, always-visible link to `https://www.aa.org/daily-reflections`, on the existing
  offline-aware external-link component so an offline click informs the user instead of
  failing silently.
- **Keep `/reflection` a client-side redirect while AAWS content is unfetched.** While online,
  `/reflection` continues to redirect to `https://www.aa.org/daily-reflections` (JS redirect
  plus meta-refresh fallback). No AAWS content is fetched, scraped, or embedded.
- **Add a defined AAWS-unavailable fallback.** When the client is offline (AAWS unreachable),
  `/reflection` does not attempt the redirect; it renders the indexed concordance entry for the
  date it is showing — date label, entry title, the concordance-only KWIC teaser, and the
  external link — with its existing offline link guard. If the index has no entry for that
  date, it shows "No reflection available for [date]" and does not substitute another date's
  content (PRD §4.4; the prototype bug called out in PRD §12).
- **Never copy full reflection text.** Any copy affordance on the DR surface is limited to the
  clipped KWIC teaser + citation (the same protected-clip rule the search results already
  enforce), never the entry's full `text`.

## Capabilities

### New Capabilities

- `daily-reflections-display`: How the Daily Reflections surface (the home "Today's Reflection"
  card and the `/reflection` route) presents a protected concordance-only source link-forward:
  the local display is limited to a KWIC teaser for the date's indexed entry, the official
  aa.org page is linked on the surfaces that render the reflection locally, `/reflection` stays
  a client-side redirect while online and no AAWS permission exists, and an offline fallback
  renders the indexed concordance entry for the date.

### Modified Capabilities

- None. No existing capability's requirements change: `search-quality` governs query-driven
  search results (unchanged — the DR KWIC path already clips correctly there) and
  `corpus-integrity` governs the corpus data (unchanged). This change is confined to the DR
  display surface, which no existing capability covers.

## Impact

- **Source (planned):** `src/lib/corpus/reflection.ts` (replace/augment `reflectionTeaser`
  with a KWIC-based teaser helper that resolves the source's `displayMode`/`contextWords`),
  `src/routes/+page.svelte` (home card renders the KWIC teaser + link, never the 250-char
  excerpt), and `src/routes/reflection/+page.svelte` (online redirect retained; offline
  fallback view added).
- **No corpus, index, or build change:** the DR corpus file and the prebuilt index are already
  in place; no `corpus/`, `static/index/*`, or `build:index` change is required. No AAWS
  fetching/scraping is added.
- **No API, database, dependency, or deployment-config change.** No new runtime dependency; the
  search/log worker path is untouched.
- **Planning-only:** this change creates artifacts under
  `openspec/changes/fix-daily-reflections-formatting/` only. Implementation happens later under
  a separate apply workflow.
- **Promotes backlog item 2.1** in `openspec/changes/product-backlog/tasks.md`, which the
  orchestrator annotates with `→ promoted to fix-daily-reflections-formatting` (this change does
  not edit the backlog).
