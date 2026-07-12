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
import { buildKwic, buildCitation, buildKwicFromOffsets } from './kwic';
import { getSynonymTerms } from '$lib/corpus/synonyms';

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
		const [msRes, passagesRes, metaRes] = await Promise.all([
			fetch('/index/minisearch.json'),
			fetch('/index/passages.json'),
			fetch('/index/index-meta.json')
		]);

		if (!msRes.ok) throw new Error(`Failed to load minisearch.json: ${msRes.status}`);
		if (!passagesRes.ok) throw new Error(`Failed to load passages.json: ${passagesRes.status}`);
		if (!metaRes.ok) throw new Error(`Failed to load index-meta.json: ${metaRes.status}`);

		const [msJson, passagesJson, metaJson] = await Promise.all([
			msRes.json(),
			passagesRes.json(),
			metaRes.json()
		]);

		const ms = MiniSearch.loadJSON(JSON.stringify(msJson), {
			fields: ['text', 'title', 'chapterRef'],
			storeFields: ['id', 'sourceId']
		});

		_store.set({
			ready: true,
			error: null,
			ms,
			passages: passagesJson as PassageLookup,
			meta: metaJson as IndexMeta,
			concordance: null
		});

		// Load concordance in background — non-blocking. Once loaded, search
		// automatically switches to the concordance path (exact matching, no fuzzy).
		_loadConcordanceInBackground();
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		_store.set({ ready: false, error: msg, ms: null, passages: null, meta: null, concordance: null });
		loadPromise = null; // allow retry
	}
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

// ─── Query normalizer ────────────────────────────────────────────────────────

/**
 * Strip apostrophes (straight and curly) so contractions match indexed tokens.
 * Applied to both phrases and keywords before passing to MiniSearch.
 * F4a — features-001-plan
 */
function normalizeForSearch(s: string): string {
	return s.replace(/['‘’ʼ]/g, '');
}

// ─── Query parser ─────────────────────────────────────────────────────────────

interface ParsedQuery {
	phrases: string[];
	keywords: string[];
	raw: string;
}

function parseQuery(q: string): ParsedQuery {
	const phrases: string[] = [];
	const keywords: string[] = [];
	let rest = q.trim();

	const phraseRegex = /"([^"]+)"/g;
	let match: RegExpExecArray | null;
	while ((match = phraseRegex.exec(q)) !== null) {
		phrases.push(match[1].trim());
		rest = rest.replace(match[0], ' ');
	}
	for (const word of rest.split(/\s+/)) {
		const w = word.trim();
		if (w) keywords.push(w);
	}

	return { phrases, keywords, raw: q };
}

// ─── Search function ──────────────────────────────────────────────────────────

interface SearchOptions {
	/** Filter to these source IDs only. Empty = all enabled sources. */
	sourceFilter?: string[];
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

	const { phrases, keywords } = parseQuery(q);

	const activeSources: Source[] =
		options.sourceFilter && options.sourceFilter.length > 0
			? (options.sourceFilter.map((id) => getSourceById(id)).filter(Boolean) as Source[])
			: [...enabledSources];
	const activeSourceIds = new Set(activeSources.map((s) => s.id));

	// ── Concordance path: exact literal matching, no fuzzy ─────────────────────
	if (store!.concordance) {
		return _searchByConcordance(
			q, phrases, keywords,
			store!.concordance, store!.passages,
			activeSources, activeSourceIds
		);
	}

	// ── MiniSearch fallback (while concordance is loading) ──────────────────────
	// fuzzy is disabled here to prevent false positives; concordance will take
	// over once loaded.
	return _searchByMiniSearch(
		q, phrases, keywords,
		store!.ms!, store!.passages,
		activeSources, activeSourceIds
	);
}

// ─── Concordance search ───────────────────────────────────────────────────────

