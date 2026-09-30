# Proposal: UX/QoL improvements

## Why

A surface-by-surface audit of the shipped app turned up a batch of small
usability gaps, accessibility rough edges, and defects that individually do not
justify their own change but collectively affect whether the tool is
trustworthy, shareable, and accessible. This change documents all of them with
observable contracts so each can be implemented and verified deliberately.

In-button copy/share confirmation is already required by PRD §8.4 ("shows ✓ for
2 s") and the implementation does not match it. A per-result passage deep link
extends PRD §3.3's deep-linkability — whose example is a search URL — to the
protected/snippet results that currently have no passage link. The rest are
found defects or quality-of-life additions.

## What Changes

**Quick wins**

- **Copy/Share confirm in place.** The Copy and Share controls on result cards
  and the passage page SHALL swap their own label to a confirmation (e.g.
  `Copied ✓`, `Link copied`) for a short period, not only fire a toast.
- **Legible exact-phrase state.** The control already has the visible label
  `Exact phrase` and `aria-pressed`, but its only on/off cue is the cryptic
  `""` / `"…"` glyph. Add a legible non-glyph state indicator (and keep the
  state from being conveyed by color alone).
- **Last-source toggle feedback.** The "cannot deselect the last source" rule is
  currently silent: the button looks pressable but does nothing. The blocked
  control SHALL indicate it cannot be deselected.
- **Install prompt initialized once.** `initInstallPrompt()` is called from both
  the root layout and the home page; listeners SHALL be registered once per load.
- **Zero-result message is not hidden by a hint.** A known-exception hint
  currently suppresses the "No results for …" confirmation; both SHALL show.

**Search & no-results**

- **Recover the zero-result state.** Offer "Try these searches" (topic chips) and
  at most one "Did you mean" drawn from the indexed term dictionary.
- **First-load index progress + retry.** Replace the static "Loading search
  index…" with advancing stages and a Retry affordance on failure.
- **Result heading semantics.** Each result exposes a heading (source/chapter
  line) below the group heading so screen-reader users can navigate by heading.
- **Filter toggles sync the URL and toggles are logged.** `toggleSource`
  currently re-runs search but never updates the URL or logs the state, so a
  filtered result set is not shareable and filtered searches are absent from the
  log. The phrase toggle already writes `phrase` to the URL, but neither toggle
  logs.
- **Wire the source link template.** `Source.linkTemplate` / `Passage.linkData`
  are parsed but unused; resolve `linkTemplate` (with `{{query}}`) into the
  non-full-text "Read at official source" action, falling back to `officialUrl`.
- **Keyboard shortcuts + hint.** Add `/` (focus search) and `?` (shortcut help)
  with a visible hint. Per the PRD warning, the hint SHALL NOT advertise an
  unwired shortcut.

**Passage, reflection & feedback**

- **Deep-link every result.** Expose "View passage"/"Share passage" for
  protected/snippet results too; the passage page already shows "Full text not
  available" and the official link for non-`full-text` sources.
- **Prev/Next match navigation.** Cycle `<mark>` occurrences on the passage
  page, centering each (`block: 'center'` — the sticky header makes `start`
  unsafe).
- **Contextual "Report this passage" links.** Prefill the existing anonymous
  `/feedback` form with passage ID, source ID, and query — no PII, no new
  submitted fields.
- **`/reflection` is reachable again.** The nav and home reflection CTAs link
  straight to external `aa.org`, so the offline concordance fallback never runs;
  point them at `/reflection`.

**Shell, a11y & analytics**

- **Styled error page.** Add `+error.svelte` consistent with the app shell so a
  404/500 is not SvelteKit's default unstyled page.
- **Nav/toast accessibility.** The mobile overlay gets Escape-to-close and a
  focus trap; the toast container stops duplicating each toast's live region.
- **Retire the public `/stats` surface.** `/stats` + `/api/stats` expose every
  logged query to anyone. They SHALL be removed; maintainer access becomes
  out-of-band. Anonymous logging itself is unchanged.

Non-goals:

- Not adding auth, accounts, bookmarks, or notes; the `/stats` mitigation removes
  a public surface rather than gating it behind a login (AGENTS.md guardrails).
- Not rendering protected/concordance-only full text anywhere, including the new
  passage links (item guardrail).
- Not changing the search algorithm, index format, corpus, or display-mode
  copy/render rules.
- Not adding non-AA content.
- Not editing `docs/plans/todo.md`; no item here duplicates a backlog entry.

## Capabilities

### New Capabilities

- `app-shell`: The app-wide shell guarantees: a styled error page for unhandled
  route errors/not-found, an accessible mobile navigation overlay, a single toast
  live region, and single registration of the PWA install prompt.
- `search-analytics`: Anonymous, offline-queued search logging for corpus and
  feature guidance, with the collected logs never exposed on a public,
  unauthenticated surface.

### Modified Capabilities

- `search-ui`: Adds filter URL sync + toggle logging, last-source disabled
  feedback, a legible exact-phrase state indicator, result heading semantics,
  zero-result recovery, index-load progress/retry, a display-mode legend, fully
  wired keyboard shortcuts, in-place copy/share confirmation, and `linkTemplate`
  resolution.
- `passage-view`: Broadens "View passage" to every result (from full-text only),
  adds in-place copy/share confirmation, and adds previous/next match navigation.
- `daily-reflections-display`: Routes the nav entry and home reflection CTAs
  through the in-app `/reflection` surface so the offline fallback is reachable.
- `feedback-to-github`: Adds contextual "Report this passage" links that prefill
  the existing three-field form with passage/source/query context and no PII.

## Impact

- **Search surface:** `src/routes/+page.svelte` (result cards, filter bar, phrase
  toggle, zero-result and loading/error states, legend, keyboard shortcuts),
  `src/lib/search/index.ts` (load progress/error state), `src/lib/search/suggestions.ts`
  (reused for the zero-result did-you-mean), a new in-place-confirmation helper.
- **Passage surface:** `src/routes/passage/[sourceId]/[passageId]/+page.svelte`.
- **Shell:** new `src/routes/+error.svelte`, `src/lib/components/Nav.svelte`,
  `src/lib/components/Toasts.svelte`, `src/routes/+layout.svelte`, and
  `src/lib/stores/install.ts` (idempotent install-prompt init).
- **Reflection:** `src/lib/components/Nav.svelte`, `src/routes/+page.svelte`.
- **Feedback:** `src/routes/+page.svelte`, the passage page, and
  `src/routes/feedback/+page.svelte`.
- **Analytics:** remove `src/routes/stats/+page.svelte` and
  `functions/api/stats.ts`.
- **Tests:** dependency-free tests for the new pure helpers (link-template
  resolution, URL-state serialization, zero-result suggestion selection), plus
  `pnpm run check`/`build`; UI tasks are `manual (browser)`.
- **No new runtime dependency, no schema/corpus change, no auth.** Logging
  (`functions/api/log.ts`) and the KV binding are unchanged.
