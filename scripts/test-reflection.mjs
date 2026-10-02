#!/usr/bin/env node
/**
 * Dependency-free Daily Reflections display regression tests.
 *
 * Run with: node scripts/test-reflection.mjs
 * (or `npm run test:reflection`)
 *
 * No test framework, no new dependency. Node's built-in type stripping plus
 * scripts/search-test-loader.mjs let this plain Node script import the real
 * reflection helpers and load the local index.
 *
 * Covers the `daily-reflections-display` spec:
 *   - the KWIC teaser is a bounded window (at most `contextSentences` whole
 *     sentences each side of the anchor) derived from the source registry
 *   - the entry's full `text` is never returned, even for a short entry
 *   - `getReflectionForDate` resolves an explicit MM-DD and is null when absent
 *   - the no-entry fallback carries no reflection text
 *   - no changed DR module fetches aa.org; the offline fallback renders from
 *     the local index alone
 */

import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

register('./search-test-loader.mjs', import.meta.url);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexDir = path.join(repoRoot, 'static', 'index');

// ─── Local-index-only fetch stub (records every requested URL) ─────────────────

const requestedUrls = [];
globalThis.fetch = async (url) => {
	const key = String(url);
	requestedUrls.push(key);
	if (!key.startsWith('/index/')) return { ok: false, status: 404, json: async () => ({}) };
	try {
		const body = await readFile(path.join(indexDir, path.basename(key)), 'utf8');
		return { ok: true, status: 200, json: async () => JSON.parse(body) };
	} catch {
		return { ok: false, status: 404, json: async () => ({}) };
	}
};

if (!existsSync(path.join(indexDir, 'passages.json'))) {
	console.error('static/index/* is missing — run `npm run build:index` first.');
	process.exit(1);
}

// ─── Import the real modules after register() ─────────────────────────────────

const { loadSearchIndex } = await import('../src/lib/search/index.ts');
const { getSourceById } = await import('../src/lib/corpus/registry.ts');
const {
	getTodaysReflection,
	getReflectionForDate,
	isValidReflectionDate,
	buildReflectionTeaser,
	getReflectionFallback,
	formatReflectionDate,
	todayReflectionKey
} = await import('../src/lib/corpus/reflection.ts');
const { splitSentences, buildKwicFromOffsets } = await import('../src/lib/search/kwic.ts');

await loadSearchIndex();

// ─── Harness ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name, fn) {
	try {
		await fn();
		passed += 1;
		console.log(`  ok  ${name}`);
	} catch (error) {
		failed += 1;
		console.error(`FAIL  ${name}`);
		console.error(`      ${error.message}`);
	}
}

// ─── KWIC text helpers ────────────────────────────────────────────────────────

function decodeHtml(html) {
	return html
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}

