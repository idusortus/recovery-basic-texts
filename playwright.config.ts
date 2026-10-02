import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config for the basictexts.org MVP.
 *
 * Runs a fresh SvelteKit dev server (port configurable via `PLAYWRIGHT_PORT`,
 * default 5173) and drives Chromium headless. Kept dependency-light (the repo
 * prefers minimal tooling): one browser, one project, a dev-server `webServer`,
 * and trace/screenshot only on failure.
 *
 * The suite converts the `manual (browser)` acceptance checks from the
 * archived `search-qol-improvements` and `passage-reader-controls` changes into
 * automated tests (see `e2e/`).
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 5173);
// Derive everything from PORT so the tests can only ever talk to the server
// this config starts — a separate base-URL override could point the tests at
// another checkout while `webServer` starts here.
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
	testDir: './e2e',
	// The index payloads are large (~9 MB) and the dev server is shared, so keep
	// execution serial for determinism rather than racing page loads.
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	timeout: 60_000,
	expect: { timeout: 10_000 },
	// List keeps console output; HTML produces `playwright-report/` for the CI
	// artifact upload. `open: 'never'` avoids launching a browser locally.
	reporter: [['list'], ['html', { open: 'never' }]],
	outputDir: 'test-results',
	use: {
		baseURL,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		// The result-card Copy and passage Copy/Share actions write to the
		// clipboard; grant the permissions so the real code path runs.
		permissions: ['clipboard-read', 'clipboard-write']
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: {
		// `pnpm exec vite dev` (not `pnpm run dev -- …`, which forwards a literal
		// `--` so Vite ignores the port and silently binds 5173). `--strictPort`
		// makes a genuinely occupied port fail loudly.
		command: `pnpm exec vite dev --port ${PORT} --strictPort`,
		url: baseURL,
		// Always start a fresh dev server. Silently reusing whatever already holds
		// the port could test a different checkout.
		reuseExistingServer: false,
		timeout: 120_000,
		stdout: 'ignore',
		stderr: 'pipe'
	}
});