function _normalizedTerm(s: string): string {
	return s.replace(/['''\u2019\u02bc]/g, '').toLowerCase();
}

/**
 * Concordance-based search: exact AND matching across all query terms,
 * with exact character offsets for highlighting.
 */
function _searchByConcordance(
	rawQuery: string,
	phrases: string[],
	keywords: string[],
	concordance: ConcordanceIndex,
	passages: PassageLookup,
	activeSources: Source[],
	activeSourceIds: Set<string>
): GroupedResults[] {
	// Collect all unique normalized terms from phrases and keywords
	const termSet = new Set<string>();
	for (const phrase of phrases) {
		for (const word of phrase.split(/\s+/)) {
			const n = _normalizedTerm(word);
			if (n.length >= 2) termSet.add(n);
		}
	}
	for (const kw of keywords) {
		const n = _normalizedTerm(kw);
		if (n.length >= 2) termSet.add(n);
	}

	const terms = [...termSet];
	if (terms.length === 0) return [];

	// Build passageId → { term → offsets } for results
	const passageOffsets = new Map<string, Map<string, Array<[number, number]>>>();

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
			if (!passageOffsets.has(occ.passageId)) passageOffsets.set(occ.passageId, new Map());
			passageOffsets.get(occ.passageId)!.set(term, occ.offsets);
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

	const directIds = new Set(candidateIds ?? []);

	// Synonym expansion for bare-keyword queries
	const synonymIds = new Set<string>();
	if (phrases.length === 0) {
		for (const synTerm of getSynonymTerms(keywords)) {
			const n = _normalizedTerm(synTerm);
			for (const occ of concordance[n] ?? []) {
				const p = passages[occ.passageId];
				if (!p || !activeSourceIds.has(p.sourceId) || directIds.has(occ.passageId)) continue;
				synonymIds.add(occ.passageId);
				if (!passageOffsets.has(occ.passageId)) passageOffsets.set(occ.passageId, new Map());
				passageOffsets.get(occ.passageId)!.set(n, occ.offsets);
			}
		}
	}

	const allIds = new Set([...directIds, ...synonymIds]);
	if (allIds.size === 0) return [];

	return _buildGrouped(allIds, directIds, passages, activeSources, activeSourceIds, passageOffsets);
}

function _buildGrouped(
	allIds: Set<string>,
	directIds: Set<string>,
	passages: PassageLookup,
	activeSources: Source[],
	activeSourceIds: Set<string>,
	passageOffsets: Map<string, Map<string, Array<[number, number]>>>
): GroupedResults[] {
	const resultsBySource = new Map<string, SearchResult[]>();

	for (const id of allIds) {
		const passage = passages[id];
		if (!passage) continue;
		const source = getSourceById(passage.sourceId);
		if (!source || !activeSourceIds.has(source.id)) continue;

		// Merge all term offsets for this passage
		const allOffsets: Array<[number, number]> = [];
		for (const offs of passageOffsets.get(id)?.values() ?? []) {
			allOffsets.push(...offs);
		}

		const kwic = buildKwicFromOffsets(
			passage.text, allOffsets, source.displayMode, source.contextWords
		);
		const citation = buildCitation(
			passage.text, source.title, passage.chapterRef, passage.pageRef
		);

		const result: SearchResult = {
			passage, source, kwic, citation,
			matchedBySynonym: !directIds.has(id)
		};

		if (!resultsBySource.has(source.id)) resultsBySource.set(source.id, []);
		resultsBySource.get(source.id)!.push(result);
	}

	const grouped: GroupedResults[] = [];
	for (const source of activeSources) {
		const results = resultsBySource.get(source.id);
		if (results && results.length > 0) {
			results.sort((a, b) => a.passage.sequence - b.passage.sequence);
			grouped.push({ source, results });
		}
	}
	return grouped;
}

// ─── MiniSearch fallback ──────────────────────────────────────────────────────

/**
 * MiniSearch-based search — used only while concordance.json is loading.
 * fuzzy is disabled to prevent false positives; the concordance path takes
 * over once loaded.
 */
function _searchByMiniSearch(
	rawQuery: string,
	phrases: string[],
	keywords: string[],
	ms: MiniSearch,
	passages: PassageLookup,
	activeSources: Source[],
	activeSourceIds: Set<string>
): GroupedResults[] {
	const matchedIds = new Set<string>();
	let directMatchIds: Set<string> | null = null;

	// Phrase searches
	for (const phrase of phrases) {
		const results = ms.search(normalizeForSearch(phrase), { combineWith: 'AND', boost: { text: 2 } });
		for (const r of results) {
			if (activeSourceIds.has(r.sourceId as string)) matchedIds.add(r.id as string);
		}
	}

	// Keyword searches — no fuzzy (avoids false positives)
	if (keywords.length > 0) {
		const nkw = normalizeForSearch(keywords.join(' '));
		const results = ms.search(nkw, { combineWith: 'AND', boost: { text: 2 }, fuzzy: false });
		for (const r of results) {
			if (!activeSourceIds.has(r.sourceId as string)) continue;
			if (phrases.length === 0 || matchedIds.has(r.id as string)) matchedIds.add(r.id as string);
		}
		if (phrases.length > 0) {
			const phraseSet = new Set(matchedIds);
			const kwSet = new Set<string>();
			for (const r of ms.search(nkw, { combineWith: 'AND', boost: { text: 2 }, fuzzy: false })) {
				if (activeSourceIds.has(r.sourceId as string)) kwSet.add(r.id as string);
			}
			matchedIds.clear();
			for (const id of phraseSet) { if (kwSet.has(id)) matchedIds.add(id); }
		}

		if (phrases.length === 0) {
			directMatchIds = new Set(matchedIds);
			for (const term of getSynonymTerms(keywords)) {
				for (const r of ms.search(normalizeForSearch(term), { boost: { text: 1.5 } })) {
					if (activeSourceIds.has(r.sourceId as string)) matchedIds.add(r.id as string);
				}
			}
		}
	}

	const resultsBySource = new Map<string, SearchResult[]>();
	for (const id of matchedIds) {
		const passage = passages[id] as Passage | undefined;
		if (!passage) continue;
		const source = getSourceById(passage.sourceId);
		if (!source || !activeSourceIds.has(source.id)) continue;
		const kwic = buildKwic(passage.text, rawQuery, source.displayMode, source.contextWords);
		const citation = buildCitation(passage.text, source.title, passage.chapterRef, passage.pageRef);
		const result: SearchResult = {
			passage, source, kwic, citation,
			matchedBySynonym: directMatchIds !== null && !directMatchIds.has(id)
		};
		if (!resultsBySource.has(source.id)) resultsBySource.set(source.id, []);
		resultsBySource.get(source.id)!.push(result);
	}

	const grouped: GroupedResults[] = [];
	for (const source of activeSources) {
		const results = resultsBySource.get(source.id);
		if (results && results.length > 0) {
			results.sort((a, b) => a.passage.sequence - b.passage.sequence);
			grouped.push({ source, results });
		}
	}
	return grouped;
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
