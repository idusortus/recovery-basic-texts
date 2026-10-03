#!/usr/bin/env node
/**
 * Dependency-free guard tests for the `/reference` reader.
 *
 * Run with: `pnpm run test:reference-reader`.
 *
 * The reader is a `.svelte` page and cannot be imported, so its guards are
 * asserted by source-scanning the page and by importing the pure view table.
 * Contract under test (reference-reader spec): the reader loads text only from
 * shipped corpus data (no external fetch), reads passages only after an
 * enabled/full-text guard, the gated branch returns before touching
 * `getPassages()`, no Twelve Concepts text is reachable, no user-data surface
 * is introduced, and the view key → source id mapping cannot drift.
 *
 * reference-reader — offline loading, gating, and view mapping.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The app loader resolves `$lib/*`; the view table is pure and import-free.
register('./search-test-loader.mjs', import.meta.url);
const { REFERENCE_VIEWS, DEFAULT_REFERENCE_VIEW_KEY, resolveReferenceView } = await import(
	'../src/lib/reference/views.ts'
);

const readerPath = resolve(root, 'src/routes/reference/+page.svelte');
const readerSource = readFileSync(readerPath, 'utf8');

const EXPECTED_MAPPING = {
	steps: 'twelve-steps',
	traditions: 'twelve-traditions',
	concepts: 'twelve-concepts',
	promises: 'promises-and-prayers'
};

let passed = 0;
function test(name, fn) {
	try {
		fn();
		passed += 1;
		console.log(`  ok  ${name}`);
	} catch (error) {
		console.error(`FAIL  ${name}`);
		throw error;
	}
}

// ─── View table (key → source id) ────────────────────────────────────────────

console.log('reference-reader: view table mapping');

test('the view table maps each key to the exact expected source id', () => {
	for (const [key, sourceId] of Object.entries(EXPECTED_MAPPING)) {
		const view = REFERENCE_VIEWS.find((v) => v.key === key);
		assert.ok(view, `expected a view for key "${key}"`);
		assert.equal(view.sourceId, sourceId, `view "${key}" must map to "${sourceId}"`);
	}
});

test('the view table declares exactly the four reference views', () => {
	assert.deepEqual(
		[...REFERENCE_VIEWS].map((v) => v.key).sort(),
		Object.keys(EXPECTED_MAPPING).sort()
	);
});

test('each of the four reference source ids appears exactly once in the table', () => {
	const ids = REFERENCE_VIEWS.map((v) => v.sourceId);
	for (const sourceId of Object.values(EXPECTED_MAPPING)) {
		assert.equal(
			ids.filter((id) => id === sourceId).length,
			1,
			`source id "${sourceId}" must appear exactly once`
		);
	}
});

test('the default view resolves for a missing/unknown key', () => {
	assert.equal(DEFAULT_REFERENCE_VIEW_KEY, 'steps');
	assert.equal(resolveReferenceView(null).sourceId, 'twelve-steps');
	assert.equal(resolveReferenceView('nonsense').sourceId, 'twelve-steps');
	assert.equal(resolveReferenceView(undefined).sourceId, 'twelve-steps');
});

test('a direct visit to each key resolves to its own view', () => {
	for (const [key, sourceId] of Object.entries(EXPECTED_MAPPING)) {
		assert.equal(resolveReferenceView(key).sourceId, sourceId);
	}
});

// ─── Offline loading: no external fetch ──────────────────────────────────────

console.log('reference-reader: offline loading');

test('the reader page makes no direct network call', () => {
	assert.ok(!/\bfetch\s*\(/.test(readerSource), 'the reader must not call fetch directly');
	assert.ok(!/XMLHttpRequest/.test(readerSource), 'the reader must not use XMLHttpRequest');
	assert.ok(!/sendBeacon/.test(readerSource), 'the reader must not use sendBeacon');
});

test('the reader page contains no external URL literal', () => {
	const urls = readerSource.match(/https?:\/\/[^\s'"]+/g) ?? [];
	assert.deepEqual(urls, [], `the reader must not embed external URLs: ${urls.join(', ')}`);
});

test('the reader loads content through the shipped index, not a network source', () => {
	assert.match(readerSource, /from '\$lib\/search\/index'/, 'must use the shipped search index');
	assert.match(readerSource, /loadSearchIndex\(\)/, 'must load the prebuilt index');
	assert.match(readerSource, /getPassages\(\)/, 'must read passages from the loaded index');
	assert.match(readerSource, /getSourceById\(/, 'must read the source from the registry');
});

// ─── Gating: guard before getPassages ────────────────────────────────────────

console.log('reference-reader: full-text guard');

test('the reader guards on enabled + full-text before reading passages', () => {
	const guardMatch = readerSource.match(/!src\.enabled \|\| src\.displayMode !== 'full-text'/);
	assert.ok(guardMatch, 'expected an `enabled`/`full-text` guard');
	const guardIndex = readerSource.indexOf(guardMatch[0]);
	const getPassagesMatch = readerSource.match(/=\s*getPassages\(\)/);
	assert.ok(getPassagesMatch, 'a getPassages() call must be present');
	const getPassagesIndex = readerSource.indexOf(getPassagesMatch[0]);
	assert.ok(
		guardIndex < getPassagesIndex,
		'the guard must appear before the getPassages() call in the reader effect'
	);
});

test('the gated branch returns before touching getPassages()', () => {
	const guardStart = readerSource.indexOf("!src.enabled || src.displayMode !== 'full-text'");
	const afterGuard = readerSource.slice(guardStart, guardStart + 200);
	assert.match(afterGuard, /return;/, 'the gated branch must return');
});

test('the gated branch renders the registry title and official link', () => {
	assert.match(readerSource, /\{source\.title\}/, 'the placeholder must show the title');
	assert.match(readerSource, /source\.officialUrl/, 'the placeholder must link to the official source');
	assert.match(readerSource, /copyright/i, 'the placeholder must state the copyright position');
});

test('no Twelve Concepts passage text is referenced or present in the corpus', () => {
	assert.ok(
		!/twelve-concepts/.test(readerSource),
		'the reader page must not name the Concepts source id (the view table owns it)'
	);
	assert.ok(
		!existsSync(resolve(root, 'corpus/sources/twelve-concepts.json')),
		'Twelve Concepts must ship no corpus file'
	);
	const passages = JSON.parse(readFileSync(resolve(root, 'static/index/passages.json'), 'utf8'));
	const conceptPassages = Object.values(passages).filter((p) => p.sourceId === 'twelve-concepts');
	assert.equal(conceptPassages.length, 0, 'no Twelve Concepts passage may be indexed');
});

// ─── No user-data surface ────────────────────────────────────────────────────

console.log('reference-reader: no user-data surface');

test('the reader introduces no auth, bookmark, note, or account surface', () => {
	const patterns = [
		[/\bbookmark/i, 'bookmark'],
		[/\bnotes?\b/i, 'note'],
		[/\bsign ?in\b/i, 'sign-in'],
		[/\bauth/i, 'auth'],
		[/\baccount/i, 'account']
	];
	for (const [pattern, label] of patterns) {
		assert.ok(!pattern.test(readerSource), `the reader must not reference ${label}`);
	}
});

test('the only storage the reader touches is the existing device-local reader prefs', () => {
	const storageKeys = readerSource.match(/localStorage\.setItem\(([^,]+)/g) ?? [];
	for (const call of storageKeys) {
		assert.match(
			call,
			/READER_PREFS_KEY/,
			`unexpected storage write: ${call}`
		);
	}
	// No server call, log enqueue, or telemetry from the reader.
	assert.ok(!/enqueueLog/.test(readerSource), 'the reader must not enqueue usage logs');
});

// ─── Accessibility / structure ───────────────────────────────────────────────

console.log('reference-reader: structure and selector');

test('the reader renders one h1 and a labeled view selector', () => {
	assert.equal((readerSource.match(/<h1\b/g) ?? []).length, 1, 'exactly one h1');
	assert.match(readerSource, /aria-label="Choose a reference text"/, 'the selector must be labeled');
	assert.match(readerSource, /aria-pressed=\{item\.key === view\.key\}/, 'active view must be exposed');
	assert.match(readerSource, /replaceState: true/, 'selection must be directly addressable');
	assert.match(readerSource, /keepFocus: true/, 'selection must keep focus');
});

test('the view selector offers a non-color active cue', () => {
	assert.match(readerSource, /aria-hidden="true" class="font-bold">✓/, 'active view needs a glyph cue');
});

console.log(`\nAll ${passed} reference-reader checks passed.`);
