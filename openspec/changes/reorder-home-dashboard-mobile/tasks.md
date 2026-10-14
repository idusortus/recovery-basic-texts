# Tasks

## 1. Implement the mobile card order

- [x] 1.1 In `src/routes/+page.svelte`, set an explicit grid `order` on all three home-dashboard cards — the Today's Reflection card, the Library Status card, and the Tools & PWA card — as the base (mobile-first) sequence Reflection → Library → Tools, with the `md:` reset that restores today's multi-column order (design D1–D3). Verify: reading the dashboard grid markup, all three cards carry an explicit base order plus the `md:` reset, and `pnpm run check` completes with no new errors (`check` validates types only — it does not validate the order classes; the ordering is verified by 2.1/2.2).
- [x] 1.2 Add an HTML comment above the dashboard grid recording the mobile reading order and the rule that any future card added to this grid needs an explicit order (design D3 risk). Verify: the comment is present at the grid and names the order.

## 2. Automated verification (Playwright)

- [x] 2.1 Add `e2e/home-dashboard-order.spec.ts` with a mobile-viewport case (for example `375×812`) that opens `/` via `gotoHome` and asserts the vertical order of the three card headings — `Today's Reflection` above `Library Status` above `Tools & PWA` — by comparing their bounding-box `y` coordinates. Verify: `pnpm run test:e2e -- home-dashboard-order` passes the mobile case.
- [x] 2.2 In the same spec, add cases for the multi-column layouts asserting the order is unchanged by comparing bounding-box `x` (the cards share rows, so `y` does not discriminate): at the two-column `md` width (for example `900×800`) the `Library Status` card sits left of the `Today's Reflection` card; at the four-column `lg` width (for example `1280×800`) all three cards share one row in reading order Library Status → Today's Reflection → Tools & PWA. Verify: the multi-column cases pass and fail if the `md:` reset is dropped.
- [x] 2.3 Run the full E2E suite and confirm no existing spec regresses. Verify: `pnpm run test:e2e` is green.

## 3. Manual verification

- [ ] 3.1 manual (browser): at a phone width, confirm the home dashboard reads Today's Reflection → Library Status → Tools & PWA, that no card sits between the reflection and the library, and that no card's heading, links, or copy changed; check both light and dark themes.
- [ ] 3.2 manual (browser): at a tablet and desktop width, confirm the dashboard is visually unchanged from before this change (Library Status leading the grid).
