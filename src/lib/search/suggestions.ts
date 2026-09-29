/**
 * Search-box suggestions, derived entirely from the already-loaded concordance
 * term dictionary — no network, no new dependency, no new build artifact.
 *
 * Two sources of suggestion, both restricted to indexed terms:
 *   - prefix matches (sorted-key binary search over the term list), ranked by
 *     term frequency (total indexed occurrences), then length, then alphabet
 *   - did-you-mean: the closest term within a bounded edit distance, searched
 *     over length buckets so only plausible candidates are compared
 *
 * Suggestions expose terms only — never passage text.
 *
 * Area 4 — search-overhaul
 */

import { normalizeString } from './normalize.js';

export interface TermEntry {
	term: string;
	/** Total indexed occurrences (used only for ranking). */
	frequency: number;
}

export type SuggestionKind = 'exact' | 'prefix' | 'didyoumean';

export interface Suggestion {
	term: string;
	kind: SuggestionKind;
}

export interface SuggestIndex {
	/** Terms sorted ascending (for binary-search prefix lookup). */
	entries: TermEntry[];
	/** Terms grouped by string length (for bounded edit-distance candidates). */
	buckets: Map<number, TermEntry[]>;
}

export interface SuggestOptions {
	limit?: number;
}

/** Minimal concordance shape needed to build suggestions. */
export type TermConcordance = Record<string, Array<{ offsets: Array<[number, number]> }>>;

/** Build the sorted term index once per loaded concordance. */
export function createSuggestIndex(concordance: TermConcordance): SuggestIndex {
	const entries: TermEntry[] = Object.entries(concordance).map(([term, occurrences]) => ({
		term,
		frequency: occurrences.reduce((sum, occurrence) => sum + occurrence.offsets.length, 0)
	}));
	entries.sort((a, b) => (a.term < b.term ? -1 : a.term > b.term ? 1 : 0));

	const buckets = new Map<number, TermEntry[]>();
	for (const entry of entries) {
		const list = buckets.get(entry.term.length);
		if (list) list.push(entry);
		else buckets.set(entry.term.length, [entry]);
	}
	return { entries, buckets };
}

/**
 * Levenshtein distance, aborted (returning `max + 1`) once it cannot be ≤ max.
 */
export function boundedEditDistance(a: string, b: string, max: number): number {
	if (a === b) return 0;
	if (Math.abs(a.length - b.length) > max) return max + 1;

	const previous = new Array<number>(b.length + 1);
	const current = new Array<number>(b.length + 1);
	for (let j = 0; j <= b.length; j++) previous[j] = j;

	for (let i = 1; i <= a.length; i++) {
		current[0] = i;
		let rowMin = current[0];
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
			if (current[j] < rowMin) rowMin = current[j];
		}
		if (rowMin > max) return max + 1;
		for (let j = 0; j <= b.length; j++) previous[j] = current[j];
	}
	return previous[b.length];
}

/** The closest indexed terms to `query` within `maxDistance`, best first. */
export function didYouMean(index: SuggestIndex, query: string, maxDistance: number): TermEntry[] {
	if (!query) return [];
	let best = maxDistance + 1;
	const matches: TermEntry[] = [];

	for (let length = query.length - maxDistance; length <= query.length + maxDistance; length++) {
		for (const entry of index.buckets.get(length) ?? []) {
			const distance = boundedEditDistance(query, entry.term, maxDistance);
			if (distance < best) {
				best = distance;
				matches.length = 0;
				matches.push(entry);
			} else if (distance === best) {
				matches.push(entry);
			}
		}
	}
	if (best > maxDistance) return [];

	matches.sort(
		(a, b) =>
			b.frequency - a.frequency ||
			a.term.length - b.term.length ||
			(a.term < b.term ? -1 : a.term > b.term ? 1 : 0)
	);
	return matches;
}

/** First index whose term is >= `prefix`. */
function lowerBound(entries: TermEntry[], prefix: string): number {
	let low = 0;
	let high = entries.length;
	while (low < high) {
		const mid = (low + high) >> 1;
		if (entries[mid].term < prefix) low = mid + 1;
		else high = mid;
	}
	return low;
}

/**
 * Ranked suggestions for the current input. Uses the last typed token as the
 * completion prefix. Returns [] until the dictionary has loaded (callers pass
 * the loaded term index) or when there is nothing useful to suggest.
 */
export function suggest(
	index: SuggestIndex,
	rawQuery: string,
	options: SuggestOptions = {}
): Suggestion[] {
	const limit = options.limit ?? 8;
	const normalized = normalizeString(rawQuery);
	const tokens = normalized.split(' ').filter(Boolean);
	const prefix = tokens[tokens.length - 1] ?? '';
	if (prefix.length < 2) return [];

	const results: Suggestion[] = [];
	const seen = new Set<string>();
	const add = (term: string, kind: SuggestionKind) => {
		if (!term || seen.has(term)) return;
		seen.add(term);
		results.push({ term, kind });
	};

	const start = lowerBound(index.entries, prefix);
	const prefixMatches: TermEntry[] = [];
	for (let i = start; i < index.entries.length; i++) {
		if (!index.entries[i].term.startsWith(prefix)) break;
		prefixMatches.push(index.entries[i]);
	}
	prefixMatches.sort(
		(a, b) =>
			b.frequency - a.frequency ||
			a.term.length - b.term.length ||
			(a.term < b.term ? -1 : a.term > b.term ? 1 : 0)
	);
	for (const entry of prefixMatches) {
		if (results.length >= limit) break;
		add(entry.term, entry.term === prefix ? 'exact' : 'prefix');
	}

	// Did-you-mean only when prefix matching has not already filled the list.
	if (results.length < limit) {
		const maxDistance = prefix.length <= 4 ? 1 : 2;
		for (const entry of didYouMean(index, prefix, maxDistance)) {
			if (results.length >= limit) break;
			add(entry.term, 'didyoumean');
		}
	}

	return results.slice(0, limit);
}

/**
 * Replace the trailing (partial) token of `rawQuery` with the chosen term, so
 * selecting "power" for "higher po" searches "higher power".
 */
export function applySuggestion(rawQuery: string, term: string): string {
	const trimmed = rawQuery.trim();
	if (!trimmed) return term;
	const parts = trimmed.split(/\s+/);
	parts[parts.length - 1] = term;
	return parts.join(' ');
}

/**
 * Next active suggestion index for ArrowUp/ArrowDown (`delta` = ±1), wrapping
 * around. Returns -1 when there are no suggestions.
 */
export function moveActiveIndex(active: number, count: number, delta: number): number {
	if (count <= 0) return -1;
	return (active + delta + count) % count;
}
