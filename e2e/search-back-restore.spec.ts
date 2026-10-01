import { expect, test, type Page } from '@playwright/test';
import {
	BB_TORNADO_ID,
	DENSE_QUERY,
	TORNADO_QUERY,
	expectUrl,
	gotoHome,
	submitSearch,
	waitForPassage,
	waitForResults
} from './helpers';

/**
 * search-qol-improvements tasks 2.1 & 2.2 — Back-to-search scroll + query
 * restoration, and the passage-page entry path.
 *
 * Spec: search-ui / "Returning to the results restores the query and scroll position".
 */

/**
 * Scroll to `y`, then click the first "View passage" link already in the
 * viewport. Returns the `window.scrollY` captured immediately before the click
 * — the value the app records for restoration — so callers can assert against
 * the real offset rather than the requested target.
 */
async function scrollAndOpenVisiblePassage(page: Page, y: number): Promise<number> {
	await page.evaluate((top) => window.scrollTo(0, top), y);
	const links = page.getByRole('link', { name: 'View passage' });
	const count = await links.count();
	const viewport = page.viewportSize();
	if (!viewport) throw new Error('no viewport size');
	for (let i = 0; i < count; i++) {
		const box = await links.nth(i).boundingBox();
		if (box && box.y > 100 && box.y + box.height < viewport.height - 20) {
			const offset = await page.evaluate(() => window.scrollY);
			await links.nth(i).click();
			return offset;
		}
	}
	throw new Error('no visible "View passage" link in viewport');
}

test.describe('Back-to-search restoration', () => {
	test.beforeEach(async ({ page }) => {
		await gotoHome(page);
	});

	test('Back from a passage restores the query and approximately the scroll position', async ({
		page
	}) => {
		await submitSearch(page, DENSE_QUERY);
		await waitForResults(page);
		// Let the background concordance re-run settle so the list is stable.
		await page.waitForTimeout(300);

		// The helper returns the offset the app recorded: `window.scrollY`
		// immediately before the click that navigated away.
		const recorded = await scrollAndOpenVisiblePassage(page, 2000);
		await expectUrl(page, /\/passage\//);
		await expect(page.getByRole('link', { name: 'Back to search' })).toBeVisible();

		await page.goBack();

		await expectUrl(page, new RegExp(`\\?q=${DENSE_QUERY}`));
		await expect(page.locator('#search-input')).toHaveValue(DENSE_QUERY);
		await waitForResults(page);

		// The restored offset is re-applied after the async results render.
		await expect
			.poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 })
			.toBeGreaterThan(500);

		const restored = await page.evaluate(() => window.scrollY);
		expect(restored).toBeGreaterThan(500);
		expect(Math.abs(restored - recorded)).toBeLessThan(300);
	});

	test('a fresh visit to the search page starts at the top', async ({ page }) => {
		await page.goto(`/?q=${DENSE_QUERY}`);
		await waitForResults(page);
		await page.waitForTimeout(300);
		expect(await page.evaluate(() => window.scrollY)).toBeLessThan(50);
	});

	test('Forward and Back reproduce the query and approximate position', async ({ page }) => {
		await submitSearch(page, DENSE_QUERY);
		await waitForResults(page);
		await page.waitForTimeout(300);

		await scrollAndOpenVisiblePassage(page, 2000);
		await expectUrl(page, /\/passage\//);

		await page.goBack();
		await expect(page.locator('#search-input')).toHaveValue(DENSE_QUERY);
		await waitForResults(page);
		await expect
			.poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 })
			.toBeGreaterThan(500);

		// Forward returns to the passage, Back returns to the results again.
		await page.goForward();
		await expectUrl(page, /\/passage\//);
		await page.goBack();
		await expect(page.locator('#search-input')).toHaveValue(DENSE_QUERY);
		await waitForResults(page);
		await expect
			.poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 })
			.toBeGreaterThan(500);
	});

	test('search -> passage lands on the highlighted term, and Back returns to the results', async ({
		page
	}) => {
		await submitSearch(page, TORNADO_QUERY);
		await waitForResults(page);

		await page.getByRole('link', { name: 'View passage' }).first().click();
		await expectUrl(page, new RegExp(BB_TORNADO_ID));
		await waitForPassage(page, BB_TORNADO_ID);

		// The first highlighted occurrence is rendered and centered on entry.
		const mark = page.locator(`#passage-${BB_TORNADO_ID} mark`).first();
		await expect(mark).toBeVisible();
		await expect(mark).toHaveText(/tornado/i);

		// Keyboard focus lands on the target passage.
		await expect(page.locator(`#passage-${BB_TORNADO_ID}`)).toBeFocused();

		// The highlight is in the viewport (clear of the sticky header).
		const box = await mark.boundingBox();
		const viewport = page.viewportSize();
		if (!box || !viewport) throw new Error('missing geometry');
		expect(box.y).toBeGreaterThan(0);
		expect(box.y).toBeLessThan(viewport.height);

		await page.goBack();
		await expect(page.locator('#search-input')).toHaveValue(TORNADO_QUERY);
		await waitForResults(page);
	});
});
