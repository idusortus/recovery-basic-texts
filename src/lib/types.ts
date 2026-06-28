/**
 * Domain types for basictexts.org — matches PRD §6.2, §6.5.
 * These are the load-bearing types used throughout the app and the build scripts.
 */

// ─── Source registry ────────────────────────────────────────────────────────

export type DisplayMode = 'full-text' | 'concordance-only' | 'snippet';
export type CopyrightStatus = 'public-domain' | 'protected' | 'unknown';

export interface Source {
	/** Unique kebab-case ID, stable — used in URLs. */
	id: string;
	/** Full display name. */
	title: string;
	/** Abbreviation used in result labels. */
	shortTitle: string;
	/** One sentence shown on /sources page. */
	description: string;
	copyright: CopyrightStatus;
	displayMode: DisplayMode;
	/** Words each side for KWIC — ignored for full-text. */
	contextWords: number;
	/** URL template with {{variables}} for external links. */
	linkTemplate: string | null;
	officialUrl: string | null;
	freeUrl: string | null;
	/** Hex color used as source badge accent. */
	color: string;
	/** Controls grouping order in results. */
	sortOrder: number;
	/** false = indexed but not shown (staged rollout). */
	enabled: boolean;
}

// ─── Corpus passages ─────────────────────────────────────────────────────────

export interface Passage {
	/** Unique passage ID — stable, used in deep-link URLs. Frozen once published. */
	id: string;
	/** Foreign key to sources.json. */
	sourceId: string;
	/** Chapter name, section title, or date (for DR). */
	title: string;
	/** For ordering within source. */
	sequence: number;
	/** ISO date string (DR entries only). */
	date: string | null;
	/** Page number reference, e.g. 'p.58'. */
	pageRef: string | null;
	/** Chapter name for cross-referencing. */
	chapterRef: string | null;
	/** Full text — indexed; display is controlled by displayMode. */
	text: string;
	/** Key/value pairs interpolated into linkTemplate. */
	linkData: Record<string, string> | null;
}

/** Lookup map returned by build-index — keyed on passage id. */
export type PassageLookup = Record<string, Passage>;

// ─── Search results ───────────────────────────────────────────────────────────

export interface SearchResult {
	passage: Passage;
	source: Source;
	/** KWIC HTML string with <mark> highlights (already HTML-escaped). */
	kwic: string;
	/** Plain-text citation for clipboard copy. */
	citation: string;
}

export interface GroupedResults {
	source: Source;
	results: SearchResult[];
}

// ─── Index metadata (static/index/index-meta.json) ────────────────────────────

export interface IndexMeta {
	/** Content-hash of corpus inputs — used for cache-busting. */
	version: string;
	builtAt: string;
	sources: Array<{
		id: string;
		passageCount: number;
	}>;
}

// ─── Usage logging ─────────────────────────────────────────────────────────────

export interface LogRecord {
	q: string;
	resultCount: number;
	/** Active source IDs at submission time, null = all. */
	sourceFilter: string[] | null;
	/** Client-side timestamp (ISO string). */
	ts: string;
}

// ─── Known-exceptions hints (corpus/known-exceptions.json) ────────────────────

export interface KnownException {
	/** Case-insensitive query strings that trigger this hint. */
	match: string[];
	title: string;
	body: string;
	link: {
		label: string;
		url: string;
	} | null;
}
