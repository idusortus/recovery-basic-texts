# Proposal: Fix PWA icon

## Why

The installed Progressive Web App shows the wrong brand mark. The web-manifest icons
served from `static/icons/icon-192.png` and `static/icons/icon-512.png` are gray squares
with a white "P", while the in-app brand mark is a navy rounded square with a white,
serif-italic, lowercase "bt" (`src/lib/components/Nav.svelte` and `src/routes/+page.svelte`).
This promotes item 2.2 of the `product-backlog` change, which reads:

> PWA icon should match the 'bt' mobile icon — currently a gray square with a white "P".
> Done when the installed PWA icon (192/512px and maskable) shows the navy "bt" monogram,
> not the gray "P".

Because the manifest currently reuses the single 512px "any" bitmap for the `maskable`
purpose, a corrected monogram would be clipped by Android's icon mask even after the gray
"P" is replaced; the fix therefore has to cover the maskable safe zone as well.

## What Changes

- **Replace the faulty bitmap icons** so the 192×192 and 512×512 manifest icons render the
  navy "bt" monogram (navy `#2C4A6E`, white serif italic), matching the in-app mark.
- **Add a dedicated maskable icon** (`static/icons/icon-maskable-512.png`) on a full-bleed
  navy background with the monogram inside the central safe zone, and point the manifest's
  `purpose: 'maskable'` entry at it instead of reusing `icon-512.png`.
- **Add an `apple-touch-icon`** (`static/icons/apple-touch-icon.png`, 180×180) and reference
  it from `src/app.html`, so iOS home-screen installs show the brand mark rather than a
  screenshot or the stale favicon.
- **Make the icon set reproducible**: commit the SVG source(s) for the monogram under
  `assets/pwa/` and a small generation script (`scripts/generate-pwa-icons.mjs`, wired as
  `pnpm run icons:pwa`) that rasterizes the committed PNGs, so the bitmaps can be
  regenerated from scratch rather than re-drawn by hand.
- **Update `vite.config.ts`** manifest wiring: the maskable entry points at the new
  maskable asset; the "any" entries keep their 192/512 paths.

Non-goals:

- Not regenerating `static/favicon.ico` (a browser-tab favicon, not the install icon named
  by backlog item 2.2). Regenerating it would require `.ico` tooling; it is left as-is and
  noted as a possible follow-up.
- Not changing service-worker caching, search, or any other app behavior.
- Not adding a runtime dependency; any rasterizer used is a build-time/dev-only tool.
- Not adding auth, accounts, bookmarks, or non-AA content (MVP guardrails in `AGENTS.md`).

## Capabilities

### New Capabilities

- `pwa-icon`: The installed web app's icons — the manifest's 192×192, 512×512, and maskable
  entries plus the apple-touch-icon — show the navy "bt" monogram, stay inside the maskable
  safe zone, and are reproducible from a committed source.

### Modified Capabilities

- None. No existing capability's requirements change (`corpus-integrity`,
  `feedback-to-github`, and `search-quality` are unaffected).

## Impact

- **Static assets:** `static/icons/icon-192.png`, `static/icons/icon-512.png` (replaced),
  new `static/icons/icon-maskable-512.png` and `static/icons/apple-touch-icon.png`, new SVG
  sources under `assets/pwa/`.
- **Config:** `vite.config.ts` (manifest `icons` entry for the maskable purpose).
- **App shell:** `src/app.html` (add the `apple-touch-icon` link).
- **Tooling:** new `scripts/generate-pwa-icons.mjs`, a `package.json` script, and a
  dev-only rasterizer dependency (e.g. `sharp@0.34.5`, already present in the lockfile); a
  PNG-shape test script.
- **No runtime/API/data changes.** No corpus, registry, search, or service-worker logic is
  touched, and no new network behavior is introduced.
