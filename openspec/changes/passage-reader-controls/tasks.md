# Tasks

> Tasks tagged **manual (browser)** need a running browser session (the "Aa"
> panel, applied sizes, focus/keyboard behavior, audio playback) and have no
> component/visual harness in this repo, so they must be left unchecked honestly
> if not run (see `decisions.md` 2026-09-30). Automatable (no browser): 1.1, 1.2,
> 3.1, 3.2, 5.3, 5.4.

## 1. Reader preferences — pure module and tests

- [ ] 1.1 Add `src/lib/passage/reader-prefs.ts` (pure, no runtime imports),
      exporting `READER_PREFS_KEY = 'basictexts-reader-prefs'`,
      `DEFAULT_READER_PREFS = { fontSize: 'default', lineSpacing: 'normal' }`,
      the `'default' | 'large' | 'larger' | 'largest'` and
      `'normal' | 'relaxed'` step types, `parseReaderPrefs(raw)`,
      `serializeReaderPrefs(prefs)`, `stepFontSize(current, delta)`, and the
      resolvers (`default`/`normal` → `null` = no override; `large` → 1.125rem,
      `larger` → 1.25rem, `largest` → 1.5rem; `relaxed` → 2.0). Parsing is
      defensive (absent/blank/bad JSON/wrong shape/unknown enum → defaults).
      Verify with the task-1.2 test.
- [ ] 1.2 Add `scripts/test-reader-prefs.mjs` (`pnpm run test:reader-prefs`)
      importing the module directly via
      `await import('../src/lib/passage/reader-prefs.ts')` (the
      `scripts/test-url-state.mjs` pattern) and add the `test:reader-prefs`
      entry to `package.json`. Cover: key constant; defaults; `default`/`normal`
      resolve to no override; steps strictly increase; `stepFontSize` clamps at
      both ends and returns to default; defensive parse cases; serialize↔parse
      round-trip; and a source scan asserting no `fetch`/`enqueueLog`/
      `sendBeacon` (local-only contract). Verify the script exits 0.

## 2. Reader preferences — passage-page control

- [ ] 2.1 In `src/routes/passage/[sourceId]/[passageId]/+page.svelte`, inside the
      existing `{#if source.displayMode === 'full-text'}` body region, add the
      "Aa" reading-settings affordance: a `role="group"`
      `aria-label="Reading settings"` containing "Decrease text size" /
      "Increase text size" buttons (disabled at the ends as a non-color cue), a
      line-spacing toggle with `aria-pressed`, and a visible + announced current
      step label (polite live region). Keep it keyboard-operable and do not use
      color alone for state. **manual (browser)** — verify tab order, labels,
      `aria-pressed`, disabled end states, and that state is legible without
      color.
- [ ] 2.2 Read `localStorage[READER_PREFS_KEY]` in `onMount` (Svelte's `onMount`,
      i.e. client-only) via `parseReaderPrefs`, hold the preference in `$state`,
      and write it back via `serializeReaderPrefs` on change; treat storage
      read/write failures as default/no-op (never throw). **manual (browser)** —
      change a setting, reload, and verify it is still applied; verify in a
      storage-disabled context that the page still works.
- [ ] 2.3 Apply the resolved `font-size` and `line-height` as inline styles on
      the passage body elements only (the passage `<p>`s inside the `full-text`
      branch), leaving the existing `leading-relaxed`/inherited size in place at
      the default step. Do not style the citation header, actions, match/
      navigation controls, or the protected branch. **manual (browser)** —
      verify the body resizes while the chrome does not, and that the default
      step leaves text size/leading unchanged.
- [ ] 2.4 Confirm the preference does not disturb the existing query highlight,
      entry scroll/focus, or match navigation. **manual (browser)** — load a
      passage URL with a query, change the reading setting, and verify the
      highlight, centered scroll/focus, and Previous/Next match controls still
      behave as before.

## 3. Listen — pure module and tests

- [ ] 3.1 Add `src/lib/passage/tts.ts` (pure, no runtime imports), exporting
      `isTtsSupported(win)` (true only when a window-like object provides a
      `speechSynthesis` object and a callable `SpeechSynthesisUtterance`),
      `canOfferListen(displayMode, supported)` (`full-text` **and** supported),
      `buildSpeechText(passageTexts)` (trim/filter blanks, preserve order), and
      `splitSpeechChunks(text, maxChars = 200)` (sentence-boundary chunks that
      never exceed `maxChars`). Verify with the task-3.2 test.
- [ ] 3.2 Add `scripts/test-tts.mjs` (`pnpm run test:tts`) importing the module
      directly and add the `test:tts` entry to `package.json`. Cover:
      `isTtsSupported` true only with both APIs and false for
      `undefined`/missing/spoofed; `canOfferListen` false for non-`full-text`
      even when supported; `buildSpeechText` trims/filters/preserves order;
      `splitSpeechChunks` respects `maxChars`, preserves content, and handles an
      overlong unbroken run; and a source scan asserting no `fetch`/
      `XMLHttpRequest`/`sendBeacon`. Verify the script exits 0.

## 4. Listen — passage-page control

- [ ] 4.1 In `src/routes/passage/[sourceId]/[passageId]/+page.svelte`, inside the
      `full-text` branch, render the Listen control only when
      `canOfferListen(source.displayMode, isTtsSupported(window))` is true
      (evaluate the support check client-side on mount); when unsupported,
      render no control and do not error. **manual (browser)** — verify the
      control appears on a full-text passage and is absent on a
      `snippet`/`concordance-only`/protected passage, and that deleting
      `window.speechSynthesis` before load removes it with no error.
- [ ] 4.2 Wire play/pause/stop: build the speech text from the rendered body
      only — `buildSpeechText(chapterPassages.map((p) => p.text))` for the
      chapter view and `buildSpeechText([passage.text])` for a single passage —
      chunk via `splitSpeechChunks`, `speak()` the queue, `pause()`/`resume()`
      the toggle, and `cancel()` on Stop and in `onDestroy` (client navigation
      destroys the route). Announce state via a polite live region and a
      non-color control state. **manual (browser)** — verify play, pause/resume,
      stop, and that navigating away stops playback.
- [ ] 4.3 Confirm Listen makes no network request and reads only the rendered
      full-text passage (no protected text, no hidden content), and that it does
      not disturb match navigation/focus. **manual (browser)** — use the control
      with DevTools Network open (expect no request), on a query URL with
      multiple matches, and on a protected passage (no control).

## 5. Validation and guardrails

- [ ] 5.1 Verify the `displayMode` guard holds for both features: the control
      markup and the speech-text source live only in the `full-text` branch, and
      no protected/snippet/concordance-only source can render or speak full
      text. **manual (browser)** — inspect each source kind's passage page.
- [ ] 5.2 Verify no auth/accounts/bookmarks/notes and no transmission: the only
      new persistence is the namespaced `basictexts-reader-prefs` key; there is
      no account, sync, network call, or usage-log involvement. **manual
      (browser)** — inspect `localStorage` and the Network panel.
- [ ] 5.3 Run the new scripts (`pnpm run test:reader-prefs`,
      `pnpm run test:tts`) alongside the existing `test:*` scripts and verify
      they pass.
- [ ] 5.4 Run `pnpm run check` and `pnpm run build`, then run
      `openspec validate passage-reader-controls --strict` and verify the change
      reports as valid.
