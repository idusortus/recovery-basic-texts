/**
 * concordance-utils.mjs
 *
 * Shared utilities for building and working with the concordance index.
 * Imported by both build-index.mjs and test-concordance-offsets.mjs.
 *
 * Issue B — PR 2
 */

// ─── Normalization ────────────────────────────────────────────────────────────

/** The apostrophe-character set stripped during normalization. */
const APOSTROPHE_RE = /['\u2018\u2019\u02bc]/g;

/**
 * Normalize a token for concordance lookup:
 * strip apostrophes and lowercase.
 * Matches the normalization applied by build-index.mjs for MiniSearch.
 *
 * @param {string} str
 * @returns {string}
 */
export function normalizeToken(str) {
	return str.replace(APOSTROPHE_RE, '').toLowerCase();
}

// ─── Tokenizer ────────────────────────────────────────────────────────────────

/**
 * Tokenize `text` into word-level tokens with character offsets.
 *
 * Each token carries:
 *   - `normalized`: lowercase, apostrophe-stripped form (matches the search index)
 *   - `start`: inclusive start character index in the original text
 *   - `end`:   exclusive end character index in the original text
 *
 * Single-character tokens are excluded (too short to be useful query terms).
 *
 * @param {string} text
 * @returns {Array<{normalized: string, start: number, end: number}>}
 */
export function tokenizeWithPositions(text) {
	const results = [];
	// Match words including internal apostrophes (contractions like "can't")
	// Also matches digits and accented Latin characters for future sources
	const re = /[A-Za-z\u00C0-\u024F\d]+(?:['\u2018\u2019\u02bc][A-Za-z]+)*/g;
	let m;
	while ((m = re.exec(text)) !== null) {
		const original = m[0];
		const normalized = normalizeToken(original);
		// Skip single-char tokens — too short to be meaningful query terms
		if (normalized.length < 2) continue;
		results.push({ normalized, start: m.index, end: m.index + original.length });
	}
	return results;
}

// ─── Concordance builder ──────────────────────────────────────────────────────

/**
 * Build the concordance index from an array of passages.
 *
 * Returns a Record<normalizedTerm, Array<{ passageId, offsets: [start, end][] }>>
 * where terms are sorted alphabetically for determinism.
 *
 * @param {Array<{id: string, text: string}>} passages
 * @returns {Record<string, Array<{passageId: string, offsets: Array<[number, number]>}>>}
 */
export function buildConcordance(passages) {
	// termMap: normalized term → Map<passageId, Array<[start, end]>>
	/** @type {Map<string, Map<string, Array<[number, number]>>>} */
	const termMap = new Map();

	for (const passage of passages) {
		const tokens = tokenizeWithPositions(passage.text);
		for (const { normalized, start, end } of tokens) {
			let passageMap = termMap.get(normalized);
			if (!passageMap) {
				passageMap = new Map();
				termMap.set(normalized, passageMap);
			}
			let offsets = passageMap.get(passage.id);
			if (!offsets) {
				offsets = [];
				passageMap.set(passage.id, offsets);
			}
			offsets.push([start, end]);
		}
	}

	// Convert to final serializable format, sorted deterministically
	const concordance = {};
	for (const term of [...termMap.keys()].sort()) {
		const passageMap = termMap.get(term);
		concordance[term] = [];
		// Sort by passageId for determinism
		for (const passageId of [...passageMap.keys()].sort()) {
			concordance[term].push({ passageId, offsets: passageMap.get(passageId) });
		}
	}

	return concordance;
}
