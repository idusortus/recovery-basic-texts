# Design

## Context

See `proposal.md` — Why. Current state and constraints that shape the approach:

- **The passage page is the only surface that renders full text.** In
  `src/routes/passage/[sourceId]/[passageId]/+page.svelte`, everything that
  renders passage text is inside `{#if source.displayMode === 'full-text'}`:
  the chapter view renders every `chapterPassages` entry as a `<p id="passage-…">`
  (`~L325-345`), the single-passage view renders `passage.text` (`~L347-355`),
  and the other branch (`~L358-376`) renders only "Full text not available" and
  the official-source link. This is the `displayMode` guard, and it is the same
  place both new controls must live.
- **Existing paragraph styling.** Chapter/single paragraphs already carry
  `text-[#1A1A1A] dark:text-slate-200 leading-relaxed` (`~L333`, `~L348`).
  `leading-relaxed` is Tailwind `line-height: 1.625`, so the page has a defined
  default leading to preserve.
- **Highlight/focus/match behavior is load-bearing.** The page derives
  `query`/`phrase` from the URL, highlights via `analyzePassage` +
  `buildFullTextHighlight`, and runs `applyQueryFocusAndScroll()` /
  `collectMatches()` / `goToMatch()` (`~L177-218`). The new controls must not
  interfere with the DOM structure those functions query (`main` → `mark`,
  `#passage-{id}`) or with focus.
- **Local-persistence precedent.** `search-ui`'s recent searches (and the theme)
  already use namespaced `localStorage` keys via a pure helper module plus a thin
  component adapter (`src/lib/search/recent-searches.ts`,
  `RECENT_SEARCH_KEY = 'basictexts-recent-searches'`; theme key
  `basictexts-theme`). Reader preferences follow that pattern.
- **Test seam precedent.** Pure, import-free modules under `src/lib/` are
  imported directly by dependency-free Node scripts (`scripts/test-url-state.mjs`
  `await import('../src/lib/search/url-state.ts')`); there is no headless
  browser, so visual/audio behavior is `manual (browser)`.
- **Guardrails.** `AGENTS.md` forbids auth/accounts/bookmarks/notes and forbids
  rendering full text for sources whose `displayMode` is not `full-text`.
  `passage-view`'s "Highlight and focus state are reproducible from the URL"
  requirement makes the **URL the only persistence for the highlight/focus
  state**; the guardrail requirement forbids new accounts/bookmarks/notes.

## Goals / Non-Goals

**Goals:**

- Add reader display preferences that affect only the full-text passage body and
  default to no override, so the browser's own text size wins until changed.
- Add a Listen control backed solely by the browser speech-synthesis API, read
  only the text the page renders for a full-text source, and stop on leave.
- Both features gated to `full-text` sources, both keyboard- and
  screen-reader-accessible, neither disturbing highlight/focus/match behavior.
- Factor the decision-making logic into pure, dependency-free modules with
  `pnpm run test:*` coverage.

**Non-Goals:**

- No new capability. One standing requirement is carried as `MODIFIED` only to
  scope its storage ban (see below) — no existing prohibition is dropped, and no
  new account/bookmark/note is introduced.
- No rate/pitch/voice control (deferred), no visual redesign, no new runtime
  dependency.
- No external TTS service, no network, no transmission of preferences.
- No passage body styles applied to the protected branch or to page chrome.

## Decisions

### Both features belong to `passage-view`; no new capability; one scoping MODIFY

The behavior is entirely about the passage page: rendering controls around the
passage body and reading that body aloud. `passage-view` already owns passage
page rendering, the `full-text`-only guard, highlight/focus, match navigation,
and copy/share, so these requirements extend it. `search-ui` owns the search
surface (`openspec/specs/search-ui/spec.md`), `app-shell` owns app-wide shell
chrome; neither owns passage-page rendering, and placing these there would split
one page's behavior across specs.

The two features themselves are **new concerns layered on** existing behavior, so
they are `## ADDED Requirements`. The delta is **not** ADDED-only, however: the
standing guardrail requirement "Passage rendering stays within the MVP
guardrails" has a scenario (`No persistence beyond the URL is introduced`) whose
THEN says "no storage beyond the URL is used". Namespaced `localStorage` for
reader preferences would falsify that clause if read literally, so the delta
carries a `## MODIFIED Requirements` block for that requirement. The MODIFIED
copy reproduces the requirement text and **every** existing scenario with its
header literally unchanged, keeps every existing prohibition
(no full text for non-`full-text` sources; no auth/accounts/bookmarks/notes; no
non-AA content), and only scopes the storage sentence: the storage ban applies to
the **highlight/focus state** (still URL-only), while ONE namespaced,
device-local, never-transmitted **display-preference** key is explicitly
permitted. Alternatives considered: a new `passage-reader-controls` capability
(rejected — it would fragment passage-page behavior and duplicate the
`passage-view` purpose); modifying `search-ui` (rejected — wrong surface);
putting the Listen control in `app-shell` (rejected — it is not shell chrome);
leaving the guardrail untouched and hoping it is read loosely (rejected — the
scoping decision belongs in the artifact, not at implementation time).

