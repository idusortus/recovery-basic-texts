/**
 * Client-side search service.
 *
 * Loads the concordance index (term → exact offsets) as the primary search
 * path — exact matches only, no fuzzy noise. Falls back to MiniSearch (with
 * fuzzy disabled) while the concordance is still loading.
 *
 * The loaded index is kept in a Svelte store so it's initialized once per
 * page load and shared across components.
 *
 * LUW 5 — PRD §7.2–7.3
 * Issue D — concordance-first search
 */

import { writable, derived, type Readable } from 'svelte/store';
import MiniSearch from 'minisearch';
import type {
	Passage,
	PassageLookup,
	Source,
	SearchResult,
	GroupedResults,
	IndexMeta,
	ConcordanceIndex
} from '$lib/types';
import { enabledSources, getSourceById } from '$lib/corpus/registry';
import { formatReflectionDate } from '$lib/corpus/reflection-date';
import { buildCitation, buildKwicFromOffsets, buildFullKwic, buildExcerpt } from './kwic';
import { tokenize, processTerm, normalizeString } from './normalize.js';
import {
	createSuggestIndex,
	suggest,
	type SuggestIndex,
	type Suggestion
} from './suggestions';
import { analyzePassage, scoreMatch } from './match';
import { getSynonymTerms } from '$lib/corpus/synonyms';
import { getNotableLabel } from '$lib/corpus/notable';

// ─── Store shape ──────────────────────────────────────────────────────────────

interface SearchStore {
	ready: boolean;
	error: string | null;
	ms: MiniSearch | null;
	passages: PassageLookup | null;
	meta: IndexMeta | null;
	/** Loaded in background after initial index — drives concordance-first search. */
	concordance: ConcordanceIndex | null;
}

// ─── Internal store ───────────────────────────────────────────────────────────

const _store = writable<SearchStore>({
	ready: false,
	error: null,
	ms: null,
	passages: null,
	meta: null,
	concordance: null
});

/** Whether the search index has finished loading. */
export const searchReady: Readable<boolean> = derived(_store, ($s) => $s.ready);

/** Error message if loading failed. */
export const searchError: Readable<string | null> = derived(_store, ($s) => $s.error);

/** Named stages of the index load, for first-load progress UI. */
export type SearchLoadStage = 'idle' | 'fetching' | 'preparing' | 'ready' | 'error';

const _progress = writable<SearchLoadStage>('idle');

/** The index loader's current stage. Advances fetching → preparing → ready. */
export const searchProgress: Readable<SearchLoadStage> = { subscribe: _progress.subscribe };

/** Index metadata (version, builtAt, sources). */
export const indexMeta: Readable<IndexMeta | null> = derived(_store, ($s) => $s.meta);

/**
 * True once the concordance index has loaded in the background.
 * Search accuracy improves when this flips — the page re-runs the active query.
 */
export const concordanceReady: Readable<boolean> = derived(_store, ($s) => $s.concordance !== null);

/**
 * Synchronously return the currently-loaded passages lookup.
 * Returns null if the index has not been loaded yet.
 */
export function getPassages(): PassageLookup | null {
	let passages: PassageLookup | null = null;
	_store.subscribe((s) => {
		passages = s.passages;
	})();
	return passages;
}

// ─── Search-box suggestions (Area 4) ─────────────────────────────────────────

let _suggestIndex: SuggestIndex | null = null;
let _suggestSource: ConcordanceIndex | null = null;

/**
 * Ranked term suggestions for the current input, derived from the loaded
 * concordance term dictionary (sorted prefix lookup + bounded edit distance).
 *
 * Returns [] until the dictionary has loaded, so search behavior is unchanged
 * before then. Suggestions are indexed terms only — never passage text.
 */
export function getSuggestionTerms(rawQuery: string, limit = 8): Suggestion[] {
	let store: SearchStore;
	_store.subscribe((s) => {
		store = s;
	})();
	const concordance = store!.concordance;
	if (!concordance) return [];

	if (_suggestSource !== concordance) {
		_suggestIndex = createSuggestIndex(concordance);
		_suggestSource = concordance;
	}
	return suggest(_suggestIndex!, rawQuery, { limit });
}

// ─── Index loader ─────────────────────────────────────────────────────────────

let loadPromise: Promise<void> | null = null;

/**
 * Load the prebuilt MiniSearch index and passages lookup from /index/*.
 * Idempotent — safe to call multiple times; loads only once.
 */