/** KWIC with tags and the clipping ellipses removed. */
function plainOf(html) {
	const withoutMarks = html
		.replace(/<mark><span class="sr-only">highlighted: <\/span>/g, '')
		.replace(/<\/mark>/g, '')
		.replace(/<[^>]*>/g, '');
	return decodeHtml(withoutMarks).replace(/\u2026/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Words in a KWIC (tags/ellipses excluded). */
function wordsIn(text) {
	return text.split(/\s+/).filter(Boolean);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('reflection: bounded KWIC teaser (DR display mode from registry)');

const drSource = getSourceById('daily-reflections');
assert.ok(drSource, 'daily-reflections is in the source registry');

await test('registry drives the bound (concordance-only, contextSentences)', () => {
	assert.equal(drSource.displayMode, 'concordance-only');
	assert.equal(drSource.contextSentences, 1, 'DR sets a 1-sentence context bound');
	assert.ok(drSource.contextWords > 0, 'word fallback remains configured');
});

await test('a concordance-only sentence window shows contextSentences each side', () => {
	const text =
		'One alpha here. Two bravo there. Three charlie everywhere. Four delta now. Five echo end.';
	const anchor = text.indexOf('charlie');
	const sentences = splitSentences(text);
	const expected = [sentences[1], sentences[2], sentences[3]].join(' ');
	const html = buildKwicFromOffsets(
		text,
		[[anchor, anchor + 'charlie'.length]],
		'concordance-only',
		8,
		anchor,
		drSource.contextSentences
	);
	assert.equal(plainOf(html), expected, 'matched sentence plus one sentence each side');
	assert.ok(html.includes('\u2026'), 'clipped sides are marked');
	assert.ok(plainOf(html).length < text.length, 'window is a strict subset');
});

await test('the rendered teaser is a bounded sentence window, never the full text', () => {
	const entry = getReflectionForDate('06-28');
	assert.ok(entry, 'June 28 entry present');
	const html = buildReflectionTeaser(entry.text);
	// The teaser anchors on the entry's first term, so the window is the
	// matched (first) sentence plus at most contextSentences sentences after it.
	const fullSentences = splitSentences(entry.text.trim());
	const windowSentences = splitSentences(plainOf(html));
	const bound = (drSource.contextSentences ?? 0) + 1;
	assert.ok(windowSentences.length <= bound, `${windowSentences.length} sentences > bound`);
	assert.ok(
		windowSentences.every((sentence, i) => fullSentences[i] === sentence),
		'window runs contiguously from the first sentence'
	);
	assert.ok(entry.text.includes(plainOf(html)), 'window is contiguous source text');
	assert.ok(
		plainOf(html).length < entry.text.trim().length,
		'window is shorter than the full text'
	);
});

await test('the full entry text is never returned for a long entry', () => {
	const entry = getReflectionForDate('06-28');
	const html = buildReflectionTeaser(entry.text);
	assert.notEqual(plainOf(html), entry.text.trim(), 'full text rendered');
	assert.ok(html.includes('\u2026'), 'clipped side is marked with an ellipsis');
	assert.ok(
		splitSentences(plainOf(html)).length < splitSentences(entry.text.trim()).length,
		'window has fewer sentences than the full text'
	);
});

await test('a short (2-sentence) entry drops a whole sentence', () => {
	const shortText = 'First sentence is here. Second sentence is there.';
	assert.equal(splitSentences(shortText).length, 2, 'fixture has two sentences');
	const html = buildReflectionTeaser(shortText);
	const window = plainOf(html);
	assert.notEqual(window, shortText, 'short entry rendered in full');
	assert.ok(html.includes('\u2026'), 'short window is clipped');
	assert.equal(splitSentences(window).length, 1, 'guard dropped a whole sentence');
});

await test('a single-sentence entry falls back to a word-drop', () => {
	const oneSentence = 'One two three four five six seven eight nine ten.';
	assert.equal(splitSentences(oneSentence).length, 1, 'fixture has one sentence');
	const html = buildReflectionTeaser(oneSentence);
	const window = plainOf(html);
	assert.notEqual(window, oneSentence, 'single-sentence entry rendered in full');
	assert.ok(html.includes('\u2026'), 'single-sentence window is clipped');
	assert.ok(
		wordsIn(window).length < wordsIn(oneSentence).length,
		'at least one word is excluded'
	);
});

await test('a one-word entry yields no full text', () => {
	const oneWord = 'Serenity';
	const html = buildReflectionTeaser(oneWord);
	assert.equal(html, '', 'a one-word entry has no bounded window');
	assert.notEqual(plainOf(html), oneWord, 'one-word entry rendered in full');
});

console.log('reflection: date resolution (getReflectionForDate)');

await test('an explicit MM-DD resolves that date; an absent date is null', () => {
	const june = getReflectionForDate('06-28');
	assert.ok(june, '06-28 resolves');
	assert.equal(june.id, 'dr-06-28');
	assert.equal(june.date, '06-28');
	assert.equal(getReflectionForDate('02-30'), null, 'absent date is null');
});

await test('getTodaysReflection delegates to the today MM-DD key', () => {
	const todays = getTodaysReflection();
	const direct = getReflectionForDate(todayReflectionKey());
	assert.equal(todays?.id ?? null, direct?.id ?? null);
});

await test('isValidReflectionDate accepts MM-DD and rejects other shapes', () => {
	for (const good of ['01-01', '06-28', '12-31']) {
		assert.equal(isValidReflectionDate(good), true, good);
	}
	for (const bad of ['13-01', '00-01', '06-32', '6-28', '', null, undefined]) {
		assert.equal(isValidReflectionDate(bad), false, String(bad));
	}
});

console.log('reflection: offline fallback');

await test('a missing entry yields the availability message and no reflection text', () => {
	const fallback = getReflectionFallback('02-30');
	assert.equal(fallback.reflection, null);
	assert.equal(fallback.teaser, '');
	assert.equal(
		fallback.message,
		`No reflection available for ${formatReflectionDate('02-30')}`
	);
	assert.ok(fallback.message, 'message is present');
});

await test('a present entry yields its bounded teaser, still not the full text', () => {
	const fallback = getReflectionFallback('06-28');
	assert.ok(fallback.reflection, 'entry present');
	assert.equal(fallback.message, null);
	assert.notEqual(plainOf(fallback.teaser), fallback.reflection.text.trim());
	assert.ok(fallback.teaser.includes('\u2026'));
});

console.log('reflection: no AAWS fetch/scrape');

await test('no request is made to aa.org while rendering the DR surface', () => {
	assert.ok(requestedUrls.length > 0, 'the local index was loaded');
	assert.ok(
		requestedUrls.every((url) => !url.includes('aa.org')),
		`unexpected aa.org request: ${requestedUrls.find((url) => url.includes('aa.org'))}`
	);
});

await test('changed DR modules contain no aa.org request path', async () => {
	const files = [
		path.join(repoRoot, 'src', 'lib', 'corpus', 'reflection.ts'),
		path.join(repoRoot, 'src', 'routes', '+page.svelte'),
		path.join(repoRoot, 'src', 'routes', 'reflection', '+page.svelte')
	];
	const requestPattern = /fetch\s*\(|XMLHttpRequest|axios|sendBeacon|navigator\.send/;
	let references = 0;
	for (const file of files) {
		const source = await readFile(file, 'utf8');
		for (const line of source.split('\n')) {
			if (!line.includes('aa.org')) continue;
			references += 1;
			assert.ok(
				!requestPattern.test(line),
				`aa.org request path in ${path.relative(repoRoot, file)}: ${line.trim()}`
			);
		}
	}
	assert.ok(references > 0, 'the surfaces still link to aa.org');
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('');
if (failed > 0) {
	console.error(`[test-reflection] FAILED — ${failed} test(s) failed, ${passed} passed`);
	process.exit(1);
}
console.log(`[test-reflection] \u2713 All ${passed} tests passed`);
