#!/usr/bin/env node
/**
 * Dependency-free tests for the local recent-search helpers.
 *
 * Run with: `pnpm run test:recent-searches`.
 *
 * Contract under test (search-ui spec): a small list of the most recent distinct
 * submitted queries is kept locally — trimmed, blank-ignored, deduped
 * case-insensitively (newest casing wins), capped, defensively parsed, and
 * clearable — and `recent-searches.ts` never transmits or logs the list.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const {
	RECENT_SEARCH_KEY,
	RECENT_SEARCH_LIMIT,
	addRecentSearch,
	parseRecentSearches,
	serializeRecentSearches,
	clearRecentSearches
} = await import('../src/lib/search/recent-searches.ts');

assert.equal(RECENT_SEARCH_KEY, 'basictexts-recent-searches');
assert.equal(RECENT_SEARCH_LIMIT, 8);

// Add prepends and trims.
assert.deepEqual(addRecentSearch([], '  Fear  '), ['Fear']);
assert.deepEqual(addRecentSearch(['Anger'], 'Fear'), ['Fear', 'Anger']);

// Blank / whitespace-only input is ignored (list unchanged).
assert.deepEqual(addRecentSearch(['Fear'], ''), ['Fear']);
assert.deepEqual(addRecentSearch(['Fear'], '   '), ['Fear']);

// Case-insensitive dedupe moves the entry to most-recent and keeps the newest casing.
assert.deepEqual(addRecentSearch(['Fear', 'Anger'], 'fear'), ['fear', 'Anger']);
assert.deepEqual(addRecentSearch(['fear', 'Anger'], 'FEAR'), ['FEAR', 'Anger']);

// The cap evicts the oldest.
let many = [];
for (let i = 0; i < RECENT_SEARCH_LIMIT + 2; i++) many = addRecentSearch(many, `q${i}`);
assert.equal(many.length, RECENT_SEARCH_LIMIT);
assert.equal(many[0], `q${RECENT_SEARCH_LIMIT + 1}`);
assert.ok(!many.includes('q0'), 'oldest entry is evicted');

// An explicit cap is honored.
assert.deepEqual(addRecentSearch(['a', 'b'], 'c', 2), ['c', 'a']);

// Parsing is defensive.
assert.deepEqual(parseRecentSearches(null), []);
assert.deepEqual(parseRecentSearches(undefined), []);
assert.deepEqual(parseRecentSearches(''), []);
assert.deepEqual(parseRecentSearches('not json'), []);
assert.deepEqual(parseRecentSearches('{"a":1}'), []);
assert.deepEqual(parseRecentSearches('"a string"'), []);
assert.deepEqual(parseRecentSearches('[1,"Fear",null,"","  ",7]'), ['Fear']);
assert.deepEqual(parseRecentSearches('["Fear","fear","Anger"]'), ['Fear', 'Anger']);
assert.deepEqual(parseRecentSearches(JSON.stringify(['a', 'b', 'c']), 2), ['a', 'b']);

// Serialize round-trips through parse.
const roundTrip = ['Fear', 'Anger'];
assert.deepEqual(parseRecentSearches(serializeRecentSearches(roundTrip)), roundTrip);

// Clear removes exactly the namespaced key.
const removed = [];
const fakeStorage = { removeItem: (key) => removed.push(key) };
clearRecentSearches(fakeStorage);
assert.deepEqual(removed, [RECENT_SEARCH_KEY]);

// A failing storage is a no-op, never an error.
clearRecentSearches({
	removeItem() {
		throw new Error('storage unavailable');
	}
});

// Hardening: the local-only module must never transmit or log the list.
const source = readFileSync(
	new URL('../src/lib/search/recent-searches.ts', import.meta.url),
	'utf8'
);
assert.ok(!/\bfetch\b/.test(source), 'recent-searches.ts must not call fetch');
assert.ok(!/enqueueLog/.test(source), 'recent-searches.ts must not reference enqueueLog');
assert.ok(!/XMLHttpRequest|sendBeacon/.test(source), 'recent-searches.ts must not transmit');

// Cross-file hardening: the pure module cannot transmit by construction, so the
// real risk is a call site handing the STORED LIST to the network/logging
// surface. Assert against the actual consumer component, not the pure module.
const pageSource = readFileSync(
	new URL('../src/routes/+page.svelte', import.meta.url),
	'utf8'
);
assert.ok(
	!/enqueueLog\([^;]*recent/i.test(pageSource),
	'+page.svelte must not pass the stored recent list to enqueueLog'
);
assert.ok(
	!/submitLog\([^;]*recent/i.test(pageSource),
	'+page.svelte must not pass the stored recent list to submitLog'
);
assert.ok(
	!/\bfetch\([^;]*recent/i.test(pageSource),
	'+page.svelte must not pass the stored recent list to fetch'
);
// The re-run path still logs only the activated query, never the list.
assert.ok(
	/enqueueLog\(\s*q\.trim\(/.test(pageSource),
	'+page.svelte must log the activated query via enqueueLog(q.trim(...))'
);

console.log('[test-recent-searches] ✓ All checks passed');
