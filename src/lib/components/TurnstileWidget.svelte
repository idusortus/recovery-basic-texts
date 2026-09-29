<script module lang="ts">
	/**
	 * Cloudflare Turnstile widget, rendered explicitly so a Svelte component can
	 * own its lifecycle. The widget writes its current token into a hidden input
	 * named `cf-turnstile-response`, which the surrounding form submits like any
	 * other field; the server validates it against the Siteverify API.
	 */
	const SCRIPT_ID = 'cf-turnstile-script';
	const ONLOAD_CALLBACK = '__basictextsTurnstileOnload';

	/**
	 * Token submitted when no site key is configured. Cloudflare's script is not
	 * loaded in that case, so the form still submits a value. The server rejects
	 * it unless it is running with the matching test secret.
	 */
	export const DISABLED_TOKEN = 'turnstile-disabled-dev-token';

	type TurnstileApi = {
		render: (container: HTMLElement, options: Record<string, unknown>) => string | undefined;
		reset: (widgetId: string) => void;
		remove: (widgetId: string) => void;
	};

	// Shared across every widget instance so the script is fetched at most once.
	let scriptPromise: Promise<void> | null = null;

	function turnstileApi(): TurnstileApi | undefined {
		return (window as unknown as { turnstile?: TurnstileApi }).turnstile;
	}

	function loadScript(): Promise<void> {
		if (turnstileApi()) return Promise.resolve();
		if (scriptPromise) return scriptPromise;

		scriptPromise = new Promise<void>((resolve, reject) => {
			const fail = () => {
				scriptPromise = null;
				reject(new Error('Failed to load the Turnstile script.'));
			};

			(window as unknown as Record<string, unknown>)[ONLOAD_CALLBACK] = () => resolve();

			const existing = document.getElementById(SCRIPT_ID);
			if (existing) {
				existing.addEventListener('load', () => resolve(), { once: true });
				existing.addEventListener('error', fail, { once: true });
				return;
			}

			const script = document.createElement('script');
			script.id = SCRIPT_ID;
			script.src = `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=${ONLOAD_CALLBACK}`;
			script.async = true;
			script.defer = true;
			script.addEventListener('load', () => resolve(), { once: true });
			script.addEventListener('error', fail, { once: true });
			document.head.appendChild(script);
		});

		return scriptPromise;
	}
</script>

<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	interface Props {
		/** Public Turnstile site key. Empty disables Cloudflare (local dev/tests). */
		siteKey: string;
		/** Turnstile "action" label the server verifies. */
		action: string;
		/** Bump to reset the widget after a failed submit (tokens are single-use). */
		resetKey?: number;
	}

	let { siteKey, action, resetKey = 0 }: Props = $props();

	// The site key is fixed for the page's lifetime, but deriving keeps this
	// reactive-safe and avoids capturing a stale prop value.
	const enabled = $derived(siteKey.trim().length > 0);

	type Status = 'loading' | 'ready' | 'verified' | 'error';

	let status = $state<Status>('loading');
	let token = $state('');
	let container = $state<HTMLDivElement>();
	// Not reactive: only read/written from mount, the effect, and teardown.
	let widgetId: string | null = null;
	// `undefined` until the first effect run, so the initial `resetKey` never
	// triggers a reset — only later changes do.
	let lastResetKey: number | undefined;

	// When no site key is configured the script is never loaded, so submit the
	// fixed dummy token instead.
	const inputValue = $derived(enabled ? token : DISABLED_TOKEN);

	const statusMessage = $derived(
		!enabled
			? ''
			: status === 'loading'
				? 'Loading verification challenge.'
				: status === 'verified'
					? 'Verification complete.'
					: status === 'error'
						? 'Verification could not be loaded. Refresh the page and try again.'
						: ''
	);

	onMount(() => {
		if (!enabled || !container) return;

		let cancelled = false;
		void (async () => {
			try {
				await loadScript();
				if (cancelled || !container) return;

				const turnstile = turnstileApi();
				if (!turnstile) throw new Error('Turnstile API unavailable after loading.');

				widgetId =
					turnstile.render(container, {
						sitekey: siteKey,
						action,
						theme: 'auto',
						// The hidden input is rendered by this component, so tell Turnstile
						// not to add its own and risk a duplicate form field.
						'response-field': false,
						callback: (value: string) => {
							token = value;
							status = 'verified';
						},
						'error-callback': () => {
							token = '';
							status = 'error';
						},
						'expired-callback': () => {
							token = '';
							status = 'ready';
						},
						'timeout-callback': () => {
							token = '';
						}
					}) ?? null;
				status = 'ready';
			} catch {
				if (!cancelled) {
					token = '';
					status = 'error';
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		const nextKey = resetKey;
		if (lastResetKey === undefined) {
			lastResetKey = nextKey;
			return;
		}
		if (nextKey === lastResetKey) return;
		lastResetKey = nextKey;

		// Turnstile tokens are single-use, so clear the stale value immediately.
		token = '';
		if (!enabled || !widgetId) return;

		const turnstile = turnstileApi();
		if (!turnstile) return;
		turnstile.reset(widgetId);
		status = 'ready';
	});

	onDestroy(() => {
		if (widgetId && turnstileApi()) {
			turnstileApi()?.remove(widgetId);
			widgetId = null;
		}
	});
</script>

<div
	class="turnstile"
	class:turnstile--active={enabled}
	bind:this={container}
></div>
<input type="hidden" name="cf-turnstile-response" value={inputValue} />
<span class="sr-only" role="status" aria-live="polite">{statusMessage}</span>

<style>
	.turnstile--active {
		/* Reserve the widget's height to avoid layout shift as the iframe loads. */
		min-height: 65px;
	}
</style>
