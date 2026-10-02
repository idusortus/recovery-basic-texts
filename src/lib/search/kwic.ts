/**
 * KWIC (Keyword-In-Context) snippet generation.
 *
 * Computes a display-mode-correct snippet with HTML-safe <mark> highlights.
 * Highlighting is offset-based and shared by both search paths, so a passage
 * returned by MiniSearch and by the concordance highlights identically.
 *
 * Clipping honors the source's display mode:
 *   - `full-text`        whole sentences around the match
 *   - `snippet`          at most `contextWords` words total (<= ~30-word cap)
 *   - `concordance-only` `contextWords` words on each side of the match
 * Protected sources are never rendered in full.
 *
 * Security: text is HTML-escaped before inserting <mark> tags to prevent XSS.
 *
 * LUW 5 — PRD §8.4
 * Area 3/6 — search-overhaul
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
 * Matched case-insensitively as a trailing word before the period.
 */
const ABBREVIATIONS = new Set([
	'dr',
	'mr',
	'mrs',
	'ms',
	'jr',
	'sr',
	'st',
	'vs',
	'etc',
	'p',
	'pp',
	'vol',
	'no',
	'ed',
	'rev',
	'approx',
	'dept',
	'est',
	'govt',
	'lb',
	'oz',
	'ft',
	'yr',
	'i.e',
	'e.g',
	'cf',
	'ch',
	'sec',
	'art',
	'inc',
	'co',
	'al',
	'ibid'
]);

/**
 * Detect a trailing token that only looks like a sentence end: an abbreviation
 * (`Dr.`, `etc.`), an initial or acronym (`W.`, `A.A.`), or a numbered-list
 * marker (`1.`, `12.`). `1.` / `12.` are treated as list markers; larger
 * integers (years such as `1939.`) still end a sentence.
 */
