#!/usr/bin/env node
/**
 * extract-reference-texts.mjs
 *
 * Derives the committed reference-text corpus files from the public-domain
 * 2nd-edition Big Book corpus, so each reference text is a byte-for-byte
 * (or contiguous-substring) match of the Big Book source rather than a second
 * hand-transcribed copy.
 *
 * Outputs (written only with --write):
 *   corpus/sources/twelve-steps.json        ← unsplit, from p0106 + p0107
 *   corpus/sources/twelve-traditions.json   ← 12 numbered traditions, from p0254-p0258
 *   corpus/sources/promises-and-prayers.json← Promises + Third/Seventh prayers
 *
 * The Third Step Prayer begins on p0112 and concludes on p0113 (both printed p.84)
 * because the prayer spans the corpus page break.
 *
 * The default run is a DRY RUN that verifies every derived `text` against the
 * Big Book source and prints what it would write. Pass --write to emit files.
 *
 * Fidelity rules enforced here:
 *   - twelve-steps: each derived passage `text` is byte-identical to its source.
 *   - twelve-traditions: every derived `text` contains the next source passage only
 *     at its start and end (contiguous across the paginated source), and is a
 *     contiguous substring of the concatenation of the source passages.
 *   - promises-and-prayers: each derived `text` is a contiguous substring of its
 *     source passage (or, for the Ninth Step Promises, of the concatenation of
 *     p0144 + p0145 across the page break).
 *
 * Usage:  node corpus/scripts/extract-reference-texts.mjs [--write]
 *
 * Reference texts — add-recovery-reference-texts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(__filename, '../../..');
const corpusRoot = join(repoRoot, 'corpus');
const sourcesRoot = join(corpusRoot, 'sources');

const WRITE = process.argv.includes('--write');

const bigBook = JSON.parse(readFileSync(join(sourcesRoot, 'big-book-2ed.json'), 'utf-8'));
const byId = new Map(bigBook.map((p) => [p.id, p]));

/** Look up a source passage by id, failing loudly if it is missing. */
function sourcePassage(id) {
	const p = byId.get(id);
	if (!p) throw new Error(`Big Book passage not found: ${id}`);
	return p;
}

/**
 * Locate `part` inside `whole`, returning its offset, or throw with context.
 * Used to prove a derived text is exactly a slice of the Big Book corpus.
 */
function requireSubstring(whole, part, label) {
	const at = whole.indexOf(part);
	if (at < 0) {
		throw new Error(`${label}: derived text is not a contiguous substring of the Big Book source`);
	}
	return at;
}

// ─── twelve-steps ─────────────────────────────────────────────────────────────
// The Steps list opens on p0106 and spills one step onto p0107. Each corpus
// passage is already a whole chunk of the Big Book, so the source is "unsplit"
// and each derived passage must be byte-identical to its source passage.

const STEPS = [
	{
		id: 'twelve-steps-list-1-11',
		title: 'The Twelve Steps',
		chapterRef: 'The Twelve Steps',
		sourcePassages: ['big-book-2ed-chapter-5-how-it-works-p0106']
	},
	{
		id: 'twelve-steps-list-12',
		title: 'The Twelve Steps',
		chapterRef: 'The Twelve Steps',
		sourcePassages: ['big-book-2ed-chapter-5-how-it-works-p0107']
	}
];

function buildTwelveSteps() {
	return STEPS.map((entry, i) => {
		const source = sourcePassage(entry.sourcePassages[0]);
		return {
			id: entry.id,
			sourceId: 'twelve-steps',
			title: entry.title,
			sequence: i + 1,
			date: null,
			pageRef: source.pageRef,
			chapterRef: entry.chapterRef,
			text: source.text,
			linkData: null
		};
	});
}

// ─── twelve-traditions ────────────────────────────────────────────────────────
// The long form runs across five paginated passages (printed p.189-p.192).
// Passage-1 text is a shared prologue, so each numbered tradition starts at its
// own slice; tradition 6 continues onto the next page, traditions 9, 10, and 11
// continue within p0257, and tradition 12 continues onto p0258. Every tradition
// thus extracts contiguously from the join of p0254-p0258.

const TRADITIONS_SOURCE_IDS = [
	'big-book-2ed-appendices-p0254',
	'big-book-2ed-appendices-p0255',
	'big-book-2ed-appendices-p0256',
	'big-book-2ed-appendices-p0257',
	'big-book-2ed-appendices-p0258'
];

