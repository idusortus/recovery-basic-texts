import { expect, test, type Page } from '@playwright/test';
import {
	ALL_SOURCES_QUERY,
	RECENT_KEY,
	expectUrl,
	gotoHome,
	recentEntry,
	recentGroup,
	submitSearch,
	waitForResults
} from './helpers';

/**
 * collapse-mobile-search-controls — the mobile search-options disclosure.
 *
 * Spec: search-ui / "Mobile disclosure control", "Disclosure toggle is
 * accessible", "Hidden panel content leaves the keyboard and assistive-technology
 * order", "Collapsed toggle indicates non-default filters", "Filtering behavior
 * is unchanged by the disclosure", "Expanded panel manages keyboard focus",
 * and "Disclosure state is not persisted".
 *
 * The panel always exists in the DOM (that is what the toggle's `aria-controls`
 * points at), so the collapsed state is asserted with `toBeHidden()`, never
 * `toHaveCount(0)`.
 */

const PANEL = '#search-more-panel';

/** The toggle by its accessible name (always starts with the visible label). */
function moreToggle(page: Page) {
	return page.getByRole('button', { name: /^More,/ });
}

/** The toggle element regardless of visibility — it is `md:hidden` at md and up. */
function moreToggleEl(page: Page) {
	return page.locator('button[aria-controls="search-more-panel"]');
}

/** Seed the local recent-searches list before the page loads. */
async function seedRecentSearches(page: Page, queries: string[]): Promise<void> {
	await page.addInitScript(
		(arg: [string, string]) => localStorage.setItem(arg[0], arg[1]),
		[RECENT_KEY, JSON.stringify(queries)] as [string, string]
	);
}

