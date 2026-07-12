/**
 * KWIC (Keyword-In-Context) snippet generation.
 *
 * Computes a display-mode-correct snippet with HTML-safe <mark> highlights.
 * Full-text sources show the entire passage; concordance-only and snippet
 * sources show `contextWords` each side of the first keyword match.
 *
 * Security: text is HTML-escaped before inserting <mark> tags to prevent XSS.
 *
 * LUW 5 — PRD §8.4
 */

import type { DisplayMode } from '$lib/types';

// ─── HTML escaping ────────────────────────────────────────────────────────────

/** Escape raw text for safe HTML insertion. */
function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

// ─── Term extraction from query ───────────────────────────────────────────────

/**
 * Extract individual search terms from a query string.
 * Handles quoted phrases and bare keywords.
 * Returns an array of lowercase term strings.
 */
export function extractTerms(query: string): string[] {
	const terms: string[] = [];
	// Extract quoted phrases first
	const phraseRegex = /"([^"]+)"/g;
	let match: RegExpExecArray | null;
	let stripped = query;
	while ((match = phraseRegex.exec(query)) !== null) {
		terms.push(match[1].toLowerCase().trim());
		stripped = stripped.replace(match[0], ' ');
	}
	// Then bare keywords
	for (const word of stripped.split(/\s+/)) {
		const w = word.trim().toLowerCase();
		if (w) terms.push(w);
	}
	return [...new Set(terms)]; // deduplicate
}

// ─── KWIC clipping ────────────────────────────────────────────────────────────

/**
 * Build a KWIC HTML string for `text` given `query` and `displayMode`.
 *
 * - `full-text`: returns the entire escaped text with keywords highlighted.
 * - `concordance-only` / `snippet`: returns `contextWords` words either side
 *   of the first keyword match, with `…` ellipsis prefix/suffix as needed.
 *
 * The returned string is safe HTML (text is escaped; only <mark> and <span>
 * tags are inserted).
 */
