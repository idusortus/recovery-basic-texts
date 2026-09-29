/**
 * Synonym expansion for query-time term augmentation.
 *
 * Loads corpus/synonyms.json and exposes a function to return all related
 * terms for a given set of keywords. Used by the search service to broaden
 * bare-keyword queries with semantically related terms (e.g. "god" → also
 * search "higher power", "creator").
 *
 * Lookup is SYMMETRIC: the map is treated as an undirected graph, so searching
 * any member of a concept group returns every other member — including members
 * that only appear as a value (e.g. "higher power") and multi-word phrases.
 *
 * F5 — features-001-plan
 * Area 5 — search-overhaul
 */

import rawSynonyms from '../../../corpus/synonyms.json';

// ─── Concept graph ────────────────────────────────────────────────────────────

/** Undirected adjacency between related terms (all lowercase). */
const adjacency = new Map<string, Set<string>>();

function link(a: string, b: string): void {
	if (!a || !b || a === b) return;
	if (!adjacency.has(a)) adjacency.set(a, new Set());
	if (!adjacency.has(b)) adjacency.set(b, new Set());
	adjacency.get(a)!.add(b);
	adjacency.get(b)!.add(a);
}

for (const [key, values] of Object.entries(rawSynonyms as Record<string, string[]>)) {
	const source = key.toLowerCase();
	for (const value of values) link(source, value.toLowerCase());
}

/** Every term connected to `start` (including `start` when it is in the graph). */
function component(start: string): Set<string> {
	const seen = new Set<string>();
	if (!adjacency.has(start)) return seen;
	const queue = [start];
	while (queue.length > 0) {
		const node = queue.shift()!;
		if (seen.has(node)) continue;
		seen.add(node);
		for (const next of adjacency.get(node) ?? []) {
			if (!seen.has(next)) queue.push(next);
		}
	}
	return seen;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns all synonym terms for the given keywords.
 *
 * Symmetric: any member of a concept group expands to the whole group. The
 * original keywords themselves are excluded (they are already searched).
 * Multi-word terms are returned as-is; callers tokenize them through the shared
 * normalizer before looking them up.
 */
export function getSynonymTerms(keywords: string[]): string[] {
	const inputs = new Set(keywords.map((keyword) => keyword.toLowerCase()));
	const synonymTerms = new Set<string>();
	for (const keyword of inputs) {
		for (const member of component(keyword)) {
			if (!inputs.has(member)) synonymTerms.add(member);
		}
	}
	return [...synonymTerms];
}
