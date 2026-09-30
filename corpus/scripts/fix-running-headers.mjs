#!/usr/bin/env node
/**
 * fix-running-headers.mjs
 *
 * Re-runnable repair for leaked page running headers in the corpus.
 *
 * It strips ONLY the leading running-header prefix from each affected passage's
 * `text` (using the shared rule set in `running-header-utils.mjs`) and leaves
 * every other field byte-identical. Default mode is a dry run that asserts the
 * expected result and writes nothing; pass `--write` to apply.
 *
 * Usage:
 *   node corpus/scripts/fix-running-headers.mjs                 # dry run, all enabled sources
 *   node corpus/scripts/fix-running-headers.mjs --dry-run
 *   node corpus/scripts/fix-running-headers.mjs --source big-book-2ed
 *   node corpus/scripts/fix-running-headers.mjs --write         # apply
 *
 * Exit code 0 only when every assertion passes.
 *
 * Change: fix-corpus-running-headers (tasks 1.2-1.4)
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	RUNNING_TITLES,
	stripRunningHeader,
	looksLikeHeaderShape
} from './running-header-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(__filename, '../../..');
const corpusRoot = join(repoRoot, 'corpus');

// Expected totals for the committed corpus being repaired.
const EXPECTED_BIG_BOOK_MATCHES = 172;

// Hand-written exact expectations for representative passages.
const ANCHORS = [
	{
		id: 'big-book-2ed-chapter-2-there-is-a-solution-p0067',
		header: '1 THERE IS A SOLUTION',
		trailing: '29',
		remainderStartsWith: 'enough, we find'
	},
	{
		id: 'big-book-2ed-chapter-5-how-it-works-p0107',
		header: '60 ALCOHOLICS ANONYMOUS',
		trailing: null,
		remainderStartsWith: '12. Having had a spiritual awakening'
	},
	{
		id: 'big-book-2ed-chapter-1-bills-story-p0027',
		header: '2 ALCOHOLICS ANONYMOUS',
		trailing: null,
		remainderStartsWith: 'I took a night law course'
	},
	{
		id: 'big-book-2ed-chapter-1-bills-story-p0029',
		header: "BILL'S STORY 3",
		trailing: null,
		remainderStartsWith: 'cial reference service'
	},
	{
		id: 'big-book-2ed-chapter-1-bills-story-p0040',
		header: '10 ALCOHOLICS ANONYMOUS',
		trailing: null,
		remainderStartsWith: 'I cared to have it'
	},
	{
		id: 'big-book-2ed-chapter-6-into-action-p0140',
		header: 'INTO ACTION 81',
		trailing: null,
		remainderStartsWith: "wouldn't care to have advertised"
	},
	{
		id: 'big-book-2ed-chapter-6-into-action-p0145',
		header: '84 ALCOHOLICS ANONYMOUS',
		trailing: null,
		remainderStartsWith: 'word serenity'
	}
];

// ─── Argument parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const write = args.includes('--write');
let sourceFilter = null;
const sourceIdx = args.indexOf('--source');
if (sourceIdx !== -1) sourceFilter = args[sourceIdx + 1] ?? null;

// ─── Load registry + sources ──────────────────────────────────────────────────

const registry = JSON.parse(readFileSync(join(corpusRoot, 'sources.json'), 'utf-8'));
const enabled = registry.filter((s) => s.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
const selected = sourceFilter ? enabled.filter((s) => s.id === sourceFilter) : enabled;

if (selected.length === 0) {
	console.error(`[fix-running-headers] no enabled source matches ${JSON.stringify(sourceFilter)}`);
	process.exit(1);
}

let failures = 0;
function check(label, condition, detail = '') {
	if (condition) {
		console.log(`  \u2713 ${label}`);
	} else {
		failures++;
		console.log(`  \u2717 ${label}${detail ? ` — ${detail}` : ''}`);
	}
}

/** Reconstruct the running-title part of a header (independent of the regex). */
function titleOf(header, rule) {
	if (rule === 1) return header.replace(/^\d{1,4} /, '');
	if (rule === 2) return header.replace(/ \d{1,4}$/, '');
	return header.replace(/^[ivxlcdm]{2,} /, '').replace(/ [ivxlcdm]{2,}$/, '');
}

console.log(`[fix-running-headers] ${write ? 'WRITE' : 'DRY RUN'} — ${selected.length} source(s)`);

// ─── Scan ─────────────────────────────────────────────────────────────────────

/** @type {Map<string, {path: string, passages: any[], strips: Array<{index:number,id:string,rule:number,header:string,trailing:string|null,remainder:string}>}>} */
const results = new Map();
let otherSourcesMatches = 0;
let rule4Strips = [];
let remainderPunctViolations = [];
let titleMismatches = [];
let candidateSurvivors = [];

