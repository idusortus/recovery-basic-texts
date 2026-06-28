/**
 * Index version store — tracks whether a new corpus version is available.
 * Compares the cached version (from the loaded index) to the latest
 * index-meta.json fetched from the network.
 *
 * LUW 8 — PRD §7.6
 */

import { writable } from 'svelte/store';

interface VersionState {
	updateAvailable: boolean;
	currentVersion: string | null;
	latestVersion: string | null;
}

const _state = writable<VersionState>({
	updateAvailable: false,
	currentVersion: null,
	latestVersion: null
});

export const indexVersionStore = { subscribe: _state.subscribe };

/**
 * Check if a newer index version is available from the network.
 * Call this after the index has been loaded (so currentVersion is known).
 */
export async function checkIndexVersion(currentVersion: string): Promise<void> {
	try {
		const res = await fetch('/index/index-meta.json', {
			cache: 'no-store',
			signal: AbortSignal.timeout(5000)
		});
		if (!res.ok) return;
		const meta = await res.json();
		const latestVersion = meta?.version;
		if (latestVersion && latestVersion !== currentVersion) {
			_state.set({ updateAvailable: true, currentVersion, latestVersion });
		}
	} catch {
		// Network unavailable or timed out — silently ignore
	}
}