export async function loadSearchIndex(): Promise<void> {
	if (loadPromise) return loadPromise;
	loadPromise = _load();
	return loadPromise;
}

async function _load(): Promise<void> {
	try {
		_progress.set('fetching');
		const [msRes, passagesRes, metaRes] = await Promise.all([
			fetch('/index/minisearch.json'),
			fetch('/index/passages.json'),
			fetch('/index/index-meta.json')
		]);

		if (!msRes.ok) throw new Error(`Failed to load minisearch.json: ${msRes.status}`);
		if (!passagesRes.ok) throw new Error(`Failed to load passages.json: ${passagesRes.status}`);
		if (!metaRes.ok) throw new Error(`Failed to load index-meta.json: ${metaRes.status}`);

		_progress.set('preparing');
		const [msJson, passagesJson, metaJson] = await Promise.all([
			msRes.json(),
			passagesRes.json(),
			metaRes.json()
		]);

		const ms = MiniSearch.loadJSON(JSON.stringify(msJson), {
			fields: ['text', 'title', 'chapterRef'],
			storeFields: ['id', 'sourceId'],
			tokenize,
			processTerm
		});

		_store.set({
			ready: true,
			error: null,
			ms,
			passages: passagesJson as PassageLookup,
			meta: metaJson as IndexMeta,
			concordance: null
		});
		_progress.set('ready');

		// Load concordance in background — non-blocking. Once loaded, search
		// automatically switches to the concordance path (exact matching, no fuzzy).
		_loadConcordanceInBackground();
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		_store.set({ ready: false, error: msg, ms: null, passages: null, meta: null, concordance: null });
		_progress.set('error');
		loadPromise = null; // allow retry
	}
}

/**
 * Re-attempt loading after a failure. Idempotent once the index is ready.
 * The caller's pending search re-runs when `searchReady` flips.
 */
export async function retryLoad(): Promise<void> {
	loadPromise = null;
	_progress.set('idle');
	return loadSearchIndex();
}

/** Fetch concordance.json in the background and update the store when ready. */
async function _loadConcordanceInBackground(): Promise<void> {
	try {
		const res = await fetch('/index/concordance.json');
		if (!res.ok) return;
		const data = (await res.json()) as ConcordanceIndex;
		_store.update((s) => ({ ...s, concordance: data }));
	} catch {
		// Concordance unavailable — MiniSearch fallback continues to work.
	}
}

// ─── Query parser ─────────────────────────────────────────────────────────────

interface ParsedQuery {
	/** Each quoted span as a sequence of normalized tokens (an exact adjacent phrase). */
	phraseTokens: string[][];
	/** Bare words as normalized, de-duplicated tokens (AND-matched). */
	keywords: string[];
	/**
	 * Keys used for synonym lookup: the bare keywords plus the normalized bare
	 * query phrase (so multi-word members such as "higher power" are recognized).
	 */
	synonymKeys: string[];
	raw: string;
}

/** Tokenize a raw query fragment into normalized, searchable terms. */
function termsFromText(text: string): string[] {
	const terms: string[] = [];
	for (const token of tokenize(text)) {
		const normalized = processTerm(token);
		if (normalized) terms.push(normalized);
	}
	return terms;
}

/**
 * Parse a query into quoted phrases (exact adjacent token runs) and bare
 * keywords (AND terms), splitting through the shared tokenizer.
 */
function parseQuery(q: string): ParsedQuery {
	const phraseTokens: string[][] = [];
	let rest = q.trim();

	const phraseRegex = /"([^"]+)"/g;
	let match: RegExpExecArray | null;
	while ((match = phraseRegex.exec(q)) !== null) {
		const tokens = termsFromText(match[1]);
		if (tokens.length > 0) phraseTokens.push(tokens);
		rest = rest.replace(match[0], ' ');
	}

	const keywords = [...new Set(termsFromText(rest))];
	// Synonym lookup keys: tokenized keywords plus the whole normalized bare
	// phrase, so "higher power" matches the multi-word concept member.
	const synonymKeys = [...new Set([...keywords, normalizeString(rest)].filter(Boolean))];
	return { phraseTokens, keywords, synonymKeys, raw: q };
}

/** Highlight parameters the passage page derives from a URL query. */
export interface PassageParams {
	/** One run of adjacent normalized tokens per phrase; empty for keyword mode. */
	phraseTokens: string[][];
	/** Normalized keyword terms (AND); empty for phrase mode. */
	keywords: string[];
}

