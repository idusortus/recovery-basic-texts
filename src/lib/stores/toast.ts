/**
 * Toast notification store.
 * Manages a queue of short-lived messages shown in the UI.
 */

import { writable } from 'svelte/store';

export interface Toast {
	id: string;
	message: string;
	type: 'info' | 'warning' | 'error';
	durationMs: number;
}

const _toasts = writable<Toast[]>([]);
export const toasts = { subscribe: _toasts.subscribe };

let _counter = 0;

export function showToast(
	message: string,
	type: Toast['type'] = 'info',
	durationMs = 4000
): void {
	const id = `toast-${++_counter}`;
	_toasts.update((ts) => [...ts, { id, message, type, durationMs }]);
	setTimeout(() => {
		_toasts.update((ts) => ts.filter((t) => t.id !== id));
	}, durationMs);
}

export function dismissToast(id: string): void {
	_toasts.update((ts) => ts.filter((t) => t.id !== id));
}
