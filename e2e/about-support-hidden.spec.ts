import { expect, test } from '@playwright/test';

/**
 * hide-support-project-info task 1.2 — the reserved support section is withheld.
 *
 * Spec: about-page / "The About page does not display a support solicitation".
 * The section stays in the source behind `{#if SHOW_SUPPORT}`; this asserts the
 * rendered `/about` shows no support heading, donation/sponsorship links, or
 * placeholder, while the rest of the page still renders.
 */
test.describe('About page support section withheld', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/about');
		await expect(page.getByRole('heading', { name: 'About basictexts.org' })).toBeVisible();
	});

	test('shows no "Support this project" heading or support copy', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Support this project' })).toHaveCount(0);
		await expect(page.getByText(/consider supporting/i)).toHaveCount(0);
		await expect(page.getByText('Support on Ko-fi')).toHaveCount(0);
	});

	test('exposes no Ko-fi or GitHub Sponsors links or placeholder', async ({ page }) => {
		// No anchor anywhere on the page targets a donation/sponsorship host.
		await expect(page.locator('a[href*="ko-fi.com"]')).toHaveCount(0);
		await expect(page.locator('a[href*="github.com/sponsors"]')).toHaveCount(0);
		await expect(page.getByText('GitHub Sponsors', { exact: false })).toHaveCount(0);
	});

	test('the rest of the About content still renders', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'What this is', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: "What this isn't", exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Send feedback', exact: true })).toBeVisible();
		const feedbackSection = page.locator('section[aria-labelledby="feedback"]');
		await expect(feedbackSection.getByRole('link', { name: /Send feedback/ })).toHaveAttribute(
			'href',
			'/feedback'
		);
	});
});
