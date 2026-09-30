/**
 * A tiny focus-trap shared by the mobile nav overlay and the shortcut-help
 * dialog. Keeps Tab/Shift+Tab inside an open dialog and focuses its first item.
 *
 * Item 10/19 — ux-qol-improvements (Design D16)
 */

const FOCUSABLE_SELECTOR = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled])',
	'textarea:not([disabled])',
	'select:not([disabled])',
	'[tabindex]:not([tabindex="-1"])'
].join(', ');

export function focusableElements(container: HTMLElement): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
		(el) => el.offsetParent !== null || el === document.activeElement
	);
}

export function focusFirstWithin(container: HTMLElement): void {
	const items = focusableElements(container);
	(items[0] ?? container).focus();
}

/** Keep Tab/Shift+Tab inside `container`, cycling at either end. */
export function trapTabKey(container: HTMLElement, event: KeyboardEvent): void {
	if (event.key !== 'Tab') return;

	const items = focusableElements(container);
	if (items.length === 0) {
		event.preventDefault();
		return;
	}

	const first = items[0];
	const last = items[items.length - 1];
	const active = document.activeElement as HTMLElement | null;
	const inside = active ? container.contains(active) : false;

	if (event.shiftKey) {
		if (!inside || active === first) {
			event.preventDefault();
			last.focus();
		}
	} else if (!inside || active === last) {
		event.preventDefault();
		first.focus();
	}
}
