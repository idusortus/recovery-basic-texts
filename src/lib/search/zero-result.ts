/**
 * Zero-result recovery suggestions.
 *
 * Pure selection of the "Try these searches" topic chips (excluding the query
 * itself) plus at most one "Did you mean" from the loaded suggestion index.
 * `TOPIC_CHIPS` is page-local, so the topic list is passed in as an argument,
 * which keeps this testable without the component.
 *
 * Item 5/16 — ux-qol-improvements (Design D5)
 */
import type { Suggestion } from './suggestions';

export interface ZeroResultRecovery {
	topics: string[];
	didYouMean: string | null;
}

export function pickZeroResultSuggestions(
	topics: string[],
	query: string,
	suggestions: Suggestion[],
	maxTopics = 6
): ZeroResultRecovery {
	const needle = query.trim().toLowerCase();
	const filtered = topics.filter((topic) => topic.trim().toLowerCase() !== needle);
	const didYouMean = suggestions.find((suggestion) => suggestion.kind === 'didyoumean');

	return {
		topics: filtered.slice(0, maxTopics),
		didYouMean: didYouMean ? didYouMean.term : null
	};
}
