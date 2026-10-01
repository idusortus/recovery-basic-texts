/**
 * Local-only recent-search list helpers.
 *
 * Pure and import-free so a dependency-free Node script can import it directly
 * (the `url-state.ts` pattern). The component supplies a thin `localStorage`
 * adapter; this module never touches storage except the explicit
 * `clearRecentSearches(storage)` helper, and it never performs I/O — the stored
 * list is device-local and is never transmitted, logged, or synced.
 *
 * search-qol-improvements — recent searches (local only)
 */

/** Namespaced storage key for the recent-search list. */
export const RECENT_SEARCH_KEY = 'basictexts-recent-searches';

/** Maximum number of distinct recent queries kept. */
export const RECENT_SEARCH_LIMIT = 8;

/** The minimal storage surface `clearRecentSearches` needs. */
export interface RecentSearchStorage {
	removeItem(key: string): void;
}

/** Case/whitespace-insensitive identity for a query. */
function queryKey(query: string): string {
	return query.trim().toLowerCase();
}

/**
 * Add an explicitly-submitted query to the front of the list.
 *
 * Trims the query, ignores blank input, deduplicates case-insensitively (the
 * newest casing wins and the entry moves to the most-recent position), and caps
 * the list. Returns a new array; the input is not mutated.
 */
export function addRecentSearch(
	list: string[],
	query: string,
	cap: number = RECENT_SEARCH_LIMIT
): string[] {
	const trimmed = query.trim();
	if (!trimmed) return [...list];

	const key = queryKey(trimmed);
	const rest = list.filter((entry) => queryKey(entry) !== key);
	const limit = Math.max(0, cap);
	return [trimmed, ...rest].slice(0, limit);
}

/**
 * Parse a persisted JSON list defensively: anything that is not an array of
 * non-blank strings yields an empty list. Entries are trimmed, deduplicated
 * case-insensitively, and capped.
 */
export function parseRecentSearches(
	raw: string | null | undefined,
	cap: number = RECENT_SEARCH_LIMIT
): string[] {
	if (!raw) return [];

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) return [];

	const limit = Math.max(0, cap);
	const list: string[] = [];
	for (const entry of parsed) {
		if (typeof entry !== 'string') continue;
		const trimmed = entry.trim();
		if (!trimmed) continue;
		if (list.some((kept) => queryKey(kept) === queryKey(trimmed))) continue;
		list.push(trimmed);
		if (limit > 0 && list.length >= limit) break;
	}
	return list;
}

/** Serialize the list for storage. */
export function serializeRecentSearches(list: string[]): string {
	return JSON.stringify(list);
}

/**
 * Remove the persisted list. A storage failure (private mode, disabled) is a
 * no-op so search is never broken by storage availability.
 */
export function clearRecentSearches(storage: RecentSearchStorage): void {
	try {
		storage.removeItem(RECENT_SEARCH_KEY);
	} catch {
		// Storage unavailable — nothing to clear.
	}
}
