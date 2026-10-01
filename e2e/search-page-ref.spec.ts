import { expect, test } from '@playwright/test';
import {
	ALL_SOURCES_QUERY,
	TORNADO_QUERY,
	gotoHome,
	submitSearch,
	waitForResults
} from './helpers';

/**
 * search-qol-improvements task 3.2 — page reference on result cards.
 *
 * Spec: search-ui / "A result card shows its passage page reference when available".
 */
test.describe('Result-card page reference', () => {
	test.beforeEach(async ({ page }) => {
		await gotoHome(page);
	});

	test('a Big Book result shows p.N as a sibling of the heading, outside the <h3>', async ({
		page
	}) => {
		await submitSearch(page, TORNADO_QUERY);
		await waitForResults(page);

		const article = page.locator('article[aria-label*="Big Book"]').first();
		await expect(article).toBeVisible();

		const heading = article.locator('h3');
		// The heading's announced text is the source/chapter line only.
		await expect(heading).toContainText('CHAPTER 6');
		await expect(heading).not.toContainText('p.103');

		// The page ref is a sibling of the heading, not a descendant.
		const pageRef = article.locator('h3 + span');
		await expect(pageRef).toHaveText('p.103');
		await expect(heading.locator('span')).toHaveCount(0);
	});

	test('a Daily Reflections result omits the page reference with no dangling separator', async ({
		page
	}) => {
		await submitSearch(page, ALL_SOURCES_QUERY);
		await waitForResults(page);

		const article = page.locator('article[aria-label*="DR"]').first();
		await expect(article).toBeVisible();

		const heading = article.locator('h3');
		await expect(heading).not.toContainText('p.');
		// No page-reference span beside the heading.
		await expect(article.locator('h3 + span')).toHaveCount(0);
		// No dangling separator appended after the chapter label.
		await expect(heading).not.toHaveText(/—\s*$/);
	});

	test('every result still exposes a heading (heading navigation unchanged)', async ({
		page
	}) => {
		await submitSearch(page, ALL_SOURCES_QUERY);
		await waitForResults(page);

		const articles = page.locator('main article');
		const headings = page.locator('main article h3');
		const articleCount = await articles.count();
		expect(articleCount).toBeGreaterThan(0);
		await expect(headings).toHaveCount(articleCount);
	});
});