/**
 * Derive the highlight parameters for the passage page from a URL query, using
 * the same query→params step search uses (so a term highlighted in the search
 * result is highlighted here by construction).
 *
 * In phrase mode the whole trimmed query is one run of adjacent normalized
 * tokens (`[termsFromText(q)]`); otherwise the keywords are the normalized query
 * terms. An absent/empty query yields empty arrays, so no highlight is emitted.
 */
export function derivePassageParams(q: string, phrase: boolean): PassageParams {
	const terms = termsFromText(q);
	if (terms.length === 0) return { phraseTokens: [], keywords: [] };
	if (phrase) return { phraseTokens: [terms], keywords: [] };
	return { phraseTokens: [], keywords: [...new Set(terms)] };
}

/** Unique terms across phrases and keywords — the exact-match candidate set. */
function allQueryTerms(phrases: string[][], keywords: string[]): string[] {
	const terms = new Set<string>(keywords);
	for (const phrase of phrases) {
		for (const token of phrase) terms.add(token);
	}
	return [...terms];
}

// ─── Search function ──────────────────────────────────────────────────────────

interface SearchOptions {
	/** Filter to these source IDs only. Empty = all enabled sources. */
	sourceFilter?: string[];
	/**
	 * When true, the entire query is matched as one run of adjacent normalized
	 * tokens (token adjacency, not a character substring) rather than AND-matched
	 * individual words. Uses a linear in-memory passage scan.
	 */
	phraseMode?: boolean;
}

/**
 * Execute a search and return results grouped by source.
 *
 * Uses the concordance index (exact matches, character offsets) when loaded.
 * Falls back to MiniSearch with fuzzy disabled while concordance is loading.
 * Returns an empty array if the index is not loaded.
 */
export function search(query: string, options: SearchOptions = {}): GroupedResults[] {
	let store: SearchStore;
	_store.subscribe((s) => {
		store = s;
	})();

	if (!store!.ready || !store!.passages) return [];

	const q = query.trim();
	if (!q) return [];

	const { phraseTokens, keywords, synonymKeys } = parseQuery(q);

	const activeSources: Source[] =
		options.sourceFilter && options.sourceFilter.length > 0
			? (options.sourceFilter.map((id) => getSourceById(id)).filter(Boolean) as Source[])
			: [...enabledSources];
	const activeSourceIds = new Set(activeSources.map((s) => s.id));

	// ── Phrase mode: one adjacent normalized-token run ──────────────────────────
	if (options.phraseMode && q.length >= 2) {
		const grouped = _searchByPhrase(
			q, store!.passages, activeSources, activeSourceIds
		);
		return _injectPinnedResult(q, grouped, store!.passages, activeSources);
	}

	// ── Concordance path: exact literal matching, no fuzzy ─────────────────────
	if (store!.concordance) {
		const grouped = _searchByConcordance(
			phraseTokens, keywords, synonymKeys,
			store!.concordance, store!.passages,
			activeSources, activeSourceIds
		);
		return _injectPinnedResult(q, grouped, store!.passages, activeSources);
	}

	// ── MiniSearch fallback (while concordance is loading) ──────────────────────
	// fuzzy is disabled here to prevent false positives; concordance will take
	// over once loaded.
	const grouped = _searchByMiniSearch(
		phraseTokens, keywords, synonymKeys,
		store!.ms!, store!.passages,
		activeSources, activeSourceIds
	);
	return _injectPinnedResult(q, grouped, store!.passages, activeSources);
}

// ─── Pinned results (steps / traditions quick reference) ─────────────────────

type PinnedType = 'steps' | 'traditions';

/**
 * Detect whether a query is requesting the twelve steps or twelve traditions list.
 * Returns the type of pinned result needed, or null.
 */
function _detectPinnedQuery(query: string): PinnedType | null {
	const q = query.trim();
	if (/^(twelve|12)\s+steps?$/i.test(q)) return 'steps';
	if (/^(twelve|12)\s+traditions?$/i.test(q)) return 'traditions';
	return null;
}

/**
 * Find the pinned passage for steps or traditions.
 * For steps: the Big Book passage in "Chapter 5 — How It Works" listing all 12 steps.
 * For traditions: the Big Book appendix passage listing all 12 traditions, or the
 * 12x12 TOC passage as a fallback.
 */
