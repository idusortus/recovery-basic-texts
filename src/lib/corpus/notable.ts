/**
 * Registry of notable/significant passages in the AA corpus.
 *
 * These are well-known excerpts that should receive a named badge when they
 * appear in search results — e.g. "THE PROMISES", "THIRD STEP PRAYER".
 *
 * Identification is done at runtime using a `textMarker` substring so no
 * corpus rebuild is needed to add or update entries.
 */

interface NotableEntry {
	/** Display label shown in the result card badge. */
	label: string;
	/** Source ID the passage belongs to. */
	sourceId: string;
	/** A short substring that uniquely identifies this passage in its source. */
	textMarker: string;
}

const NOTABLE_PASSAGES: NotableEntry[] = [
	{
		label: 'The Promises',
		sourceId: 'big-book-2ed',
		textMarker: 'We are going to know a new freedom',
	},
	{
		label: 'Third Step Prayer',
		sourceId: 'big-book-2ed',
		textMarker: 'God, I offer myself to Thee',
	},
	{
		label: 'Seventh Step Prayer',
		sourceId: 'big-book-2ed',
		textMarker: 'My Creator, I am now willing',
	},
	{
		label: 'On Awakening',
		sourceId: 'big-book-2ed',
		textMarker: 'On awakening let us think',
	},
];

/**
 * Return the notable label for a passage, or null if it is not notable.
 * Case-insensitive substring match on the passage text.
 */
export function getNotableLabel(sourceId: string, text: string): string | null {
	for (const entry of NOTABLE_PASSAGES) {
		if (entry.sourceId !== sourceId) continue;
		if (text.includes(entry.textMarker)) return entry.label;
	}
	return null;
}
