#!/usr/bin/env node
/**
 * Dependency-free tests for the reader display-preference helpers.
 *
 * Run with: `pnpm run test:reader-prefs`.
 *
 * Contract under test (passage-view spec): the full-text passage body offers a
 * finite font-size / line-spacing preference; the default applies NO override
 * (so the browser/user text size and the page's own leading win); a change can
 * return to the default; parsing is defensive; and the pure module never
 * transmits or logs the preference.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const {
	READER_PREFS_KEY,
	FONT_SIZE_STEPS,
	LINE_SPACING_STEPS,
	DEFAULT_READER_PREFS,
	resolveReaderPrefs,
	parseReaderPrefs,
	serializeReaderPrefs,
	stepFontSize,
	fontSizeRem,
	lineHeightValue
} = await import('../src/lib/passage/reader-prefs.ts');

// Namespaced key and default.
assert.equal(READER_PREFS_KEY, 'basictexts-reader-prefs');
assert.deepEqual(DEFAULT_READER_PREFS, { fontSize: 'default', lineSpacing: 'normal' });

// Step sets.
assert.deepEqual(FONT_SIZE_STEPS, ['default', 'large', 'larger', 'largest']);
assert.deepEqual(LINE_SPACING_STEPS, ['normal', 'relaxed']);

// Default / normal resolve to NO override.
assert.equal(fontSizeRem('default'), null);
assert.equal(lineHeightValue('normal'), null);

// A changed step resolves to an explicit value.
assert.equal(fontSizeRem('large'), '1.125rem');
assert.equal(fontSizeRem('larger'), '1.25rem');
assert.equal(fontSizeRem('largest'), '1.5rem');
assert.equal(lineHeightValue('relaxed'), 2.0);

// Steps strictly increase.
assert.ok(fontSizeRem('large').length > 0);
assert.ok(parseFloat(fontSizeRem('large')) < parseFloat(fontSizeRem('larger')));
assert.ok(parseFloat(fontSizeRem('larger')) < parseFloat(fontSizeRem('largest')));

// stepFontSize clamps at both ends (no wrap) and returns to default.
assert.equal(stepFontSize('default', -1), 'default');
assert.equal(stepFontSize('default', 1), 'large');
assert.equal(stepFontSize('large', -1), 'default', 'stepping down reaches the default (no override)');
assert.equal(stepFontSize('largest', 1), 'largest');
assert.equal(stepFontSize('largest', -1), 'larger');
assert.equal(stepFontSize('default', 0), 'default', 'a zero delta is a no-op');
assert.equal(stepFontSize('nonsense', 1), 'large', 'an unknown current clamps to default first');

// resolveReaderPrefs clamps unknown/missing members to the default.
assert.deepEqual(resolveReaderPrefs({}), DEFAULT_READER_PREFS);
assert.deepEqual(resolveReaderPrefs({ fontSize: 'largest' }), {
	fontSize: 'largest',
	lineSpacing: 'normal'
});
assert.deepEqual(resolveReaderPrefs({ fontSize: 'huge', lineSpacing: 'loose' }), DEFAULT_READER_PREFS);
assert.deepEqual(resolveReaderPrefs(null), DEFAULT_READER_PREFS);

// Parsing is defensive.
assert.deepEqual(parseReaderPrefs(null), DEFAULT_READER_PREFS);
assert.deepEqual(parseReaderPrefs(undefined), DEFAULT_READER_PREFS);
assert.deepEqual(parseReaderPrefs(''), DEFAULT_READER_PREFS);
assert.deepEqual(parseReaderPrefs('not json'), DEFAULT_READER_PREFS);
assert.deepEqual(parseReaderPrefs('42'), DEFAULT_READER_PREFS);
assert.deepEqual(parseReaderPrefs('"a string"'), DEFAULT_READER_PREFS);
assert.deepEqual(parseReaderPrefs('[]'), DEFAULT_READER_PREFS);
assert.deepEqual(parseReaderPrefs('{"fontSize":"largest","lineSpacing":"relaxed"}'), {
	fontSize: 'largest',
	lineSpacing: 'relaxed'
});
assert.deepEqual(parseReaderPrefs('{"fontSize":"huge"}'), DEFAULT_READER_PREFS);

// Serialize round-trips through parse.
const roundTrip = { fontSize: 'larger', lineSpacing: 'relaxed' };
assert.deepEqual(parseReaderPrefs(serializeReaderPrefs(roundTrip)), roundTrip);
assert.deepEqual(parseReaderPrefs(serializeReaderPrefs(DEFAULT_READER_PREFS)), DEFAULT_READER_PREFS);

// Hardening: the local-only module must never transmit or log the preference.
const source = readFileSync(new URL('../src/lib/passage/reader-prefs.ts', import.meta.url), 'utf8');
assert.ok(!/\bfetch\b/.test(source), 'reader-prefs.ts must not call fetch');
assert.ok(!/enqueueLog/.test(source), 'reader-prefs.ts must not reference enqueueLog');
assert.ok(!/XMLHttpRequest|sendBeacon/.test(source), 'reader-prefs.ts must not transmit');

console.log('[test-reader-prefs] ✓ All checks passed');
