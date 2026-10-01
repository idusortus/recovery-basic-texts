import { expect, type Page } from '@playwright/test';

/**
 * Shared selectors, URLs and browser-side mocks for the E2E suite.
 *
 * Selectors favor role/name/text; the few id-based hooks (`#search-input`,
 * `#passage-<id>`) are already part of the product markup and are not added for
 * tests.
 */

// ─── Known corpus fixtures (verified against static/index/passages.json) ───────

/** Full-text Big Book passage carrying pageRef `p.103` and the word "tornado". */
export const BB_TORNADO_ID = 'big-book-2ed-chapter-6-into-action-p0142';
export const BB_TORNADO_URL = `/passage/big-book-2ed/${BB_TORNADO_ID}`;

/** Protected concordance-only Daily Reflections entry (no pageRef, no full text). */
export const DR_PASSAGE_ID = 'dr-01-12';
export const DR_PASSAGE_URL = `/passage/daily-reflections/${DR_PASSAGE_ID}`;

/** Snippet (protected) 12&12 passage. */
export const TWELVE_PASSAGE_URL =
	'/passage/twelve-steps-traditions/twelve-steps-traditions-step-one-p0004';

/** A single term that occurs in all three enabled sources (BB / 12&12 / DR). */
export const ALL_SOURCES_QUERY = 'fear';
/** A single term with a single Big Book hit (the tornado passage). */
export const TORNADO_QUERY = 'tornado';
/** A high-frequency term that produces a dense, scrollable result list. */
export const DENSE_QUERY = 'god';

export const RECENT_KEY = 'basictexts-recent-searches';
export const READER_PREFS_KEY = 'basictexts-reader-prefs';

// ─── Navigation helpers ────────────────────────────────────────────────────────

export async function gotoHome(page: Page): Promise<void> {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /There is a solution/ })).toBeVisible();
	// The hero is server-rendered; wait until hydration has run and the search
	// index has loaded (the load-status paragraph disappears) before interacting,
	// so `bind:value` and the keydown handlers are attached.
	await expect(page.locator('main p[role="status"]')).toHaveCount(0, { timeout: 30_000 });
}

/** Type a query and submit it with Enter (an explicit submit). */
export async function submitSearch(page: Page, query: string): Promise<void> {
	const input = page.locator('#search-input');
	await input.fill(query);
	await input.press('Enter');
}

/** Wait until the results summary line is rendered. */
export async function waitForResults(page: Page): Promise<void> {
	await expect(page.locator('main p[aria-live="polite"]').first()).toBeVisible({
		timeout: 20_000
	});
}

/** Clear the search input and wait for the home/empty state to return. */
export async function returnHome(page: Page): Promise<void> {
	await page.locator('#search-input').fill('');
	await expect(page.getByRole('heading', { name: /There is a solution/ })).toBeVisible();
}

/** Wait until a specific passage paragraph is rendered on the passage page. */
export async function waitForPassage(page: Page, passageId: string): Promise<void> {
	await expect(page.locator(`#passage-${passageId}`)).toBeVisible({ timeout: 20_000 });
}

/**
 * Wait for the page's initial network activity to go idle.
 *
 * Loading the index fetches its assets (`minisearch.json`, `passages.json`,
 * `index-meta.json`, then `concordance.json` in the background), and each store
 * update triggers the root layout's `/index/index-meta.json` version check — so
 * several app-initiated requests settle just after the passage first renders.
 * Tests that assert a specific interaction makes *zero* network requests must
 * exclude this unrelated load traffic. Call after arrival and before clearing
 * the captured request list. `networkidle` ignores the Vite HMR websocket.
 *
 * Resolves even if the checks never fire or the load fails.
 */
export function waitForInitialNetworkIdle(page: Page): Promise<void> {
	return page
		.waitForLoadState('networkidle', { timeout: 20_000 })
		.catch(() => undefined);
}

/**
 * Abort every non-localhost request so "zero network request" tests are
 * hermetic and deterministic.
 *
 * The app shell loads third-party resources (Google Analytics, Google Fonts)
 * whose delivery timing depends on the network and is unrelated to the
 * interaction under test; without this they can land in a captured window and
 * make the assertion flaky. Aborted requests still raise `request` events, so
 * an app-initiated call to *any* non-local host during the interaction is still
 * detected by an empty-list assertion. Call before `page.goto`.
 */
