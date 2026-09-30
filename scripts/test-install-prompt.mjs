#!/usr/bin/env node
/**
 * Dependency-free test for install-prompt initialization.
 *
 * Run with: `pnpm run test:install-prompt`.
 *
 * Node's built-in TypeScript type-stripping (Node >= 22.18 / 23.6) lets us
 * import `src/lib/stores/install.ts` directly — no test framework, no build
 * step. A fake `window` records listener registrations so we can assert the
 * module registers exactly one set, even when initialized more than once.
 *
 * Contract under test (app-shell spec): the PWA install prompt is initialized
 * exactly once per page load.
 */
import assert from 'node:assert/strict';

const registered = [];
globalThis.window = {
	addEventListener(type, handler) {
		registered.push({ type, handler });
	}
};

const { initInstallPrompt, canInstall } = await import('../src/lib/stores/install.ts');

initInstallPrompt();
initInstallPrompt();
initInstallPrompt();

const beforeinstall = registered.filter((entry) => entry.type === 'beforeinstallprompt');
const appinstalled = registered.filter((entry) => entry.type === 'appinstalled');

assert.equal(beforeinstall.length, 1, 'beforeinstallprompt registered exactly once');
assert.equal(appinstalled.length, 1, 'appinstalled registered exactly once');

// The retained handler still drives the install-available state.
let canInstallValue = false;
const unsubscribe = canInstall.subscribe((value) => {
	canInstallValue = value;
});

beforeinstall[0].handler({ preventDefault() {} });
assert.equal(canInstallValue, true, 'beforeinstallprompt marks the app installable');

appinstalled[0].handler();
assert.equal(canInstallValue, false, 'appinstalled clears the installable state');

unsubscribe();

console.log('[test-install-prompt] ✓ All checks passed');