function isNonBoundaryEnd(sentence: string): boolean {
	const lastToken = sentence.match(/(\S+)$/)?.[1];
	if (!lastToken) return false;
	const core = lastToken.replace(/["'\u201c\u201d\u2018\u2019)\]]+$/g, '');
	if (/^\d{1,2}\.$/.test(core)) return true; // numbered list item
	if (/^[A-Za-z]\.$/.test(core)) return true; // single initial (W.)
	if (/^(?:[A-Za-z]\.){2,}$/.test(core)) return true; // initials (A.A., U.S.)
	return ABBREVIATIONS.has(core.replace(/\.+$/, '').toLowerCase());
}

/** A sentence's character range in the source text. */
export interface SentenceRange {
	start: number;
	end: number;
	text: string;
}

/**
 * Split text into sentences, returning each sentence's exact range in the
 * original text (so offset-based highlighting never drifts).
 *
 * A boundary is punctuation followed by whitespace and a capital letter, unless
 * the punctuation belongs to an abbreviation, initial/acronym, or numbered-list
 * marker.
 */
export function splitSentenceRanges(text: string): SentenceRange[] {
	const boundary = /([.!?]+)(["'\u201d\u2019)\]]*)(\s+)(?=[A-Z0-9"'\u201c\u2018(])/g;
	const raw: Array<{ start: number; end: number }> = [];
	let last = 0;
	let match: RegExpExecArray | null;
	while ((match = boundary.exec(text)) !== null) {
		const end = match.index + match[1].length + match[2].length;
		raw.push({ start: last, end });
		last = end + match[3].length;
	}
	raw.push({ start: last, end: text.length });

	const ranges: SentenceRange[] = [];
	for (const candidate of raw) {
		let start = candidate.start;
		let end = candidate.end;
		while (start < end && /\s/.test(text[start])) start++;
		while (end > start && /\s/.test(text[end - 1])) end--;
		if (start >= end) continue;

		const previous = ranges[ranges.length - 1];
		if (previous && isNonBoundaryEnd(text.slice(previous.start, previous.end))) {
			// Merge this chunk into the previous sentence (abbreviation/list marker).
			previous.end = end;
		} else {
			ranges.push({ start, end, text: '' });
		}
	}

	return ranges.map((range) => ({ ...range, text: text.slice(range.start, range.end) }));
}

/** Split plain text into sentence strings. */
export function splitSentences(text: string): string[] {
	const ranges = splitSentenceRanges(text);
	return ranges.length > 0 ? ranges.map((range) => range.text) : [text.trim()];
}

// ─── Highlighting ─────────────────────────────────────────────────────────────

/** Highlight exact character ranges in `text` with <mark> tags (HTML-safe). */
function highlightByOffsets(text: string, offsets: Array<[number, number]>): string {
	let html = '';
	let pos = 0;
	for (const [start, end] of offsets) {
		if (start > pos) html += escapeHtml(text.slice(pos, start));
		html += `<mark><span class="sr-only">highlighted: </span>${escapeHtml(text.slice(start, end))}</mark>`;
		pos = end;
	}
	if (pos < text.length) html += escapeHtml(text.slice(pos));
	return html;
}

/**
 * Render the COMPLETE `text` with EVERY offset wrapped in `<mark>` (HTML-safe),
 * reusing `highlightByOffsets`' escaping and sr-only "highlighted:" prefix.
 *
 * Unlike `buildKwicFromOffsets(text, offsets, 'full-text', …)` — whose
 * `full-text` window clips to ±2 sentences around the first match — this renders
 * the whole text with no clipping window and no ellipsis. Use it to highlight a
 * whole chapter (e.g. the passage page), never for search-result snippets.
 *
 * `offsets` are merged match ranges (as returned by `analyzePassage`); they are
 * sorted and merged defensively so overlapping/adjacent input is still safe.
 */
export function buildFullTextHighlight(text: string, offsets: Array<[number, number]>): string {
	if (offsets.length === 0) return escapeHtml(text);
	const merged = mergeOffsets(
		offsets
			.filter(([start, end]) => start >= 0 && end > start && end <= text.length)
			.sort((a, b) => a[0] - b[0] || a[1] - b[1])
	);
	return highlightByOffsets(text, merged);
}

/** Merge overlapping or adjacent [start, end) pairs. Input must be sorted by start. */
function mergeOffsets(sorted: Array<[number, number]>): Array<[number, number]> {
	const result: Array<[number, number]> = [];
	for (const [start, end] of sorted) {
		if (result.length === 0 || start > result[result.length - 1][1]) {
			result.push([start, end]);
		} else {
			result[result.length - 1][1] = Math.max(result[result.length - 1][1], end);
		}
	}
	return result;
}

// ─── Clipping windows ─────────────────────────────────────────────────────────

/** Number of full sentences shown on each side of the match for `full-text`. */
const SENTENCE_CONTEXT = 2;
/** Hard excerpt cap for `snippet` sources (PRD §6.3). */
const MAX_SNIPPET_WORDS = 30;

interface WordRange {
	start: number;
	end: number;
}

/** Whitespace-delimited words with their character ranges. */
function wordRanges(text: string): WordRange[] {
	const ranges: WordRange[] = [];
	const re = /\S+/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(text)) !== null) {
		ranges.push({ start: match.index, end: match.index + match[0].length });
	}
	return ranges;
}

/** Index of the first word that contains or follows `offset`. */
function wordIndexAt(words: WordRange[], offset: number): number {
	for (let i = 0; i < words.length; i++) {
		if (words[i].end > offset) return i;
	}
	return Math.max(0, words.length - 1);
}

/** Index of the sentence that contains `offset` (falls back to the last). */
function sentenceIndexAt(sentences: SentenceRange[], offset: number): number {
	for (let i = 0; i < sentences.length; i++) {
		if (offset < sentences[i].end) return i;
	}
	return Math.max(0, sentences.length - 1);
}

interface ClipWindow {
	start: number;
	end: number;
}

/** `full-text`: whole sentences from the match outward. */
function fullTextWindow(text: string, anchor: number): ClipWindow {
	const sentences = splitSentenceRanges(text);
	const index = sentenceIndexAt(sentences, anchor);
	const from = Math.max(0, index - SENTENCE_CONTEXT);
	const to = Math.min(sentences.length - 1, index + SENTENCE_CONTEXT);
	return { start: sentences[from].start, end: sentences[to].end };
}

/** `concordance-only`: `contextWords` words on each side of the match. */
function eachSideWindow(
	text: string,
	words: WordRange[],
	offsets: Array<[number, number]>,
	anchor: number,
	contextWords: number
): ClipWindow {
	if (words.length === 0) return { start: 0, end: text.length };

	const anchorMatch = offsets.find(([start, end]) => start <= anchor && anchor < end) ?? offsets[0];
	const firstWord = wordIndexAt(words, anchorMatch[0]);
	const lastWord = wordIndexAt(words, Math.max(anchorMatch[0], anchorMatch[1] - 1));
	const from = Math.max(0, Math.min(firstWord, lastWord) - contextWords);
	const to = Math.min(words.length - 1, Math.max(firstWord, lastWord) + contextWords);
	return { start: words[from].start, end: words[to].end };
}

/** `snippet`: at most `limit` words total, sentence-aligned when that fits. */
function snippetWindow(
	text: string,
	words: WordRange[],
	sentences: SentenceRange[],
	anchor: number,
	limit: number
): ClipWindow {
	if (words.length <= limit) return { start: 0, end: text.length };

	const index = sentenceIndexAt(sentences, anchor);
	const sentenceWords = (range: SentenceRange) =>
		words.filter((word) => word.start >= range.start && word.start < range.end).length;

	let total = sentenceWords(sentences[index]);
	if (total <= limit) {
		// Sentence-aligned: grow outward (next first, then previous) while it fits.
		let from = index;
		let to = index;
		let grew = true;
		while (grew) {
			grew = false;
			if (to + 1 < sentences.length) {
				const next = sentenceWords(sentences[to + 1]);
				if (total + next <= limit) {
					to++;
					total += next;
					grew = true;
					continue;
				}
			}
			if (from - 1 >= 0) {
				const prev = sentenceWords(sentences[from - 1]);
				if (total + prev <= limit) {
					from--;
					total += prev;
					grew = true;
				}
			}
		}
		return { start: sentences[from].start, end: sentences[to].end };
	}

	// Match sentence is longer than the bound: clip at a word boundary, centered.
	const anchorWord = wordIndexAt(words, anchor);
	const half = Math.floor((limit - 1) / 2);
	let from = Math.max(0, anchorWord - half);
	let to = from + limit - 1;
	if (to > words.length - 1) {
		to = words.length - 1;
		from = Math.max(0, to - limit + 1);
	}
	return { start: words[from].start, end: words[to].end };
}

/** Render a character window with an ellipsis on each clipped side. */
function renderWindow(text: string, offsets: Array<[number, number]>, window: ClipWindow): string {
	const slice = text.slice(window.start, window.end);
	const adjusted = offsets
		.filter(([start, end]) => start < window.end && end > window.start)
		.map(
			([start, end]) =>
				[
					Math.max(start, window.start) - window.start,
					Math.min(end, window.end) - window.start
				] as [number, number]
		);

	const prefix = window.start > 0 ? '\u2026 ' : '';
	const suffix = window.end < text.length ? ' \u2026' : '';
	return prefix + highlightByOffsets(slice, adjusted) + suffix;
}

/**
 * Never render the full text of a protected (`snippet`/`concordance-only`)
 * passage: if the window would cover every word, drop one word from the side
 * away from the match and mark that side clipped.
 */
function enforceProtectedClip(
	text: string,
	window: ClipWindow,
	anchor: number,
	displayMode: DisplayMode
): ClipWindow {
	if (displayMode === 'full-text') return window;
	if (window.start > 0 || window.end < text.length) return window;

	const words = wordRanges(text);
	if (words.length <= 1) return window;

	const anchorWord = wordIndexAt(words, anchor);
	if (anchorWord > 0) {
		return { start: words[1].start, end: words[words.length - 1].end };
	}
	return { start: words[0].start, end: words[words.length - 2].end };
}

interface ResolvedWindow {
	/** Merged match offsets (empty when nothing matched). */
	offsets: Array<[number, number]>;
	/** Character window to display/copy. */
	window: ClipWindow;
}

/** Resolve the display/copy window for a result, honoring display mode. */
function resolveWindow(
	text: string,
	offsets: Array<[number, number]>,
	displayMode: DisplayMode,
	contextWords: number,
	anchorOffset?: number
): ResolvedWindow {
	if (offsets.length === 0) {
		// No matched term to highlight. Never fall back to full text for
		// protected sources — clip to the head of the passage instead.
		if (displayMode === 'full-text') {
			return { offsets: [], window: { start: 0, end: text.length } };
		}
		const words = wordRanges(text);
		if (words.length === 0) return { offsets: [], window: { start: 0, end: 0 } };
		const limit =
			displayMode === 'snippet'
				? Math.min(contextWords > 0 ? contextWords : MAX_SNIPPET_WORDS, MAX_SNIPPET_WORDS)
				: (contextWords || 8) * 2;
		const last = Math.min(words.length - 1, limit - 1);
		const head = { start: words[0].start, end: words[last].end };
		return { offsets: [], window: enforceProtectedClip(text, head, 0, displayMode) };
	}

	const merged = mergeOffsets([...offsets].sort((a, b) => a[0] - b[0]));
	const anchor = anchorOffset ?? merged[0][0];

	let window: ClipWindow;
	if (displayMode === 'concordance-only') {
		window = eachSideWindow(text, wordRanges(text), merged, anchor, contextWords || 8);
	} else if (displayMode === 'snippet') {
		const limit = Math.min(contextWords > 0 ? contextWords : MAX_SNIPPET_WORDS, MAX_SNIPPET_WORDS);
		window = snippetWindow(text, wordRanges(text), splitSentenceRanges(text), anchor, limit);
	} else {
		window = fullTextWindow(text, anchor);
	}

	return { offsets: merged, window: enforceProtectedClip(text, window, anchor, displayMode) };
}

/**
 * Build a KWIC snippet from exact character offsets.
 *
 * `anchorOffset` centers the window on the best-ranked match (Area 6); it
 * defaults to the first offset. Clipping follows `displayMode`/`contextWords`.
 */
export function buildKwicFromOffsets(
	text: string,
	offsets: Array<[number, number]>,
	displayMode: DisplayMode,
	contextWords: number,
	anchorOffset?: number
): string {
	const { offsets: merged, window } = resolveWindow(
		text,
		offsets,
		displayMode,
		contextWords,
		anchorOffset
	);
	return renderWindow(text, merged, window);
}

/**
 * Plain-text excerpt for the clipboard: the full text for `full-text` sources,
 * the displayed (clipped) window for `snippet`/`concordance-only`. Never the
 * full passage for a protected source.
 */
export function buildExcerpt(
	text: string,
	offsets: Array<[number, number]>,
	displayMode: DisplayMode,
	contextWords: number,
	anchorOffset?: number
): string {
	// Full-text sources copy the whole passage (unchanged behavior).
	if (displayMode === 'full-text') return text;

	const { window } = resolveWindow(text, offsets, displayMode, contextWords, anchorOffset);
	const prefix = window.start > 0 ? '\u2026 ' : '';
	const suffix = window.end < text.length ? ' \u2026' : '';
	return prefix + text.slice(window.start, window.end) + suffix;
}

// ─── Full-text highlight (pinned Quick Reference results) ─────────────────────

function highlightAll(text: string, terms: string[]): string {
	if (terms.length === 0) return escapeHtml(text);

	const escaped = terms
		.slice()
		.sort((a, b) => b.length - a.length)
		.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

	const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');

	const parts = text.split(pattern);
	return parts
		.map((part, i) => {
			if (i % 2 === 1) {
				return (
					`<mark>` + `<span class="sr-only">highlighted: </span>` + escapeHtml(part) + `</mark>`
				);
			}
			return escapeHtml(part);
		})
		.join('');
}

/**
 * Return the full passage text with search terms highlighted, without any
 * clipping. Only for `full-text` pinned "Quick Reference" results.
 */
export function buildFullKwic(text: string, query: string): string {
	const terms = extractTerms(query);
	if (terms.length === 0) return escapeHtml(text);
	return highlightAll(text, terms);
}

// ─── Plain-text citation ──────────────────────────────────────────────────────

/**
 * Build a plain-text citation string for clipboard copy.
 * Format: "Text excerpt\n\nFrom Source Title, Chapter (p.X)"
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
	return `${text}\n\nFrom ${parts.join(', ')}`;
}
