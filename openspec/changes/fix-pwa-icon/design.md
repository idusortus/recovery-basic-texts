# Design

## Context

See `proposal.md` — Why. Current state that shapes the approach, verified against the repo:

- `vite.config.ts` uses `SvelteKitPWA` and declares three manifest icons: `/icons/icon-192.png`
  (192×192), `/icons/icon-512.png` (512×512), and `/icons/icon-512.png` again with
  `purpose: 'maskable'`. Manifest `theme_color` is `#2C4A6E` and `background_color` is
  `#F8F7F4`.
- `static/icons/icon-192.png` and `static/icons/icon-512.png` are the faulty bitmaps
  (`file` reports 192×192 and 512×512, 16-bit RGB): a gray square with a white "P".
- The intended mark is rendered as live text in the app: `src/lib/components/Nav.svelte`
  lines 68–72 draw `<span class="… rounded bg-navy text-white font-serif italic …">bt</span>`
  (navy `#2C4A6E`, white, Lora serif italic, lowercase "bt"). `src/routes/+page.svelte`
  (~line 547) renders the same mark.
- Brand tokens: `tailwind.config.ts` and `src/app.css` define `navy: #2C4A6E` and
  `serif: 'Lora', Georgia, Cambria, serif`. Lora is loaded from Google Fonts in `app.html`,
  so it is not guaranteed to be installed as a system font on a build machine.
- `src/app.html` references only `%sveltekit.assets%/favicon.ico`; it has no
  `apple-touch-icon`. The PWA plugin injects the manifest link.
- `package.json` has no image tooling and no icon script. `sharp@0.34.5` is present in the
  pnpm lockfile, so it is present in the pnpm store but is not resolvable as a top-level
  import.
- `globPatterns` already precache `client/**/*.png`, so any PNG added under `static/icons/`
  is precached automatically.

## Goals / Non-Goals

**Goals:**

- Serve the navy "bt" monogram from every install surface the manifest and app shell control
  (192, 512, maskable, apple-touch).
- Make the maskable artwork mask-safe rather than reusing the "any" bitmap.
- Keep the icon set regenerable from a committed source with one documented command.
- Keep the change dependency-light and build-time only.

**Non-Goals:**

- Not regenerating `static/favicon.ico` (browser-tab favicon, not named by backlog item 2.2);
  it is left untouched and called out as a follow-up.
- Not touching service-worker caching behavior, the search worker, or any runtime code.
- Not introducing a runtime dependency or a design-system icon pipeline beyond this mark.
- Not changing `theme_color` / `background_color` or any other manifest field.

## Decisions

### Author the mark as a committed SVG source; derive the PNGs

The source of truth is committed SVG under `assets/pwa/`; the shipped PNGs are rasterized
from it. Alternative considered: edit the existing PNGs directly. Rejected — hand-edited
bitmaps are not regenerable, drift from the in-app mark, and would have to be re-authored at
each size. The SVG also lets us express the maskable variant as the same monogram with
different padding.

### Two SVG sources: an "any" mark and a padded maskable mark

