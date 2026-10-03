/**
 * Declarative view table for the `/reference` reader.
 *
 * Each view is keyed by the route's `text` query parameter and names exactly
 * one registry source id. The reader branches only on registry state, never on
 * a hard-coded list of which sources to gate, so this table is the single place
 * the key → source mapping is declared. Kept import-free so a dependency-free
 * Node test can import it directly (the `url-state.ts` pattern).
 *
 * reference-reader — one self-contained view per text.
 */

/** A selectable reference-text view. */
export interface ReferenceView {
	/** Value of the `?text=` query parameter. */
	key: string;
	/** Exact registry source id this view presents. */
	sourceId: string;
	/** Short label shown on the view selector. */
	label: string;
}

/** The reader views, in display order. The first is the default. */
export const REFERENCE_VIEWS: readonly ReferenceView[] = [
	{ key: 'steps', sourceId: 'twelve-steps', label: 'Twelve Steps' },
	{ key: 'traditions', sourceId: 'twelve-traditions', label: 'Twelve Traditions' },
	{ key: 'concepts', sourceId: 'twelve-concepts', label: 'Twelve Concepts' },
	{ key: 'promises', sourceId: 'promises-and-prayers', label: 'Promises & Prayers' }
];

/** The default view key when the `text` parameter is missing or unknown. */
export const DEFAULT_REFERENCE_VIEW_KEY = REFERENCE_VIEWS[0].key;

/**
 * Resolve a requested `text` parameter to a known view. An unknown or missing
 * key falls back to the default view, so a direct visit to `/reference` (or a
 * stale link) always renders a valid view.
 */
export function resolveReferenceView(requested: string | null | undefined): ReferenceView {
	return REFERENCE_VIEWS.find((v) => v.key === requested) ?? REFERENCE_VIEWS[0];
}
