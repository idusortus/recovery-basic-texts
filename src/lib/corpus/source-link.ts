/**
 * Resolve the external "read at official source" destination for a result.
 *
 * A source may define a `linkTemplate` (for example a web-search passthrough for
 * a protected source) whose `{{placeholders}}` are filled from the passage's
 * `linkData` plus the current query. When a placeholder cannot be resolved, or
 * the source has no template, the action falls back to the source's
 * `officialUrl`, then `freeUrl`, so it never emits a broken link.
 *
 * Item 18 — ux-qol-improvements (Design D10)
 */
import type { Source, Passage } from '$lib/types';

const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*\}\}/g;

export function resolveSourceLink(
	source: Pick<Source, 'linkTemplate' | 'officialUrl' | 'freeUrl'>,
	passage: Pick<Passage, 'linkData'>,
	query: string
): string | null {
	const fallback = source.officialUrl ?? source.freeUrl ?? null;
	const template = source.linkTemplate;
	if (!template) return fallback;

	const values: Record<string, string> = { ...(passage.linkData ?? {}), query };
	let unresolved = false;

	const href = template.replace(PLACEHOLDER, (_match, name: string) => {
		const value = values[name];
		if (value === undefined || value === null) {
			unresolved = true;
			return '';
		}
		return encodeURIComponent(value);
	});

	if (unresolved || href.includes('{{')) return fallback;
	return href;
}
