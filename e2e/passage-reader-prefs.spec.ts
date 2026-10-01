import { expect, test, type Page } from '@playwright/test';
import {
	BB_TORNADO_ID,
	BB_TORNADO_URL,
	READER_PREFS_KEY,
	blockReaderPrefsStorage,
	waitForPassage
} from './helpers';

/**
 * passage-reader-controls tasks 2.1–2.4 — reader preferences ("Aa").
 *
 * Spec: passage-view / "Reader preferences adjust the full-text passage body".
 */

const TARGET = `#passage-${BB_TORNADO_ID}`;

async function bodyFontSize(page: Page): Promise<number> {
	return page
		.locator(TARGET)
		.evaluate((el) => parseFloat(getComputedStyle(el as HTMLElement).fontSize));
}

async function bodyLineHeight(page: Page): Promise<number> {
	return page
		.locator(TARGET)
		.evaluate((el) => parseFloat(getComputedStyle(el as HTMLElement).lineHeight));
}

async function chromeFontSize(page: Page): Promise<number> {
	return page
		.locator('p', { hasText: /BIG BOOK/ })
		.first()
		.evaluate((el) => parseFloat(getComputedStyle(el as HTMLElement).fontSize));
}

async function openSettings(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Reading settings' }).click();
	await expect(page.getByRole('group', { name: 'Reading settings' })).toBeVisible();
}

