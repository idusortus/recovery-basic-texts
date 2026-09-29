/**
 * concordance-utils.mjs
 *
 * Shared utilities for building and working with the concordance index.
 * Imported by both build-index.mjs and test-concordance-offsets.mjs.
 *
 * Normalization and tokenization come from the one canonical module
 * (src/lib/search/normalize.js) that the app and the index builder also use,
 * so the two search paths tokenize identically.
 *
 * Issue B — PR 2
 * Area 1 — search-overhaul (shared normalization)
 */

import { normalizeTerm, scanTokens } from '../../src/lib/search/normalize.js';

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * Normalize a token for concordance lookup: strip apostrophes and lowercase.
 * Kept for existing importers; delegates to the shared normalizer.
 *
 * @param {string} str
 * @returns {string}
 */
export function normalizeToken(str) {
	return normalizeTerm(str);
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
	for (const { raw, start, end } of scanTokens(text)) {
		const normalized = normalizeTerm(raw);
		// Skip single-char tokens — too short to be meaningful query terms
		if (normalized.length < 2) continue;
		results.push({ normalized, start, end });
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
