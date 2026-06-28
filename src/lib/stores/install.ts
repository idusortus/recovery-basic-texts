/**
 * PWA install prompt store.
 * Captures the `beforeinstallprompt` event and exposes `promptInstall()`.
 *
 * Phase E — PRD §8.4 ("PWA install prompt")
 */

import { writable } from 'svelte/store';

/** Subset of BeforeInstallPromptEvent (not in standard lib.dom.d.ts) */
interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Module-level reference so promptInstall() can access it without store subscription narrowing issues
let _pendingPrompt: BeforeInstallPromptEvent | null = null;

const _canInstall = writable(false);

/** True when the browser has a pending install prompt ready to show. */
export const canInstall = { subscribe: _canInstall.subscribe };

/**
 * Wire up `beforeinstallprompt` and `appinstalled` listeners.
 * Call once from the root layout's `onMount`.
 */
export function initInstallPrompt(): void {
	if (typeof window === 'undefined') return;

	window.addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		_pendingPrompt = e as BeforeInstallPromptEvent;
		_canInstall.set(true);
	});

	window.addEventListener('appinstalled', () => {
		_pendingPrompt = null;
		_canInstall.set(false);
	});
}

/**
 * Show the browser's native install prompt.
 * Clears the stored prompt once the user responds.
 */
export async function promptInstall(): Promise<void> {
	if (!_pendingPrompt) return;
	const p = _pendingPrompt;
	await p.prompt();
	const { outcome } = await p.userChoice;
	if (outcome === 'accepted') {
		_pendingPrompt = null;
		_canInstall.set(false);
	}
}
