#!/usr/bin/env node
/**
 * Dependency-free tests for search URL-state serialize/parse.
 *
 * Run with: `pnpm run test:url-state`.
 *
 * Contract under test (search-ui spec): a filter/phrase change updates the
 * browser URL so the state is shareable, and a reload reproduces it.
 */
import assert from 'node:assert/strict';

const { serializeSearchUrl, parseSearchUrl } = await import('../src/lib/search/url-state.ts');

const KNOWN = ['big-book-2ed', 'twelve-steps-traditions', 'daily-reflections'];

// Default (all sources) omits the sources parameter.
assert.equal(serializeSearchUrl({ q: 'fear', phrase: false, sources: null }), 'q=fear');

// A subset writes the sources parameter, comma-joined.
assert.equal(
	serializeSearchUrl({ q: 'fear', phrase: false, sources: ['big-book-2ed', 'daily-reflections'] }),
	'q=fear&sources=big-book-2ed%2Cdaily-reflections'
);

// Phrase mode is flagged.
assert.equal(serializeSearchUrl({ q: 'higher power', phrase: true, sources: null }), 'q=higher+power&phrase=1');

// Round-trip.
const state = { q: 'acceptance', phrase: true, sources: ['big-book-2ed'] };
const parsed = parseSearchUrl(serializeSearchUrl(state), KNOWN);
assert.deepEqual(parsed, state, 'round-trip preserves the state');

// Parsing is defensive: unknown ids are dropped, all-unknown falls back to null.
assert.deepEqual(parseSearchUrl('?q=x&sources=bogus%2Cbig-book-2ed', KNOWN).sources, ['big-book-2ed']);
assert.equal(parseSearchUrl('?q=x&sources=bogus', KNOWN).sources, null);

// Parsing works with or without a leading '?'.
assert.deepEqual(parseSearchUrl('q=x&phrase=1', KNOWN), { q: 'x', phrase: true, sources: null });
assert.deepEqual(parseSearchUrl('', KNOWN), { q: '', phrase: false, sources: null });

// Empty query + phrase false serializes to an empty string.
assert.equal(serializeSearchUrl({ q: '', phrase: false, sources: null }), '');

console.log('[test-url-state] ✓ All checks passed');
