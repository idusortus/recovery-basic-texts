/**
 * Daily Reflection helpers.
 *
 * Resolves a DR corpus entry from the already-loaded local search index and
 * builds a bounded, display-mode-clipped KWIC teaser through the shared KWIC
 * machinery. The entry's full `text` is never returned or rendered — Daily
 * Reflections is a protected, concordance-only source (see AGENTS.md).
 */

import { getPassages } from '$lib/search/index';
import { buildKwicFromOffsets } from '$lib/search/kwic';
import { getSourceById } from './registry';
import { formatReflectionDate } from './reflection-date';
import type { Passage } from '$lib/types';

// Re-exported for backward compatibility; the implementation lives in the
// dependency-free `reflection-date` module to avoid a search/index import cycle.
export { formatReflectionDate } from './reflection-date';

const DR_SOURCE_ID = 'daily-reflections';

/** Today's local date as an MM-DD key (e.g. "06-28"). */
export function todayReflectionKey(): string {
	const today = new Date();
	const mm = String(today.getMonth() + 1).padStart(2, '0');
	const dd = String(today.getDate()).padStart(2, '0');
	return `${mm}-${dd}`;
}

/**
 * Returns the Daily Reflections passage for an explicit MM-DD key, or null
 * when the index is not yet loaded or has no entry for that date.
 */
export function getReflectionForDate(mmDd: string): Passage | null {
	const passages = getPassages();
	if (!passages) return null;
	for (const passage of Object.values(passages)) {
		if (passage.sourceId === DR_SOURCE_ID && passage.date === mmDd) {
			return passage;
		}
	}
	return null;
}

/**
 * Returns the Daily Reflections passage for today (matched by MM-DD `date`
 * field), or null if the corpus has no entry for today / the index is not
 * yet loaded.
 */
export function getTodaysReflection(): Passage | null {
	return getReflectionForDate(todayReflectionKey());
}

/**
 * True for a syntactically valid MM-DD key (`01-01`–`12-31`). Day length is
 * not validated against the calendar; that is a corpus lookup concern.
 */
export function isValidReflectionDate(value: string | null | undefined): value is string {
	return typeof value === 'string' && /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value);
}

/** Character range of the first whitespace-delimited term, or null. */
function firstTermRange(text: string): [number, number] | null {
	const match = /\S+/.exec(text);
	if (!match) return null;
	return [match.index, match.index + match[0].length];
}

/** Plain-text words in a rendered KWIC teaser (tags and entities excluded). */
function teaserWords(html: string): string[] {
	const plain = html
		.replace(/<mark><span class="sr-only">highlighted: <\/span>/g, '')
		.replace(/<[^>]*>/g, '')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\u2026/g, ' ');
	return plain.split(/\s+/).filter(Boolean);
}

/**
 * Builds the KWIC teaser for a DR entry: a bounded window anchored on the
 * entry's first indexed term, clipped by the source's `displayMode` and
 * `contextWords` from the registry (not hard-coded).
 *
 * A bounded window cannot be a strict subset of a 0/1-word entry, and a window
 * that still covers every word would reproduce the full `text`. Both cases
 * return '' (an empty, neutral teaser) rather than the entry's full text, so
 * this helper can never leak a protected entry's complete `text`.
 */
export function buildReflectionTeaser(text: string): string {
	const words = text.trim().split(/\s+/).filter(Boolean);
	if (words.length <= 1) return '';

	const source = getSourceById(DR_SOURCE_ID);
	const displayMode = source?.displayMode ?? 'concordance-only';
	const contextWords = source?.contextWords ?? 8;
	const contextSentences = source?.contextSentences ?? null;
	const range = firstTermRange(text);
	const offsets: Array<[number, number]> = range ? [range] : [];
	const html = buildKwicFromOffsets(
		text,
		offsets,
		displayMode,
		contextWords,
		range?.[0],
		contextSentences
	);

	// The result is discarded when the clipped window still covers every word.
	return teaserWords(html).length < words.length ? html : '';
}

/** Offline fallback state for a date's reflection. */
export interface ReflectionFallback {
	/** The MM-DD key in context. */
	date: string;
	/** Display label, e.g. "June 28". */
	dateLabel: string;
	/** The indexed entry, or null when the local index has no entry. */
	reflection: Passage | null;
	/** KWIC teaser HTML ('' when there is no entry). Never the full text. */
	teaser: string;
	/** "No reflection available for …" when absent, else null. */
	message: string | null;
}

/**
 * Resolves the offline fallback for a date: the indexed entry plus its bounded
 * KWIC teaser, or an availability message when no entry exists. Never
 * substitutes another date's content.
 */
export function getReflectionFallback(mmDd: string): ReflectionFallback {
	const reflection = getReflectionForDate(mmDd);
	const dateLabel = formatReflectionDate(mmDd);
	return {
		date: mmDd,
		dateLabel,
		reflection,
		teaser: reflection ? buildReflectionTeaser(reflection.text) : '',
		message: reflection ? null : `No reflection available for ${dateLabel}`
	};
}