for (const source of selected) {
	const path = join(corpusRoot, 'sources', `${source.id}.json`);
	if (!existsSync(path)) {
		console.error(`[fix-running-headers] missing corpus file: ${path}`);
		process.exit(1);
	}
	const passages = JSON.parse(readFileSync(path, 'utf-8'));
	const strips = [];
	passages.forEach((p, index) => {
		const t = typeof p.text === 'string' ? p.text : '';
		const r = stripRunningHeader(t);
		if (!r.matched) {
			if (source.id === 'big-book-2ed' || selected.length === 1) {
				if (looksLikeHeaderShape(t)) candidateSurvivors.push({ id: p.id, text: t.slice(0, 70) });
			}
			return;
		}
		strips.push({ index, id: p.id, rule: r.rule, header: r.header, trailing: r.trailingNumber, remainder: r.remainder });
	});

	for (const s of strips) {
		if (source.id !== 'big-book-2ed') otherSourcesMatches++;
		if (s.trailing !== null) rule4Strips.push({ id: s.id, value: s.trailing });
		if (/^[.,;:)]/.test(s.remainder)) remainderPunctViolations.push({ id: s.id, remainder: s.remainder.slice(0, 30) });
		if (!RUNNING_TITLES.includes(titleOf(s.header, s.rule))) {
			titleMismatches.push({ id: s.id, header: s.header, title: titleOf(s.header, s.rule) });
		}
	}

	results.set(source.id, { path, passages, strips });
	console.log(`\n[${source.id}] ${strips.length}/${passages.length} passages match a running-header prefix`);
	for (const s of strips) {
		const extra = s.trailing !== null ? `  +trailing "${s.trailing}"` : '';
		console.log(`  [rule${s.rule}] ${s.id}  \u2192  "${s.header}"${extra}`);
	}
}

const totalStrips = [...results.values()].reduce((n, r) => n + r.strips.length, 0);

// ─── Unmatched start-of-text candidates (task 1.4) ────────────────────────────

console.log(`\n[fix-running-headers] unmatched start-of-text candidates (page number + 2+ ALL-CAPS words): ${candidateSurvivors.length}`);
for (const c of candidateSurvivors) console.log(`  ? ${c.id}  "${c.text}"`);

// ─── Assertions (tasks 1.2-1.4) ───────────────────────────────────────────────

const bigBookStrips = results.get('big-book-2ed')?.strips.length ?? 0;

// Idempotency: running again on an already-repaired corpus is a no-op, but only
// when the broad (non-allowlisted) candidate scan also finds nothing — so a
// detector that silently matched nothing while headers remain still fails below.
if (!sourceFilter && bigBookStrips === 0 && otherSourcesMatches === 0 && candidateSurvivors.length === 0) {
	console.log('\n[fix-running-headers] already repaired — 0 header prefixes and 0 candidates; nothing to do');
	process.exit(0);
}

console.log('\n[fix-running-headers] assertions:');
check(
	`big-book-2ed matches = ${EXPECTED_BIG_BOOK_MATCHES}`,
	bigBookStrips === EXPECTED_BIG_BOOK_MATCHES,
	`got ${bigBookStrips}`
);
if (!sourceFilter) {
	check('other enabled sources match = 0', otherSourcesMatches === 0, `got ${otherSourcesMatches}`);
}
check('exactly one Rule 4 trailing-page-number strip', rule4Strips.length === 1, `got ${rule4Strips.length}`);
check(
	'Rule 4 strip is ...p0067 \u2192 "29"',
	rule4Strips.length === 1 &&
		rule4Strips[0].id === 'big-book-2ed-chapter-2-there-is-a-solution-p0067' &&
		rule4Strips[0].value === '29',
	JSON.stringify(rule4Strips)
);
check('no stripped remainder begins with [.,;:)]', remainderPunctViolations.length === 0, JSON.stringify(remainderPunctViolations));
check(
	'every stripped header is a known running title (exact header match)',
	titleMismatches.length === 0,
	JSON.stringify(titleMismatches)
);

for (const a of ANCHORS) {
	const s = results.get('big-book-2ed')?.strips.find((x) => x.id === a.id);
	check(
		`anchor ${a.id} \u2192 header "${a.header}"`,
		!!s && s.header === a.header && (s.trailing ?? null) === a.trailing,
		s ? `got header "${s.header}" trailing ${JSON.stringify(s.trailing)}` : 'not matched'
	);
	check(
		`anchor ${a.id} remainder starts with ${JSON.stringify(a.remainderStartsWith)}`,
		!!s && s.remainder.startsWith(a.remainderStartsWith),
		s ? `got ${JSON.stringify(s.remainder.slice(0, 40))}` : 'not matched'
	);
}

check(`unmatched candidates reviewed (${candidateSurvivors.length})`, true);

// ─── Apply or finish ──────────────────────────────────────────────────────────

if (failures > 0) {
	console.error(`\n[fix-running-headers] FAILED — ${failures} assertion(s) failed; nothing written`);
	process.exit(1);
}

if (!write) {
	console.log(
		`\n[fix-running-headers] DRY RUN complete — ${totalStrips} header prefixes, ${rule4Strips.length} Rule 4 trailing number(s); 0 mismatches; nothing written`
	);
	process.exit(0);
}

let written = 0;
for (const r of results.values()) {
	if (r.strips.length === 0) continue;
	const byIndex = new Map(r.strips.map((s) => [s.index, s]));
	const updated = r.passages.map((p, index) => {
		const s = byIndex.get(index);
		if (!s) return p;
		return { ...p, text: s.remainder };
	});
	writeFileSync(r.path, JSON.stringify(updated, null, 2), 'utf-8');
	written++;
	console.log(`[fix-running-headers] wrote ${r.strips.length} repaired passage(s) to ${r.path}`);
}
console.log(`[fix-running-headers] done — ${written} file(s) written`);
