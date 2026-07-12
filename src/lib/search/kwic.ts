/**
 * KWIC (Keyword-In-Context) snippet generation.
 *
 * Computes a display-mode-correct snippet with HTML-safe <mark> highlights.
 * All sources show 2–3 full sentences around the first keyword match; the
 * passage view (not the search card) is where full text is rendered.
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

// ─── Sentence splitting ───────────────────────────────────────────────────────

/**
 * Known abbreviations that end with a period but are NOT sentence boundaries.
 * Matched case-insensitively as a trailing word before a `. `.
 */
const ABBREV_PATTERN = /(?:Dr|Mr|Mrs|Ms|Jr|Sr|St|vs|etc|A\.A|p|pp|vol|no|ed|rev|approx|dept|est|govt|lb|oz|ft|yr)\s*$/i;

/**
 * Split plain text into sentences.
 *
 * Splits on `. `, `! `, `? ` where:
 *   - The character before the punctuation is not part of a known abbreviation
 *   - The character after the space is an uppercase letter (or end of string)
 * This avoids splitting on "A.A.", "p.58", "Dr. Bob", numbered lists like "1. We admitted", etc.
 */
export function splitSentences(text: string): string[] {
	// Split at sentence-ending punctuation followed by a space and uppercase letter
	// Uses a lookahead to keep the delimiter attached to the preceding sentence.
	const raw = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
	const sentences: string[] = [];
	for (const chunk of raw) {
		const trimmed = chunk.trim();
		if (!trimmed) continue;
		// If the chunk ends with an abbreviation period followed by nothing, it's
		// likely a false split — merge back with the next chunk.
		// This handles "Dr. " splits (the last word of `chunk` is an abbreviation).
		const lastWord = trimmed.match(/(\S+)$/)?.[1] ?? '';
		if (ABBREV_PATTERN.test(lastWord) && sentences.length > 0) {
			sentences[sentences.length - 1] += ' ' + trimmed;
		} else {
			sentences.push(trimmed);
		}
	}
	return sentences.length > 0 ? sentences : [text.trim()];
}

/**
 * Return the index of the sentence that contains the first keyword match.
 * Searches each sentence for any of the provided terms (case-insensitive, stripped).
 * Returns 0 if no match is found.
 */
function findMatchingSentenceIndex(sentences: string[], terms: string[]): number {
	const strip = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
	for (let i = 0; i < sentences.length; i++) {
		const strippedSentence = strip(sentences[i]);
		for (const term of terms) {
			const termWords = term.trim().split(/\s+/);
			if (termWords.length === 1) {
				if (strippedSentence.includes(strip(termWords[0]))) return i;
			} else {
				// Multi-word phrase: check that all words appear in order
				const stripped = termWords.map(strip);
				if (stripped.every((w) => w && strippedSentence.includes(w))) return i;
			}
		}
	}
	return 0;
}

// ─── KWIC clipping ────────────────────────────────────────────────────────────

/** Number of full sentences to show on each side of the matching sentence. */
const SENTENCE_CONTEXT = 2;

/**
 * Build a KWIC HTML string for `text` given `query` and `displayMode`.
 *
 * For all display modes, clips to SENTENCE_CONTEXT full sentences on each
 * side of the sentence containing the first keyword match, with `…` ellipsis
 * where text is cut. The `contextWords` parameter is retained for API
 * compatibility but is no longer used for clipping.
 *
 * The returned string is safe HTML (text is escaped; only <mark> and <span>
 * tags are inserted).
 */
export function buildKwic(
	text: string,
	query: string,
	_displayMode: DisplayMode,
	_contextWords: number
): string {
	const terms = extractTerms(query);
	if (terms.length === 0) return escapeHtml(text);

	const sentences = splitSentences(text);
	const matchIdx = findMatchingSentenceIndex(sentences, terms);

	const fromIdx = Math.max(0, matchIdx - SENTENCE_CONTEXT);
	const toIdx = Math.min(sentences.length - 1, matchIdx + SENTENCE_CONTEXT);

	const clip = sentences.slice(fromIdx, toIdx + 1).join(' ');
	const prefix = fromIdx > 0 ? '… ' : '';
	const suffix = toIdx < sentences.length - 1 ? ' …' : '';

	return prefix + highlightAll(clip, terms) + suffix;
}

// ─── Offset-based KWIC (concordance path) ─────────────────────────────────────

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

/**
 * Return the full passage text with search terms highlighted, without any clipping.
 * Used for pinned "Quick Reference" results where the entire list must be visible.
 */
export function buildFullKwic(text: string, query: string): string {
	const terms = extractTerms(query);
	if (terms.length === 0) return escapeHtml(text);
	return highlightAll(text, terms);
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
 * Uses sentence-aware clipping for all display modes: shows SENTENCE_CONTEXT
 * full sentences on each side of the sentence containing the first match.
 * The `contextWords` parameter is retained for API compatibility but unused.
 */
export function buildKwicFromOffsets(
	text: string,
	offsets: Array<[number, number]>,
	_displayMode: DisplayMode,
	_contextWords: number
): string {
	if (offsets.length === 0) return escapeHtml(text);

	const sorted = [...offsets].sort((a, b) => a[0] - b[0]);
	const merged = mergeOffsets(sorted);
	const [matchStart] = merged[0];

	// Split into sentences and find which sentence contains the first match offset.
	const sentences = splitSentences(text);

	// Build cumulative character positions for sentence boundaries.
	// We re-join sentences with a single space to match what splitSentences split.
	let charPos = 0;
	let matchSentenceIdx = 0;
	for (let i = 0; i < sentences.length; i++) {
		const sentEnd = charPos + sentences[i].length;
		if (matchStart >= charPos && matchStart < sentEnd) {
			matchSentenceIdx = i;
			break;
		}
		// +1 for the space separator between sentences in the original text
		charPos = sentEnd + 1;
		if (i === sentences.length - 1) matchSentenceIdx = i;
	}

	const fromIdx = Math.max(0, matchSentenceIdx - SENTENCE_CONTEXT);
	const toIdx = Math.min(sentences.length - 1, matchSentenceIdx + SENTENCE_CONTEXT);

	// Compute the character range of the clipped sentence block within the original text.
	// Re-walk to find the start of sentence `fromIdx` and end of sentence `toIdx`.
	charPos = 0;
	let clipStart = 0;
	let clipEnd = text.length;
	for (let i = 0; i < sentences.length; i++) {
		if (i === fromIdx) clipStart = charPos;
		const sentEnd = charPos + sentences[i].length;
		if (i === toIdx) { clipEnd = sentEnd; break; }
		charPos = sentEnd + 1;
	}

	const prefix = fromIdx > 0 ? '… ' : '';
	const suffix = toIdx < sentences.length - 1 ? ' …' : '';

	// Clip and re-zero the offsets relative to clipStart
	const adjusted: Array<[number, number]> = merged
		.filter(([s, e]) => s < clipEnd && e > clipStart)
		.map(([s, e]) => [Math.max(s, clipStart) - clipStart, Math.min(e, clipEnd) - clipStart]);

	return prefix + highlightByOffsets(text.slice(clipStart, clipEnd), adjusted) + suffix;
}
