import { expect, test } from '@playwright/test';
import {
	ALL_SOURCES_QUERY,
	gotoHome,
	recentEntry,
	recentGroup,
	returnHome,
	submitSearch,
	waitForResults
} from './helpers';

/**
 * search-qol-improvements task 5.2 — integration pass in light/dark themes and
 * at a mobile viewport.
 *
 * The interactive checks are automated; pixel-level visual review remains manual.
 */
test.describe('Search QoL integration (light/dark + mobile)', () => {
	test.describe('mobile viewport', () => {
		test.use({ viewport: { width: 390, height: 844 } });

		test('recent row, page ref, and Copy labels work on a phone viewport', async ({ page }) => {
			await gotoHome(page);

			await submitSearch(page, 'Fear');
			await waitForResults(page);
			await returnHome(page);
			await expect(recentGroup(page)).toBeVisible();
			await expect(recentEntry(page, 'Fear')).toBeVisible();

			await submitSearch(page, ALL_SOURCES_QUERY);
			await waitForResults(page);

			// Page ref shown for Big Book, omitted for Daily Reflections.
			const bb = page.locator('article[aria-label*="Big Book"]').first();
			await expect(bb.locator('h3 + span')).toHaveText(/p\.\d+/);
			const dr = page.locator('article[aria-label*="DR"]').first();
			await expect(dr.locator('h3 + span')).toHaveCount(0);

			// Copy labels match the display mode.
			await expect(
				page
					.locator('section[aria-label*="Alcoholics Anonymous"]')
					.getByRole('button', { name: 'Copy passage to clipboard' })
					.first()
			).toBeVisible();
			await expect(
				page
					.locator('section[aria-label*="Daily Reflections"]')
					.getByRole('button', { name: 'Copy excerpt to clipboard' })
					.first()
			).toBeVisible();

			// No horizontal overflow at the phone width.
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - window.innerWidth
			);
			expect(overflow).toBeLessThanOrEqual(1);
		});
	});

	test('dark theme applies and the search surface still works', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'dark' });
		await gotoHome(page);
		await expect(page.locator('html')).toHaveClass(/dark/);

		await submitSearch(page, ALL_SOURCES_QUERY);
		await waitForResults(page);
		await expect(
			page.locator('section[aria-label*="Alcoholics Anonymous"]')
		).toBeVisible();
	});

	test('light theme is the default and the search surface still works', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'light' });
		await gotoHome(page);
		await expect(page.locator('html')).not.toHaveClass(/dark/);

		await submitSearch(page, ALL_SOURCES_QUERY);
		await waitForResults(page);
		await expect(
			page.locator('section[aria-label*="Daily Reflections"]')
		).toBeVisible();
	});
});
