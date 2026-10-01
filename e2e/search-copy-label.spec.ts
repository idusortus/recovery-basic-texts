import { expect, test } from '@playwright/test';
import {
	ALL_SOURCES_QUERY,
	gotoHome,
	installClipboardMock,
	readClipboard,
	submitSearch,
	waitForResults
} from './helpers';

/**
 * search-qol-improvements task 4.2 — Copy label matches the payload.
 *
 * Spec: search-ui / "The Copy control's label matches what it copies".
 */
test.describe('Result-card Copy label', () => {
	test.beforeEach(async ({ page }) => {
		await installClipboardMock(page);
		await gotoHome(page);
	});

	test('full-text results read "Copy passage"; protected results read "Copy excerpt"', async ({
		page
	}) => {
		await submitSearch(page, ALL_SOURCES_QUERY);
		await waitForResults(page);

		const bb = page.locator('section[aria-label*="Alcoholics Anonymous"]');
		const twelve = page.locator('section[aria-label*="Twelve Steps"]');
		const dr = page.locator('section[aria-label*="Daily Reflections"]');

		await expect(bb.getByRole('button', { name: 'Copy passage to clipboard' }).first()).toBeVisible();
		await expect(twelve.getByRole('button', { name: 'Copy excerpt to clipboard' }).first()).toBeVisible();
		await expect(dr.getByRole('button', { name: 'Copy excerpt to clipboard' }).first()).toBeVisible();

		// Visible labels match the accessible names.
		await expect(bb.getByRole('button', { name: 'Copy passage to clipboard' }).first()).toHaveText(
			'Copy passage'
		);
		await expect(dr.getByRole('button', { name: 'Copy excerpt to clipboard' }).first()).toHaveText(
			'Copy excerpt'
		);
	});

	test('clicking Copy confirms in place, then reverts to the mode-appropriate label', async ({
		page
	}) => {
		await submitSearch(page, ALL_SOURCES_QUERY);
		await waitForResults(page);

		// Locate by position (the first button in the card) so the locator stays
		// stable as the label changes on confirmation.
		const article = page
			.locator('section[aria-label*="Alcoholics Anonymous"] article')
			.first();
		const copy = article.locator('button').first();
		await expect(copy).toHaveText('Copy passage');
		await expect(copy).toHaveAttribute('aria-label', 'Copy passage to clipboard');

		await copy.click();

		// In-place confirmation replaces the label...
		await expect(copy).toHaveText('Copied ✓');
		// ...and the copy payload was written (mocked clipboard).
		const copied = await readClipboard(page);
		expect(copied.length).toBeGreaterThan(0);

		// ...then reverts after the confirmation window.
		await expect(copy).toHaveText('Copy passage', { timeout: 5000 });
		await expect(copy).toHaveAttribute('aria-label', 'Copy passage to clipboard');
	});

	test('a protected result copies only the clipped excerpt payload', async ({ page }) => {
		await submitSearch(page, ALL_SOURCES_QUERY);
		await waitForResults(page);

		const article = page
			.locator('section[aria-label*="Daily Reflections"] article')
			.first();
		const copy = article.locator('button').first();
		await expect(copy).toHaveText('Copy excerpt');
		await expect(copy).toHaveAttribute('aria-label', 'Copy excerpt to clipboard');

		await copy.click();
		await expect(copy).toHaveText('Copied ✓');

		const copied = await readClipboard(page);
		expect(copied.length).toBeGreaterThan(0);
		// A protected excerpt is bounded; a full DR passage is hundreds of words.
		expect(copied.split(/\s+/).length).toBeLessThan(120);
	});
});
