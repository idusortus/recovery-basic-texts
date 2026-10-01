import { expect, test } from '@playwright/test';
import {
	BB_TORNADO_ID,
	BB_TORNADO_URL,
	DR_PASSAGE_URL,
	TWELVE_PASSAGE_URL,
	blockThirdPartyRequests,
	expectUrl,
	installTtsMock,
	readTtsMock,
	removeTts,
	waitForInitialNetworkIdle,
	waitForPassage
} from './helpers';

/**
 * passage-reader-controls tasks 4.1–4.3 — Listen (text-to-speech).
 *
 * Spec: passage-view / "A Listen control reads the rendered full-text passage aloud".
 *
 * Real audio output cannot be asserted; the mock verifies the deterministic
 * control contract (speak/pause/resume/cancel, announced state, and that only
 * rendered full-text content is queued).
 */
test.describe('Listen control', () => {
	test('full-text page offers Listen; play/pause/resume/stop announce state and speak rendered text', async ({
		page
	}) => {
		await installTtsMock(page);
		await page.goto(BB_TORNADO_URL);
		await waitForPassage(page, BB_TORNADO_ID);

		const listen = page.getByRole('button', { name: 'Listen' });
		await expect(listen).toBeVisible();
		await expect(listen).toHaveAttribute('aria-pressed', 'false');

		await listen.click();
		const pause = page.getByRole('button', { name: 'Pause' });
		await expect(pause).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByText('Listening', { exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();

		let mock = await readTtsMock(page);
		expect(mock.spoken.length).toBeGreaterThan(0);
		expect(mock.spoken.join(' ')).toContain('tornado');

		// Only the rendered full-text content is spoken: every queued chunk is a
		// substring of the rendered article text.
		const rendered = (
			await page.locator('article').evaluate((el) => (el as HTMLElement).innerText)
		)
			.replace(/\s+/g, ' ')
			.trim();
		for (const chunk of mock.spoken) {
			expect(rendered).toContain(chunk.replace(/\s+/g, ' ').trim());
		}

		await pause.click();
		await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
		await expect(page.getByText('Paused', { exact: true })).toBeVisible();
		mock = await readTtsMock(page);
		expect(mock.paused).toBeGreaterThan(0);

		await page.getByRole('button', { name: 'Resume' }).click();
		await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
		await expect(page.getByText('Listening', { exact: true })).toBeVisible();
		mock = await readTtsMock(page);
		expect(mock.resumed).toBeGreaterThan(0);

		await page.getByRole('button', { name: 'Stop' }).click();
		await expect(page.getByRole('button', { name: 'Listen' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Stop' })).toHaveCount(0);
		await expect(page.getByText('Stopped', { exact: true })).toBeVisible();
		mock = await readTtsMock(page);
		expect(mock.cancelled).toBeGreaterThan(0);
	});

	test('same-route chapter navigation cancels speech', async ({ page }) => {
		await installTtsMock(page);
		await page.goto(BB_TORNADO_URL);
		await waitForPassage(page, BB_TORNADO_ID);

		await page.getByRole('button', { name: 'Listen' }).click();
		await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
		const before = (await readTtsMock(page)).cancelled;

		// Chapter navigation is a same-route param change (no full reload).
		const nav = page.getByRole('navigation', { name: 'Chapter navigation' });
		await nav.getByRole('link').last().click();

		await expect(page.getByRole('button', { name: 'Listen' })).toBeVisible();
		await expect
			.poll(async () => (await readTtsMock(page)).cancelled)
			.toBeGreaterThan(before);
	});

	test('leaving the passage page cancels speech', async ({ page }) => {
		await installTtsMock(page);
		await page.goto(BB_TORNADO_URL);
		await waitForPassage(page, BB_TORNADO_ID);

		await page.getByRole('button', { name: 'Listen' }).click();
		await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
		const before = (await readTtsMock(page)).cancelled;

		await page.getByRole('link', { name: 'Back to search' }).click();
		await expectUrl(page, /\/$/);

		await expect
			.poll(async () => (await readTtsMock(page)).cancelled)
			.toBeGreaterThan(before);
	});

	test('no Listen control on protected (DR) or snippet (12&12) passages', async ({ page }) => {
		await installTtsMock(page);

		await page.goto(DR_PASSAGE_URL);
		await expect(page.getByText('Full text not available')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Listen' })).toHaveCount(0);

		await page.goto(TWELVE_PASSAGE_URL);
		await expect(page.getByText('Full text not available')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Listen' })).toHaveCount(0);
	});

	test('when speech synthesis is unavailable the control is absent and nothing errors', async ({
		page
	}) => {
		const errors: string[] = [];
		page.on('pageerror', (err) => errors.push(err.message));
		await removeTts(page);
		await page.goto(BB_TORNADO_URL);
		await waitForPassage(page, BB_TORNADO_ID);

		// The rest of the full-text page still works...
		await expect(page.getByRole('button', { name: 'Reading settings' })).toBeVisible();
		// ...but no working Listen control is offered.
		await expect(page.getByRole('button', { name: 'Listen' })).toHaveCount(0);
		await expect(page.getByText(/Failed to load/)).toHaveCount(0);
		expect(errors).toEqual([]);
	});

	test('Listen makes no external/network request and no usage-log call', async ({ page }) => {
		await installTtsMock(page);
		await blockThirdPartyRequests(page);
		const requests: string[] = [];
		page.on('request', (request) => requests.push(request.url()));

		await page.goto(BB_TORNADO_URL);
		await waitForPassage(page, BB_TORNADO_ID);
		// Let the app's own index/version load traffic settle so the captured
		// window is deterministic and contains only the Listen interaction.
		await waitForInitialNetworkIdle(page);
		await page.waitForTimeout(300);

		// Only requests made *by the Listen interaction* matter here: clear the
		// captured list, then require it to stay empty. This rejects *any* request
		// during the interaction — not just aa.org or /api/log.
		requests.length = 0;
		await page.getByRole('button', { name: 'Listen' }).click();
		await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
		await page.waitForTimeout(500);

		expect(requests).toEqual([]);
	});
});
