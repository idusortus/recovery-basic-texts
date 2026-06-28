/**
 * Client-side search service.
 *
 * Hydrates a prebuilt MiniSearch index from static/index/ and exposes a
 * search function that:
 *   - Parses quoted phrases (exact match) and bare keywords (AND logic)
 *   - Groups results by source in sortOrder
 *   - Applies display-mode-correct KWIC clipping
 *
 * The loaded index is kept in a Svelte store so it's initialized once per
 * page load and shared across components.
 *
 * LUW 5 — PRD §7.2–7.3
 */

import { writable, derived, type Readable } from 'svelte/store';
import MiniSearch from 'minisearch';
import type {
	Passage,
	PassageLookup,
	Source,
	SearchResult,
	GroupedResults,
	IndexMeta
} from '$lib/types';
import { enabledSources, getSourceById } from '$lib/corpus/registry';
import { buildKwic, buildCitation } from './kwic';
import { getSynonymTerms } from '$lib/corpus/synonyms';

// ─── Store shape ──────────────────────────────────────────────────────────────

interface SearchStore {
	ready: boolean;
	error: string | null;
	ms: MiniSearch | null;
	passages: PassageLookup | null;
	meta: IndexMeta | null;
}

// ─── Internal store ───────────────────────────────────────────────────────────

const _store = writable<SearchStore>({
	ready: false,
	error: null,
	ms: null,
	passages: null,
	meta: null
});

/** Whether the search index has finished loading. */
export const searchReady: Readable<boolean> = derived(_store, ($s) => $s.ready);

/** Error message if loading failed. */
export const searchError: Readable<string | null> = derived(_store, ($s) => $s.error);

/** Index metadata (version, builtAt, sources). */
export const indexMeta: Readable<IndexMeta | null> = derived(_store, ($s) => $s.meta);

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
			meta: metaJson as IndexMeta
		});
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		_store.set({ ready: false, error: msg, ms: null, passages: null, meta: null });
		loadPromise = null; // allow retry
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
 * Returns an empty array if the index is not loaded.
 */
export function search(
	query: string,
	options: SearchOptions = {}
): GroupedResults[] {
	let store: SearchStore;
	// Synchronously read current store value
	_store.subscribe((s) => { store = s; })();

	if (!store!.ready || !store!.ms || !store!.passages) return [];

	const q = query.trim();
	if (!q) return [];

	const { phrases, keywords } = parseQuery(q);
	const ms = store!.ms;
	const passages = store!.passages;

	// Determine active sources
	const activeSources: Source[] =
		options.sourceFilter && options.sourceFilter.length > 0
			? (options.sourceFilter
					.map((id) => getSourceById(id))
					.filter(Boolean) as Source[])
			: [...enabledSources];

	const activeSourceIds = new Set(activeSources.map((s) => s.id));

	// Collect all matching passage IDs (union of phrase + keyword searches)
	const matchedIds = new Set<string>();

	// Phrase searches: each phrase is an exact-phrase search
	for (const phrase of phrases) {
		const results = ms.search(normalizeForSearch(phrase), {
			combineWith: 'AND',
			boost: { text: 2 }
		});
		for (const r of results) {
			if (activeSourceIds.has(r.sourceId as string)) {
				matchedIds.add(r.id as string);
			}
		}
	}

	// Keyword searches: AND across all keywords, with fuzzy tolerance (F4b)
	if (keywords.length > 0) {
		const normalizedKw = normalizeForSearch(keywords.join(' '));
		const results = ms.search(normalizedKw, {
			combineWith: 'AND',
			boost: { text: 2 },
			fuzzy: 0.2
		});
		for (const r of results) {
			if (activeSourceIds.has(r.sourceId as string)) {
				// If phrases were also specified, keep only passages that match both
				if (phrases.length === 0 || matchedIds.has(r.id as string)) {
					matchedIds.add(r.id as string);
				}
			}
		}
		// If both phrases and keywords: intersect (keep only those in both sets)
		if (phrases.length > 0) {
			const phraseMatches = new Set(matchedIds);
			const keywordMatches = new Set<string>();
			const kwResults = ms.search(normalizedKw, {
				combineWith: 'AND',
				boost: { text: 2 },
				fuzzy: 0.2
			});
			for (const r of kwResults) {
				if (activeSourceIds.has(r.sourceId as string)) {
					keywordMatches.add(r.id as string);
				}
			}
			matchedIds.clear();
			for (const id of phraseMatches) {
				if (keywordMatches.has(id)) matchedIds.add(id);
			}
		}

		// Synonym expansion: bare keyword queries only (F5)
		// Phrase queries are kept strict; only expand plain keyword searches.
		if (phrases.length === 0) {
			const synTerms = getSynonymTerms(keywords);
			for (const term of synTerms) {
				const synResults = ms.search(normalizeForSearch(term), {
					boost: { text: 1.5 }
				});
				for (const r of synResults) {
					if (activeSourceIds.has(r.sourceId as string)) {
						matchedIds.add(r.id as string);
					}
				}
			}
		}
	}

	// Build SearchResult objects
	const resultsBySource = new Map<string, SearchResult[]>();

	for (const id of matchedIds) {
		const passage = passages[id] as Passage | undefined;
		if (!passage) continue;
		const source = getSourceById(passage.sourceId);
		if (!source || !activeSourceIds.has(source.id)) continue;

		const kwic = buildKwic(passage.text, q, source.displayMode, source.contextWords);
		const citation = buildCitation(
			passage.text,
			source.title,
			passage.chapterRef,
			passage.pageRef
		);

		const result: SearchResult = { passage, source, kwic, citation };

		if (!resultsBySource.has(source.id)) {
			resultsBySource.set(source.id, []);
		}
		resultsBySource.get(source.id)!.push(result);
	}

	// Group by source in sortOrder
	const grouped: GroupedResults[] = [];
	for (const source of activeSources) {
		const results = resultsBySource.get(source.id);
		if (results && results.length > 0) {
			// Sort results by sequence within source
			results.sort((a, b) => a.passage.sequence - b.passage.sequence);
			grouped.push({ source, results });
		}
	}

	return grouped;
}
