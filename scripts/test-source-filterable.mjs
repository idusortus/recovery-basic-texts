#!/usr/bin/env node
/**
 * Dependency-free tests for the registry-driven `filterable` flag.
 *
 * Run with: `pnpm run test:source-filterable`.
 *
 * The contract under test (reference-texts spec): `filterable` separates the
 * source-filter chips from the search index. It is a registry field defaulting
 * to `true`, set `false` only on the four reference sources, and validated as
 * an optional boolean. Because a `.svelte` page cannot be imported, the
 * page-level consumers (the derived `filterableSources` default set, the
 * "all filterable selected ⇒ no filter" sentinel, and the `/sources` listing of
 * all sources) are asserted by source-scanning the page, and the registry
 * data itself is loaded through the real loader.
 *
 * Reference-texts / reference-reader — registry flag and chips.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The app loader lets Node import `registry.ts` (extensionless `$lib/*` and
// attribute-less JSON imports); the module itself does the validation.
register('./search-test-loader.mjs', import.meta.url);
const { allSources, enabledSources, getSourceById } = await import(
	'../src/lib/corpus/registry.ts'
);

const REFERENCE_IDS = ['twelve-steps', 'twelve-traditions', 'twelve-concepts', 'promises-and-prayers'];

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

// ─── Registry data ───────────────────────────────────────────────────────────

console.log('source-filterable: registry flag');

test('the four reference ids are present in the registry', () => {
	for (const id of REFERENCE_IDS) {
		assert.ok(getSourceById(id), `expected registered source "${id}"`);
	}
});

test('the four reference ids are non-filterable', () => {
	for (const id of REFERENCE_IDS) {
		assert.equal(getSourceById(id)?.filterable, false, `${id} must set filterable:false`);
	}
});

test('every other source is filterable (absent defaults to true)', () => {
	for (const source of allSources) {
		if (REFERENCE_IDS.includes(source.id)) continue;
		assert.equal(source.filterable, true, `${source.id} must default to filterable:true`);
	}
});

test('exactly the four reference ids opt out of filtering', () => {
	const nonFilterable = allSources.filter((s) => s.filterable === false).map((s) => s.id);
	assert.deepEqual([...nonFilterable].sort(), [...REFERENCE_IDS].sort());
});

// ─── Loader validation semantics (in-memory, mirrors validateSource) ─────────

console.log('source-filterable: validation of the optional field');

/** A minimal copy of the loader's `filterable` validation rule. */
function coerceFilterable(raw) {
	if (raw !== undefined && raw !== null && typeof raw !== 'boolean') {
		throw new Error('expected boolean when present');
	}
	return raw === undefined || raw === null ? true : raw;
}

test('an absent `filterable` defaults to true', () => {
	assert.equal(coerceFilterable(undefined), true);
});

test('a null `filterable` defaults to true', () => {
	assert.equal(coerceFilterable(null), true);
});

test('a present boolean is preserved', () => {
	assert.equal(coerceFilterable(false), false);
	assert.equal(coerceFilterable(true), true);
});

test('a present non-boolean value is rejected', () => {
	assert.throws(() => coerceFilterable('false'), /boolean/);
	assert.throws(() => coerceFilterable(0), /boolean/);
	assert.throws(() => coerceFilterable({}), /boolean/);
});

// ─── Derived default filter set ──────────────────────────────────────────────

console.log('source-filterable: derived filterableSources default set');

const filterableSources = enabledSources.filter((s) => s.filterable !== false);

test('the default filter set excludes every reference id', () => {
	for (const id of REFERENCE_IDS) {
		assert.ok(
			!filterableSources.some((s) => s.id === id),
			`${id} must not be in the default filter set`
		);
	}
});

test('the filterable set is exactly the enabled sources minus the three enabled reference ids', () => {
	// twelve-concepts is disabled, so it is already excluded by `enabledSources`.
	const expected = new Set(
		enabledSources.filter((s) => !REFERENCE_IDS.includes(s.id)).map((s) => s.id)
	);
	assert.deepEqual(new Set(filterableSources.map((s) => s.id)), expected);
});

test('the full source set still includes all four reference ids (search/index untouched)', () => {
	for (const id of REFERENCE_IDS) {
		assert.ok(
			allSources.some((s) => s.id === id),
			`${id} must remain in the full registry`
		);
	}
});

test('an enabled reference source stays in enabledSources (and thus searchable)', () => {
	for (const id of ['twelve-steps', 'twelve-traditions', 'promises-and-prayers']) {
		assert.ok(
			enabledSources.some((s) => s.id === id),
			`${id} must remain enabled/indexed`
		);
	}
});

// ─── Page consumers (source-scanned) ─────────────────────────────────────────

console.log('source-filterable: page consumers');

const pageSource = readFileSync(resolve(root, 'src/routes/+page.svelte'), 'utf8');

test('the page derives one named `filterableSources` list from the registry flag', () => {
	assert.match(
		pageSource,
		/const filterableSources = \$derived\(\s*enabledSources\.filter\(\s*\(s\)\s*=>\s*s\.filterable !== false\s*\)\s*\)/,
		'the page must derive filterableSources via the registry flag'
	);
});

test('the default active set is seeded from filterableSources', () => {
	assert.match(
		pageSource,
		/new Set\(untrack\(\(\) => filterableSources\.map\(\(s\) => s\.id\)\)\)/,
		'activeSourceIds must be seeded from filterableSources'
	);
});

