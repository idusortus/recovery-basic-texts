/**
 * Daily Reflection helpers.
 * Returns today's DR corpus entry (if available) from the loaded search index.
 */

import { getPassages } from '$lib/search/index';
import type { Passage } from '$lib/types';

/**
 * Returns the Daily Reflections passage for today (matched by MM-DD `date` field),
 * or null if the corpus has no entry for today / the index is not yet loaded.
 */
export function getTodaysReflection(): Passage | null {
	const passages = getPassages();
	if (!passages) return null;
	const today = new Date();
	const mm = String(today.getMonth() + 1).padStart(2, '0');
	const dd = String(today.getDate()).padStart(2, '0');
	const key = `${mm}-${dd}`;

	for (const passage of Object.values(passages)) {
		if (passage.sourceId === 'daily-reflections' && passage.date === key) {
			return passage;
		}
	}
	return null;
}

/**
 * Returns a short teaser excerpt (~200 chars) from reflection text,
 * trimmed to the last complete word and followed by an ellipsis.
 */
export function reflectionTeaser(text: string, maxChars = 200): string {
	if (text.length <= maxChars) return text;
	const truncated = text.slice(0, maxChars);
	const lastSpace = truncated.lastIndexOf(' ');
	return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '…';
}

/**
 * Formats a MM-DD date string for display (e.g. "06-28" → "June 28").
 */
export function formatReflectionDate(mmDd: string): string {
	const [mm, dd] = mmDd.split('-').map(Number);
	const d = new Date(2000, mm - 1, dd);
	return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}