function _findPinnedPassage(type: PinnedType, passages: PassageLookup): Passage | null {
	if (type === 'steps') {
		// The Big Book passage in Chapter 5 that lists all twelve steps numerically.
		for (const p of Object.values(passages) as Passage[]) {
			if (
				p.sourceId === 'big-book-2ed' &&
				p.chapterRef === 'Chapter 5 — How It Works' &&
				p.text.includes('Here are the steps we took')
			) {
				return p;
			}
		}
	}

	if (type === 'traditions') {
		// First try the Big Book appendix/back-matter passage with the traditions list.
		for (const p of Object.values(passages) as Passage[]) {
			if (
				p.sourceId === 'big-book-2ed' &&
				p.text.includes('Tradition One') &&
				p.text.includes('Our common welfare should come first')
			) {
				return p;
			}
		}
		// Fallback: 12x12 TOC passage that contains traditions summaries.
		const fallback = (passages as PassageLookup)['twelve-steps-traditions-step-one-p0007'] as Passage | undefined;
		if (fallback) return fallback;
	}

	return null;
}

/**
 * Optionally prepend a pinned "Quick Reference" result to the grouped results.
 * Mutates the grouped array in place (safe — it's built fresh on each search).
 */
function _injectPinnedResult(
	query: string,
	grouped: GroupedResults[],
	passages: PassageLookup,
	activeSources: Source[]
): GroupedResults[] {
	const pinnedType = _detectPinnedQuery(query);
	if (!pinnedType) return grouped;

	const passage = _findPinnedPassage(pinnedType, passages);
	if (!passage) return grouped;

	const source = getSourceById(passage.sourceId);
	if (!source) return grouped;
	// Quick Reference renders full text — only safe for full-text (public-domain) sources.
	if (source.displayMode !== 'full-text') return grouped;

	const kwic = buildFullKwic(passage.text, query);
	const citation = buildCitation(passage.text, source.title, passage.chapterRef, passage.pageRef);
	const pinnedResult: SearchResult = { passage, source, kwic, citation, pinned: true };

	// Find the group for this source and prepend; create the group if it doesn't exist.
	const existing = grouped.find((g) => g.source.id === source.id);
	if (existing) {
		// Remove any duplicate of this passage already in results
		const deduped = existing.results.filter((r) => r.passage.id !== passage.id);
		existing.results = [pinnedResult, ...deduped];
	} else {
		const sourceObj = activeSources.find((s) => s.id === source.id) ?? source;
		grouped.unshift({ source: sourceObj, results: [pinnedResult] });
	}

	return grouped;
}

// ─── Shared result assembly (both paths) ─────────────────────────────────────

interface Candidate {
	passage: Passage;
	matchedBySynonym: boolean;
	/**
	 * Extra terms to highlight (synonym terms that matched). Query terms are
	 * always highlighted; this only adds the synonym that caused the match.
	 */
	highlightTerms: string[];
}

/**
 * Build grouped, ranked results from exact-match candidates. BOTH search paths
 * call this, so ranking and highlighting are identical by construction.
 */
function _rankAndGroup(
	candidates: Iterable<Candidate>,
	phraseTokens: string[][],
	keywords: string[],
	activeSources: Source[],
	activeSourceIds: Set<string>
): GroupedResults[] {
	const bySource = new Map<string, Array<{ result: SearchResult; score: number }>>();

	for (const candidate of candidates) {
		const passage = candidate.passage;
		if (!activeSourceIds.has(passage.sourceId)) continue;
		const source = getSourceById(passage.sourceId);
		if (!source) continue;

		const match = analyzePassage(passage.text, phraseTokens, keywords);
		const highlight = candidate.highlightTerms.length
			? analyzePassage(passage.text, phraseTokens, keywords, candidate.highlightTerms)
			: match;
		const kwic = buildKwicFromOffsets(
			passage.text, highlight.offsets, source.displayMode, source.contextWords,
			highlight.anchor, source.contextSentences
		);
		// The copy citation must never contain a protected passage's full text:
		// full-text sources get the whole text, others get the displayed excerpt.
		const excerpt = buildExcerpt(
			passage.text, highlight.offsets, source.displayMode, source.contextWords,
			highlight.anchor, source.contextSentences
		);
		// Daily Reflections leads with its date rather than its chapterRef.
		const isDailyReflection = source.id === 'daily-reflections' && passage.date;
		const citation = buildCitation(
			excerpt,
			source.title,
			isDailyReflection ? null : passage.chapterRef,
			passage.pageRef,
			isDailyReflection ? formatReflectionDate(passage.date as string) : null
		);
		const result: SearchResult = {
			passage, source, kwic, citation,
			matchedBySynonym: candidate.matchedBySynonym,
			notableLabel: getNotableLabel(passage.sourceId, passage.text) ?? undefined
		};

		let bucket = bySource.get(source.id);
		if (!bucket) { bucket = []; bySource.set(source.id, bucket); }
		bucket.push({ result, score: scoreMatch(match) });
	}

	const grouped: GroupedResults[] = [];
	for (const source of activeSources) {
		const bucket = bySource.get(source.id);
		if (!bucket || bucket.length === 0) continue;
		// Relevance first, then deterministic corpus order (source order is the group order).
		bucket.sort(
			(a, b) => b.score - a.score || a.result.passage.sequence - b.result.passage.sequence
		);
		grouped.push({ source, results: bucket.map((entry) => entry.result) });
	}
	return grouped;
}