### Reader preferences: one pure module + a thin localStorage adapter

New pure, import-free module `src/lib/passage/reader-prefs.ts`:

| Constant / value | Definition |
|---|---|
| `READER_PREFS_KEY` | `'basictexts-reader-prefs'` (namespaced, matching `basictexts-theme` / `basictexts-recent-searches`) |
| Stored shape | JSON `{"fontSize":"<step>","lineSpacing":"<step>"}` |
| `fontSize` steps | `'default' \| 'large' \| 'larger' \| 'largest'` |
| Resolved font size | `default → null` (no override); `large → 1.125rem`; `larger → 1.25rem`; `largest → 1.5rem` |
| `lineSpacing` steps | `'normal' \| 'relaxed'` |
| Resolved line height | `normal → null` (no override); `relaxed → 2.0` |
| `DEFAULT_READER_PREFS` | `{ fontSize: 'default', lineSpacing: 'normal' }` |

Exports: `READER_PREFS_KEY`, `DEFAULT_READER_PREFS`, the step arrays/types,
`resolveReaderPrefs(partial)` (clamps unknown/missing enum members to the
default), `parseReaderPrefs(raw)` (defensive: absent/blank/invalid JSON/wrong
shape → defaults), `serializeReaderPrefs(prefs)`, `stepFontSize(current, delta)`
(clamps at both ends), and the two resolvers
(`fontSizeRem`, `lineHeightValue`, returning `null` when no override applies).

Semantics:

- **Default = no override.** `default` font size and `normal` line spacing
  resolve to `null`, so the component applies **no inline style** at the
  default and the existing `leading-relaxed` and the user/browser text size are
  untouched. Overriding body text size happens only after an explicit step.
- **Line-spacing semantics (resolved).** Font size always defers to the
  browser/user's own setting until the reader steps it. Spacing's `normal` means
  "no override", which keeps the page's **existing `leading-relaxed` (1.625)**;
  `relaxed` applies an explicit `line-height: 2.0`. So `normal` is not the
  browser's literal default leading but the page's own current leading — chosen
  so the default appearance is byte-for-byte unchanged and only an explicit
  change restyles the body.
- **Body only.** Resolved values are applied as inline `font-size` /
  `line-height` on the elements that render the passage body (the passage
  `<p>`s), inside the `full-text` branch only. The citation header, actions,
  match/navigation controls, and the protected branch are never targeted, so
  chrome is unaffected.
- **Bindable, independent axes.** Font size and line spacing resolve
  independently, so either can be changed without touching the other; at the
  default the style binding is empty.
- **Return to default.** `default` is the bottom font-size step, so stepping
  down from `large` reaches it; `stepFontSize` clamps (no wrap) at both ends.
- **Persistence when storage is available.** The component reads the key on
  mount, applies via `parseReaderPrefs`, and writes via `serializeReaderPrefs` on
  change. When storage is unavailable (private mode/disabled), the pref still
  works in memory for the session and a write is a no-op — a read falls back to
  defaults and a write never throws, exactly like recent searches, so the page
  never breaks. No network, no account, no sync, no usage-log involvement.
- **Application timing.** Read and apply on mount (the page already loads its
  index client-side), so the default state renders first and the persisted
  preference is applied without an SSR mismatch.

