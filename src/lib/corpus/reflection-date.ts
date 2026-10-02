/**
 * Pure Daily Reflection date formatting.
 *
 * Dependency-free by design: `$lib/search/index` needs this helper, while
 * `$lib/corpus/reflection` imports `getPassages` from `$lib/search/index`.
 * Keeping the formatter in its own module breaks that import cycle. It is
 * re-exported from `reflection.ts` so existing importers keep working.
 */

/**
 * Formats a MM-DD date string for display (e.g. "06-28" → "June 28").
 */
export function formatReflectionDate(mmDd: string): string {
	const [mm, dd] = mmDd.split('-').map(Number);
	const d = new Date(2000, mm - 1, dd);
	return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}
