/**
 * Result-card label helpers.
 *
 * Pure and import-free so a dependency-free Node script can import it directly
 * (the `url-state.ts` pattern):
 *   - `formatPageRef` renders a passage page reference (e.g. `p.58`) for the
 *     card header, or `null` when there is none.
 *   - `copyLabelFor` picks the Copy control's truthful label from the source's
 *     display mode.
 *
 * search-qol-improvements — page reference + Copy label
 */

/** Display mode of a source, mirrored locally to keep this module import-free. */
export type DisplayMode = 'full-text' | 'concordance-only' | 'snippet';

/**
 * Normalize a passage page reference to the displayed `p.<n>` form.
 *
 * Returns `null` for an absent/blank value so the card emits nothing (no
 * dangling separator). Mirrors `buildCitation`'s leading-`p` normalization.
 */
export function formatPageRef(pageRef: string | null | undefined): string | null {
	if (typeof pageRef !== 'string') return null;
	const trimmed = pageRef.trim();
	if (!trimmed) return null;
	return `p.${trimmed.replace(/^p\.?/i, '')}`;
}

/**
 * The Copy control's label for a source's display mode. `full-text` copies the
 * whole passage ("Copy passage"); protected modes copy the clipped excerpt
 * ("Copy excerpt").
 */
export function copyLabelFor(displayMode: DisplayMode): string {
	return displayMode === 'full-text' ? 'Copy passage' : 'Copy excerpt';
}
