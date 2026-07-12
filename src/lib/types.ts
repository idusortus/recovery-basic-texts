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
	/** Edition provenance — required when a pagemap exists for this source. */
	edition?: SourceEdition | null;
}

// ─── Corpus locator and pagemap ───────────────────────────────────────────────

/** Structural position of a passage within its source edition. */
export interface PassageLocator {
	/** chapterRef value — machine-stable, used for pagemap lookups. */
	chapter: string;
	/** Printed chapter title as it appears in the book. */
	chapterTitle: string;
	/** Printed page number as an integer; null for unnumbered front matter. */
	printedPage: number | null;
	/** 0-based paragraph index within the chapter/section. */
	paragraphIndex: number;
}

/** One structural anchor entry in a source pagemap. */
export interface PageMapEntry {
	/** Corpus pageRef value at this chapter boundary (e.g. "p.22"). */
	corpusPageRef: string;
	/** Printed page number per the book's printed pagination; null for unnumbered pages. */
	printedPage: number | null;
	/** chapterRef value in the corpus at this boundary. */
	chapter: string;
	/** First few words of the opening passage — used for anchor verification. */
	anchor: string;
}

/** Per-source artifact mapping corpus page refs to printed pages and chapter anchors. */
export interface PageMap {
	/** Matches Source.id. */
	sourceId: string;
	/** Human-readable edition/printing reference this pagemap was verified against. */
	editionRef: string;
	/** ISO timestamp when this pagemap was last verified. */
	builtAt: string;
	entries: PageMapEntry[];
}

/** Edition provenance for a source — required for sources that have a pagemap. */
export interface SourceEdition {
	/** Human-readable edition label, e.g. "2nd". */
	edition: string;
	/** Year of first printing for this edition. */
	year: number;
	publisher: string;
	isbn?: string | null;
	/** URL of the reference PDF/text used for citation verification. */
	referenceUrl?: string | null;
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
	/** Structural locator for citation and pagemap verification. */
	locator?: PassageLocator | null;
	/** Human-readable citation string, e.g. "Alcoholics Anonymous (2nd Ed.), p. 58, ¶2". */
	citation?: string | null;
	/** SHA-1 hex digest of the normalised passage text (lower-cased, whitespace-collapsed). */
	checksum?: string | null;
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
	/** True when this result was matched via synonym expansion, not the literal query term. */
	matchedBySynonym?: boolean;
	/** True for synthetic "Quick Reference" results injected for step/tradition queries. */
	pinned?: boolean;
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
	/** Concordance summary — present when concordance.json was emitted. */
	concordance?: {
		termCount: number;
		totalOccurrences: number;
	} | null;
}

// ─── Concordance index (static/index/concordance.json) ───────────────────────

/** All occurrences of a single term within one passage. */
export interface ConcordanceOccurrence {
	/** Passage ID. */
	passageId: string;
	/** Character offset pairs [start, end) in the original passage text. */
	offsets: Array<[number, number]>;
}

/**
 * Concordance index: normalized (lowercase, apostrophe-stripped) term →
 * list of passages where it occurs with exact character offsets.
 *
 * Emitted to static/index/concordance.json by build-index.mjs.
 */
export type ConcordanceIndex = Record<string, ConcordanceOccurrence[]>;

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