export function buildKwic(
	text: string,
	query: string,
	displayMode: DisplayMode,
	contextWords: number
): string {
	const terms = extractTerms(query);
	if (terms.length === 0) return escapeHtml(text);

	if (displayMode === 'full-text') {
		return highlightAll(text, terms);
	}

	// Concordance-only / snippet: clip to contextWords each side of first match
	const words = text.split(/(\s+)/); // preserve whitespace tokens
	// Build a token array of just the word tokens (non-whitespace)
	const wordTokens: Array<{ word: string; index: number }> = [];
	for (let i = 0; i < words.length; i++) {
		if (words[i].trim()) {
			wordTokens.push({ word: words[i], index: i });
		}
	}

	// Find first matching word position
	let matchWordIndex = -1;
	outer: for (let wi = 0; wi < wordTokens.length; wi++) {
		const lc = wordTokens[wi].word.toLowerCase().replace(/[^a-z0-9']/g, '');
		for (const term of terms) {
			const termWords = term.split(/\s+/);
			if (termWords.length === 1) {
				if (lc.includes(termWords[0].replace(/[^a-z0-9']/g, ''))) {
					matchWordIndex = wi;
					break outer;
				}
			} else {
				// Multi-word phrase: check consecutive words
				let allMatch = true;
				for (let j = 0; j < termWords.length; j++) {
					if (wi + j >= wordTokens.length) { allMatch = false; break; }
					const lcj = wordTokens[wi + j].word.toLowerCase().replace(/[^a-z0-9']/g, '');
					if (!lcj.includes(termWords[j].replace(/[^a-z0-9']/g, ''))) {
						allMatch = false; break;
					}
				}
				if (allMatch) { matchWordIndex = wi; break outer; }
			}
		}
	}

	if (matchWordIndex === -1) {
		// No match found — show the first contextWords words
		const clip = wordTokens.slice(0, contextWords).map((t) => t.word).join(' ');
		return escapeHtml(clip) + (wordTokens.length > contextWords ? '…' : '');
	}

	const startWI = Math.max(0, matchWordIndex - contextWords);
	const endWI = Math.min(wordTokens.length - 1, matchWordIndex + contextWords);

	const clipWords = wordTokens.slice(startWI, endWI + 1).map((t) => t.word);
	const clipText = clipWords.join(' ');

	const prefix = startWI > 0 ? '…' : '';
	const suffix = endWI < wordTokens.length - 1 ? '…' : '';

	return prefix + highlightAll(clipText, terms) + suffix;
}

// ─── Internal: highlight all terms in text ────────────────────────────────────

function highlightAll(text: string, terms: string[]): string {
	if (terms.length === 0) return escapeHtml(text);

	// Build a regex that matches any term (escaped for regex safety)
	const escaped = terms
		.slice()
		.sort((a, b) => b.length - a.length) // longer terms first
		.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

	const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');

	// Split on match boundaries, escape each segment, wrap matches
	const parts = text.split(pattern);
	return parts
		.map((part, i) => {
			if (i % 2 === 1) {
				// This is a match
				return (
					`<mark>` +
					`<span class="sr-only">highlighted: </span>` +
					escapeHtml(part) +
					`</mark>`
				);
			}
			return escapeHtml(part);
		})
		.join('');
}

// ─── Plain-text citation ──────────────────────────────────────────────────────

/**
 * Build a plain-text citation string for clipboard copy.
 * Format: "Text excerpt — Source Title, Chapter (p.X)"
 */
export function buildCitation(
	text: string,
	sourceTitle: string,
	chapterRef: string | null,
	pageRef: string | null
): string {
	const parts: string[] = [sourceTitle];
	if (chapterRef) parts.push(chapterRef);
	if (pageRef) parts.push(`p.${pageRef.replace(/^p\.?/, '')}`);
	return `${text}\n\n— ${parts.join(', ')}`;
}

// ─── Offset-based KWIC (concordance path) ─────────────────────────────────────

/** Merge overlapping or adjacent [start, end) pairs. Input must be sorted by start. */
function mergeOffsets(sorted: Array<[number, number]>): Array<[number, number]> {
	const result: Array<[number, number]> = [];
	for (const [s, e] of sorted) {
		if (result.length === 0 || s >= result[result.length - 1][1]) {
			result.push([s, e]);
		} else {
			result[result.length - 1][1] = Math.max(result[result.length - 1][1], e);
		}
	}
	return result;
}

/** Highlight exact character ranges in `text` with <mark> tags (HTML-safe). */
function highlightByOffsets(text: string, offsets: Array<[number, number]>): string {
	let html = '';
	let pos = 0;
	for (const [s, e] of offsets) {
		if (s > pos) html += escapeHtml(text.slice(pos, s));
		html += `<mark><span class="sr-only">highlighted: </span>${escapeHtml(text.slice(s, e))}</mark>`;
		pos = e;
	}
	if (pos < text.length) html += escapeHtml(text.slice(pos));
	return html;
}

/**
 * Build a KWIC snippet using exact character offsets from the concordance index.
 *
 * Unlike `buildKwic()`, this never uses regex matching — it highlights the exact
 * characters that were indexed. Zero false positives; zero missed highlights.
 *
 * - `full-text`: entire passage, all occurrences highlighted.
 * - `concordance-only` / `snippet`: `contextWords` words each side of the first
 *   match, with ellipsis prefix/suffix.
 */
export function buildKwicFromOffsets(
	text: string,
	offsets: Array<[number, number]>,
	displayMode: DisplayMode,
	contextWords: number
): string {
	if (offsets.length === 0) return escapeHtml(text);

	const sorted = [...offsets].sort((a, b) => a[0] - b[0]);
	const merged = mergeOffsets(sorted);

	if (displayMode === 'full-text') {
		return highlightByOffsets(text, merged);
	}

	// Concordance-only / snippet: clip contextWords words around the first match
	const [matchStart] = merged[0];

	// Build word-token list with cumulative character positions
	const tokens = text.split(/(\s+)/);
	type WordToken = { start: number; end: number };
	const wordTokens: WordToken[] = [];
	let charPos = 0;
	for (const tok of tokens) {
		const end = charPos + tok.length;
		if (tok.trim()) wordTokens.push({ start: charPos, end });
		charPos = end;
	}
	if (wordTokens.length === 0) return escapeHtml(text);

	// Find the word containing matchStart
	let matchWordIdx = wordTokens.findIndex((t) => t.start <= matchStart && matchStart < t.end);
	if (matchWordIdx === -1) matchWordIdx = 0;

	const fromIdx = Math.max(0, matchWordIdx - contextWords);
	const toIdx = Math.min(wordTokens.length - 1, matchWordIdx + contextWords);

	const clipStart = wordTokens[fromIdx].start;
	const clipEnd = wordTokens[toIdx].end;

	const prefix = fromIdx > 0 ? '… ' : '';
	const suffix = toIdx < wordTokens.length - 1 ? ' …' : '';

	// Clip and re-zero the offsets relative to clipStart
	const adjusted: Array<[number, number]> = merged
		.filter(([s, e]) => s < clipEnd && e > clipStart)
		.map(([s, e]) => [Math.max(s, clipStart) - clipStart, Math.min(e, clipEnd) - clipStart]);

	return prefix + highlightByOffsets(text.slice(clipStart, clipEnd), adjusted) + suffix;
}
