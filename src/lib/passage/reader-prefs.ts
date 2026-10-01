/**
 * Reader display-preference helpers for the full-text passage body.
 *
 * Pure and import-free so a dependency-free Node script can import it directly
 * (the `url-state.ts` / `recent-searches.ts` pattern). The component supplies a
 * thin `localStorage` adapter; this module never touches storage and never
 * performs I/O — the chosen preference is device-local and is never transmitted,
 * logged, or synced.
 *
 * passage-reader-controls — reader preferences (local only)
 */

/** Namespaced storage key for the reader display preference. */
export const READER_PREFS_KEY = 'basictexts-reader-prefs';

/** Font-size steps, smallest → largest. `default` applies no override. */
export const FONT_SIZE_STEPS = ['default', 'large', 'larger', 'largest'] as const;
export type FontSizeStep = (typeof FONT_SIZE_STEPS)[number];

/** Line-spacing steps. `normal` applies no override (keeps the page's leading). */
export const LINE_SPACING_STEPS = ['normal', 'relaxed'] as const;
export type LineSpacingStep = (typeof LINE_SPACING_STEPS)[number];

/** The resolved display preference. */
export interface ReaderPrefs {
	fontSize: FontSizeStep;
	lineSpacing: LineSpacingStep;
}

/** The state before the reader changes anything: no override on either axis. */
export const DEFAULT_READER_PREFS: ReaderPrefs = {
	fontSize: 'default',
	lineSpacing: 'normal'
};

/** Resolved font size per step; `null` means "apply no inline font-size". */
const FONT_SIZE_REM: Record<FontSizeStep, string | null> = {
	default: null,
	large: '1.125rem',
	larger: '1.25rem',
	largest: '1.5rem'
};

/** Resolved line height per step; `null` means "apply no inline line-height". */
const LINE_HEIGHT_VALUE: Record<LineSpacingStep, number | null> = {
	normal: null,
	relaxed: 2.0
};

function isFontSizeStep(value: unknown): value is FontSizeStep {
	return typeof value === 'string' && (FONT_SIZE_STEPS as readonly string[]).includes(value);
}

function isLineSpacingStep(value: unknown): value is LineSpacingStep {
	return typeof value === 'string' && (LINE_SPACING_STEPS as readonly string[]).includes(value);
}

/**
 * Clamp a partial preference to a valid `ReaderPrefs`: unknown/absent enum
 * members fall back to the default for that axis.
 */
export function resolveReaderPrefs(partial: Partial<ReaderPrefs> | null | undefined): ReaderPrefs {
	return {
		fontSize: isFontSizeStep(partial?.fontSize) ? partial!.fontSize! : DEFAULT_READER_PREFS.fontSize,
		lineSpacing: isLineSpacingStep(partial?.lineSpacing)
			? partial!.lineSpacing!
			: DEFAULT_READER_PREFS.lineSpacing
	};
}

/**
 * Parse a persisted preference defensively. Absent/blank input, invalid JSON,
 * a non-object shape, or an unknown enum member all resolve to the default.
 */
export function parseReaderPrefs(raw: string | null | undefined): ReaderPrefs {
	if (!raw) return { ...DEFAULT_READER_PREFS };

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { ...DEFAULT_READER_PREFS };
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return { ...DEFAULT_READER_PREFS };
	}
	return resolveReaderPrefs(parsed as Partial<ReaderPrefs>);
}

/** Serialize the preference for storage. */
export function serializeReaderPrefs(prefs: ReaderPrefs): string {
	return JSON.stringify(resolveReaderPrefs(prefs));
}

/**
 * Step the font size by `delta` (+1 / -1), clamping at both ends (no wrap). A
 * `delta` of 0 is a no-op, and stepping down from `large` returns to `default`
 * (which removes the override).
 */
export function stepFontSize(current: FontSizeStep, delta: number): FontSizeStep {
	const index = FONT_SIZE_STEPS.indexOf(isFontSizeStep(current) ? current : 'default');
	if (delta === 0) return FONT_SIZE_STEPS[index];
	const next = Math.min(Math.max(index + Math.sign(delta), 0), FONT_SIZE_STEPS.length - 1);
	return FONT_SIZE_STEPS[next];
}

/** Resolved `font-size` for a step, or `null` when no override applies. */
export function fontSizeRem(step: FontSizeStep): string | null {
	return FONT_SIZE_REM[isFontSizeStep(step) ? step : 'default'];
}

/** Resolved `line-height` for a step, or `null` when no override applies. */
export function lineHeightValue(step: LineSpacingStep): number | null {
	return LINE_HEIGHT_VALUE[isLineSpacingStep(step) ? step : 'normal'];
}
