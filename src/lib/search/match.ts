/**
 * Shared query-match analysis — one implementation of "where and how well does
 * this query match this passage text", used by BOTH search paths so they
 * highlight and rank identically.
 *
 * Everything derives from the canonical tokenizer (./normalize.js), so offsets are
 * the same character ranges the concordance index stores.
 *
 * Area 3 (highlight offsets) + Area 6 (relevance score) — search-overhaul
 */

import { scanTokens, normalizeTerm } from './normalize.js';

/** A word token and its character range in the source text. */
interface ScanToken {
	normalized: string;
	start: number;
	end: number;
}

interface PhraseRun {
	startToken: number;
	startOffset: number;
	endOffset: number;
}

export interface PassageMatch {
	/** Merged [start, end) ranges of every query-term occurrence (keywords + phrase spans). */
	offsets: Array<[number, number]>;
	/** Character offset used to center the snippet — the start of the best match. */
	anchor: number;
	/** Distinct keyword terms requested. */
	totalKeywords: number;
	/** Distinct keyword terms present in the text. */
	matchedKeywords: number;
	/** Quoted phrases requested. */
	totalPhrases: number;
	/** Quoted phrases present adjacently in the text. */
	matchedPhrases: number;
	/** Total occurrences of query terms in the text (keywords + phrase runs). */
	frequency: number;
	/** True when every keyword occurs in the text. */
	hasAllKeywords: boolean;
	/** True when every quoted phrase occurs adjacently in the text. */
	hasAllPhrases: boolean;
	/** Token span (inclusive) of the smallest window containing one of each matched keyword; 0 when <2. */
	proximityWindow: number;
}

function mergeRanges(ranges: Array<[number, number]>): Array<[number, number]> {
	const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const merged: Array<[number, number]> = [];
	for (const [start, end] of sorted) {
		const last = merged[merged.length - 1];
		if (last && start <= last[1]) {
			last[1] = Math.max(last[1], end);
		} else {
			merged.push([start, end]);
		}
	}
	return merged;
}

/** Find every index where `phrase` occurs as a contiguous run of tokens. */
function phraseRuns(tokens: ScanToken[], phrase: string[]): PhraseRun[] {
	const runs: PhraseRun[] = [];
	if (phrase.length === 0) return runs;
	for (let i = 0; i + phrase.length <= tokens.length; i++) {
		let ok = true;
		for (let k = 0; k < phrase.length; k++) {
			if (tokens[i + k].normalized !== phrase[k]) {
				ok = false;
				break;
			}
		}
		if (ok) {
			runs.push({
				startToken: i,
				startOffset: tokens[i].start,
				endOffset: tokens[i + phrase.length - 1].end
			});
		}
	}
	return runs;
}

/**
 * Smallest token window (inclusive count) that contains at least one occurrence
 * of every term in `terms`, over their token positions. Returns null when fewer
 * than two terms have positions.
 */
function smallestWindow(
	positions: Map<string, number[]>,
	terms: string[]
): { window: number; startToken: number } | null {
	if (terms.length < 2) return null;

	const events: Array<{ pos: number; term: string }> = [];
	for (const term of terms) {
		for (const pos of positions.get(term) ?? []) events.push({ pos, term });
	}
	events.sort((a, b) => a.pos - b.pos || (a.term < b.term ? -1 : a.term > b.term ? 1 : 0));

	const counts = new Map<string, number>();
	let have = 0;
	let left = 0;
	let best: { window: number; startToken: number } | null = null;

	for (let right = 0; right < events.length; right++) {
		const term = events[right].term;
		const count = (counts.get(term) ?? 0) + 1;
		counts.set(term, count);
		if (count === 1) have++;

		while (have === terms.length) {
			const window = events[right].pos - events[left].pos + 1;
			if (!best || window < best.window) {
				best = { window, startToken: events[left].pos };
			}
			const leftTerm = events[left].term;
			const leftCount = (counts.get(leftTerm) ?? 0) - 1;
			counts.set(leftTerm, leftCount);
			if (leftCount === 0) have--;
			left++;
		}
	}

	return best;
}

