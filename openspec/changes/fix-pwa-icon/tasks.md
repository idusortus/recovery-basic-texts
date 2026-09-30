# Tasks

Package scripts are invoked with pnpm, the repo's declared package manager
(`packageManager: pnpm@11.9.0`, with `pnpm-lock.yaml` and CI using `pnpm install
--frozen-lockfile`); `npm run <script>` is an equivalent invocation. The steps below use
pnpm for internal consistency.

## 1. Icon source

- [x] 1.1 Create `assets/pwa/icon.svg`: a `#2C4A6E` navy rounded square with the lowercase white serif-italic "bt" as vector outlines (not live `<text>`); verify by rasterizing it once and confirming the glyphs render without Lora installed (Design: font-independent glyphs)
- [x] 1.2 Create `assets/pwa/icon-maskable.svg`: a full-bleed opaque navy square with the same outlined "bt" centered and scaled into the central 80% safe zone; verify by masking a render to a centered 80% circle and confirming no monogram stroke is clipped

## 2. Generation tooling

- [x] 2.1 Add `sharp` as a direct `devDependency` and run `pnpm install`; verify the install succeeds and `pnpm why sharp` lists it as a direct dependency
- [x] 2.2 Add `scripts/generate-pwa-icons.mjs` (reads the two SVGs; writes `static/icons/icon-192.png` at 192×192, `icon-512.png` at 512×512, `icon-maskable-512.png` at 512×512, and `apple-touch-icon.png` at 180×180) plus the `icons:pwa` script in `package.json`; verify `pnpm run icons:pwa` creates all four files
- [x] 2.3 Ensure the generated PNGs are 8-bit RGBA, the "any" icons have transparent rounded corners, and the maskable/apple-touch icons are opaque navy; verify with `file static/icons/*.png` and visual inspection

## 3. Manifest and app-shell wiring

- [x] 3.1 Retarget the `maskable` manifest entry in `vite.config.ts` to `/icons/icon-maskable-512.png` (leave the 192/512 "any" entries unchanged); verify by building and reading `build/client/manifest.webmanifest` (or the built manifest) to confirm the maskable `src`
- [x] 3.2 Add a `<link rel="apple-touch-icon" href="%sveltekit.assets%/icons/apple-touch-icon.png" />` to `src/app.html`; verify the built HTML references it

## 4. Verification

- [x] 4.1 Add `scripts/test-pwa-icons.mjs` that parses the PNG headers to assert the four icons exist at 192×192 / 512×512 / 512×512 / 180×180 and asserts `vite.config.ts` points the `maskable` entry at `icon-maskable-512.png`; wire it as `test:pwa-icons` and verify it passes
- [x] 4.2 Run `pnpm run build` and `pnpm run check`; verify the build succeeds with the new assets and the manifest/HTML wiring is present in the output
- [ ] 4.3 Manually verify the done-when condition: serve the production build, install it as a PWA (desktop install and/or Android home screen), and confirm the installed icon at 192/512 and maskable shows the navy "bt" monogram, not the gray "P"
- [x] 4.4 Confirm the change is scoped: `static/favicon.ico` is untouched and no search, corpus, or service-worker logic changed