// ─── Concordance search ───────────────────────────────────────────────────────

/**
 * Concordance-based search: exact AND matching across all query terms (quoted
 * phrases additionally verified as adjacent), ranked by the shared score.
 */
function _searchByConcordance(
	phraseTokens: string[][],
	keywords: string[],
	synonymKeys: string[],
	concordance: ConcordanceIndex,
	passages: PassageLookup,
	activeSources: Source[],
	activeSourceIds: Set<string>
): GroupedResults[] {
	const terms = allQueryTerms(phraseTokens, keywords);
	if (terms.length === 0) return [];

	// AND intersection: sort terms by selectivity (fewest passages = most selective)
	const sortedTerms = [...terms].sort(
		(a, b) => (concordance[a]?.length ?? 0) - (concordance[b]?.length ?? 0)
	);

	let candidateIds: Set<string> | null = null;
	for (const term of sortedTerms) {
		const occurrences = concordance[term] ?? [];
		const termSet = new Set<string>();
		for (const occ of occurrences) {
			const p = passages[occ.passageId];
			if (!p || !activeSourceIds.has(p.sourceId)) continue;
			termSet.add(occ.passageId);
		}
		if (candidateIds === null) {
			candidateIds = termSet;
		} else {
			for (const id of candidateIds) {
				if (!termSet.has(id)) candidateIds.delete(id);
			}
		}
		if (candidateIds.size === 0) break;
	}

	const candidates = new Map<string, Candidate>();
	for (const id of candidateIds ?? []) {
		const passage = passages[id];
		if (!passage) continue;
		// Keywords are guaranteed by the intersection; quoted phrases must be adjacent.
		const match = analyzePassage(passage.text, phraseTokens, keywords);
		if (!match.hasAllPhrases) continue;
		candidates.set(id, { passage, matchedBySynonym: false, highlightTerms: [] });
	}

	// Synonym expansion for bare-keyword queries — each synonym term is tokenized
	// and its terms AND-matched, so multi-word members ("higher power",
	// "spirit of the universe") match consistently with the MiniSearch path.
	if (phraseTokens.length === 0) {
		for (const synTerm of getSynonymTerms(synonymKeys)) {
			const synTokens = termsFromText(synTerm);
			if (synTokens.length === 0) continue;

			let ids: Set<string> | null = null;
			for (const token of synTokens) {
				const termSet = new Set<string>();
				for (const occ of concordance[token] ?? []) {
					const p = passages[occ.passageId];
					if (p && activeSourceIds.has(p.sourceId)) termSet.add(occ.passageId);
				}
				if (ids === null) {
					ids = termSet;
				} else {
					for (const id of ids) {
						if (!termSet.has(id)) ids.delete(id);
					}
				}
				if (ids.size === 0) break;
			}

			for (const id of ids ?? []) {
				if (candidates.has(id)) continue;
				const p = passages[id];
				if (!p) continue;
				candidates.set(id, { passage: p, matchedBySynonym: true, highlightTerms: synTokens });
			}
		}
	}

	return _rankAndGroup(candidates.values(), phraseTokens, keywords, activeSources, activeSourceIds);
}

// ─── MiniSearch fallback ──────────────────────────────────────────────────────