/**
 * Analyze how `text` matches the query.
 *
 * `phrases` are sequences of normalized tokens that must appear contiguously;
 * `keywords` are normalized terms that must each appear at least once.
 *
 * `highlightTerms` (default: `keywords`) are the terms whose occurrences are
 * returned in `offsets` and counted in `frequency` — synonym expansion passes
 * the synonym terms here so a synonym-matched passage is highlighted on the
 * term that actually matched (and never falls back to full text).
 */
export function analyzePassage(
	text: string,
	phrases: string[][],
	keywords: string[],
	highlightTerms: string[] = keywords
): PassageMatch {
	const tokens: ScanToken[] = scanTokens(text).map((token) => ({
		normalized: normalizeTerm(token.raw),
		start: token.start,
		end: token.end
	}));

	const keywordSet = new Set(keywords);
	const highlightSet = new Set([...highlightTerms, ...keywords]);
	const positions = new Map<string, number[]>();
	const offsets: Array<[number, number]> = [];
	let frequency = 0;

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		if (keywordSet.has(token.normalized)) {
			const list = positions.get(token.normalized);
			if (list) list.push(i);
			else positions.set(token.normalized, [i]);
		}
		if (highlightSet.has(token.normalized)) {
			offsets.push([token.start, token.end]);
			frequency++;
		}
	}

	let matchedPhrases = 0;
	const phraseAnchors: number[] = [];
	for (const phrase of phrases) {
		const runs = phraseRuns(tokens, phrase);
		if (runs.length === 0) continue;
		matchedPhrases++;
		frequency += runs.length;
		phraseAnchors.push(runs[0].startToken);
		for (const run of runs) offsets.push([run.startOffset, run.endOffset]);
	}

	const matchedKeywords = positions.size;
	const hasAllKeywords = keywords.every((term) => (positions.get(term)?.length ?? 0) > 0);
	const hasAllPhrases = phrases.every((phrase) => phraseRuns(tokens, phrase).length > 0);

	const proximity = smallestWindow(positions, [...positions.keys()]);

	let anchor: number;
	if (phraseAnchors.length > 0) {
		anchor = tokens[phraseAnchors[0]].start;
	} else if (proximity) {
		anchor = tokens[proximity.startToken].start;
	} else if (offsets.length > 0) {
		anchor = offsets.reduce((min, [start]) => Math.min(min, start), Number.POSITIVE_INFINITY);
	} else {
		anchor = 0;
	}

	return {
		offsets: mergeRanges(offsets),
		anchor,
		totalKeywords: keywords.length,
		matchedKeywords,
		totalPhrases: phrases.length,
		matchedPhrases,
		frequency,
		hasAllKeywords,
		hasAllPhrases,
		proximityWindow: proximity?.window ?? 0
	};
}

/**
 * One shared relevance score (higher = more relevant), used by both search
 * paths. Coverage dominates, then quoted-phrase coverage, then proximity of the
 * matched terms, then term frequency — so a passage matching all query terms
 * always outranks one matching fewer, regardless of term frequency.
 */
export function scoreMatch(match: PassageMatch): number {
	const coverage = match.totalKeywords === 0 ? 1 : match.matchedKeywords / match.totalKeywords;
	const phraseCoverage = match.totalPhrases === 0 ? 1 : match.matchedPhrases / match.totalPhrases;
	const proximity =
		match.matchedKeywords < 2 || match.proximityWindow === 0
			? 0
			: Math.round((999 * (match.matchedKeywords - 1)) / Math.max(1, match.proximityWindow - 1));

	return (
		Math.round(coverage * 1_000_000_000) +
		Math.round(phraseCoverage * 10_000_000) +
		Math.min(proximity, 999) * 10_000 +
		Math.min(match.frequency, 9999)
	);
}
