/**
 * Canonical search normalization.
 *
 * One implementation shared by every consumer so index-time and query-time
 * tokens are byte-identical:
 *   - corpus/scripts/build-index.mjs        (MiniSearch index build)
 *   - corpus/scripts/concordance-utils.mjs  (concordance index build + tokenizer)
 *   - src/lib/search/index.ts               (query normalization / search)
 *
 * This module deliberately has NO imports — no `$lib` alias, no Node or browser
 * APIs — and is a plain ESM `.js` module (the package sets `"type": "module"`),
 * so Node can import it natively with no TypeScript type-stripping at build or
 * deploy time, and Vite can bundle the same file into the app. Types are JSDoc.
 *
 * Area 1 — search-overhaul
 */

/** Apostrophe characters removed from tokens: straight, curly and modifier. */
const APOSTROPHE_RE = /['\u2018\u2019\u02bc]/g;

/**
 * Quote / dash / hyphen characters treated as word separators. Folding them to a
 * space makes `"god"` == `god`, `face-to-face` == `face to face` and
 * `self–pity` == `self pity` on both search paths.
 *
 * Apostrophes are intentionally excluded: they are stripped (contractions stay
 * one token), not treated as separators.
 */
const SEPARATOR_RE =
	/[\u201c\u201d\u201e\u201f\u00ab\u00bb\u2010\u2011\u2012\u2013\u2014\u2015\u2212-]/g;

/**
 * Word pattern. Mirrors the concordance tokenizer: letters (including Latin-1
 * and Latin Extended-A), digits, and internal apostrophes, so contractions such
 * as `can't` and `God's` remain a single token.
 */
const TOKEN_PATTERN =
	"[A-Za-z\\u00C0-\\u024F\\d]+(?:['\\u2018\\u2019\\u02bc][A-Za-z\\u00C0-\\u024F]+)*";

/**
 * A word token and its position in the source string.
 *
 * @typedef {object} RawToken
 * @property {string} raw The exact matched text, including any internal apostrophe.
 * @property {number} start Inclusive start index in the source string.
 * @property {number} end Exclusive end index in the source string.
 */

/**
 * Lowercase a token and strip every apostrophe variant.
 *
 * @param {string} term
 * @returns {string}
 */
export function normalizeTerm(term) {
	return term.replace(APOSTROPHE_RE, '').toLowerCase();
}

/**
 * Normalize a whole string: lowercase, strip apostrophes, fold quotes/dashes to
 * spaces, then collapse and trim whitespace.
 *
 * Used for the indexed fields and for query text on the MiniSearch side.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeString(text) {
	return text
		.replace(APOSTROPHE_RE, '')
		.replace(SEPARATOR_RE, ' ')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Scan `text` for word tokens with their character offsets.
 *
 * @param {string} text
 * @returns {RawToken[]}
 */
export function scanTokens(text) {
	const re = new RegExp(TOKEN_PATTERN, 'g');
	/** @type {RawToken[]} */
	const tokens = [];
	/** @type {RegExpExecArray | null} */
	let match;
	while ((match = re.exec(text)) !== null) {
		tokens.push({ raw: match[0], start: match.index, end: match.index + match[0].length });
	}
	return tokens;
}

/**
 * Tokenizer for MiniSearch: raw word tokens, normalized later by processTerm.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
	return scanTokens(text).map((token) => token.raw);
}

/**
 * MiniSearch `processTerm`: normalize a token and drop single-character tokens
 * (matching the concordance tokenizer, which excludes them). Returns null so
 * MiniSearch excludes the token entirely.
 *
 * @param {string} term
 * @returns {string | null}
 */
export function processTerm(term) {
	const normalized = normalizeTerm(term);
	return normalized.length >= 2 ? normalized : null;
}
