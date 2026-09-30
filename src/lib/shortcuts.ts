/**
 * The single registry of wired keyboard shortcuts.
 *
 * The visible hint is rendered from this list, so an advertised shortcut cannot
 * drift from the one actually wired in `+layout.svelte` (PRD §12 warns against
 * a displayed-but-unwired shortcut).
 *
 * Item 10 — ux-qol-improvements (Design D7)
 */

export interface Shortcut {
	keys: string;
	description: string;
}

export const SHORTCUTS: readonly Shortcut[] = [
	{ keys: '/', description: 'Focus the search box' },
	{ keys: '?', description: 'Show keyboard shortcuts' }
];
