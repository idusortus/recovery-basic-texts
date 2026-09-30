/**
 * Pure serialize/parse for the search URL state.
 *
 * The address bar carries `q`, `phrase=1` in exact-phrase mode, and `sources`
 * when the active source set differs from the all-enabled default. Keeping this
 * pure makes the shareable-URL round-trip testable without a browser.
 *
 * Item 17 — ux-qol-improvements (Design D9)
 */

export interface SearchUrlState {
	q: string;
	phrase: boolean;
	/** null = all enabled sources selected (the default, omitted from the URL). */
	sources: string[] | null;
}

export function serializeSearchUrl(state: SearchUrlState): string {
	const params = new URLSearchParams();
	if (state.q) params.set('q', state.q);
	if (state.phrase) params.set('phrase', '1');
	if (state.sources && state.sources.length > 0) {
		params.set('sources', state.sources.join(','));
	}
	return params.toString();
}

export function parseSearchUrl(search: string, knownSourceIds: string[]): SearchUrlState {
	const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
	const known = new Set(knownSourceIds);

	const rawSources = params.get('sources');
	let sources: string[] | null = null;
	if (rawSources !== null) {
		const parsed = rawSources
			.split(',')
			.map((id) => id.trim())
			.filter((id) => known.has(id));
		// Unknown ids are ignored; an all-unknown list falls back to the default.
		sources = parsed.length > 0 ? parsed : null;
	}

	return {
		q: params.get('q') ?? '',
		phrase: params.get('phrase') === '1',
		sources
	};
}
