/**
 * Source registry loader.
 *
 * Loads and validates corpus/sources.json at build time (bundled by Vite).
 * Exposes enabled sources sorted by sortOrder.
 *
 * LUW 2 — PRD §6.1–6.2.
 */

import type { Source, DisplayMode, CopyrightStatus } from '$lib/types';
import rawSources from '../../../corpus/sources.json';

// ─── Validation ──────────────────────────────────────────────────────────────

const VALID_DISPLAY_MODES = new Set<DisplayMode>(['full-text', 'concordance-only', 'snippet']);
const VALID_COPYRIGHT = new Set<CopyrightStatus>(['public-domain', 'protected', 'unknown']);

function validateSource(raw: unknown, index: number): Source {
	if (typeof raw !== 'object' || raw === null) {
		throw new Error(`sources.json[${index}]: expected object, got ${typeof raw}`);
	}
	const r = raw as Record<string, unknown>;

	const require = <T>(key: string, type: string): T => {
		if (typeof r[key] !== type) {
			throw new Error(`sources.json[${index}].${key}: expected ${type}, got ${typeof r[key]}`);
		}
		return r[key] as T;
	};

	const id = require<string>('id', 'string');
	const displayMode = require<string>('displayMode', 'string');
	const copyright = require<string>('copyright', 'string');

	if (!VALID_DISPLAY_MODES.has(displayMode as DisplayMode)) {
		throw new Error(
			`sources.json[${index}].displayMode: invalid value "${displayMode}". Must be one of: ${[...VALID_DISPLAY_MODES].join(', ')}`
		);
	}
	if (!VALID_COPYRIGHT.has(copyright as CopyrightStatus)) {
		throw new Error(
			`sources.json[${index}].copyright: invalid value "${copyright}". Must be one of: ${[...VALID_COPYRIGHT].join(', ')}`
		);
	}

	return {
		id,
		title: require<string>('title', 'string'),
		shortTitle: require<string>('shortTitle', 'string'),
		description: require<string>('description', 'string'),
		copyright: copyright as CopyrightStatus,
		displayMode: displayMode as DisplayMode,
		contextWords: require<number>('contextWords', 'number'),
		linkTemplate: (r['linkTemplate'] as string | null) ?? null,
		officialUrl: (r['officialUrl'] as string | null) ?? null,
		freeUrl: (r['freeUrl'] as string | null) ?? null,
		color: require<string>('color', 'string'),
		sortOrder: require<number>('sortOrder', 'number'),
		enabled: require<boolean>('enabled', 'boolean')
	};
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/** All sources from the registry (including disabled), sorted by sortOrder. */
export const allSources: readonly Source[] = (rawSources as unknown[])
	.map((raw, i) => validateSource(raw, i))
	.sort((a, b) => a.sortOrder - b.sortOrder);

/** Enabled sources only, sorted by sortOrder. */
export const enabledSources: readonly Source[] = allSources.filter((s) => s.enabled);

/** Look up a source by ID. Returns undefined if not found. */
export function getSourceById(id: string): Source | undefined {
	return allSources.find((s) => s.id === id);
}