`assets/pwa/icon.svg` is the navy rounded square with the monogram at a launcher-comfortable
size; `assets/pwa/icon-maskable.svg` is a full-bleed navy square with the monogram scaled
down into the central 80% safe zone. Alternative considered: one padded SVG used for both
purposes. Rejected — the "any" icon would then look small and loose in launchers, and a
single unpadded bitmap for `maskable` is exactly the defect being fixed (the monogram would
be clipped by Android's mask). Keeping two explicit files matches the "flat, explicit" bias.

### `sharp` as a dev-only dependency, driven by a committed script

`scripts/generate-pwa-icons.mjs` reads the committed SVGs and writes the four PNGs; it is
wired as `pnpm run icons:pwa` and `sharp` is added as a direct `devDependency`. Alternatives
considered: an external CLI (`rsvg-convert`, ImageMagick) — not guaranteed to be installed,
so regeneration is not reproducible; `pnpm dlx` at run time — needs the network and is not
hermetic; committing PNGs with no source — not regenerable. `sharp@0.34.5` is already
present in the pnpm lockfile/store, so promoting it to a direct devDependency adds no new
download and keeps the toolchain Node-native. Rendering is pinned via the lockfile.

### Outline the "bt" glyphs so rasterization is font-independent

The SVG carries the "bt" as vector outlines rather than live `<text>` in Lora. Lora is a
webfont loaded in the browser, not a system font on the build machine; a `<text>` element
would render with a fallback serif (or nothing) when sharp rasterizes it. Outlining the
glyphs once at authoring time (from Lora Italic) makes the committed PNGs identical on any
machine. Alternative considered: bundle/install the Lora TTF in the script. Rejected — adds
a font download/install step and a licensing surface for a one-time authoring need.

### Add a 180×180 apple-touch-icon, generated from the maskable source

iOS ignores manifest icons; without an `apple-touch-icon` it falls back to a screenshot or
the favicon. The apple-touch PNG is generated from `icon-maskable.svg` (opaque full-bleed
navy, monogram in the safe zone) because iOS applies its own corner rounding and handles
opaque artwork best. Alternative considered: skip iOS and ship manifest icons only. Rejected
— it leaves the most common install surface (iOS home screen) with the wrong mark.

### Retarget only the `maskable` manifest entry

The "any" entries keep their existing `/icons/icon-192.png` and `/icons/icon-512.png` paths
and their default purpose; only the `maskable` entry changes its `src` to
`/icons/icon-maskable-512.png`. Alternative considered: rename all icon files to force cache
busting. Rejected as unnecessary churn — the service worker precache already versions via
the generated SW, and the paths are stable. The apple-touch link is added to `src/app.html`
under the assets path. No other manifest field changes.

### Rasters are 8-bit RGBA; "any" corners stay transparent

Rounded-square corner transparency on the "any" icons lets the launcher background show
through, matching how the in-app chip reads against any surface. The current files are
16-bit RGB; the regenerated ones are 8-bit RGBA for broad launcher support. The maskable
and apple-touch icons are fully opaque navy.

## Risks / Trade-offs

- [sharp's SVG renderer differs across versions/platforms, so a future regeneration could
  shift anti-aliasing] → Pin sharp via the lockfile, commit the produced PNGs (they are what
  ships), and keep regeneration a maintenance action; the checklist test asserts dimensions
  and palette, not pixel-identity.
- [The one-time glyph outlining is manual and easy to get wrong] → Commit the outlined SVG
  as the source of truth; the script only rasterizes and never re-typesets, so the pipeline
  is stable once the SVG is correct.
- [The 80% safe-zone estimate is approximate across launchers] → Keep the monogram well
  inside the central 80% and add a checklist scenario that masks the canvas to a centered
  80% shape and checks the monogram is unclipped.
- [iOS caches apple-touch-icons aggressively] → Ship the correct icon once; if it must
  change again, rename the file (e.g. add a version suffix) rather than reusing the path.
- [Adding a devDependency conflicts with "dependency-light"] → sharp@0.34.5 is already in
  the lockfile and is dev-only, so it adds no new download and no runtime weight; the
  alternative tools are less reproducible.

## Migration Plan

No data or API migration. Land the SVG sources, script, generated PNGs, `vite.config.ts`
maskable retarget, and the `app.html` apple-touch link together. After deploy, already
installed instances may keep the old icon until the browser refreshes the manifest and icon
cache; a fresh install or cache clear shows the monogram. Rollback is a revert of the same
files.

## Open Questions

- Whether to also refresh `static/favicon.ico` from the same mark is deferred: it is a
  browser-tab favicon, outside backlog item 2.2's done-when condition, and would need `.ico`
  tooling. Not resolving it does not change these specs, the approach, or the task breakdown.