test.describe('Mobile disclosure', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('clusters are collapsed behind a visible More toggle and stay out of the tab order', async ({
		page
	}) => {
		await seedRecentSearches(page, ['Fear']);
		await gotoHome(page);

		const panel = page.locator(PANEL);
		// The panel is never removed from the DOM, so `aria-controls` resolves.
		await expect(panel).toHaveCount(1);
		await expect(panel).toBeHidden();

		const toggle = moreToggle(page);
		await expect(toggle).toBeVisible();
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(toggle).toHaveAttribute('aria-controls', 'search-more-panel');
		await expect(toggle).toHaveAccessibleName('More, show search options');

		// Every cluster lives inside the always-present panel and is hidden with it.
		await expect(
			panel.getByRole('group', { name: 'Recent searches', includeHidden: true })
		).toBeHidden();
		await expect(
			panel.getByRole('group', { name: 'Filter by source', includeHidden: true })
		).toBeHidden();
		await expect(
			panel.getByRole('group', { name: 'Quick topic searches', includeHidden: true })
		).toBeHidden();

		// Walking the Tab sequence never lands inside the collapsed panel.
		await page.locator('#search-input').focus();
		for (let i = 0; i < 12; i += 1) {
			await page.keyboard.press('Tab');
			const focusInsidePanel = await page.evaluate((selector) => {
				const el = document.querySelector(selector);
				return el !== null && document.activeElement !== null && el.contains(document.activeElement);
			}, PANEL);
			expect(focusInsidePanel, `Tab stop ${i + 1} must not land in the collapsed panel`).toBe(
				false
			);
		}
	});

	test('expanding reveals the clusters and moves focus to the first control', async ({ page }) => {
		await seedRecentSearches(page, ['Fear']);
		await gotoHome(page);

		await moreToggle(page).click();

		const panel = page.locator(PANEL);
		await expect(panel).toBeVisible();
		await expect(moreToggle(page)).toHaveAttribute('aria-expanded', 'true');
		await expect(moreToggle(page)).toHaveAccessibleName('More, hide search options');

		await expect(panel.getByRole('group', { name: 'Recent searches' })).toBeVisible();
		await expect(panel.getByRole('group', { name: 'Filter by source' })).toBeVisible();
		await expect(panel.getByRole('group', { name: 'Quick topic searches' })).toBeVisible();

		// Focus lands on the first focusable control inside the panel.
		await expect(recentEntry(page, 'Fear')).toBeFocused();
	});

	test('Escape collapses the panel and returns focus to the toggle', async ({ page }) => {
		await gotoHome(page);
		const toggle = moreToggle(page);

		await toggle.click();
		await expect(page.locator(PANEL)).toBeVisible();

		await page.keyboard.press('Escape');

		await expect(page.locator(PANEL)).toBeHidden();
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(toggle).toHaveAccessibleName('More, show search options');
		await expect(toggle).toBeFocused();
	});

	test('a source deselected inside the panel keeps filtering after the panel is collapsed', async ({
		page
	}) => {
		await gotoHome(page);
		await moreToggle(page).click();

		// Deselect Daily Reflections from inside the panel.
		await page.getByRole('button', { name: 'DR', exact: true }).click();
		await expectUrl(page, /sources=big-book-2ed%2Ctwelve-steps-traditions/);

		await submitSearch(page, ALL_SOURCES_QUERY);
		await waitForResults(page);

		// The suggestion listbox overlays the toggle; blur closes it first.
		await page.locator('#search-input').blur();

		// Collapse the panel; the active filter set must survive.
		await moreToggle(page).click();
		await expect(page.locator(PANEL)).toBeHidden();

		await expectUrl(page, /q=fear/);
		await expectUrl(page, /sources=big-book-2ed%2Ctwelve-steps-traditions/);
		await expect(
			page.locator('section[aria-label="Alcoholics Anonymous (2nd Edition) results"]')
		).toBeVisible();
		await expect(page.locator('section[aria-label="Daily Reflections results"]')).toHaveCount(0);
	});

	test('exact phrase inside the panel updates the URL and shows a count badge', async ({ page }) => {
		await gotoHome(page);
		await moreToggle(page).click();

		// The accessible name flips with the state, but both contain "exact phrase".
		const phraseToggle = page.getByRole('button', { name: /exact phrase/i });
		await phraseToggle.click();

		await expectUrl(page, /phrase=1/);
		await expect(phraseToggle).toHaveAttribute('aria-pressed', 'true');

		const toggle = moreToggle(page);
		await expect(toggle).toContainText('·');
		await expect(toggle).toContainText('1');
		await expect(toggle).toHaveAccessibleName('More, hide search options, 1 filter changed');
	});

	test('no count badge is shown at the default filters', async ({ page }) => {
		await gotoHome(page);

		const toggle = moreToggle(page);
		await expect(toggle).toBeVisible();
		await expect(toggle).toContainText('More');
		await expect(toggle).not.toContainText('·');
		await expect(toggle).toHaveAccessibleName('More, show search options');
	});

	test('the expanded Recent row stays a labeled group of descriptive controls', async ({ page }) => {
		await seedRecentSearches(page, ['Fear', 'Anger']);
		await gotoHome(page);
		await moreToggle(page).click();

		const group = recentGroup(page);
		await expect(group).toBeVisible();
		await expect(group).toHaveAttribute('role', 'group');
		await expect(group).toHaveAttribute('aria-label', 'Recent searches');

		await expect(recentEntry(page, 'Fear')).toHaveAttribute('aria-label', 'Search again for Fear');
		await expect(recentEntry(page, 'Anger')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Clear recent searches' })).toBeVisible();
	});
});

test.describe('Disclosure breakpoint: 767 px (below md)', () => {
	test.use({ viewport: { width: 767, height: 844 } });

	test('the toggle is visible and the panel is collapsed until expanded', async ({ page }) => {
		await gotoHome(page);

		const toggle = moreToggleEl(page);
		await expect(toggle).toHaveCount(1);
		await expect(toggle).toBeVisible();
		await expect(page.locator(PANEL)).toBeHidden();

		await toggle.click();
		await expect(page.locator(PANEL)).toBeVisible();
	});
});

for (const width of [768, 1024]) {
	test.describe(`Disclosure breakpoint: ${width} px (md and up)`, () => {
		test.use({ viewport: { width, height: 844 } });

		test('the toggle is hidden and the clusters render inline without expanding', async ({
			page
		}) => {
			await seedRecentSearches(page, ['Fear']);
			await gotoHome(page);

			const toggle = moreToggleEl(page);
			await expect(toggle).toHaveCount(1);
			await expect(toggle).toBeHidden();

			const panel = page.locator(PANEL);
			await expect(panel).toBeVisible();
			await expect(panel.getByRole('group', { name: 'Recent searches' })).toBeVisible();
			await expect(panel.getByRole('group', { name: 'Filter by source' })).toBeVisible();
			await expect(panel.getByRole('group', { name: 'Quick topic searches' })).toBeVisible();
		});
	});
}