test.describe('Passage reader preferences (full-text)', () => {
	test('the Aa group is present, keyboard-operable, announced, and uses aria-disabled end states', async ({
		page
	}) => {
		await page.goto(BB_TORNADO_URL);
		await waitForPassage(page, BB_TORNADO_ID);

		const trigger = page.getByRole('button', { name: 'Reading settings' });
		await expect(trigger).toBeVisible();
		await expect(page.getByRole('group', { name: 'Reading settings' })).toHaveCount(0);

		// Keyboard-operable: focus the trigger and open with Enter.
		await trigger.focus();
		await expect(trigger).toBeFocused();
		await page.keyboard.press('Enter');

		const group = page.getByRole('group', { name: 'Reading settings' });
		await expect(group).toBeVisible();

		const decrease = page.getByRole('button', { name: 'Decrease text size' });
		const increase = page.getByRole('button', { name: 'Increase text size' });

		// At the default step the decrease button is aria-disabled but still focusable
		// (no native `disabled` attribute, so it stays in the tab order).
		await expect(decrease).toHaveAttribute('aria-disabled', 'true');
		await expect(decrease).not.toHaveAttribute('disabled', '');
		// Playwright treats `aria-disabled` as disabled, so assert the native
		// property directly: it must stay focusable (no `disabled` attribute).
		expect(await decrease.evaluate((el) => (el as HTMLButtonElement).disabled)).toBe(false);
		await decrease.focus();
		await expect(decrease).toBeFocused();

		// Announced current step via a polite live region (not color alone).
		const live = group.locator('[aria-live="polite"]');
		await expect(live).toContainText('Text size: Default');
		await expect(live).toContainText('line spacing: normal');

		// Increase to the largest step; the increase button then becomes aria-disabled.
		await increase.click();
		await expect(live).toContainText('Text size: Large');
		await increase.click();
		await increase.click();
		await expect(live).toContainText('Text size: Largest');
		await expect(increase).toHaveAttribute('aria-disabled', 'true');
		expect(await increase.evaluate((el) => (el as HTMLButtonElement).disabled)).toBe(false);

		// Line-spacing toggle exposes its state via aria-pressed (non-color cue).
		const spacing = page.getByRole('button', { name: 'Line spacing' });
		await expect(spacing).toHaveAttribute('aria-pressed', 'false');
		await spacing.click();
		await expect(spacing).toHaveAttribute('aria-pressed', 'true');
	});

	test('increasing the text size changes the body only and persists across reload', async ({
		page
	}) => {
		await page.goto(BB_TORNADO_URL);
		await waitForPassage(page, BB_TORNADO_ID);

		const before = await bodyFontSize(page);
		const chromeBefore = await chromeFontSize(page);
		// Default applies no inline override.
		await expect(page.locator(TARGET)).not.toHaveAttribute('style', /font-size/);

		await openSettings(page);
		await page.getByRole('button', { name: 'Increase text size' }).click();

		const after = await bodyFontSize(page);
		expect(after).toBeGreaterThan(before);
		await expect(page.locator(TARGET)).toHaveAttribute('style', /font-size/);
		// Surrounding chrome is unaffected.
		expect(await chromeFontSize(page)).toBeCloseTo(chromeBefore, 0);

		// Persisted under the namespaced key.
		const stored = await page.evaluate((key) => localStorage.getItem(key), READER_PREFS_KEY);
		expect(stored).toContain('large');

		// Still applied after a reload (group is closed by default, pref still active).
		await page.reload();
		await waitForPassage(page, BB_TORNADO_ID);
		expect(await bodyFontSize(page)).toBeGreaterThan(before);
		expect(await chromeFontSize(page)).toBeCloseTo(chromeBefore, 0);
	});

	test('stepping back to default removes the inline override', async ({ page }) => {
		await page.goto(BB_TORNADO_URL);
		await waitForPassage(page, BB_TORNADO_ID);

		await openSettings(page);
		await page.getByRole('button', { name: 'Increase text size' }).click();
		await expect(page.locator(TARGET)).toHaveAttribute('style', /font-size/);

		await page.getByRole('button', { name: 'Decrease text size' }).click();
		await expect(page.locator(TARGET)).not.toHaveAttribute('style', /font-size/);

		// The persisted value is back to the default step.
		const stored = await page.evaluate((key) => localStorage.getItem(key), READER_PREFS_KEY);
		expect(stored).toContain('default');
	});

	test('the line-spacing toggle applies and reverts the body override', async ({ page }) => {
		await page.goto(BB_TORNADO_URL);
		await waitForPassage(page, BB_TORNADO_ID);

		await openSettings(page);
		const before = await bodyLineHeight(page);
		const spacing = page.getByRole('button', { name: 'Line spacing' });

		await spacing.click();
		await expect(spacing).toHaveAttribute('aria-pressed', 'true');
		const relaxed = await bodyLineHeight(page);
		expect(relaxed).toBeGreaterThan(before);
		await expect(page.locator(TARGET)).toHaveAttribute('style', /line-height/);

		await spacing.click();
		await expect(spacing).toHaveAttribute('aria-pressed', 'false');
		await expect(page.locator(TARGET)).not.toHaveAttribute('style', /line-height/);
	});

	test('storage-disabled still functions in memory without error', async ({ page }) => {
		await blockReaderPrefsStorage(page);
		await page.goto(BB_TORNADO_URL);
		await waitForPassage(page, BB_TORNADO_ID);

		const before = await bodyFontSize(page);
		await openSettings(page);
		await page.getByRole('button', { name: 'Increase text size' }).click();
		expect(await bodyFontSize(page)).toBeGreaterThan(before);

		// No error surface rendered.
		await expect(page.getByText(/Failed to load|Passage not found/)).toHaveCount(0);
	});

	test('changing the preference does not disturb highlight, focus, or match navigation', async ({
		page
	}) => {
		await page.goto(`${BB_TORNADO_URL}?q=the`);
		await waitForPassage(page, BB_TORNADO_ID);

		const mark = page.locator(`${TARGET} mark`).first();
		await expect(mark).toBeVisible();
		await expect(page.locator(TARGET)).toBeFocused();
		const matchNav = page.getByRole('group', { name: 'Match navigation' });
		await expect(matchNav).toBeVisible();

		await openSettings(page);
		await page.getByRole('button', { name: 'Increase text size' }).click();

		// Highlight and match navigation are unchanged (focus legitimately moved to
		// the settings control that was activated).
		await expect(mark).toBeVisible();
		await expect(matchNav).toBeVisible();
		await expect(page.getByText(/Match \d+ of \d+/)).toBeVisible();
	});
});
