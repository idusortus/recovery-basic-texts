#!/usr/bin/env node
/**
 * test-concordance-offsets.mjs
 *
 * Golden-file tests for the concordance tokenizer.
 * Verifies that tokenizeWithPositions produces character-accurate offsets
 * against known fixture text.
 *
 * Exits with code 1 on any failure.
 *
 * Usage:  node corpus/scripts/test-concordance-offsets.mjs
 *
 * Issue B — PR 2
 */

import { tokenizeWithPositions } from './concordance-utils.mjs';

let failures = 0;

function expect(label, actual, expected) {
	const a = JSON.stringify(actual);
	const e = JSON.stringify(expected);
	if (a !== e) {
		console.error(`  ✗ ${label}\n    expected: ${e}\n    actual:   ${a}`);
		failures++;
	} else {
		console.log(`  ✓ ${label}`);
	}
}

// ─── Fixture helpers ──────────────────────────────────────────────────────────

/**
 * Given the output of tokenizeWithPositions, find the first token matching
 * `normalized` and return its [start, end] pair — or null if not found.
 */
function firstOffset(tokens, normalized) {
	const t = tokens.find((tk) => tk.normalized === normalized);
	return t ? [t.start, t.end] : null;
}

/**
 * Given the output of tokenizeWithPositions, collect all [start, end] pairs
 * for tokens matching `normalized`.
 */
function allOffsets(tokens, normalized) {
	return tokens.filter((tk) => tk.normalized === normalized).map((tk) => [tk.start, tk.end]);
}

/**
 * Verify that the offset correctly slices the original text.
 */
function verifySlice(label, text, start, end, expectedSlice) {
	const slice = text.slice(start, end);
	if (slice !== expectedSlice) {
		console.error(`  ✗ ${label}: slice [${start},${end}] = "${slice}", expected "${expectedSlice}"`);
		failures++;
	} else {
		console.log(`  ✓ ${label}: slice [${start},${end}] = "${slice}"`);
	}
}

// ─── Test 1: Simple ASCII sentence ───────────────────────────────────────────

console.log('\n[test] Simple ASCII sentence');
{
	const text = 'Rarely have we seen a person fail';
	const tokens = tokenizeWithPositions(text);

	expect('rarely offset', firstOffset(tokens, 'rarely'), [0, 6]);
	expect('have offset',   firstOffset(tokens, 'have'),   [7, 11]);
	expect('we offset',     firstOffset(tokens, 'we'),     [12, 14]);
	expect('seen offset',   firstOffset(tokens, 'seen'),   [15, 19]);
	// "a" is single-char — filtered
	expect('a is filtered', firstOffset(tokens, 'a'), null);
	expect('person offset', firstOffset(tokens, 'person'), [22, 28]);
	expect('fail offset',   firstOffset(tokens, 'fail'),   [29, 33]);

	// Verify slice correctness
	verifySlice('rarely slice', text, 0, 6, 'Rarely');
	verifySlice('person slice', text, 22, 28, 'person');
}

// ─── Test 2: Contraction normalization ───────────────────────────────────────

console.log('\n[test] Contractions and apostrophes');
{
	const text = "We can't do it by ourselves.";
	const tokens = tokenizeWithPositions(text);

	// "can't" → normalized "cant", spans "can't" at position 3–8
	expect('cant normalized', firstOffset(tokens, 'cant'), [3, 8]);
	verifySlice('cant slice', text, 3, 8, "can't");

	// "We" → "we" at position 0
	expect('we offset', firstOffset(tokens, 'we'), [0, 2]);

	// "it" at position 12
	expect('it offset', firstOffset(tokens, 'it'), [12, 14]);

	// "ourselves" at position 18
	expect('ourselves offset', firstOffset(tokens, 'ourselves'), [18, 27]);
}

// ─── Test 3: Curly apostrophes ────────────────────────────────────────────────

console.log('\n[test] Curly apostrophes');
{
	const text = 'God\u2019s will for us';
	const tokens = tokenizeWithPositions(text);

	// "God's" → normalized "gods", spans "God's" at 0–5
	expect('gods normalized', firstOffset(tokens, 'gods'), [0, 5]);
	verifySlice('gods slice', text, 0, 5, 'God\u2019s');

	expect('will offset', firstOffset(tokens, 'will'), [6, 10]);
	expect('for offset',  firstOffset(tokens, 'for'),  [11, 14]);
	// "us" is 2 chars — should be included
	expect('us offset', firstOffset(tokens, 'us'), [15, 17]);
}

// ─── Test 4: Multiple occurrences of same term ───────────────────────────────

console.log('\n[test] Multiple occurrences');
{
	const text = 'We knew we could not do it alone. We had tried.';
	const tokens = tokenizeWithPositions(text);

	const weOffsets = allOffsets(tokens, 'we');
	expect('three "we" occurrences', weOffsets.length, 3);
	expect('first we', weOffsets[0], [0, 2]);
	expect('second we', weOffsets[1], [8, 10]);
	expect('third we', weOffsets[2], [34, 36]);

	// Verify all slices are "We" or "we"
	for (const [s, e] of weOffsets) {
		const slice = text.slice(s, e).toLowerCase();
		if (slice !== 'we') {
			console.error(`  ✗ we slice [${s},${e}] = "${text.slice(s, e)}", not "we"`);
			failures++;
		}
	}
}

// ─── Test 5: Numbers ─────────────────────────────────────────────────────────

console.log('\n[test] Numbers in text');
{
	// "There were 300 members by 1939."
	//  0123456789012345678901234567890
	//            1111111111222222222233
	const text = 'There were 300 members by 1939.';
	const tokens = tokenizeWithPositions(text);

	expect('300 offset',  firstOffset(tokens, '300'),  [11, 14]);
	expect('1939 offset', firstOffset(tokens, '1939'), [26, 30]);

	verifySlice('300 slice',  text, 11, 14, '300');
	verifySlice('1939 slice', text, 26, 30, '1939');
}

// ─── Test 6: Known Big Book passage ──────────────────────────────────────────

console.log('\n[test] Known Big Book phrase');
{
	const text = 'Rarely have we seen a person fail who has thoroughly followed our path.';
	const tokens = tokenizeWithPositions(text);

	// Verify "thoroughly" offset and slice
	const thorOffset = firstOffset(tokens, 'thoroughly');
	if (thorOffset) {
		verifySlice('thoroughly slice', text, thorOffset[0], thorOffset[1], 'thoroughly');
	} else {
		console.error('  ✗ "thoroughly" not found in tokens');
		failures++;
	}

	// Verify "followed" offset and slice
	const follOffset = firstOffset(tokens, 'followed');
	if (follOffset) {
		verifySlice('followed slice', text, follOffset[0], follOffset[1], 'followed');
	} else {
		console.error('  ✗ "followed" not found in tokens');
		failures++;
	}
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('');
if (failures > 0) {
	console.error(`[test-concordance-offsets] FAILED — ${failures} failure(s)`);
	process.exit(1);
} else {
	console.log('[test-concordance-offsets] ✓ All tests passed');
}
