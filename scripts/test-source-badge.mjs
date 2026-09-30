#!/usr/bin/env node
/**
 * Dependency-free tests for the source-accent resolution used by the filter bar.
 *
 * Run with: `pnpm run test:source-badge`.
 *
 * Node's built-in TypeScript type-stripping (Node >= 22.18 / 23.6) lets us import
 * `src/lib/corpus/source-accent.ts` directly — no test framework and no build
 * step. The module under test is deliberately pure (no I/O, no app imports).
 *
 * The contract under test is the one the search-ui spec binds: on a selected
 * chip the badge fill equals the chip fill (the source accent) and the RING is
 * what carries the >= 3:1 contrast; the label foreground must meet >= 4.5:1.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	FALLBACK_ACCENT,
	FOREGROUND_DARK,
	FOREGROUND_LIGHT,
	CHIP_SURFACE_RING,
	contrastRatio,
	resolveSourceAccent
} from '../src/lib/corpus/source-accent.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The unselected chip surface: white in the light theme, slate-900 in the dark theme.
const LIGHT_CHIP_SURFACE = '#FFFFFF';
const DARK_CHIP_SURFACE = '#0F172A';

const MIN_LABEL_CONTRAST = 4.5;
const MIN_RING_CONTRAST = 3;

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

const sources = JSON.parse(readFileSync(resolve(root, 'corpus/sources.json'), 'utf8'));

console.log('source-badge: resolved fills and contrast (committed accents)');

for (const source of sources) {
	const accent = resolveSourceAccent(source.color);
	const labelRatio = contrastRatio(accent.fill, accent.onFill);
	const ringRatio = contrastRatio(accent.fill, accent.ring);
	console.log(
		`  ${source.id.padEnd(24)} fill=${accent.fill} onFill=${accent.onFill} ` +
			`label=${labelRatio.toFixed(2)}:1 ring=${accent.ring} ringOnFill=${ringRatio.toFixed(2)}:1`
	);

	test(`${source.id} uses its committed accent as the fill`, () => {
		assert.equal(accent.fill, source.color);
	});

	test(`${source.id} foreground is the better of light/dark and meets 4.5:1`, () => {
		assert.ok(
			accent.onFill === FOREGROUND_LIGHT || accent.onFill === FOREGROUND_DARK,
			`onFill is one of the two tokens (got ${accent.onFill})`
		);
		assert.ok(
			labelRatio >= MIN_LABEL_CONTRAST,
			`label ${accent.onFill} on ${accent.fill} is ${labelRatio.toFixed(2)}:1 (< ${MIN_LABEL_CONTRAST})`
		);
	});

	test(`${source.id} selected-chip ring meets 3:1 against the accent fill`, () => {
		// Selected chip: chip fill == badge fill == accent, so the ring separates them.
		assert.ok(
			ringRatio >= MIN_RING_CONTRAST,
			`ring ${accent.ring} on ${accent.fill} is ${ringRatio.toFixed(2)}:1 (< ${MIN_RING_CONTRAST})`
		);
		assert.notEqual(accent.ring, accent.fill, 'ring must not equal the fill it separates');
	});
}

console.log('source-badge: unselected-chip surface ring');

test('neutral surface ring meets 3:1 against the light chip surface', () => {
	const ratio = contrastRatio(CHIP_SURFACE_RING, LIGHT_CHIP_SURFACE);
	assert.ok(ratio >= MIN_RING_CONTRAST, `${CHIP_SURFACE_RING} on white is ${ratio.toFixed(2)}:1`);
});

test('neutral surface ring meets 3:1 against the dark chip surface (slate-900)', () => {
	const ratio = contrastRatio(CHIP_SURFACE_RING, DARK_CHIP_SURFACE);
	assert.ok(
		ratio >= MIN_RING_CONTRAST,
		`${CHIP_SURFACE_RING} on slate-900 is ${ratio.toFixed(2)}:1`
	);
});

console.log('source-badge: missing/invalid accents fall back to the theme navy');

const INVALID_INPUTS = [
	['null', null],
	['undefined', undefined],
	['empty string', ''],
	['whitespace', '   '],
	['bare word', 'navy'],
	['too short hex', '#12'],
	['non-hex digits', '#gggggg'],
	['five digits', '#12345'],
	['rgb()', 'rgb(44, 74, 110)'],
	['number', 42],
	['object', {}]
];

for (const [label, value] of INVALID_INPUTS) {
	test(`${label} falls back to ${FALLBACK_ACCENT}`, () => {
		const accent = resolveSourceAccent(value);
		assert.equal(accent.fill, FALLBACK_ACCENT);
		assert.ok(
			contrastRatio(accent.fill, accent.onFill) >= MIN_LABEL_CONTRAST,
			'fallback label still meets 4.5:1'
		);
		assert.ok(
			contrastRatio(accent.fill, accent.ring) >= MIN_RING_CONTRAST,
			'fallback ring still meets 3:1'
		);
	});
}

test('a valid shorthand hex is expanded and preserved', () => {
	const accent = resolveSourceAccent('#abc');
	assert.equal(accent.fill.toLowerCase(), '#aabbcc');
});

console.log('source-badge: the gold daily-reflections accent is the known low-contrast case');

test('gold #C8902A yields the dark foreground/ring, not white', () => {
	const accent = resolveSourceAccent('#C8902A');
	assert.equal(accent.fill, '#C8902A');
	// Regression guard: forcing the foreground back to white would fail here.
	assert.equal(accent.onFill, FOREGROUND_DARK);
	assert.equal(accent.ring, FOREGROUND_DARK);
	assert.ok(
		contrastRatio(accent.fill, accent.onFill) >= MIN_LABEL_CONTRAST,
		'dark label on gold meets 4.5:1'
	);
	assert.ok(
		contrastRatio(accent.fill, accent.ring) >= MIN_RING_CONTRAST,
		'dark ring on gold meets 3:1'
	);
});

test('white on the gold accent is below 4.5:1 (why white must not be forced)', () => {
	const whiteRatio = contrastRatio(FOREGROUND_LIGHT, '#C8902A');
	assert.ok(
		whiteRatio < MIN_LABEL_CONTRAST,
		`white on gold is ${whiteRatio.toFixed(2)}:1 — the old fixed text-white was the defect`
	);
	// If the helper ever regressed to the old hard-coded white, this fails again.
	assert.notEqual(resolveSourceAccent('#C8902A').onFill, FOREGROUND_LIGHT);
});

console.log(`\nAll ${passed} source-badge checks passed.`);
