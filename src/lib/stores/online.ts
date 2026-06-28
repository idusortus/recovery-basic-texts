/**
 * Online/offline store.
 * Tracks navigator.onLine and subscribes to online/offline window events.
 * Safe to import in SSR context (returns true when window is unavailable).
 */

import { readable } from 'svelte/store';

export const online = readable<boolean>(true, (set) => {
	if (typeof window === 'undefined') return;
	set(navigator.onLine);

	const handleOnline = () => set(true);
	const handleOffline = () => set(false);

	window.addEventListener('online', handleOnline);
	window.addEventListener('offline', handleOffline);

	return () => {
		window.removeEventListener('online', handleOnline);
		window.removeEventListener('offline', handleOffline);
	};
});