// Each entry: `startIndex` is the source passage the tradition's slice begins in
// (used for `pageRef` provenance), `text` is the contiguous slice itself. Like
// traditions 1-11, the leading `N.--` list marker is stripped; the body is kept
// verbatim.
const TRADITIONS = [
	{
		startIndex: 0,
		text: sourcePassage(TRADITIONS_SOURCE_IDS[0]).text.split(' 1.--')[1].split(' 2.--')[0]
	},
	{
		startIndex: 0,
		text: sourcePassage(TRADITIONS_SOURCE_IDS[0]).text.split(' 2.--')[1].split(' 3.--')[0]
	},
	{
		startIndex: 0,
		text: sourcePassage(TRADITIONS_SOURCE_IDS[0]).text.split(' 3.--')[1].split(' 4.--')[0]
	},
	{
		startIndex: 0,
		text: sourcePassage(TRADITIONS_SOURCE_IDS[0]).text.split(' 4.--')[1].split(' 5.--')[0]
	},
	{
		startIndex: 0,
		text: sourcePassage(TRADITIONS_SOURCE_IDS[0]).text.split(' 5.--')[1].split(' 6.--')[0]
	},
	{
		startIndex: 0,
		text:
			sourcePassage(TRADITIONS_SOURCE_IDS[0]).text.split(' 6.--')[1] +
			' ' +
			sourcePassage(TRADITIONS_SOURCE_IDS[1]).text.split(' 7.--')[0]
	},
	{ startIndex: 1, text: sourcePassage(TRADITIONS_SOURCE_IDS[1]).text.split(' 7.--')[1] },
	{ startIndex: 2, text: sourcePassage(TRADITIONS_SOURCE_IDS[2]).text.split(' 8.--')[1] },
	{
		startIndex: 3,
		text: sourcePassage(TRADITIONS_SOURCE_IDS[3]).text.split(' 9.--')[1].split(' 10.--')[0]
	},
	{
		startIndex: 3,
		text: sourcePassage(TRADITIONS_SOURCE_IDS[3]).text.split(' 10.--')[1].split(' 11.--')[0]
	},
	{
		startIndex: 3,
		text: sourcePassage(TRADITIONS_SOURCE_IDS[3]).text.split(' 11.--')[1].split(' 12.--And finally')[0]
	},
	{
		// Tradition 12's marker (`12.--`) sits at the end of p0257 and its body
		// continues onto p0258; strip the leading list marker like traditions 1-11
		// so every derived `text` is the tradition body verbatim.
		startIndex: 3,
		text:
			sourcePassage(TRADITIONS_SOURCE_IDS[3]).text.split(' 12.--')[1] +
			' ' +
			sourcePassage(TRADITIONS_SOURCE_IDS[4]).text
	}
];

const TRADITION_WORDS = [
	'One',
	'Two',
	'Three',
	'Four',
	'Five',
	'Six',
	'Seven',
	'Eight',
	'Nine',
	'Ten',
	'Eleven',
	'Twelve'
];

function buildTwelveTraditions() {
	const all = TRADITIONS_SOURCE_IDS.map((id) => sourcePassage(id).text).join(' ');
	for (const [i, t] of TRADITIONS.entries()) {
		requireSubstring(all, t.text, `tradition ${i + 1}`);
	}
	const last = TRADITIONS[TRADITIONS.length - 1].text.trimEnd();
	if (!last.startsWith('And finally, we of Alcoholics Anonymous believe')) {
		throw new Error(
			`tradition 12 expected to start at "And finally, we of Alcoholics Anonymous believe", got: ${last.slice(0, 40)}...`
		);
	}
	if (!last.endsWith('presides over us all.')) {
		throw new Error(
			`tradition 12 expected to end at "presides over us all.", got: ...${last.slice(-40)}`
		);
	}
	return TRADITIONS.map((t, i) => {
		// pageRef is the printed page the tradition's slice begins on. Tradition
		// 12's marker sits at the very end of p0257, but its body (and thus the
		// bulk of its text) continues on p0258, so it cites the ending page to
		// avoid pointing readers at a page that carries no visible text.
		const startPage = sourcePassage(TRADITIONS_SOURCE_IDS[t.startIndex]).pageRef;
		const pageRef = i === TRADITIONS.length - 1 ? sourcePassage(TRADITIONS_SOURCE_IDS[4]).pageRef : startPage;
		return {
			id: `twelve-traditions-long-${i + 1}`,
			sourceId: 'twelve-traditions',
			title: `The Twelve Traditions (Long Form) — Tradition ${TRADITION_WORDS[i]}`,
			sequence: i + 1,
			date: null,
			pageRef,
			chapterRef: 'The Twelve Traditions (The Long Form)',
			text: t.text,
			linkData: null
		};
	});
}