export async function blockThirdPartyRequests(page: Page): Promise<void> {
	await page.route('**/*', (route) => {
		const url = new URL(route.request().url());
		if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
			return route.continue();
		}
		return route.abort();
	});
}

export function recentGroup(page: Page) {
	return page.getByRole('group', { name: 'Recent searches' });
}

/**
 * Assert the current URL matches `pattern`.
 *
 * Playwright's `toHaveURL` can hang on SvelteKit's client-side route changes
 * (no `framenavigated` event), so poll `page.url()` directly instead.
 */
export async function expectUrl(page: Page, pattern: RegExp, timeout = 10_000): Promise<void> {
	await expect.poll(() => page.url(), { timeout }).toMatch(pattern);
}

export function recentEntry(page: Page, query: string) {
	return page.getByRole('button', { name: `Search again for ${query}`, exact: true });
}

// ─── Browser-side mocks (installed via addInitScript) ──────────────────────────

/**
 * Install a deterministic `speechSynthesis` mock. Records every call on
 * `window.__ttsMock` so tests can assert speak/pause/resume/cancel without real
 * audio (real audio output is a residual manual gap).
 */
export async function installTtsMock(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const mock = {
			spoken: [] as string[],
			utterances: [] as unknown[],
			paused: 0,
			resumed: 0,
			cancelled: 0
		};
		(window as unknown as { __ttsMock: typeof mock }).__ttsMock = mock;

		class MockUtterance {
			text: string;
			onend: (() => void) | null = null;
			onerror: (() => void) | null = null;
			constructor(text: string) {
				this.text = text;
			}
		}

		const synth = {
			speak(u: { text: string }) {
				mock.spoken.push(u.text);
				mock.utterances.push(u);
			},
			pause() {
				mock.paused += 1;
			},
			resume() {
				mock.resumed += 1;
			},
			cancel() {
				mock.cancelled += 1;
			},
			getVoices() {
				return [];
			}
		};

		Object.defineProperty(window, 'SpeechSynthesisUtterance', {
			configurable: true,
			writable: true,
			value: MockUtterance
		});
		Object.defineProperty(window, 'speechSynthesis', {
			configurable: true,
			get: () => synth
		});
	});
}

/** Remove the speech-synthesis APIs so `isTtsSupported` returns false. */
export async function removeTts(page: Page): Promise<void> {
	await page.addInitScript(() => {
		Object.defineProperty(window, 'speechSynthesis', {
			configurable: true,
			get: () => undefined
		});
		Object.defineProperty(window, 'SpeechSynthesisUtterance', {
			configurable: true,
			get: () => undefined
		});
	});
}

/**
 * Replace `navigator.clipboard.writeText` with a recorder (`window.__clipboard`)
 * so copy behavior is deterministic without depending on OS clipboard state.
 */
export async function installClipboardMock(page: Page): Promise<void> {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			get: () => ({
				writeText(text: string) {
					(window as unknown as { __clipboard: string }).__clipboard = text;
					return Promise.resolve();
				},
				readText() {
					return Promise.resolve(
						(window as unknown as { __clipboard?: string }).__clipboard ?? ''
					);
				}
			})
		});
	});
}

/** Make only the reader-prefs storage key throw, leaving the rest of the app intact. */
export async function blockReaderPrefsStorage(page: Page): Promise<void> {
	await page.addInitScript((key: string) => {
		const origGet = Storage.prototype.getItem;
		const origSet = Storage.prototype.setItem;
		Storage.prototype.getItem = function (k: string) {
			if (k === key) throw new Error('storage disabled for test');
			return origGet.call(this, k);
		};
		Storage.prototype.setItem = function (k: string, v: string) {
			if (k === key) throw new Error('storage disabled for test');
			return origSet.call(this, k, v);
		};
	}, READER_PREFS_KEY);
}

export async function readTtsMock(page: Page) {
	return page.evaluate(
		() =>
			(window as unknown as { __ttsMock: { spoken: string[]; paused: number; resumed: number; cancelled: number } })
				.__ttsMock
	);
}

export async function readClipboard(page: Page): Promise<string> {
	return page.evaluate(
		() => (window as unknown as { __clipboard?: string }).__clipboard ?? ''
	);
}
