# Tasks

> Implementation status: tasks 1.1–5.1 are complete; 5.2 is a manual in-app
> verification step left for the user. Grouped by area; each task states its own
> verification.

## 1. Reflection helpers

- [x] 1.1 Add a KWIC-based teaser helper to `src/lib/corpus/reflection.ts` that takes the date's indexed entry `text`, the source `displayMode` (`concordance-only`) and `contextWords`, anchors on the entry's first indexed term, and delegates to `buildKwicFromOffsets` from `src/lib/search/kwic.ts` — done when the helper returns a bounded window (at most `contextWords` words each side of the anchor) and never returns the entry's full `text` (verified by the test in 4.1)
- [x] 1.2 Add a `getReflectionForDate(mmDd)` resolver in `src/lib/corpus/reflection.ts` and make `getTodaysReflection()` delegate to it with today's `MM-DD` key — done when both resolve the same entry for today and an explicit `MM-DD` resolves that date's entry (or `null` when absent)
- [x] 1.3 Keep the DR source's `displayMode`/`contextWords` read from the registry (`getSourceById('daily-reflections')`) rather than hard-coded — done when changing `contextWords` in `corpus/sources.json` changes the teaser bound with no code edit

## 2. Home "Today's Reflection" card

- [x] 2.1 Replace the `reflectionTeaser(todaysReflection.text, 250)` quoted excerpt in `src/routes/+page.svelte` with the KWIC teaser from 1.1 — done when the 250-character excerpt is gone and the rendered prose is a bounded KWIC window that is a strict subset of the entry `text`
- [x] 2.2 Keep the card link-forward: the existing "Read full reflection at aa.org →" link points to `https://www.aa.org/daily-reflections` via the offline-aware `ExternalLink` component — done when the link is visible with an entry present and an offline click shows the "You're offline" toast
- [x] 2.3 Ensure the card exposes no copy affordance that would place the entry's full `text` on the clipboard — done when the card has no full-text copy path (or any copy path uses `buildExcerpt`, which clips protected sources)

## 3. `/reflection` route: continue the redirect, add the AAWS-unavailable fallback

- [x] 3.1 Branch `src/routes/reflection/+page.svelte` on the `online` store: while online, keep the existing client-side redirect (JS `window.location.replace` plus `<meta http-equiv="refresh">`) to `https://www.aa.org/daily-reflections`; while offline, do not attempt the redirect — done when online `/reflection` navigates to aa.org and offline `/reflection` stays put
- [x] 3.2 Render the offline fallback from the local index: date label, entry title, the KWIC teaser from 1.1, and the official link with the offline guard — done when offline `/reflection` shows the indexed entry for the date with no network access
- [x] 3.3 Resolve the fallback date from `?date=MM-DD` when present and valid, otherwise from today, reusing 1.2 — done when `?date=06-28` offline shows the June 28 entry and an invalid/missing param shows today
- [x] 3.4 When the local index has no entry for the date, show "No reflection available for [date]" and substitute no other date's content — done when an absent-date offline load shows that message and no reflection text or title

## 4. Tests

- [x] 4.1 Add `scripts/test-reflection.mjs` (dependency-free, using the existing `scripts/search-test-loader.mjs` pattern) covering: the teaser window is at most `contextWords` words each side of the anchor; the full `text` is never returned for a long entry; a short entry is still not reproduced in full; `getReflectionForDate` resolves an explicit `MM-DD` and returns `null` for an absent date; and the no-entry fallback produces no reflection text — done when `node scripts/test-reflection.mjs` passes
- [x] 4.2 Assert the DR surface fetches nothing from aa.org: the only aa.org reference in the changed modules is a navigation link/redirect, with no fetch/scrape call — done when a check of the changed files shows no aa.org request path and the offline test renders from the local index alone

## 5. Verification

- [x] 5.1 Run `npm run check`, `npm run lint`, `node scripts/test-reflection.mjs`, and `npm run test:search` — done when `npm run check`, `node scripts/test-reflection.mjs`, and `npm run test:search` pass and `npm run lint` reports no NEW errors (the 4 pre-existing errors in unrelated files are out of scope for this change)
- [ ] 5.2 Manually verify in the running app (light and dark): the home card shows only a bounded KWIC teaser and links to aa.org; online `/reflection` redirects; offline `/reflection` shows the indexed entry for the date; an absent date shows the no-availability message; no full reflection text is visible anywhere — done when each is observed