The control is an "Aa" toggle that opens a labeled group (`role="group"` with
`aria-label="Reading settings"`): "Decrease text size" / "Increase text size"
buttons, a line-spacing toggle with `aria-pressed`, a visible and announced
current-step label (a polite live region), and `aria-pressed`/state text so state
is never color-only. At the end steps the decrease/increase buttons are kept
**focusable** and marked with `aria-disabled="true"` (plus the muted visual
style) rather than the `disabled` attribute, so they are not removed from the tab
order; the live-region step label announces the boundary state (e.g. "Smallest
size" / "Largest size") so the end condition is conveyed without relying on color
or on the element disappearing from the tab order. Alternatives considered: a
per-passage inline font-size (fragments state across paragraphs);
storing a single numeric scale (harder to clamp/default and to read in
`localStorage`); CSS classes toggled on `<html>` (would style chrome too, and
fights the theme class); `sessionStorage` (does not survive the next visit).

### Listen: pure capability/support gating + a thin speech adapter

New pure, import-free module `src/lib/passage/tts.ts`:

- `isTtsSupported(win)` — a predicate over an injected window-like object:
  `true` only when the object provides a `speechSynthesis` object and a
  callable `SpeechSynthesisUtterance`. Pure, so a dependency-free test can feed
  fake/absent APIs and cover graceful degradation without a browser.
- `canOfferListen(displayMode, supported)` — the gating predicate:
  `displayMode === 'full-text' && supported`. Encodes the `full-text` guard and
  the support guard in one testable place.
- `buildSpeechText(passageTexts)` — trims/filters blank entries and joins them
  in rendered order. Given only the passage text the full-text branch already
  renders, it cannot include protected or hidden content.
- `splitSpeechChunks(text, maxChars = 200)` — splits the text on sentence
  boundaries into chunks no longer than `maxChars`, so a long chapter is queued
  as several utterances (some engines truncate a single very long utterance).

The component's thin adapter holds the `speechSynthesis` reference and
playback state:

- **Play** builds `buildSpeechText(...)` **only from the `full-text` branch's
  rendered values** — `chapterPassages.map(p => p.text)` for the chapter view, or
  `[passage.text]` for a single full-text passage — chunks it, and `speak()`s the
  queue. **Pause** calls `pause()`; **Play** while paused calls `resume()`.
  **Stop** calls `cancel()`.
- **Stopping is not `onDestroy`-only.** `onDestroy` does **not** fire on
  same-route navigation: chapter/passage nav links navigate within
  `[sourceId]/[passageId]`, so SvelteKit reuses `+page.svelte` and only the
  params change. Relying on `onDestroy` alone would let speech keep reading the
  previous passage into the next one. Playback is therefore also stopped/reset
  whenever the driving params change: in `loadPassage` (`~+page.svelte:96`), in
  the reactive `$effect` that loads the passage (`~:81-84`), and in
  `afterNavigate` (`~:91-94`). `onDestroy` keeps its `cancel()` as the last-resort
  cleanup for a true unmount (leaving the route entirely); the param-change
  stops cover within-route navigation, and both satisfy the spec scenario
  "Playback stops when leaving the page".
- **State is announced** with an `aria-live="polite"` status ("Listening" /
  "Paused" / "Stopped") and a pressed/toggle state on the control, plus a
  non-color label/icon change.
- **Graceful degradation.** The support check runs client-side on mount. When
  unsupported, the control is **not rendered at all** (the spec allows absent or
  clearly-disabled) so no dead control or error appears. Alternative considered:
  rendering a disabled control with an explanation (rejected as visual noise for
  a capability the browser simply lacks, and against the calm-design guidance).
- **No conflict with match navigation.** Listen only calls the speech API; it
  never moves focus, scrolls, or restructures the DOM that
  `collectMatches`/`goToMatch` operate on.

Rate/pitch/voice control is explicitly deferred (see proposal non-goals), so the
control surface stays small.

### Full-text gating and content scope are enforced at the render branch

Both controls are placed inside the existing
`{#if source.displayMode === 'full-text'}` region (the body and action rows
already live there). The protected/`snippet`/`concordance-only` branch renders
only "Full text not available" and the official-source link, so it has no
control and no speech source.

The speech source is gated by `displayMode` **explicitly**, not by the
`chapterPassages` array. `chapterPassages` is populated by
`src.copyright === 'public-domain'` (`~+page.svelte:116-122`), which is a
*different* field from `displayMode`; today public-domain implies `full-text`,
but the two must not be conflated. Therefore the Listen control is rendered only
when `canOfferListen(source.displayMode, isTtsSupported(window))` is true, and
the utterance text is built **only inside the `full-text` branch** from the same
values that branch renders (`chapterPassages` / `passage.text`) — never from the
index at large and never from a protected source. `test:tts` asserts this: the
component source is scanned to confirm the Listen control and the
`buildSpeechText` call appear only within a `displayMode === 'full-text'` region
and that the call is guarded by `canOfferListen`.

### Posture on the existing URL-only persistence requirement

`passage-view`'s "Highlight and focus state are reproducible from the URL"
requirement makes the URL the only persistence for the **highlight/focus
state**, and the guardrail requirement forbids accounts/bookmarks/notes. Reader
preferences are a distinct concern (display comfort), stored under a namespaced,
device-local key, and never persist or alter the highlight/focus state, which
remains URL-only; no account/bookmark/note is added.

Because the guardrail requirement's `No persistence beyond the URL is introduced`
scenario says flatly "no storage beyond the URL is used", this delta **does not
leave that to implementation-time judgement**: it carries a `## MODIFIED
Requirements` block for that requirement. The block reproduces the requirement
text and both existing scenario headers verbatim, keeps every prohibition, and
rewords only that scenario's THEN so the storage ban is scoped to the
highlight/focus state and explicitly permits a single namespaced, device-local,
never-transmitted display-preference key. There is no open question left here —
the scoping decision is made in the artifact.

### Testing strategy

- `src/lib/passage/reader-prefs.ts` and `src/lib/passage/tts.ts` are pure and
  import-free, so two new dependency-free scripts import them directly:
  `scripts/test-reader-prefs.mjs` (`pnpm run test:reader-prefs`) and
  `scripts/test-tts.mjs` (`pnpm run test:tts`), following
  `scripts/test-url-state.mjs` / `scripts/test-recent-searches.mjs`.
  - reader-prefs: key constant; defaults; `default`/`normal` resolve to no
    override; steps strictly increase; `stepFontSize` clamps at both ends and
    can return to default; defensive parse (null/blank/bad JSON/wrong shape/
    unknown enum → default); serialize↔parse round-trip; a source scan asserting
    the module contains no `fetch`/`enqueueLog`/`sendBeacon` (local-only
    contract).
  - tts: `isTtsSupported` true only with both APIs present, false for
    `undefined`/missing/spoofed; `canOfferListen` false for non-`full-text` even
    when supported; `buildSpeechText` trims/filters blanks and preserves order;
    `splitSpeechChunks` never exceeds `maxChars`, preserves content, and handles
    an overlong unbroken run; a source scan asserting no network primitives; and
    a component scan asserting the Listen control / `buildSpeechText` call is
    gated on `canOfferListen(source.displayMode, …)` and lives inside the
    `displayMode === 'full-text'` region (the explicit displayMode gate, not the
    `copyright`-derived `chapterPassages`).
- The applied visual sizes, persistence across reload, keyboard operation, and
  the actual audio play/pause/stop are `manual (browser)` — this repo has no
  headless browser. Graceful degradation is verified manually by removing the
  API (e.g. `delete window.speechSynthesis` before load) in addition to the pure
  predicate test.

## Risks / Trade-offs

- [Storing preferences locally could be read as conflicting with the standing
  "URL is the only persistence" requirement] → resolved in the artifact: the
  delta carries a `MODIFIED` copy of the guardrail requirement whose no-storage
  scenario is scoped to the highlight/focus state (still URL-only) and explicitly
  permits one namespaced, device-local, never-transmitted display-preference key.
  No prohibition is dropped.
- [`normal` line spacing maps to "no override", which keeps the page's existing
  `leading-relaxed` (1.625), not the browser's literal default] → decided in the
  design (see "Line-spacing semantics (resolved)"): the default appearance is
  byte-for-byte unchanged and only an explicit change restyles the body.
- [`onDestroy` does not fire on same-route chapter/passage navigation, so
  `cancel()` there would not stop speech when only the params change] → playback
  is also stopped/reset on every driving-param change (`loadPassage` / the load
  `$effect` / `afterNavigate`), so speech never continues into the next passage;
  `onDestroy` remains the true-unmount cleanup.
- [`speechSynthesis.pause()`/`resume()` is implemented inconsistently on some
  engines] → the design uses the standard API and, if a target browser ignores
  pause during implementation testing, falls back to `cancel()` +
  resume-from-current-chunk; this changes no spec behavior.
- [Some engines truncate a single very long utterance] → `splitSpeechChunks`
  queues sentence-sized utterances; covered by a pure test.
- [Inline body styles could accidentally hit chrome or the highlight markup] →
  styles are applied only to the passage `<p>` elements inside the `full-text`
  branch; the highlight is rendered inside those paragraphs and is unaffected by
  inherited font size/leading.
- [`localStorage` unavailable (private mode/disabled)] → read falls back to
  defaults and write is a no-op; the page and both controls still work.
- [Persisted preferences could render before hydration and mismatch SSR] →
  state starts at `DEFAULT_READER_PREFS` and storage is read in `onMount`; the
  passage body is not rendered until the client-side index loads anyway.

## Migration Plan

No data, schema, dependency, corpus, or index migration. Changes are confined to
`src/routes/passage/[sourceId]/[passageId]/+page.svelte`, two new pure modules
under `src/lib/passage/`, two new test scripts, and two `package.json`
`test:*` entries. Rollback is reverting those files; the only residual browser
state is the namespaced `basictexts-reader-prefs` key, which is inert once the
feature is removed.

## Open Questions

- None. The persistence-scope question is resolved by the `MODIFIED` guardrail
  requirement in this change (the storage ban is scoped to the highlight/focus
  state; one namespaced display-preference key is explicitly permitted), and the
  line-spacing semantics are resolved in the reader-preferences decision above
  (`normal` = no override, keeping the page's existing `leading-relaxed`).