test('the chip {#each} iterates filterableSources', () => {
	assert.match(
		pageSource,
		/\{#each filterableSources as source \(source\.id\)\}/,
		'the Filter Sources chips must iterate filterableSources'
	);
});

test('the URL default/known id list uses filterableSources', () => {
	assert.match(
		pageSource,
		/parseSearchUrl\(\s*\$page\.url\.search,[\s\S]*?filterableSources\.map\(\(s\) => s\.id\)\s*\)/,
		'parseSearchUrl must receive the filterable default set'
	);
});

test('task 2.4: the sentinel compares against filterableSources.length', () => {
	assert.match(
		pageSource,
		/if \(activeSourceIds\.size >= filterableSources\.length\) return null;/,
		'the all-selected sentinel must compare against filterableSources.length'
	);
});

test('task 2.4: no consumer still compares the default filter set against enabledSources.length', () => {
	assert.ok(
		!/activeSourceIds\.size\s*>=\s*enabledSources\.length/.test(pageSource),
		'the sentinel must not reference enabledSources.length'
	);
});

test('no src file hard-codes the reference ids as a chip-exclusion list', () => {
	const files = [];
	const walk = (dir) => {
		for (const entry of readdirSync(dir)) {
			const full = resolve(dir, entry);
			if (statSync(full).isDirectory()) walk(full);
			else if (/\.(svelte|ts|js)$/.test(entry)) files.push(full);
		}
	};
	walk(resolve(root, 'src'));
	for (const id of REFERENCE_IDS) {
		for (const file of files) {
			// The reference reader's view table intentionally names each source;
			// it is a reader mapping, not a chip-exclusion list.
			if (file.includes('/src/routes/reference/') || file.includes('/src/lib/reference/')) continue;
			assert.ok(
				!readFileSync(file, 'utf8').includes(`'${id}'`),
				`${file} must not hard-code the reference id "${id}"`
			);
		}
	}
});

// ─── /sources lists all registered sources (task 2.5) ────────────────────────

console.log('source-filterable: /sources listing (task 2.5)');

const sourcesPage = readFileSync(resolve(root, 'src/routes/sources/+page.svelte'), 'utf8');

test('/sources iterates allSources, not enabledSources or filterableSources', () => {
	assert.match(
		sourcesPage,
		/\{#each allSources as source \(source\.id\)\}/,
		'/sources must list every registered source'
	);
	assert.ok(!/#each enabledSources/.test(sourcesPage), '/sources must not filter to enabled sources');
	assert.ok(
		!/#each filterableSources/.test(sourcesPage),
		'/sources must not be narrowed by filterable'
	);
});

test('/sources therefore includes the four reference ids (disabled one included)', () => {
	for (const id of REFERENCE_IDS) {
		const source = getSourceById(id);
		assert.ok(source, `${id} must be in allSources`);
		// The card renders even when !source.enabled (dimmed "Coming soon").
		assert.equal(typeof source.enabled, 'boolean');
	}
});

// ─── Default search still reaches non-filterable sources (tasks 2.2 / 2.4) ───
// Drive the real search service against the prebuilt index. The default (no
// `sourceFilter`, what `activeSourceList() === null` produces when every
// filterable chip is selected) must still return a non-filterable source.

console.log('source-filterable: default search reach (tasks 2.2 / 2.4)');

const repoRoot = root;
const indexDir = resolve(repoRoot, 'static', 'index');

async function loadSearchService() {
	if (!existsSync(resolve(indexDir, 'minisearch.json'))) {
		throw new Error('static/index/* is missing — run `pnpm run build:index` first.');
	}
	const files = {
		'/index/minisearch.json': readFileSync(resolve(indexDir, 'minisearch.json'), 'utf8'),
		'/index/passages.json': readFileSync(resolve(indexDir, 'passages.json'), 'utf8'),
		'/index/index-meta.json': readFileSync(resolve(indexDir, 'index-meta.json'), 'utf8'),
		'/index/concordance.json': readFileSync(resolve(indexDir, 'concordance.json'), 'utf8')
	};
	globalThis.fetch = async (url) => {
		const body = files[url];
		if (body === undefined) return { ok: false, status: 404, json: async () => ({}) };
		return { ok: true, status: 200, json: async () => JSON.parse(body) };
	};
	const mod = await import(`../src/lib/search/index.ts?source-filterable`);
	await mod.loadSearchIndex();
	const { get } = await import('svelte/store');
	for (let i = 0; i < 100 && !get(mod.concordanceReady); i++) {
		await new Promise((r) => setTimeout(r, 2));
	}
	return mod;
}

const searchModule = await loadSearchService();

test('a default search for "promises" reaches the non-filterable promises-and-prayers source', () => {
	const ids = new Set(searchModule.search('promises').map((g) => g.source.id));
	assert.ok(
		ids.has('promises-and-prayers'),
		`"promises" must still return promises-and-prayers (got: ${[...ids].join(', ') || 'none'})`
	);
});

test('task 2.4: the all-filterable-selected sentinel yields an unfiltered default search', () => {
	// With every filterable chip selected, activeSourceList() returns null, so
	// search runs with no `sourceFilter`. Assert that the unfiltered default
	// reaches a source that is indexed but has no chip.
	const filterableIds = filterableSources.map((s) => s.id);
	assert.equal(filterableIds.length, enabledSources.length - 3, 'three enabled reference sources opt out');
	const unfiltered = searchModule.search('promises');
	assert.ok(
		unfiltered.some((g) => g.source.id === 'promises-and-prayers'),
		'default (null) filter must include non-filterable sources'
	);
	// And confirm the three filterable ids are a strict subset of the default set.
	assert.ok(filterableIds.every((id) => enabledSources.some((s) => s.id === id)));
});

console.log(`\nAll ${passed} source-filterable checks passed.`);
