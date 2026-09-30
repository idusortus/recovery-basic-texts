#!/usr/bin/env node
/**
 * test-corpus-headers.mjs
 *
 * Dependency-free regression test for leaked page running headers in the corpus.
 *
 *  A. Corpus scan: loads every enabled corpus source and FAILS (non-zero, naming
 *     the offending passage IDs) if any passage's `text` begins with a
 *     running-header shape (a page number adjacent to two or more ALL-CAPS words,
 *     either order, or a roman-numeral front-matter header). This scan uses its
 *     own broad structural pattern, independent of the allowlist in
 *     `running-header-utils.mjs`.
 *
 *  B. Fixed fixtures: a hand-written list of header shapes with exact expected
 *     remainders, asserted against `stripRunningHeader`. The EXPECTATIONS are
 *     fixed here (not derived from the detector), so a regression in the
 *     detector's priority order or its `[.,;:)]` guard fails this test.
 *
 * Run:  node corpus/scripts/test-corpus-headers.mjs   (or `npm run test:corpus-headers`)
 * Exits 1 on any failure.
 *
 * Change: fix-corpus-running-headers (tasks 5.1-5.2)
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripRunningHeader } from './running-header-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(__filename, '../../..');
const corpusRoot = join(repoRoot, 'corpus');

let failures = 0;

function check(label, condition, detail = '') {
	if (condition) {
		console.log(`  \u2713 ${label}`);
	} else {
		failures++;
		console.log(`  \u2717 ${label}${detail ? ` — ${detail}` : ''}`);
	}
}

// ─── A. Corpus scan (broad structural pattern, no title allowlist) ────────────

const CAPS_WORD = "[A-Z][A-Z0-9.'\u2019\\-]*";
const CAPS_RUN = `${CAPS_WORD}(?: ${CAPS_WORD})+`;
const NUM = '\\d{1,4}';
const ROMAN = '[ivxlcdm]{2,}'; // matches the rule set; uppercase roman handled by task 6.1
const BOUND = '(?=[^A-Za-z0-9]|$)';

// number-first (optionally with a separated trailing number), title-last, roman either order
const HEADER_SHAPE = new RegExp(
	`^(?:${NUM} ${CAPS_RUN}(?: ${NUM})?|${CAPS_RUN} ${NUM}|${ROMAN} (?:${CAPS_WORD} )*${CAPS_WORD}|(?:${CAPS_WORD} )+${ROMAN})${BOUND}`
);

console.log('\n[test-corpus-headers] A. corpus scan — no passage may begin with a running header');

const registry = JSON.parse(readFileSync(join(corpusRoot, 'sources.json'), 'utf-8'));
let scanned = 0;

for (const source of registry.filter((s) => s.enabled)) {
	const path = join(corpusRoot, 'sources', `${source.id}.json`);
	if (!existsSync(path)) {
		console.log(`  - ${source.id}: no corpus file, skipped`);
		continue;
	}
	const passages = JSON.parse(readFileSync(path, 'utf-8'));
	if (!Array.isArray(passages)) {
		failures++;
		console.log(`  \u2717 ${source.id}: corpus file is not an array`);
		continue;
	}
	scanned += passages.length;
	const offenders = passages.filter((p) => typeof p.text === 'string' && HEADER_SHAPE.test(p.text));
	check(`${source.id}: 0 / ${passages.length} passages begin with a running header`, offenders.length === 0);
	for (const o of offenders) {
		console.log(`      offender: ${o.id}  ${JSON.stringify(o.text.slice(0, 60))}`);
	}
}

console.log(`  (scanned ${scanned} passages across enabled sources)`);

// ─── B. Fixed fixture list (expectations independent of the detector) ─────────

console.log('\n[test-corpus-headers] B. fixed fixtures — exact expected remainders');

/** @type {Array<{input: string, matched: boolean, trailing: string|null, remainder: string, note: string}>} */
const FIXTURES = [
	// Number-first (Rule 1)
	{ input: '82 ALCOHOLICS ANONYMOUS for the first time', matched: true, trailing: null, remainder: 'for the first time', note: 'number-first' },
	{ input: '84 ALCOHOLICS ANONYMOUS word serenity and we will know peace', matched: true, trailing: null, remainder: 'word serenity and we will know peace', note: 'number-first' },
	// Title-last (Rule 2)
	{ input: "INTO ACTION 81 wouldn't care to have advertised", matched: true, trailing: null, remainder: "wouldn't care to have advertised", note: 'title-last' },
	{ input: "BILL'S STORY 3 cial reference service", matched: true, trailing: null, remainder: 'cial reference service', note: 'title-last' },
	{ input: 'A VISION FOR YOU 157 commence shoulder to shoulder', matched: true, trailing: null, remainder: 'commence shoulder to shoulder', note: 'title-last, single-letter title word' },
	// Roman front-matter (Rule 3)
	{ input: 'xii PREFACE been preserved', matched: true, trailing: null, remainder: 'been preserved', note: 'roman-first' },
	{ input: 'FOREWORD xvii could', matched: true, trailing: null, remainder: 'could', note: 'roman-last' },
	{ input: "xxiv THE DOCTOR'S OPINION growth inherent", matched: true, trailing: null, remainder: 'growth inherent', note: 'roman-first, title with apostrophe' },
	// Rule 4 conditional trailing page number
	{ input: '1 THERE IS A SOLUTION 29 enough, we find', matched: true, trailing: '29', remainder: 'enough, we find', note: 'Rule 4 strips separated page number' },
	// Rule 1 must win before Rule 4; the list number `.` must survive
	{ input: '60 ALCOHOLICS ANONYMOUS 12. Having had a spiritual awakening', matched: true, trailing: null, remainder: '12. Having had a spiritual awakening', note: 'twelfth-step list number preserved' },
	// Must not swallow the first body word (single-letter all-caps body word)
	{ input: '2 ALCOHOLICS ANONYMOUS I took a night law course', matched: true, trailing: null, remainder: 'I took a night law course', note: 'must not swallow body word I' },
	// Negatives — unchanged
	{ input: 'Chapter 5 HOW IT WORKS Rarely have we seen a person fail', matched: false, trailing: null, remainder: 'Chapter 5 HOW IT WORKS Rarely have we seen a person fail', note: 'chapter opening' },
	{ input: 'STEP 12', matched: false, trailing: null, remainder: 'STEP 12', note: 'single caps word + number' },
	{ input: 'ALCOHOLICS ANONYMOUS, p. 25', matched: false, trailing: null, remainder: 'ALCOHOLICS ANONYMOUS, p. 25', note: 'mid-text citation form' },
	{ input: 'ALCOHOLICS ANONYMOUS, pp. 88-89', matched: false, trailing: null, remainder: 'ALCOHOLICS ANONYMOUS, pp. 88-89', note: 'mid-text plural citation' },
	{ input: 'The central fact of our lives today', matched: false, trailing: null, remainder: 'The central fact of our lives today', note: 'ordinary prose' }
];

for (const f of FIXTURES) {
	const r = stripRunningHeader(f.input);
	const ok =
		r.matched === f.matched &&
		r.remainder === f.remainder &&
		(r.trailingNumber ?? null) === f.trailing;
	check(`fixture [${f.note}]`, ok, `got ${JSON.stringify({ matched: r.matched, trailing: r.trailingNumber, remainder: r.remainder })}`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('');
if (failures > 0) {
	console.error(`[test-corpus-headers] FAILED — ${failures} failure(s)`);
	process.exit(1);
}
console.log('[test-corpus-headers] \u2713 All checks passed');
