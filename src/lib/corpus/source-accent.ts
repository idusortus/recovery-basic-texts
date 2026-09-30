/**
 * Source-accent resolution for the filter bar chips.
 *
 * Pure, dependency-free helpers that turn a configured source accent into the
 * chip/badge fill, a contrast-selected label foreground, and a badge ring.
 * Missing or invalid accents fall back to the theme navy so no chip can render
 * an empty or transparent background, and every returned color is chosen from
 * WCAG relative luminance so the badge stays separable from the surface it is
 * drawn on.
 *
 * This module must stay import-free: `scripts/test-source-badge.mjs` imports it
 * directly under Node's TypeScript type-stripping (same pattern as
 * `scripts/test-feedback.mjs`).
 */

/** Theme navy (`--color-navy`). Used whenever a configured accent is missing or invalid. */
export const FALLBACK_ACCENT = '#2C4A6E';

/**
 * Neutral ring for the badge on an unselected chip. The unselected chip surface
 * is `#FFFFFF` (light) or `slate-900` `#0F172A` (dark); this one neutral passes
 * the 3:1 ring requirement against both, so no theme switch is needed.
 */
export const CHIP_SURFACE_RING = '#78716C';

/** The repo's light text token (`--color-text` dark value); one of the two foreground picks. */
export const FOREGROUND_LIGHT = '#FFFFFF';

/** The repo's dark text token (`--color-text`); the other foreground pick. */
export const FOREGROUND_DARK = '#1A1A1A';

const HEX_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** True when `value` is a `#rgb` or `#rrggbb` hex string. */
export function isValidHex(value: unknown): value is string {
	return typeof value === 'string' && HEX_PATTERN.test(value);
}

function expandHex(hex: string): string {
	if (hex.length === 4) {
		return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
	}
	return hex;
}

function channelToLinear(channel: number): number {
	const c = channel / 255;
	return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x relative luminance of a `#rgb`/`#rrggbb` color. */
export function relativeLuminance(hex: string): number {
	const expanded = expandHex(hex);
	const r = parseInt(expanded.slice(1, 3), 16);
	const g = parseInt(expanded.slice(3, 5), 16);
	const b = parseInt(expanded.slice(5, 7), 16);
	return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/** WCAG contrast ratio between two hex colors (1–21). */
export function contrastRatio(a: string, b: string): number {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	const lighter = Math.max(la, lb);
	const darker = Math.min(la, lb);
	return (lighter + 0.05) / (darker + 0.05);
}

/** `#FFFFFF` or `#1A1A1A`, whichever contrasts better with `fill`. */
export function contrastForeground(fill: string): string {
	return contrastRatio(fill, FOREGROUND_LIGHT) >= contrastRatio(fill, FOREGROUND_DARK)
		? FOREGROUND_LIGHT
		: FOREGROUND_DARK;
}

export interface SourceAccent {
	/** Chip and badge fill: the valid accent, or the fallback navy. */
	fill: string;
	/** Label foreground for a chip filled with `fill`. */
	onFill: string;
	/**
	 * Badge ring color on a chip filled with `fill`. On a selected chip the badge
	 * fill equals the chip fill, so this ring (not the fill) carries the contrast.
	 */
	ring: string;
}

/**
 * Resolve a configured accent into chip/badge fill, label foreground, and ring.
 * A missing, empty, or non-hex accent yields the fallback navy.
 */
export function resolveSourceAccent(accent: string | null | undefined): SourceAccent {
	const fill = isValidHex(accent) ? expandHex(accent) : FALLBACK_ACCENT;
	// One luminance result drives both the label foreground and the badge ring.
	const contrast = contrastForeground(fill);
	return { fill, onFill: contrast, ring: contrast };
}
