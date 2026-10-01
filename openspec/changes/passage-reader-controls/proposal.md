# Proposal: Passage reader controls

## Why

The passage page renders full chapters of public-domain AA literature, but it
offers no reading-comfort controls and no way to listen to the text. Readers who
need larger type, looser leading, or text-to-speech must zoom the whole page
(which also enlarges the chrome) or leave the app. Two small, self-contained
additions — reader preferences (font size + line spacing) and Listen
(text-to-speech) — make the full-text passage page usable by more people without
touching search, the corpus, or copyright boundaries.

## What Changes

- **Reader preferences.** Add a small, accessible "reading settings" control
  (an "Aa" affordance that opens a labeled group) to the passage page for
  `full-text` sources only. It adjusts the **passage body** font size across a
  few steps and toggles line spacing (normal / relaxed). Preferences persist in
  `localStorage` under a namespaced key; no account, no sync. The default step
  does not override body text size, so the browser/user's own settings win until
  the reader explicitly changes something. The control is keyboard-operable, its
  group is labeled, and state is not conveyed by color alone.
- **Listen (text-to-speech).** Add a "Listen" control to the passage page for
  `full-text` sources only, using the browser `speechSynthesis` API — no
  external service, no network request, no data sent. It plays/pauses the
  rendered passage text, announces playback state accessibly, and stops on
  unmount/navigation. It reads only the rendered passage text, never protected
  text and never hidden content. When `speechSynthesis` is unavailable, no
  working control is shown (the affordance is absent or clearly disabled) and
  nothing errors.
- **No change to existing passage behavior.** Query-term highlighting, the
  entry scroll/focus, match navigation, and copy/share are unchanged; both
  features are gated to `full-text` sources and do not conflict with the
  existing match/scroll state.

Non-goals:

- No authentication, accounts, bookmarks, notes, or highlights (AGENTS.md).
- No persistence beyond browser-local reader preferences (a namespaced
  `localStorage` key) and the existing URL state. Reader preferences are
  deliberately distinct from the highlight/focus state, which remains URL-only.
- No full-text rendering or speech for protected, `snippet`, or
  `concordance-only` sources; the existing `displayMode` guard is unchanged.
- No external TTS service, network call, or data transmission.
- No rate/pitch/voice control in this change (deferred to keep MVP scope
  narrow); no visual redesign, no change to the search surface, corpus, index,
  or source registry.

## Capabilities

### New Capabilities

- None. Both features are passage-page behaviors and are homed in the existing
  `passage-view` capability (see design.md — capability mapping).

### Modified Capabilities

- `passage-view`: adds (as new `ADDED` requirements, altering no existing
  requirement) reader preferences for the full-text passage body and a
  text-to-speech "Listen" control, both gated to `full-text` sources and both
  preserving the existing highlight/focus/match/copy behavior.

## Impact

- **Passage page** (`src/routes/passage/[sourceId]/[passageId]/+page.svelte`):
  the "Aa" reading-settings group and its applied body styles, plus the Listen
  control and its playback lifecycle, both inside the existing
  `source.displayMode === 'full-text'` branch.
- **New pure helpers (testable):** `src/lib/passage/reader-prefs.ts`
  (namespaced key, step/default resolution, defensive parse/serialize) and
  `src/lib/passage/tts.ts` (a browser-API support/gating predicate and speech
  text/chunk assembly) — no runtime imports, importable by a dependency-free
  Node script.
- **Tests:** new dependency-free `pnpm run test:reader-prefs` and
  `pnpm run test:tts` scripts in `package.json`, matching
  `scripts/test-url-state.mjs`. Visual/audio behavior (the "Aa" panel, applied
  sizes, actual speech output) is verified `manual (browser)` — this repo has no
  headless browser.
- **Corpus / schema / index / dependencies / API:** none. No new runtime
  dependency, no corpus or registry change, no logging change, no server code.
