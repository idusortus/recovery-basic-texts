import { expect, test } from '@playwright/test';
import {
	BB_TORNADO_ID,
	BB_TORNADO_URL,
	DR_PASSAGE_URL,
	READER_PREFS_KEY,
	TWELVE_PASSAGE_URL,
	blockThirdPartyRequests,
	installTtsMock,
	waitForInitialNetworkIdle,
	waitForPassage
} from './helpers';

/**
 * passage-reader-controls tasks 5.1 & 5.2 — displayMode guardrails and the
 * no-transmission / local-only persistence contract.
 */

test.describe('Passage guardrails', () => {
	test('a protected passage shows the official-source state and no reader controls', async ({
		page
	}) => {
		await installTtsMock(page);
		await page.goto(DR_PASSAGE_URL);

		await expect(page.getByText('Full text not available')).toBeVisible();
		const official = page.getByRole('link', { name: /Read at official source/ });
		await expect(official).toBeVisible();
		await expect(official).toHaveAttribute('href', /aa\.org/);

		// No reader-prefs group/trigger, no Listen, no Copy/Share, no rendered body.
		await expect(page.getByRole('button', { name: 'Reading settings' })).toHaveCount(0);
		await expect(page.getByRole('group', { name: 'Reading settings' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Listen' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: /Copy/ })).toHaveCount(0);
		await expect(page.getByRole('button', { name: /Share/ })).toHaveCount(0);
		await expect(page.locator('p[id^="passage-"]')).toHaveCount(0);
	});

	test('a snippet passage likewise never renders full text or reader controls', async ({
		page
	}) => {
		await installTtsMock(page);
		await page.goto(TWELVE_PASSAGE_URL);

		await expect(page.getByText('Full text not available')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Reading settings' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Listen' })).toHaveCount(0);
		await expect(page.locator('p[id^="passage-"]')).toHaveCount(0);
	});

	test('the only new persistence is the namespaced reader-prefs key (no account/sync)', async ({
		page
	}) => {
		await blockThirdPartyRequests(page);
		const requests: string[] = [];
		page.on('request', (request) => requests.push(request.url()));

		await page.goto(BB_TORNADO_URL);
		await waitForPassage(page, BB_TORNADO_ID);
		// Let the app's own index/version load traffic settle so the captured
		// window contains only our clicks, not unrelated app-initiated requests.
		await waitForInitialNetworkIdle(page);

		// Only requests made *by the reader-prefs interaction* matter here: clear
		// the captured list, then require it to stay empty (no usage-log or
		// account/sync transmission of any kind).
		requests.length = 0;
		await page.getByRole('button', { name: 'Reading settings' }).click();
		await page.getByRole('button', { name: 'Increase text size' }).click();
		await page.waitForTimeout(300);

		const keys = await page.evaluate(() => Object.keys(localStorage));
		expect(keys).toContain(READER_PREFS_KEY);
		expect(keys.some((key) => /account|auth|bookmark|note|user|session/i.test(key))).toBe(false);

		expect(requests).toEqual([]);
	});
});
