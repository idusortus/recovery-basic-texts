import { expect, test } from '@playwright/test';
import {
	RECENT_KEY,
	expectUrl,
	gotoHome,
	recentEntry,
	recentGroup,
	returnHome,
	submitSearch,
	waitForResults
} from './helpers';

/**
 * search-qol-improvements task 1.3 — Recent searches row.
 *
 * Spec: search-ui / "Local recent searches are offered beneath the search input".
 */
test.describe('Recent searches row', () => {
	test.beforeEach(async ({ page }) => {
		await gotoHome(page);
	});

	test('a submitted query appears in the Recent row, which is hidden while results show', async ({
		page
	}) => {
		await submitSearch(page, 'Fear');
		await waitForResults(page);

		// While a query is active the row is not rendered.
		await expect(recentGroup(page)).toHaveCount(0);

		await returnHome(page);
		await expect(recentGroup(page)).toBeVisible();
		await expect(recentEntry(page, 'Fear')).toBeVisible();
	});

	test('debounced typing alone does not record an entry', async ({ page }) => {
		await page.locator('#search-input').fill('fear');
		// Wait past the 150ms debounce so the as-you-type search has run.
		await page.waitForTimeout(500);
		await waitForResults(page);

		const stored = await page.evaluate((key) => localStorage.getItem(key), RECENT_KEY);
		expect(stored).toBeNull();
	});

	test('duplicates dedupe case-insensitively keeping the newest casing', async ({ page }) => {
		await submitSearch(page, 'Fear');
		await waitForResults(page);
		await returnHome(page);

		await submitSearch(page, 'fear');
		await waitForResults(page);
		await returnHome(page);

		await expect(recentGroup(page).getByRole('button')).toHaveCount(2); // one entry + Clear
		await expect(recentEntry(page, 'fear')).toBeVisible();
		await expect(recentEntry(page, 'Fear')).toHaveCount(0);

		const stored = await page.evaluate(
			(key) => JSON.parse(localStorage.getItem(key) ?? '[]'),
			RECENT_KEY
		);
		expect(stored).toEqual(['fear']);
	});

	test('the list is capped at 8 distinct queries', async ({ page }) => {
		const seeded = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'];
		await page.evaluate(
			([key, list]) => localStorage.setItem(key, JSON.stringify(list)),
			[RECENT_KEY, seeded] as const
		);
		await page.reload();
		await expect(recentGroup(page)).toBeVisible();

		await submitSearch(page, 'q9');
		await expect(page.getByText(/No results for/)).toBeVisible();
		await returnHome(page);

		const stored: string[] = await page.evaluate(
			(key) => JSON.parse(localStorage.getItem(key) ?? '[]'),
			RECENT_KEY
		);
		expect(stored).toHaveLength(8);
		expect(stored[0]).toBe('q9');
		expect(stored).not.toContain('q8');
	});

	test('activating an entry re-runs it as an explicit submit', async ({ page }) => {
		await submitSearch(page, 'Fear');
		await waitForResults(page);
		await returnHome(page);

		await recentEntry(page, 'Fear').click();

		await expectUrl(page, /\?q=Fear/);
		await expect(page.locator('#search-input')).toHaveValue('Fear');
		await waitForResults(page);
		await expect(recentGroup(page)).toHaveCount(0);
	});

	test('the clear control empties and hides the row, and the cleared state persists across reload', async ({
		page
	}) => {
		await submitSearch(page, 'Fear');
		await waitForResults(page);
		await returnHome(page);
		await expect(recentGroup(page)).toBeVisible();

		await page.getByRole('button', { name: 'Clear recent searches' }).click();

		await expect(recentGroup(page)).toHaveCount(0);
		const stored = await page.evaluate((key) => localStorage.getItem(key), RECENT_KEY);
		expect(stored).toBeNull();

		await page.reload();
		await expect(page.getByRole('heading', { name: /There is a solution/ })).toBeVisible();
		await expect(recentGroup(page)).toHaveCount(0);
	});

	test('the row is a labeled group whose controls are focusable with a focus ring', async ({
		page
	}) => {
		await submitSearch(page, 'Fear');
		await waitForResults(page);
		await returnHome(page);

		const group = recentGroup(page);
		await expect(group).toHaveAttribute('aria-label', 'Recent searches');

		const entry = recentEntry(page, 'Fear');
		await entry.focus();
		await expect(entry).toBeFocused();
		await expect(entry).toHaveClass(/focus-visible:ring-2/);

		const clear = page.getByRole('button', { name: 'Clear recent searches' });
		await clear.focus();
		await expect(clear).toBeFocused();
	});
});
