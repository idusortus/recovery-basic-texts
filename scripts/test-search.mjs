#!/usr/bin/env node
/**
 * Dependency-free search-quality regression tests (Areas 1, 2, 3, 6).
 *
 * Run with: node scripts/test-search.mjs
 * (or `npm run test:search`, which rebuilds static/index first)
 *
 * No test framework, no new dependency. Node's built-in type stripping plus
 * scripts/search-test-loader.mjs let this plain Node script import the real app
 * search service (`src/lib/search/index.ts`) and exercise BOTH search paths.
 *
 * Covers spec requirements:
 *   - Contraction- and punctuation-insensitive matching (shared normalization)
 *   - MiniSearch tokenizes indexes/query identically
 *   - Both search paths agree on matches, highlights and ordering
 *   - `tornado` returns big-book-2ed-chapter-6-into-action-p0142 on both paths
 *   - The leaked page header is gone from that passage
 *   - Query parsing, sentence splitting, KWIC clipping per display mode
 *   - Shared relevance ranking and match-centered snippets
 *
 * Area 1/2/3/6 — search-overhaul
 */

import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MiniSearch from 'minisearch';
import { get } from 'svelte/store';

import {
	normalizeTerm,
	normalizeString,
	tokenize,
	processTerm
} from '../src/lib/search/normalize.js';
import { tokenizeWithPositions, buildConcordance } from '../corpus/scripts/concordance-utils.mjs';

register('./search-test-loader.mjs', import.meta.url);

// Loaded after register() so the loader can resolve extensionless/`$lib` imports.
const { splitSentences, buildKwicFromOffsets, buildExcerpt, buildFullTextHighlight, buildCitation } =
	await import('../src/lib/search/kwic.ts');
const { analyzePassage, scoreMatch } = await import('../src/lib/search/match.ts');
const { createSuggestIndex, suggest, boundedEditDistance, applySuggestion, moveActiveIndex } =
	await import('../src/lib/search/suggestions.ts');
const { getSynonymTerms } = await import('../src/lib/corpus/synonyms.ts');

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexDir = path.join(repoRoot, 'static', 'index');
const golden = JSON.parse(
	await readFile(path.join(repoRoot, 'scripts', 'fixtures', 'search-golden.json'), 'utf8')
);

const TARGET_PASSAGE = 'big-book-2ed-chapter-6-into-action-p0142';
/**
 * The corrected page reference. The Big Book corpus numbers `pageRef` by PDF
 * page (chapter map: "PDF page = book page + 21"), so the passage printed on
 * book page 82 lives at corpus page p.103 — consistent with its neighbours
 * (p.102 / p.104) and the big-book-2ed pagemap.
 */
const EXPECTED_PAGE_REF = 'p.103';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const APOSTROPHE_VARIANTS = ["Haven't", 'Havent', 'Haven\u2019t', 'Haven\u2018t', 'haven\u02bct'];

function idsFromGroups(groups) {
	return groups.flatMap((g) => g.results.map((r) => r.passage.id)).sort();
}

/** Results in app order (grouped), flattened without re-sorting. */
function resultsOf(groups) {
	return groups.flatMap((g) => g.results);
}

/** Issued ids in app order, grouped by source. */
function orderedIds(groups) {
	return groups.map((g) => [g.source.id, g.results.map((r) => r.passage.id)]);
}

