import { expect, test, type Page } from '@playwright/test';
import { gotoHome } from './helpers';

/**
 * reorder-home-dashboard-mobile tasks 2.1 / 2.2 — the home dashboard card order.
 *
 * Visual order is asserted from the cards' heading positions:
 *  - mobile (single column): the cards stack, so their headings' `y` orders them;
 *  - multi-column (md/lg): the cards share a row, so `y` does not discriminate and
 *    their `x` (left-to-right) is compared instead.
 *
 * The multi-column cases exercise the `md:order-none` reset: without it the
 * mobile `order` classes leak upward and the Library Status card would land to
 * the right of Today's Reflection (md: two columns) or second in the row (lg),
 * failing these assertions.
 */

/** The three dashboard headings, by their accessible name (all are `<h2>`). */
const REFLECTION_HEADING = "Today's Reflection";
const LIBRARY_HEADING = 'Library Status';
const TOOLS_HEADING = 'Tools & PWA';

async function headingBox(page: Page, name: string) {
	const heading = page.getByRole('heading', { name, exact: true });
	await expect(heading).toBeVisible();
	const box = await heading.boundingBox();
	if (!box) throw new Error(`No bounding box for heading "${name}"`);
	return box;
}

test.describe('home dashboard card order', () => {
	test.describe('mobile (single column)', () => {
		test.use({ viewport: { width: 375, height: 812 } });

		test("stacks Today's Reflection above Library Status above Tools & PWA", async ({ page }) => {
			await gotoHome(page);

			const reflection = await headingBox(page, REFLECTION_HEADING);
			const library = await headingBox(page, LIBRARY_HEADING);
			const tools = await headingBox(page, TOOLS_HEADING);

			// One card per row: `y` is the visual stacking order, top to bottom.
			expect(reflection.y).toBeLessThan(library.y);
			expect(library.y).toBeLessThan(tools.y);
		});
	});

	test.describe('multi-column md (two columns)', () => {
		test.use({ viewport: { width: 900, height: 800 } });

		test("Library Status sits left of Today's Reflection", async ({ page }) => {
			await gotoHome(page);

			const library = await headingBox(page, LIBRARY_HEADING);
			const reflection = await headingBox(page, REFLECTION_HEADING);

			// Library and Reflection share the first row, so compare `x`, not `y`.
			expect(Math.abs(library.y - reflection.y)).toBeLessThan(50);
			expect(library.x).toBeLessThan(reflection.x);
		});
	});

	test.describe('multi-column lg (four columns)', () => {
		test.use({ viewport: { width: 1280, height: 800 } });

		test("reads Library Status, Today's Reflection, Tools & PWA left to right", async ({
			page
		}) => {
			await gotoHome(page);

			const library = await headingBox(page, LIBRARY_HEADING);
			const reflection = await headingBox(page, REFLECTION_HEADING);
			const tools = await headingBox(page, TOOLS_HEADING);

			// All three share the first row, so compare `x` left to right.
			expect(Math.abs(library.y - reflection.y)).toBeLessThan(50);
			expect(Math.abs(reflection.y - tools.y)).toBeLessThan(50);
			expect(library.x).toBeLessThan(reflection.x);
			expect(reflection.x).toBeLessThan(tools.x);
		});
	});
});
