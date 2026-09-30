# pwa-icon Specification

## Purpose

Defines what the installed web app's icon set must show: the navy "bt" brand monogram at
every declared size, a maskable variant whose monogram survives the launcher mask, an
apple-touch-icon for iOS installs, and icons that can be regenerated from a committed
source rather than redrawn by hand.

## Requirements

### Requirement: 192×192 and 512×512 manifest icons show the navy "bt" monogram

The web app manifest SHALL declare a 192×192 and a 512×512 icon, both `image/png` and
carrying no `maskable` purpose. The artwork served for both SHALL be the brand monogram — a
navy (`#2C4A6E`) rounded-square field bearing a lowercase, white, serif-italic "bt" —
matching the in-app mark rendered by `Nav.svelte`. The images SHALL be exactly 192×192 and
512×512 pixels respectively, and SHALL NOT be the previous gray square with a white "P".

#### Scenario: Manifest declares both "any" sizes

- **WHEN** the built web manifest's icon list is read
- **THEN** it contains a 192×192 and a 512×512 `image/png` entry without a `maskable` purpose

#### Scenario: Rasters match their declared pixel size

- **WHEN** `static/icons/icon-192.png` and `static/icons/icon-512.png` are read
- **THEN** their pixel dimensions are exactly 192×192 and 512×512

#### Scenario: The gray "P" artwork is gone

- **WHEN** either installed icon is viewed
- **THEN** it shows the navy-and-white "bt" monogram and not a gray square with a white "P"

### Requirement: A dedicated maskable icon keeps the monogram inside the safe zone

The manifest SHALL declare a distinct `maskable` icon (`static/icons/icon-maskable-512.png`,
512×512, `image/png`, `purpose: 'maskable'`) rather than reusing the "any" 512×512 raster.
Its artwork SHALL be a full-bleed, opaque navy field with the white "bt" monogram centered
and confined to the central 80% safe zone, so no launcher mask clips the monogram.

#### Scenario: The maskable entry is a distinct asset

- **WHEN** the built web manifest is read
- **THEN** the `maskable` entry's `src` is `/icons/icon-maskable-512.png`, not `/icons/icon-512.png`

#### Scenario: The monogram survives masking

- **WHEN** the maskable icon is masked to a centered shape occupying the central 80% of the canvas
- **THEN** every stroke of the "bt" monogram remains fully visible

#### Scenario: The maskable background is full-bleed navy

- **WHEN** the maskable icon's edges are inspected
- **THEN** its background is opaque navy to all four edges, with no transparency and no gray

### Requirement: The app shell exposes an apple-touch-icon showing the brand mark

`src/app.html` SHALL reference a `<link rel="apple-touch-icon">` pointing at a 180×180 PNG
that shows the navy "bt" monogram, so iOS home-screen installs use the brand mark rather
than a page screenshot or the stale favicon.

#### Scenario: The apple-touch-icon link is present

- **WHEN** `src/app.html` is read
- **THEN** it contains a `rel="apple-touch-icon"` link resolving to the monogram PNG under the assets path

#### Scenario: The referenced asset is the brand mark

- **WHEN** the file referenced by the apple-touch-icon link is viewed
- **THEN** it is a 180×180 PNG showing the navy "bt" monogram

### Requirement: Icons are reproducible from a committed source

The repository SHALL commit the SVG source(s) of the monogram under `assets/pwa/` and a
documented command (`pnpm run icons:pwa`) that regenerates the committed icon PNGs from
them at the declared sizes. The committed SVG SHALL render the monogram without depending
on a system-installed font (the "bt" glyphs SHALL be vector outlines, not live text), so
regeneration yields the same artwork on any machine.

#### Scenario: One command regenerates every icon

- **WHEN** `pnpm run icons:pwa` is run from a clean checkout with dev dependencies installed
- **THEN** it (re)creates `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, and `apple-touch-icon.png` at their declared sizes

#### Scenario: The committed source is font-independent

- **WHEN** the committed SVG is rendered on a machine with no Lora font installed
- **THEN** the "bt" monogram renders identically to the committed icons, because its glyphs are outlines
