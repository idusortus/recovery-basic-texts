import { expect, test } from '@playwright/test';
import { BB_TORNADO_ID, BB_TORNADO_URL, waitForPassage } from './helpers';

/**
 * Regression guard for the passage load `$effect` self-dependency loop.
 *
 * The load effect once read `chapterPassages` / `source` back after writing
 * them, so the effect depended on its own output and threw Svelte's
 * `effect_update_depth_exceeded`. Opening a full-text Big Book passage must
 * render with no page error at all.
 *
 * Spec: passage-view / "A full-text passage page renders without an effect loop".
 */
test.describe('Full-text passage render (effect-loop regression)', () => {
	test('a Big Book passage renders with no page error', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (err) => errors.push(err.message));

		await page.goto(BB_TORNADO_URL);
		await waitForPassage(page, BB_TORNADO_ID);

		// The passage content actually rendered (not just an empty shell).
		const target = page.locator(`#passage-${BB_TORNADO_ID}`);
		await expect(target).toBeVisible();
		await expect(target).toContainText(/tornado/i);

		// Give the runes effects a beat to settle, then assert no error at all —
		// in particular no `effect_update_depth_exceeded`.
		await page.waitForTimeout(300);
		expect(errors.filter((message) => message.includes('effect_update_depth_exceeded'))).toEqual(
			[]
		);
		expect(errors).toEqual([]);
	});
});