/**
 * MiniSearch-based search — used only while concordance.json is loading.
 * Quoted phrases are verified as adjacent after the AND lookup, so results (and
 * their ranking/highlighting) match the concordance path.
 */
function _searchByMiniSearch(
	phraseTokens: string[][],
	keywords: string[],
	synonymKeys: string[],
	ms: MiniSearch,
	passages: PassageLookup,
	activeSources: Source[],
	activeSourceIds: Set<string>
): GroupedResults[] {
	const candidates = new Map<string, Candidate>();
	const terms = allQueryTerms(phraseTokens, keywords);

	if (terms.length > 0) {
		// fuzzy is disabled to prevent false positives; this path must return the
		// same exact-match candidates as the concordance path.
		const hits = ms.search(terms.join(' '), {
			combineWith: 'AND',
			fuzzy: false,
			boost: { text: 2 }
		});
		for (const hit of hits) {
			if (!activeSourceIds.has(hit.sourceId as string)) continue;
			const id = hit.id as string;
			const passage = passages[id];
			if (!passage) continue;
			const match = analyzePassage(passage.text, phraseTokens, keywords);
			if (!match.hasAllKeywords || !match.hasAllPhrases) continue;
			candidates.set(id, { passage, matchedBySynonym: false, highlightTerms: [] });
		}
	}

	// Synonym expansion for bare-keyword queries — mirror the concordance path:
	// tokenize each synonym term and AND-match its terms (no OR noise).
	if (phraseTokens.length === 0 && keywords.length > 0) {
		for (const term of getSynonymTerms(synonymKeys)) {
			const synTokens = termsFromText(term);
			if (synTokens.length === 0) continue;
			for (const hit of ms.search(synTokens.join(' '), {
				combineWith: 'AND',
				fuzzy: false,
				boost: { text: 1.5 }
			})) {
				if (!activeSourceIds.has(hit.sourceId as string)) continue;
				const id = hit.id as string;
				if (candidates.has(id)) continue;
				const passage = passages[id];
				if (!passage) continue;
				if (!analyzePassage(passage.text, [], synTokens).hasAllKeywords) continue;
				candidates.set(id, { passage, matchedBySynonym: true, highlightTerms: synTokens });
			}
		}
	}

	return _rankAndGroup(candidates.values(), phraseTokens, keywords, activeSources, activeSourceIds);
}

// ─── Phrase search (exact adjacent phrase) ───────────────────────────────────

/**
 * Search all in-memory passages for the whole query as an exact adjacent phrase,
 * using the shared tokenizer/analysis for matching, offsets and ranking.
 */
function _searchByPhrase(
	rawQuery: string,
	passages: PassageLookup,
	activeSources: Source[],
	activeSourceIds: Set<string>
): GroupedResults[] {
	const phrase = termsFromText(rawQuery);
	if (phrase.length === 0) return [];

	const candidates: Candidate[] = [];
	for (const raw of Object.values(passages)) {
		const passage = raw as Passage;
		if (!activeSourceIds.has(passage.sourceId)) continue;
		const match = analyzePassage(passage.text, [phrase], []);
		if (!match.hasAllPhrases) continue;
		candidates.push({ passage, matchedBySynonym: false, highlightTerms: [] });
	}

	return _rankAndGroup(candidates, [phrase], [], activeSources, activeSourceIds);
}

// ─── Concordance loader ───────────────────────────────────────────────────────

let _concordancePromise: Promise<ConcordanceIndex | null> | null = null;

/**
 * Lazily load the concordance index from /index/concordance.json.
 * Idempotent — returns the same promise on repeated calls.
 *
 * Returns null if the concordance artifact is unavailable (e.g. not yet built).
 */
export async function loadConcordanceIndex(): Promise<ConcordanceIndex | null> {
	if (_concordancePromise) return _concordancePromise;
	_concordancePromise = fetch('/index/concordance.json').then(async (res) => {
		if (!res.ok) return null;
		return res.json() as Promise<ConcordanceIndex>;
	}).catch(() => null);
	return _concordancePromise;
}

/**
 * Look up all passages that contain `term` (pre-normalized: lowercase, apostrophes stripped)
 * with their character offsets.
 *
 * Returns an empty array when the concordance is not loaded or the term is absent.
 */
export async function getConcordanceOccurrences(normalizedTerm: string) {
	const concordance = await loadConcordanceIndex();
	if (!concordance) return [];
	return concordance[normalizedTerm] ?? [];
}
