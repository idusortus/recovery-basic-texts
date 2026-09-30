# Design

## Context

See `proposal.md` — Why. Current state that shapes the approach (read-only findings):

- **Home card reproduces text.** `src/routes/+page.svelte` (Today's Reflection card,
  ~lines 462–515) calls `getTodaysReflection()` and renders
  `reflectionTeaser(todaysReflection.text, 250)` inside quotes — a 250-character lead excerpt of
  the protected entry's `text`, plus a "Read full reflection at aa.org" link, and a no-entry
  fallback card.
- **`/reflection` is a bare redirect.** `src/routes/reflection/+page.svelte` (28 lines) does
  `window.location.replace('https://www.aa.org/daily-reflections')` in `onMount` and adds a
  `<meta http-equiv="refresh">` fallback. It has no offline behavior and no local view.
- **Helpers.** `src/lib/corpus/reflection.ts` provides `getTodaysReflection()` (matches
  `sourceId === 'daily-reflections'` by the `MM-DD` `date` field), a character-based
  `reflectionTeaser(text, maxChars = 200)`, and `formatReflectionDate(mmDd)`.
- **KWIC machinery already clips protected sources.** `src/lib/search/kwic.ts` exposes
  `buildKwicFromOffsets(text, offsets, displayMode, contextWords, anchorOffset)` and
  `buildExcerpt(...)`; for `concordance-only` it keeps `contextWords` words on each side of the
  match, and `enforceProtectedClip` guarantees the full text is never rendered even for short
  passages. `buildExcerpt` returns the clipped window for protected sources. The search service
  already uses these (`src/lib/search/index.ts`).
- **Source registry.** `corpus/sources.json` lists `daily-reflections` with
  `displayMode: "concordance-only"`, `contextWords: 8`, `linkTemplate`/`officialUrl` both
  `https://www.aa.org/daily-reflections`, and no `freeUrl`.
- **Corpus + index are in place.** `corpus/sources/daily-reflections.json` holds 366 entries
  (`dr-MM-DD`); the prebuilt local index already contains them. No new text source is needed.
- **Offline plumbing exists.** `src/lib/stores/online.ts` is a readable store tracking
  `navigator.onLine`; `src/lib/components/ExternalLink.svelte` intercepts clicks when offline
  and shows "You're offline — this link needs an internet connection."
- **Constraints (unchanged):** no AAWS permission is assumed, so no fetching/scraping
  (`corpus/CORPUS-GUIDE.md` Part 3, Source 3; backlog 2.1 NOTE); no auth/accounts; protected
  sources are never rendered or copied in full (`AGENTS.md`); `/reflection` stays a client-side
  redirect while online unless/until permission exists.

## Goals / Non-Goals

**Goals:**

- Remove the local reproduction of the day's reflection prose from the DR surface.
- Render the date's indexed DR entry as a bounded concordance-only KWIC teaser produced by the
  existing KWIC machinery.
- Keep the reflection surface link-forward, and keep `/reflection` a client-side redirect while
  online with no AAWS permission.
- Provide a defined offline fallback that renders the indexed concordance entry for the date,
  with no date substitution.

**Non-Goals:**

- No fetching, scraping, or embedding of AAWS content (see proposal Non-goals and
  `corpus/CORPUS-GUIDE.md`); no assumption of AAWS permission.
- Not building the full PRD §4.4 reflection browser: no previous/next-day navigation and no
  calendar picker in this change. Only the fallback view for the date in context is in scope.
- No change to the DR corpus, the prebuilt index, the search/deep-link behavior, usage logging,
  or any other source's display.
- No new runtime dependency, API, database, or deployment-config change.

## Decisions

### Area 1 — Keep `/reflection` as the online redirect; add an offline fallback branch

- **Recommended:** `/reflection` branches on the existing `online` store. When online, it
  performs the current client-side redirect (JS `window.location.replace` plus the
  `<meta http-equiv="refresh">` fallback) — unchanged. When offline (AAWS unreachable), it
  skips the redirect and renders the local fallback view for the date in context. This is the
  only reading that satisfies both the backlog's "`/reflection` stays a client-side redirect"
  and "when AAWS is unavailable it falls back to the indexed concordance entry."
- **A. Replace the redirect with a full local reflection browser.** Rejected: contradicts the
  explicit redirect constraint, and the PRD §8.4 reflection browser (date nav, picker) is out of
  MVP scope for this bug.
- **B. Always redirect (no fallback).** Rejected: fails the backlog's "falls back to the indexed
  concordance entry for that date."
- **C. Probe aa.org availability with a fetch.** Rejected: fetching AAWS content is exactly what
  the permission constraint forbids; `navigator.onLine` is the available, permitted signal.

The date in context resolves from `?date=MM-DD` when present (so the PRD §8.4 shareable date
param is honored in the fallback), otherwise from today. This reuses the existing `MM-DD` keying
in `getTodaysReflection`; a sibling resolver takes an explicit `MM-DD` key.

