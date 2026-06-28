/**
 * Known-exceptions hint matcher.
 * Matches a query against a curated list of well-known search terms that
 * deserve a contextual hint (e.g. passages not in the public-domain corpus).
 *
 * The canonical source is corpus/known-exceptions.json; this module mirrors
 * that data as a typed constant for the app bundle.
 *
 * LUW 11 — PRD §4.7
 */

import type { KnownException } from '$lib/types';

// Mirrors corpus/known-exceptions.json
const exceptions: KnownException[] = [
	{
		match: ['acceptance', 'acceptance was the answer', 'acceptance is the answer'],
		title: 'Looking for the Acceptance passage?',
		body: 'The well-known passage beginning "And acceptance is the answer to all my problems today…" is from a personal story added in the 3rd edition of the Big Book, which is not in the public domain and is not in our corpus. You can read it at aa.org.',
		link: {
			label: 'Read at aa.org →',
			url: 'https://www.aa.org/alcoholics-anonymous'
		}
	},
	{
		match: ['sponsor', 'sponsee', 'sponsorship'],
		title: 'Sponsor and sponsorship',
		body: 'The 1st-edition Big Book predates the word "sponsor" as AA uses it today. Sponsorship concepts are discussed in later AA literature, including the 12&12 and AA service materials.',
		link: null
	},
	{
		match: ['promises', 'the promises'],
		title: 'The Promises',
		body: 'The Promises passage ("We are going to know a new freedom…") appears on pages 83–84 of the Big Book. Search for individual words from the passage — "freedom", "comprehend", or "intuitively" — to find it.',
		link: null
	}
];

/**
 * Find any known-exception hints that match the given query.
 * Matching is case-insensitive against the submitted query string.
 */
export function findExceptions(query: string): KnownException[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	return exceptions.filter((ex) =>
		ex.match.some((m) => q.includes(m.toLowerCase()) || m.toLowerCase().includes(q))
	);
}