// ─── promises-and-prayers ─────────────────────────────────────────────────────
// The Ninth Step Promises span the p0144/p0145 page break; the Third and Seventh
// Step prayers each sit inside one passage. Every `text` is a slice of the Big
// Book corpus (no re-wrapping, no smart-quote changes).

const PROMISES_LINE = 'If we are painstaking about this phase of our development';
const PRAYER_START = {
	'big-book-2ed-chapter-5-how-it-works-p0112': '"God, I offer myself to Thee',
	'big-book-2ed-chapter-6-into-action-p0131': '"My Creator, I am now willing'
};

const PRAYER_END = {
	'big-book-2ed-chapter-5-how-it-works-p0112': 'Thy will always!"',
	'big-book-2ed-chapter-6-into-action-p0131': 'Amen.'
};

function buildPromisesAndPrayers() {
	const p0144 = sourcePassage('big-book-2ed-chapter-6-into-action-p0144').text;
	const p0145 = sourcePassage('big-book-2ed-chapter-6-into-action-p0145').text;

	const promisesStart = p0144.indexOf(PROMISES_LINE);
	if (promisesStart < 0) throw new Error('Ninth Step Promises start not found in p0144');
	const promisesEndRel = p0145.indexOf('This thought brings us to STEP TEN');
	if (promisesEndRel < 0) throw new Error('Ninth Step Promises end not found in p0145');
	const promisesText = p0144.slice(promisesStart) + ' ' + p0145.slice(0, promisesEndRel).trimEnd();

	const entries = [
		{
			id: 'promises-ninth-step',
			title: 'The Ninth Step Promises',
			chapterRef: 'Chapter 6 — Into Action',
			sourcePassages: ['big-book-2ed-chapter-6-into-action-p0144', 'big-book-2ed-chapter-6-into-action-p0145'],
			pageRef: 'p.104',
			text: promisesText
		},
		{
			id: 'prayer-third-step',
			title: 'The Third Step Prayer',
			chapterRef: 'Chapter 5 — How It Works',
			sourcePassages: ['big-book-2ed-chapter-5-how-it-works-p0112', 'big-book-2ed-chapter-5-how-it-works-p0113'],
			pageRef: 'p.84',
			text: null
		},
		{
			id: 'prayer-seventh-step',
			title: 'The Seventh Step Prayer',
			chapterRef: 'Chapter 6 — Into Action',
			sourcePassages: ['big-book-2ed-chapter-6-into-action-p0131'],
			pageRef: 'p.97',
			text: null
		}
	];

	for (const entry of entries) {
		if (entry.text) continue;
		const whole = entry.sourcePassages.map((id) => sourcePassage(id).text).join(' ');
		const start = whole.indexOf(PRAYER_START[entry.sourcePassages[0]]);
		if (start < 0) throw new Error(`${entry.id}: prayer start marker not found`);
		const rest = whole.slice(start);
		const endMarker = PRAYER_END[entry.sourcePassages[0]];
		const end = rest.indexOf(endMarker);
		if (end < 0) throw new Error(`${entry.id}: prayer end marker "${endMarker}" not found`);
		entry.text = rest.slice(0, end + endMarker.length);
	}

	for (const entry of entries) {
		const whole = entry.sourcePassages.map((id) => sourcePassage(id).text).join(' ');
		requireSubstring(whole, entry.text, entry.id);
	}

	return entries.map((entry, i) => ({
		id: entry.id,
		sourceId: 'promises-and-prayers',
		title: entry.title,
		sequence: i + 1,
		date: null,
		pageRef: entry.pageRef,
		chapterRef: entry.chapterRef,
		text: entry.text,
		linkData: null
	}));
}

// ─── Emit ─────────────────────────────────────────────────────────────────────

const outputs = {
	'twelve-steps.json': buildTwelveSteps(),
	'twelve-traditions.json': buildTwelveTraditions(),
	'promises-and-prayers.json': buildPromisesAndPrayers()
};

let total = 0;
for (const [file, passages] of Object.entries(outputs)) {
	const json = JSON.stringify(passages, null, 2) + '\n';
	total += passages.length;
	console.log(`[extract-reference-texts] ${file}: ${passages.length} passages, ${json.length} bytes`);
	if (WRITE) {
		writeFileSync(join(sourcesRoot, file), json, 'utf-8');
		console.log(`  wrote corpus/sources/${file}`);
	} else {
		console.log('  (dry run — pass --write to emit)');
	}
}
console.log(
	`[extract-reference-texts] ${WRITE ? 'Wrote' : 'Verified'} ${total} reference passages across 3 files`
);