### Area 2 — Derive the teaser from the KWIC machinery, not a character slice

- **Recommended:** Replace the character-based `reflectionTeaser` usage with a KWIC teaser built
  from the date's indexed entry via `buildKwicFromOffsets(entry.text, offsets, displayMode,
  contextWords, anchorOffset)`, where `displayMode`/`contextWords` come from the
  `daily-reflections` registry entry and the anchor is the first indexed term of the entry's
  `text`. `enforceProtectedClip` then guarantees a short entry is still not reproduced in full.
  Reusing the search KWIC path means one clipping rule for DR everywhere and no new text source.
- **A. Anchor on the entry's title terms when present, else the first term.** Considered; more
  "keyword"-like, but ~43/366 titles contain no title word in the text, so it would fall back to
  the first term anyway and adds a code path for no observable gain. Deferrable (Open Questions).
- **B. Render no prose (title + date + link only).** Rejected: PRD §8.4 and the backlog done-when
  both call for a KWIC teaser, and it would drop the useful "which reflection is this" cue.
- **C. Keep `reflectionTeaser(text, 250)`.** Rejected: that is the bug — it reproduces a large
  slice of the protected text and ignores `displayMode`/`contextWords`.

Where the surface offers no copy action (as today), requirement 2 is satisfied by having no
full-text copy path; if a copy action is ever added it must use `buildExcerpt`, which clips for
protected sources.

### Area 3 — No new text source; render from the local index only

- **Recommended:** The fallback and the home card resolve the entry from the already-loaded
  local `passages` lookup (via `getPassages()`), exactly as `getTodaysReflection` does today.
  Nothing is fetched from aa.org to render; aa.org appears only as a user-navigated link. This
  keeps the change data-free and honors the permission constraint.
- **A. Fetch the day's reflection from aa.org when online and render it locally.** Rejected: the
  forbidden behavior; also reproduces protected text.

### Area 4 — Link-forward presentation and offline link guard

- **Recommended:** Keep the existing "Read full reflection at aa.org →" link on the card and use
  the existing `ExternalLink` component for it (and in the fallback view), so an offline click
  shows the offline toast rather than a dead navigation. When online, `/reflection` redirects to
  the same URL.
- **A. Plain `<a>` links.** Rejected: loses the offline guard already built for online-only
  links (PRD §7.5).

## Risks / Trade-offs

- **[Renders less than before, which may read as "emptier"]** → The KWIC teaser plus title, date,
  and the prominent official link still orient the user, and the change is explicitly
  link-forward; the PRD prescribes this structure (§8.4).
- **[`navigator.onLine` can be true while aa.org is unreachable]** → The fallback is keyed on the
  client's offline signal, not a content probe (probing is forbidden). A reachable-but-failing
  aa.org redirect simply lands the user on aa.org's own error page; no protected text is
  involved. Acceptable for MVP.
- **[Anchor choice could show an unintuitive window]** → Anchor on the entry's first indexed
  term, which for DR is the opening of the entry and reads naturally; the exact anchor is a
  deferrable tuning detail and does not change the bounded-window requirement.
- **[`?date=` parsing drift from the PRD]** → Support only `MM-DD` validation (fall back to today
  on anything else); prev/next navigation is explicitly out of scope.
- **[Short entries could still be fully shown]** → `enforceProtectedClip` excludes at least one
  word when a window would cover the whole text, so the full `text` is never reproduced; a test
  asserts this for a short fixture entry.
- **[The DR source is already ingested and enabled while its AAWS permission is unresolved]** →
  `corpus/sources.json` enables `daily-reflections` (366 entries, `concordance-only`) and the
  prebuilt index already contains them, but `corpus/CORPUS-GUIDE.md:125-130` gates DR ingestion
  on an AAWS reply and says to exclude DR at launch if permission is declined or unanswered.
  This change surfaces that inherited gap by making the surface strictly link-forward and
  redirect-only while online, but it neither resolves nor assumes away the permission question:
  if AAWS declines, disabling/removing the DR source from the corpus is a separate corpus-level
  follow-up outside this change's scope.

## Migration Plan

No data migration and no index rebuild — the DR corpus and prebuilt index are unchanged.
Implementation order: (1) add a KWIC-teaser helper and an explicit-date resolver to
`src/lib/corpus/reflection.ts`; (2) switch the home card to the teaser + link; (3) branch
`/reflection` on the `online` store to redirect-or-fallback; (4) add tests and verify in the
running app. Rollback is `git revert`; nothing derived is regenerated.

## Open Questions

- Whether to anchor the KWIC teaser on the entry's first indexed term or on a title term when
  one appears in the text. The observable bounded-window guarantee is unchanged either way, so
  this can be decided during implementation.
- Exact visual placement of the link relative to the teaser on the home card is a styling
  detail, not a behavioral one.
