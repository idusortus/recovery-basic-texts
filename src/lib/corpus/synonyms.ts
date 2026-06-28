/**
 * Synonym expansion for query-time term augmentation.
 *
 * Loads corpus/synonyms.json and exposes a function to return all synonym
 * terms for a given set of keywords. Used by the search service to broaden
 * bare-keyword queries with semantically related terms (e.g. "god" → also
 * search "higher power", "creator").
 *
 * F5 — features-001-plan
 */

import rawSynonyms from '../../../corpus/synonyms.json';

const synonymMap = new Map<string, string[]>();
for (const [key, values] of Object.entries(rawSynonyms as Record<string, string[]>)) {
	synonymMap.set(key.toLowerCase(), values.map((v) => v.toLowerCase()));
}

/**
 * Returns all synonym terms for the given keywords.
 * Does NOT include the original keywords themselves — those are already searched.
 * Only single-keyword synonyms are expanded; multi-word synonym phrases are included.
 */
export function getSynonymTerms(keywords: string[]): string[] {
	const synonymTerms = new Set<string>();
	for (const kw of keywords) {
		const syns = synonymMap.get(kw.toLowerCase());
		if (syns) {
			for (const s of syns) synonymTerms.add(s);
		}
	}
	return [...synonymTerms];
}
