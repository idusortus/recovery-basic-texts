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

		// A protected excerpt is a bounded, clipped window: it is a strict subset
		// of the full entry (never the reflective prose in full), marks the
		// clipped side with an ellipsis, and leads with the date-led attribution.
		expect(copied).toContain('\u2026');
		expect(copied).toMatch(/\n\n[A-Z][a-z]+ \d{1,2} · Daily Reflections\s*$/);

		// Compare the excerpt against the full entry text, read from the page's own
		// index (not a hard-coded fixture bound): the excerpt must be shorter than
		// the entry and must not reproduce it. This stays correct for every DR
		// result regardless of entry length.
		const heading = article.locator('h3');
		const headingText = (await heading.textContent())?.trim() ?? '';
		const excerpt = copied.split('\n\n')[0];
		const words = (s: string): number => s.split(/\s+/).filter(Boolean).length;
		const stats = await page.evaluate(async (headingText) => {
			const res = await fetch('/index/passages.json');
			const passages = (await res.json()) as Record<string, { text: string; date?: string | null }>;
			// The heading is "<MONTH DAY> · DAILY REFLECTIONS"; derive the MM-DD date.
			const match = /^([A-Z]+) (\d{1,2}) ·/.exec(headingText.toUpperCase());
			if (!match) return null;
			const months = [
				'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
				'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
			];
			const month = months.indexOf(match[1]) + 1;
			if (month === 0) return null;
			const date = `${String(month).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
			const entry = Object.values(passages).find(
				(p) => p.date === date && typeof p.text === 'string'
			);
			return entry ? entry.text : null;
		}, headingText);
		expect(stats).not.toBeNull();
		const fullText = stats as string;
		// The excerpt marks clipped sides with an ellipsis; strip those markers
		// (and normalize whitespace) so the remainder is a verbatim run of the
		// entry's text. No hard-coded length bound: correctness is structural.
		const normalize = (s: string): string =>
			s.replace(/\u2026/g, ' ').replace(/\s+/g, ' ').trim();
		const excerptCore = normalize(excerpt);
		expect(excerpt).not.toBe(fullText);
		expect(normalize(fullText).includes(excerptCore)).toBe(true);
		expect(words(excerpt)).toBeLessThan(words(fullText));
	});

	test('a Daily Reflections result card leads with the date', async ({ page }) => {
		await submitSearch(page, ALL_SOURCES_QUERY);
		await waitForResults(page);

		const article = page
			.locator('section[aria-label*="Daily Reflections"] article')
			.first();
		const heading = article.locator('h3');
		// The heading is date-led: "JANUARY 1 · DAILY REFLECTIONS", one line.
		await expect(heading).toHaveText(/^[A-Z]+ \d{1,2} · DAILY REFLECTIONS$/);
		// The accessible name still contains both the date and the DR label.
		await expect(article).toHaveAttribute('aria-label', /DR/);
	});
});