function findResult(groups, passageId) {
	return resultsOf(groups).find((r) => r.passage.id === passageId);
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

const FIRST_MARK_RE = /<mark>(?:<span class="sr-only">highlighted: <\/span>)?([\s\S]*?)<\/mark>/;
const ALL_MARKS_RE = new RegExp(FIRST_MARK_RE.source, 'g');

/** Decoded contents of every `<mark>` in a KWIC string. */
function marksOf(html) {
	return [...html.matchAll(ALL_MARKS_RE)].map((m) => decodeHtml(m[1]));
}

/** KWIC with tags and the clipping ellipses removed. */
function plainOf(html) {
	const withoutMarks = html
		.replace(/<mark><span class="sr-only">highlighted: <\/span>/g, '')
		.replace(/<\/mark>/g, '')
		.replace(/<[^>]*>/g, '');
	return decodeHtml(withoutMarks)
		.replace(/\u2026/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Words in a KWIC (tags/ellipses excluded). */
function wordsIn(html) {
	return plainOf(html).split(/\s+/).filter(Boolean);
}

/** Words before and after the first highlighted match in a KWIC. */
function countsAroundFirstMark(html) {
	const match = html.match(FIRST_MARK_RE);
	if (!match) return { before: 0, after: 0 };
	const before = plainOf(html.slice(0, match.index)).split(/\s+/).filter(Boolean).length;
	const after = plainOf(html.slice(match.index + match[0].length))
		.split(/\s+/)
		.filter(Boolean).length;
	return { before, after };
}

/** Un-escape HTML back to plain text, stripping only the highlight markup. */
function withoutHighlightMarkup(html) {
	return decodeHtml(
		html
			.replace(/<mark><span class="sr-only">highlighted: <\/span>/g, '')
			.replace(/<\/mark>/g, '')
			.replace(/<[^>]*>/g, '')
	);
}

/** Parse a query into phrase token runs and keywords, as the app does. */
function queryParts(query) {
	const phrases = [];
	let rest = query.trim();
	for (const match of query.matchAll(/"([^"]+)"/g)) {
		const tokens = tokenize(match[1]).map(processTerm).filter(Boolean);
		if (tokens.length > 0) phrases.push(tokens);
		rest = rest.replace(match[0], ' ');
	}
	const keywords = [...new Set(tokenize(rest).map(processTerm).filter(Boolean))];
	return { phrases, keywords };
}

/** The score the app assigns to a result for a query. */
function scoreFor(result, query) {
	const { phrases, keywords } = queryParts(query);
	return scoreMatch(analyzePassage(result.passage.text, phrases, keywords));
}

/**
 * Load a fresh instance of the app search service against the prebuilt index.
 * A unique query string busts the ESM cache so each call gets its own store.
 * `withConcordance` controls whether the concordance artifact is served — when
 * false, `search()` stays on the MiniSearch path.
 */
async function loadSearch(tag, withConcordance) {
	const files = {
		'/index/minisearch.json': await readFile(path.join(indexDir, 'minisearch.json'), 'utf8'),
		'/index/passages.json': await readFile(path.join(indexDir, 'passages.json'), 'utf8'),
		'/index/index-meta.json': await readFile(path.join(indexDir, 'index-meta.json'), 'utf8'),
		'/index/concordance.json': await readFile(path.join(indexDir, 'concordance.json'), 'utf8')
	};

	globalThis.fetch = async (url) => {
		if (!withConcordance && String(url).includes('concordance')) {
			return { ok: false, status: 404, json: async () => ({}) };
		}
		const body = files[url];
		if (body === undefined) return { ok: false, status: 404, json: async () => ({}) };
		return { ok: true, status: 200, json: async () => JSON.parse(body) };
	};

	const mod = await import(`../src/lib/search/index.ts?${tag}`);

	await mod.loadSearchIndex();
	if (withConcordance) {
		for (let i = 0; i < 100 && !get(mod.concordanceReady); i++) {
			await new Promise((resolve) => setTimeout(resolve, 2));
		}
		if (!get(mod.concordanceReady)) throw new Error('concordance never became ready');
	}
	return mod;
}

// ─── Guard: index must exist ──────────────────────────────────────────────────

if (!existsSync(path.join(indexDir, 'minisearch.json'))) {
	console.error('static/index/* is missing — run `npm run build:index` first.');
	process.exit(1);
}

console.log('search: shared normalization (Area 1.1)');

await test('apostrophe variants normalize to one term', () => {
	for (const variant of APOSTROPHE_VARIANTS) {
		assert.equal(processTerm(tokenize(variant)[0]), 'havent', `variant ${variant}`);
	}
	assert.equal(normalizeTerm('Haven\u2019t'), 'havent');
});

await test('hyphens are separators and quotes/dashes fold to spaces', () => {
	assert.deepEqual(tokenize('face-to-face'), ['face', 'to', 'face']);
	assert.equal(normalizeString('face-to-face'), 'face to face');
	assert.equal(normalizeString('face to face'), 'face to face');
	assert.equal(normalizeString('\u201cgod\u201d'), 'god');
	assert.equal(normalizeString('self\u2013pity'), 'self pity');
});

await test('trailing/surrounding punctuation is dropped from a term', () => {
	assert.equal(processTerm(tokenize('god.')[0]), 'god');
	assert.equal(processTerm(tokenize('god,')[0]), 'god');
	assert.equal(processTerm(tokenize('(god)')[0]), 'god');
	assert.equal(processTerm(tokenize('tornado.')[0]), 'tornado');
});

await test('MiniSearch tokenizer and concordance tokenizer agree on a fixture corpus', () => {
	const fixture = [
		'Rarely have we seen a person fail who has thoroughly followed our path.',
		"We can't do it by ourselves.",
		'God\u2019s will for us',
		'face-to-face combat',
		'The alcoholic is like a tornado roaring his way through the lives of others.',
		'82 ALCOHOLICS ANONYMOUS forget, so can she.'
	];
	for (const text of fixture) {
		const concordanceTerms = [
			...new Set(tokenizeWithPositions(text).map((t) => t.normalized))
		].sort();
		const msTerms = [...new Set(tokenize(text).map(processTerm).filter(Boolean))].sort();
		assert.deepEqual(msTerms, concordanceTerms, `fixture: ${text}`);
	}
});

await test('buildConcordance keys equal MiniSearch-processed terms', () => {
	const passage = {
		id: 'fx',
		text: "We haven't got a clue; God\u2019s face-to-face will."
	};
	const concordanceTerms = Object.keys(buildConcordance([passage])).sort();
	const msTerms = [...new Set(tokenize(passage.text).map(processTerm).filter(Boolean))].sort();
	assert.deepEqual(msTerms, concordanceTerms);
});

console.log('search: MiniSearch index/query token parity (Area 1.2)');

await test('a term tokenizes identically at index and query time', () => {
	assert.equal(processTerm(tokenize("Haven't")[0]), processTerm(tokenize('Havent')[0]));
	assert.equal(processTerm(tokenize("Haven't")[0]), processTerm(tokenize('Haven\u2019t')[0]));
});

await test('MiniSearch built with the shared tokenizer matches query variants', () => {
	const ms = new MiniSearch({
		fields: ['text'],
		storeFields: ['id'],
		idField: 'id',
		tokenize,
		processTerm
	});
	ms.addAll([{ id: 'x', text: "We haven't got a clue." }]);
	for (const query of ['Havent got', "Haven't got", 'Haven\u2019t got', 'havent   got']) {
		const hits = ms.search(query, { combineWith: 'AND', fuzzy: false });
		assert.equal(hits.length, 1, `query ${query}`);
	}
});

console.log('search: two-path parity (Area 1.3)');

const msPath = await loadSearch('ms', false);
const concordancePath = await loadSearch('conc', true);

await test('both paths are live (MiniSearch vs concordance)', () => {
	assert.equal(get(msPath.concordanceReady), false);
	assert.equal(get(concordancePath.concordanceReady), true);
});

await test('equivalent query variants match the same passages on both paths', () => {
	// Groups whose members must return identical passage sets. (Bare `god` is
	// deliberately excluded: it is a synonym key and expands — Area 5.)
	const groups = [
		['Havent got', "Haven't got", 'Haven\u2019t got', "haven't got"],
		['god.', 'god,'],
		['face-to-face', 'face to face'],
		['tornado', 'Tornado', 'tornado.']
	];

	for (const group of groups) {
		const msSets = group.map((q) => JSON.stringify(idsFromGroups(msPath.search(q))));
		const concSets = group.map((q) => JSON.stringify(idsFromGroups(concordancePath.search(q))));

		assert.ok(JSON.parse(msSets[0]).length > 0, `non-empty: ${group[0]}`);
		assert.ok(
			msSets.every((s) => s === msSets[0]),
			`MiniSearch variants agree: ${group.join(' | ')}`
		);
		assert.ok(
			concSets.every((s) => s === concSets[0]),
			`concordance variants agree: ${group.join(' | ')}`
		);
		assert.equal(msSets[0], concSets[0], `paths agree: ${group.join(' | ')}`);
	}
});

await test('both paths return the same passages for every normalization variant', () => {
	const queries = [
		'Havent got',
		"Haven't got",
		'Haven\u2019t got',
		'god.',
		'god,',
		'face-to-face',
		'face to face',
		'tornado',
		'Tornado',
		'tornado.'
	];
	for (const query of queries) {
		assert.equal(
			JSON.stringify(idsFromGroups(msPath.search(query))),
			JSON.stringify(idsFromGroups(concordancePath.search(query))),
			`paths agree: ${query}`
		);
	}
});

await test('surrounding punctuation does not drop passages the bare term matches', () => {
	const bare = new Set(idsFromGroups(msPath.search('god')));
	for (const query of ['god.', 'god,']) {
		for (const id of idsFromGroups(msPath.search(query))) {
			assert.ok(bare.has(id), `${query} result ${id} present for bare "god"`);
		}
	}
});

console.log('search: parser + sentence splitting (Area 3.1/3.2)');

await test('golden sentence boundaries (abbreviations, page refs, numbered lists)', () => {
	for (const entry of golden.sentences) {
		assert.deepEqual(splitSentences(entry.text), entry.expected, entry.text);
	}
});

await test('quoted phrases require adjacency; bare words are AND-matched', () => {
	// "self will" is not a synonym key, so this is pure parser/adjacency behavior.
	const bare = resultsOf(msPath.search('self will'));
	const quoted = resultsOf(msPath.search('"self will"'));
	assert.ok(bare.length > 0 && quoted.length > 0, 'both forms return results');
	assert.ok(quoted.length < bare.length, 'quoted phrase is stricter than bare AND');

	for (const result of bare) {
		const match = analyzePassage(result.passage.text, [], ['self', 'will']);
		assert.equal(match.hasAllKeywords, true, `bare AND: ${result.passage.id}`);
	}
	for (const result of quoted) {
		const match = analyzePassage(result.passage.text, [['self', 'will']], []);
		assert.equal(match.hasAllPhrases, true, `quoted adjacency: ${result.passage.id}`);
	}
	assert.ok(
		bare.some(
			(result) => !analyzePassage(result.passage.text, [['self', 'will']], []).hasAllPhrases
		),
		'at least one bare match is non-adjacent (filtered out by the quoted form)'
	);
});

console.log('search: two-path highlight identity (Area 3.3)');

await test('both paths highlight the same spans for shared passages', () => {
	const queries = [
		'tornado',
		"Haven't got",
		'higher power',
		'fear anger',
		'face to face',
		'acceptance'
	];
	for (const query of queries) {
		const concordanceResults = new Map(
			resultsOf(concordancePath.search(query)).map((r) => [r.passage.id, r])
		);
		let shared = 0;
		for (const result of resultsOf(msPath.search(query))) {
			const other = concordanceResults.get(result.passage.id);
			if (!other) continue;
			assert.deepEqual(
				marksOf(result.kwic),
				marksOf(other.kwic),
				`marks differ: ${query} — ${result.passage.id}`
			);
			shared += 1;
		}
		assert.ok(shared > 0, `no shared results for ${query}`);
	}
});

console.log('search: display-mode clipping (Area 3.4)');

await test('snippet KWIC is at most contextWords words in total', () => {
	const results = resultsOf(concordancePath.search('willingness')).filter(
		(r) => r.source.displayMode === 'snippet'
	);
	assert.ok(results.length > 0, 'has snippet results');
	for (const result of results) {
		const limit = Math.min(result.source.contextWords, 30);
		assert.ok(
			wordsIn(result.kwic).length <= limit,
			`${result.passage.id}: ${wordsIn(result.kwic).length} > ${limit}`
		);
	}
});

await test('concordance-only KWIC is clipped to contextSentences on each side when set', () => {
	const results = resultsOf(concordancePath.search('gratitude')).filter(
		(r) => r.source.displayMode === 'concordance-only' && r.source.contextSentences
	);
	assert.ok(results.length > 0, 'has sentence-bounded concordance-only results');
	for (const result of results) {
		const shown = plainOf(result.kwic);
		const matched = splitSentences(result.passage.text).filter((s) => shown.includes(s));
		// At most contextSentences sentences each side of the matched sentence.
		assert.ok(
			matched.length <= 2 * (result.source.contextSentences ?? 0) + 1,
			`${result.passage.id}: ${matched.length} sentences shown`
		);
		// The window is a strict subset of the entry, with a clipped side marked.
		assert.ok(
			result.passage.text.includes(shown),
			`${result.passage.id}: window is contiguous source text`
		);
		assert.ok(
			shown.length < result.passage.text.trim().length,
			`${result.passage.id}: window reproduces the full text`
		);
		assert.ok(result.kwic.includes('\u2026'), `${result.passage.id}: clipped side is marked`);
	}
});

await test('concordance-only without contextSentences stays word-bounded', () => {
	// Synthetic: the same KWIC engine, no sentence bound — word clipping intact.
	const text =
		'Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron.';
	const start = text.indexOf('theta');
	const html = buildKwicFromOffsets(text, [[start, start + 5]], 'concordance-only', 2, start);
	const { before, after } = countsAroundFirstMark(html);
	assert.ok(before <= 3, 'word-bounded: left side clips to contextWords + the match span');
	assert.ok(after <= 3, 'word-bounded: right side clips to contextWords');
	assert.ok(html.includes('\u2026'), 'word-bounded concordance-only is clipped');
});

await test('a protected short entry never reproduces the full text (synthetic)', () => {
	const text = 'First sentence here. Second sentence there. Third sentence last.';
	const start = text.indexOf('Second');
	const html = buildKwicFromOffsets(
		text,
		[[start, start + 'Second'.length]],
		'concordance-only',
		8,
		start,
		1
	);
	const shown = plainOf(html);
	assert.notEqual(shown, text, 'full synthetic entry rendered');
	assert.ok(html.includes('\u2026'), 'guard marks the clipped side');
	assert.ok(splitSentences(shown).length < splitSentences(text).length, 'a sentence was dropped');
});

await test('protected display modes never render the full passage', () => {
	for (const query of ['willingness', 'gratitude', 'acceptance']) {
		for (const module of [msPath, concordancePath]) {
			for (const result of resultsOf(module.search(query))) {
				if (result.source.displayMode === 'full-text') continue;
				assert.notEqual(
					plainOf(result.kwic),
					result.passage.text.trim(),
					`full protected text rendered: ${query} — ${result.passage.id}`
				);
			}
		}
	}
});

console.log('search: golden queries (Area 3.5)');

await test('golden queries: sentence boundaries + highlighted spans on both paths', () => {
	assert.ok(golden.queries.length >= 5, 'golden query set present');
	for (const entry of golden.queries) {
		for (const [label, module] of [
			['minisearch', msPath],
			['concordance', concordancePath]
		]) {
			const result = findResult(module.search(entry.query), entry.passageId);
			assert.ok(result, `${label}: ${entry.query} did not return ${entry.passageId}`);
			assert.deepEqual(marksOf(result.kwic), entry.marks, `${label} marks: ${entry.query}`);
			assert.ok(
				splitSentences(result.passage.text).includes(entry.sentence),
				`${label} sentence boundary: ${entry.query}`
			);
			assert.ok(
				plainOf(result.kwic).includes(entry.sentence),
				`${label} snippet contains the matching sentence: ${entry.query}`
			);
		}
	}
});

console.log('search: ranking + snippet quality (Area 6)');

const RANKING_QUERIES = [
	'tornado',
	'higher power',
	'fear anger',
	'serenity',
	'Into Action',
	'face to face'
];

await test('results are ordered by the shared relevance score, ties by sequence', () => {
	for (const module of [msPath, concordancePath]) {
		for (const query of RANKING_QUERIES) {
			for (const group of module.search(query)) {
				const expected = group.results
					.map((r) => ({
						id: r.passage.id,
						score: scoreFor(r, query),
						sequence: r.passage.sequence
					}))
					.sort((a, b) => b.score - a.score || a.sequence - b.sequence)
					.map((entry) => entry.id);
				assert.deepEqual(
					group.results.map((r) => r.passage.id),
					expected,
					`${query} (${group.source.id})`
				);
			}
		}
	}
});

await test('the strongest (adjacent) match ranks first within a source group', () => {
	for (const group of concordancePath.search('self will')) {
		assert.ok(group.results.length > 1, `${group.source.id} has results`);
		const top = analyzePassage(group.results[0].passage.text, [], ['self', 'will']);
		assert.equal(top.proximityWindow, 2, `${group.source.id}: top result is adjacent`);
		const last = analyzePassage(
			group.results[group.results.length - 1].passage.text,
			[],
			['self', 'will']
		);
		assert.ok(last.proximityWindow > 2, `${group.source.id}: weakest result is non-adjacent`);
	}
});

await test('passages matching all terms rank above synonym-only matches', () => {
	for (const group of concordancePath.search('fear anger')) {
		const direct = group.results.map((r, i) => (r.matchedBySynonym ? -1 : i)).filter((i) => i >= 0);
		const synonym = group.results
			.map((r, i) => (r.matchedBySynonym ? i : -1))
			.filter((i) => i >= 0);
		if (direct.length > 0 && synonym.length > 0) {
			assert.ok(
				Math.max(...direct) < Math.min(...synonym),
				`${group.source.id}: direct matches must outrank synonym-only matches`
			);
		}
	}
});

await test('ordering is deterministic for the same query and index', () => {
	for (const query of RANKING_QUERIES) {
		assert.deepEqual(
			orderedIds(concordancePath.search(query)),
			orderedIds(concordancePath.search(query)),
			query
		);
	}
});

await test('both paths produce the same result order (Area 6.3)', () => {
	for (const query of RANKING_QUERIES) {
		assert.deepEqual(
			orderedIds(concordancePath.search(query)),
			orderedIds(msPath.search(query)),
			`order differs: ${query}`
		);
	}
});

await test('snippets center on the best-ranked match, not the earliest offset', () => {
	const text =
		'He will not sleep. Fear was everywhere. Then one day he found God will help him if he asks. Peace came at last.';
	const match = analyzePassage(text, [], ['god', 'will']);
	const best = buildKwicFromOffsets(text, match.offsets, 'concordance-only', 3, match.anchor);
	const earliest = buildKwicFromOffsets(
		text,
		match.offsets,
		'concordance-only',
		3,
		match.offsets[0][0]
	);
	assert.ok(plainOf(best).includes('God will help'), 'best window anchors the dense cluster');
	assert.ok(!plainOf(best).includes('He will not sleep'), 'best window leaves the early lone term');
	assert.ok(
		plainOf(earliest).includes('He will not sleep'),
		'earliest-offset anchor would show the early lone term'
	);

	// Integration: the real `god will` result for p0189 is centered on the pair.
	const result = findResult(
		concordancePath.search('god will'),
		'big-book-2ed-chapter-8-to-wives-p0189'
	);
	assert.ok(result, 'p0189 returned');
	assert.ok(plainOf(result.kwic).includes('God will'), 'real snippet contains the dense cluster');
});

console.log('search: synonym & concept grouping (Area 5)');

await test('concept groups are symmetric in getSynonymTerms (Area 5.1/5.2)', () => {
	const group = ['god', 'higher power', 'creator', 'spirit of the universe'];
	for (const member of group) {
		const terms = getSynonymTerms([member]).map((t) => t.toLowerCase());
		for (const other of group) {
			if (other === member) continue;
			assert.ok(terms.includes(other), `${member} should expand to ${other}`);
		}
	}
});

await test('existing groups still expand, and values expand back to the key (Area 5.5)', () => {
	assert.ok(getSynonymTerms(['fear']).length > 0);
	assert.ok(getSynonymTerms(['resentment']).length > 0);
	assert.ok(getSynonymTerms(['acceptance']).length > 0);
	assert.ok(getSynonymTerms(['sobriety']).length > 0);
	assert.ok(getSynonymTerms(['anxiety']).includes('fear'));
	assert.ok(getSynonymTerms(['anger']).includes('resentment'));
	assert.ok(getSynonymTerms(['willingness']).includes('acceptance'));
	assert.ok(getSynonymTerms(['sober']).includes('sobriety'));
});

await test('searching God surfaces Higher Power passages, and vice versa (Area 5.1)', () => {
	const godResults = resultsOf(concordancePath.search('god'));
	const higherPower = godResults.filter(
		(r) =>
			r.matchedBySynonym &&
			/\bhigher power\b/i.test(r.passage.text) &&
			!/\bgod\b/i.test(r.passage.text)
	);
	assert.ok(higherPower.length > 0, 'God surfaced a passage using "Higher Power"');

	const prayerResults = resultsOf(concordancePath.search('higher power'));
	const godOnly = prayerResults.filter(
		(r) =>
			r.matchedBySynonym &&
			/\bgod\b/i.test(r.passage.text) &&
			!/higher\s+power/i.test(r.passage.text)
	);
	assert.ok(godOnly.length > 0, '"Higher Power" surfaced a passage using "God"');
});

await test('concept-group members return the same passage set', () => {
	const members = ['god', 'higher power', 'creator', 'spirit of the universe'];
	const sets = members.map((m) => JSON.stringify(idsFromGroups(concordancePath.search(m))));
	assert.ok(
		sets.every((s) => s === sets[0]),
		'every member expands to the whole concept group'
	);
});

await test('multi-word synonyms AND-match and the two paths agree (Area 5.3)', () => {
	const queries = [
		'god',
		'higher power',
		'creator',
		'spirit of the universe',
		'fear',
		'anxiety',
		'acceptance',
		'willingness',
		'sobriety'
	];
	const synonymSet = (module, query) =>
		JSON.stringify(
			resultsOf(module.search(query))
				.filter((r) => r.matchedBySynonym)
				.map((r) => r.passage.id)
				.sort()
		);
	for (const query of queries) {
		assert.equal(
			JSON.stringify(idsFromGroups(msPath.search(query))),
			JSON.stringify(idsFromGroups(concordancePath.search(query))),
			`result sets differ: ${query}`
		);
		assert.equal(
			synonymSet(msPath, query),
			synonymSet(concordancePath, query),
			`synonym sets differ: ${query}`
		);
	}
});

await test('quoted phrases are never synonym-expanded', () => {
	for (const query of ['"god"', '"higher power"', '"fear"']) {
		const results = resultsOf(concordancePath.search(query));
		assert.ok(results.length > 0, `quoted phrase matches: ${query}`);
		assert.equal(results.filter((r) => r.matchedBySynonym).length, 0, query);
	}
});

await test('synonym-only results are marked (Area 5.4)', () => {
	const marked = resultsOf(concordancePath.search('god')).filter((r) => r.matchedBySynonym);
	assert.ok(marked.length > 0, 'some results carry matchedBySynonym');
});

console.log('search: search-box suggestions (Area 4)');

await test('no suggestions until the term dictionary has loaded (Area 4.4)', () => {
	assert.deepEqual(msPath.getSuggestionTerms('pow'), []);
	assert.deepEqual(msPath.getSuggestionTerms('serenety'), []);
});

await test('prefix suggestions are indexed terms, ranked by frequency', async () => {
	const suggestions = concordancePath.getSuggestionTerms('pow');
	assert.ok(suggestions.length > 0, 'has prefix suggestions');
	assert.ok(
		suggestions.every((s) => s.term.startsWith('pow')),
		'all share the prefix'
	);
	assert.equal(suggestions[0].term, 'power', 'most frequent prefix match first');

	const concordance = JSON.parse(await readFile(path.join(indexDir, 'concordance.json'), 'utf8'));
	const frequency = (term) => concordance[term].reduce((n, o) => n + o.offsets.length, 0);
	for (let i = 1; i < suggestions.length; i++) {
		assert.ok(
			frequency(suggestions[i - 1].term) >= frequency(suggestions[i].term),
			'ranked by frequency'
		);
	}
});

await test('a misspelling surfaces a did-you-mean', () => {
	assert.ok(concordancePath.getSuggestionTerms('serenety').some((s) => s.term === 'serenity'));
	assert.ok(concordancePath.getSuggestionTerms('forgivness').some((s) => s.term === 'forgiveness'));
});

await test('suggestions are indexed terms only — never passage text (Area 4.4)', async () => {
	const concordance = JSON.parse(await readFile(path.join(indexDir, 'concordance.json'), 'utf8'));
	const indexed = new Set(Object.keys(concordance));
	for (const query of ['pow', 'serenety', 'god', 'havent go']) {
		for (const suggestion of concordancePath.getSuggestionTerms(query)) {
			assert.ok(indexed.has(suggestion.term), `not an indexed term: ${suggestion.term}`);
			assert.ok(
				!/\s/.test(suggestion.term),
				`suggestion is not a single indexed term: ${suggestion.term}`
			);
		}
	}
});

await test('suggestion ranking/helpers behave (Area 4.1)', () => {
	const index = createSuggestIndex({
		alpha: [{ offsets: [[0, 5]] }],
		alphabet: [{ offsets: [[0, 5]] }],
		alphabetize: [
			{
				offsets: [
					[0, 5],
					[6, 11]
				]
			}
		],
		beta: [{ offsets: [[0, 4]] }]
	});
	assert.deepEqual(
		suggest(index, 'alp').map((s) => s.term),
		['alphabetize', 'alpha', 'alphabet']
	);
	assert.equal(suggest(index, 'bta')[0]?.term, 'beta');
	assert.deepEqual(suggest(index, 'a'), [], 'too short to suggest');

	assert.equal(boundedEditDistance('kitten', 'sitting', 3), 3);
	assert.ok(boundedEditDistance('abc', 'xyz', 1) > 1);
});

await test('selecting a suggestion composes the query and runs the search (Area 4.3)', () => {
	assert.equal(applySuggestion('higher po', 'power'), 'higher power');
	assert.equal(applySuggestion('pow', 'power'), 'power');
	assert.equal(applySuggestion('', 'power'), 'power');
	assert.equal(
		JSON.stringify(idsFromGroups(concordancePath.search(applySuggestion('higher po', 'power')))),
		JSON.stringify(idsFromGroups(concordancePath.search('higher power')))
	);
});

await test('combobox keyboard navigation wraps (Area 4.2)', () => {
	assert.equal(moveActiveIndex(-1, 3, 1), 0, 'first ArrowDown selects the first option');
	assert.equal(moveActiveIndex(0, 3, 1), 1);
	assert.equal(moveActiveIndex(2, 3, 1), 0, 'ArrowDown wraps to the top');
	assert.equal(moveActiveIndex(0, 3, -1), 2, 'ArrowUp wraps to the bottom');
	assert.equal(moveActiveIndex(0, 0, 1), -1, 'no suggestions → none active');
});

await test('search input is wired as an accessible combobox (Area 4.2)', async () => {
	const source = await readFile(path.join(repoRoot, 'src', 'routes', '+page.svelte'), 'utf8');
	for (const marker of [
		'role="combobox"',
		'aria-autocomplete="list"',
		'aria-controls="search-suggestions"',
		'aria-haspopup="listbox"',
		'aria-expanded=',
		'aria-activedescendant=',
		'role="listbox"',
		'role="option"',
		'aria-selected=',
		"e.key === 'ArrowDown'",
		"e.key === 'ArrowUp'",
		"e.key === 'Escape'",
		'refreshSuggestions()'
	]) {
		assert.ok(source.includes(marker), `combobox markup missing: ${marker}`);
	}
	// Suggestions are refreshed in the input handler, which still schedules the
	// original 150ms debounced search afterwards.
	const inputHandler = source.slice(
		source.indexOf('function handleInput()'),
		source.indexOf('function handleKeydown')
	);
	assert.ok(inputHandler.includes('refreshSuggestions()'), 'handleInput refreshes suggestions');
	assert.ok(inputHandler.includes('}, 150);'), 'debounced search schedule unchanged');
});

console.log('search: clipboard excerpt guard');

await test('protected results copy a clipped excerpt, never the full passage', () => {
	for (const query of ['gratitude', 'acceptance', 'god']) {
		for (const result of resultsOf(concordancePath.search(query))) {
			if (result.source.displayMode === 'full-text') continue;
			assert.ok(
				!result.citation.includes(result.passage.text),
				`citation contains full protected text: ${query} — ${result.passage.id}`
			);
			assert.ok(
				result.citation.includes('\u2026'),
				`citation should mark the clipped side: ${query} — ${result.passage.id}`
			);
		}
	}
});

await test('full-text results keep the full text in their citation', () => {
	const result = findResult(concordancePath.search('tornado'), TARGET_PASSAGE);
	assert.ok(result, 'tornado result present');
	assert.ok(result.citation.includes(result.passage.text));
});

await test('a Daily Reflections citation leads with the formatted date', () => {
	const results = resultsOf(concordancePath.search('gratitude')).filter(
		(r) => r.source.id === 'daily-reflections'
	);
	assert.ok(results.length > 0, 'has a Daily Reflections result');
	for (const result of results) {
		const date = result.passage.chapterRef;
		assert.ok(date, 'DR passage carries a chapterRef (human date)');
		const [excerpt, attribution] = result.citation.split('\n\n');
		assert.equal(attribution, `${date} · Daily Reflections`, 'citation leads with the date');
		assert.ok(!attribution.includes('From '), 'citation is not the generic From form');
		assert.ok(!excerpt.includes(result.passage.text), 'DR citation never contains the full text');
	}
});

await test('buildCitation leads with the date when provided, else the From form', () => {
	const dated = buildCitation('excerpt text', 'Daily Reflections', null, null, 'January 1');
	assert.equal(dated, 'excerpt text\n\nJanuary 1 · Daily Reflections');
	const generic = buildCitation('excerpt text', 'Big Book', 'Chapter 5 — How It Works', 'p.58');
	assert.equal(
		generic,
		'excerpt text\n\nFrom Big Book, Chapter 5 — How It Works, p.58'
	);
});

await test('buildExcerpt is full for full-text and clipped for protected', () => {
	const text = 'One two three four five six seven eight nine ten eleven twelve.';
	const offsets = [[13, 17]]; // "four"
	assert.equal(buildExcerpt(text, offsets, 'full-text', 15, 13), text);
	const excerpt = buildExcerpt(text, offsets, 'concordance-only', 2, 13);
	assert.ok(excerpt.includes('four'));
	assert.notEqual(excerpt, text);
	assert.ok(excerpt.startsWith('\u2026 '), 'clipped excerpt marks the left cut');
});

console.log('search: tornado regression (Area 2.4)');

await test('tornado returns the passage on both paths (any case)', () => {
	for (const query of ['tornado', 'Tornado', 'TORNADO']) {
		assert.ok(
			idsFromGroups(msPath.search(query)).includes(TARGET_PASSAGE),
			`MiniSearch path: ${query}`
		);
		assert.ok(
			idsFromGroups(concordancePath.search(query)).includes(TARGET_PASSAGE),
			`concordance path: ${query}`
		);
	}
});

console.log('search: corpus defect (Area 2.2)');

await test('p0142 has no leaked page header and the expected page reference', async () => {
	const passages = JSON.parse(
		await readFile(path.join(repoRoot, 'corpus', 'sources', 'big-book-2ed.json'), 'utf8')
	);
	const index = passages.findIndex((p) => p.id === TARGET_PASSAGE);
	assert.ok(index > 0, 'target passage exists');
	const passage = passages[index];

	assert.ok(!passage.text.includes('82 ALCOHOLICS ANONYMOUS'), 'leaked page header is gone');
	assert.ok(
		!/^\s*\d+\s+ALCOHOLICS ANONYMOUS\b/.test(passage.text),
		'passage does not start with a page-header line'
	);
	assert.equal(passage.pageRef, EXPECTED_PAGE_REF, 'page reference');

	// Verify against the surrounding passages' pageRefs (corpus convention).
	const page = parseInt(passage.pageRef.replace(/^p\./, ''), 10);
	const prev = parseInt(passages[index - 1].pageRef.replace(/^p\./, ''), 10);
	const next = parseInt(passages[index + 1].pageRef.replace(/^p\./, ''), 10);
	assert.ok(page >= prev && page <= next, `page ${page} between ${prev} and ${next}`);
});

// ─── Passage highlight (persist-passage-highlight) ───────────────────────────

console.log('search: passage highlight (persist-passage-highlight)');

await test('buildFullTextHighlight preserves the plain text and marks every occurrence', () => {
	const text = 'Home sweet home. There is no place like home.';
	const match = analyzePassage(text, [], ['home']);
	assert.equal(match.offsets.length, 3, 'three occurrences found');
	const html = buildFullTextHighlight(text, match.offsets);
	assert.ok(!html.includes('\u2026'), 'no clipping ellipsis');
	assert.equal(withoutHighlightMarkup(html), text, 'complete text preserved (no clipping)');
	assert.deepEqual(marksOf(html), ['Home', 'home', 'home'], 'every occurrence marked');
});

await test('buildFullTextHighlight renders a whole real passage without clipping', () => {
	const passages = concordancePath.getPassages();
	const text = passages[TARGET_PASSAGE].text;
	const match = analyzePassage(text, [], ['home']);
	assert.ok(match.offsets.length > 0, 'keyword "home" occurs in the passage');
	const whole = buildFullTextHighlight(text, match.offsets);
	const clipped = buildKwicFromOffsets(text, match.offsets, 'full-text', 0, match.anchor);
	assert.equal(withoutHighlightMarkup(whole), text, 'whole passage text preserved');
	assert.equal(marksOf(whole).length, match.offsets.length, 'every offset marked');
	// The existing `full-text` KWIC primitive still clips (unchanged behavior).
	assert.ok(clipped.includes('\u2026'), 'buildKwicFromOffsets still clips full-text');
	assert.ok(clipped.length < whole.length, 'clipped render is shorter than the whole');
});

await test('derivePassageParams: phrase mode is one adjacent token run, else keywords', () => {
	assert.deepEqual(concordancePath.derivePassageParams('higher power', true), {
		phraseTokens: [['higher', 'power']],
		keywords: []
	});
	assert.deepEqual(concordancePath.derivePassageParams('higher power', false), {
		phraseTokens: [],
		keywords: ['higher', 'power']
	});
	assert.deepEqual(
		concordancePath.derivePassageParams('god god', false),
		{ phraseTokens: [], keywords: ['god'] },
		'keywords are de-duplicated, matching parseQuery'
	);
	assert.deepEqual(concordancePath.derivePassageParams('   ', true), {
		phraseTokens: [],
		keywords: []
	});
	assert.deepEqual(concordancePath.derivePassageParams('', false), {
		phraseTokens: [],
		keywords: []
	});
});

await test('phrase mode matches token adjacency, not a character substring', () => {
	const { phraseTokens } = concordancePath.derivePassageParams('god will', true);
	assert.deepEqual(phraseTokens, [['god', 'will']]);
	assert.equal(
		analyzePassage('god will help us', phraseTokens, []).hasAllPhrases,
		true,
		'adjacent tokens match'
	);
	assert.equal(
		analyzePassage('god is far; will it', phraseTokens, []).hasAllPhrases,
		false,
		'non-adjacent tokens do not match'
	);
	// Normalized-token adjacency folds apostrophes: phrase "Gods will" matches "God's will".
	const apostrophe = concordancePath.derivePassageParams('Gods will', true);
	assert.equal(
		analyzePassage("God's will for us.", apostrophe.phraseTokens, []).hasAllPhrases,
		true,
		'normalized tokens fold apostrophes'
	);
});

await test('buildFullTextHighlight HTML-escapes text inside and outside the mark', () => {
	const text = 'A <tag> & "quotes" then god and 5 < 6.';
	const start = text.indexOf('god');
	const html = buildFullTextHighlight(text, [[start, start + 3]]);
	assert.ok(html.includes('&lt;tag&gt;'), 'angle brackets escaped');
	assert.ok(html.includes('&amp;'), 'ampersand escaped');
	assert.ok(html.includes('&quot;quotes&quot;'), 'double quotes escaped');
	assert.ok(!html.includes('<tag>'), 'no raw tag reaches the output');
	assert.equal(withoutHighlightMarkup(html), text, 'round-trips back to the exact text');
	assert.ok(
		html.includes('<mark><span class="sr-only">highlighted: </span>god</mark>'),
		'mark wrapper with sr-only prefix'
	);
});

await test('the passage route highlights only inside the full-text branch', async () => {
	const routePath = path.join(
		repoRoot,
		'src',
		'routes',
		'passage',
		'[sourceId]',
		'[passageId]',
		'+page.svelte'
	);
	const src = await readFile(routePath, 'utf8');
	assert.ok(src.includes("source.displayMode === 'full-text'"), 'branches on full-text');
	assert.ok(src.includes('buildFullTextHighlight'), 'uses the whole-text renderer');
	assert.ok(src.includes('analyzePassage'), 'uses the shared match path');
	assert.ok(src.includes('derivePassageParams'), 'uses the shared query→params helper');
	assert.ok(src.includes('Full text not available'), 'protected branch unchanged');
	assert.ok(src.includes('svelte/no-at-html-tags'), 'at-html lint guard present');
	assert.ok(!src.includes('buildKwicFromOffsets'), 'does not use the clipping KWIC builder');
	assert.ok(
		!src.includes('buildFullKwic') && !src.includes('extractTerms'),
		'no naive extractor on the passage page'
	);
});

await test('buildKwicFromOffsets snippet/concordance-only clipping is unchanged', () => {
	const text =
		'Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron.';
	const start = text.indexOf('theta');
	const offsets = [[start, start + 5]];
	const snippet = buildKwicFromOffsets(text, offsets, 'snippet', 5, start);
	assert.ok(wordsIn(snippet).length <= 5, 'snippet stays within the word cap');
	const concordance = buildKwicFromOffsets(text, offsets, 'concordance-only', 2, start);
	const { before, after } = countsAroundFirstMark(concordance);
	assert.ok(before <= 3, 'concordance-only clips the left side');
	assert.ok(after <= 3, 'concordance-only clips the right side');
	assert.ok(concordance.includes('\u2026'), 'concordance-only is clipped');
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('');
if (failed > 0) {
	console.error(`[test-search] FAILED — ${failed} test(s) failed, ${passed} passed`);
	process.exit(1);
}
console.log(`[test-search] \u2713 All ${passed} tests passed`);
