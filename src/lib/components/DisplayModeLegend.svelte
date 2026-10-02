<script lang="ts">
	import { onMount } from 'svelte';
	import { X } from '@lucide/svelte';

	// Local UI preference (like the theme): no account, no personal data.
	const STORAGE_KEY = 'basictexts-display-legend-dismissed';

	let ready = $state(false);
	let dismissed = $state(false);

	onMount(() => {
		try {
			dismissed = localStorage.getItem(STORAGE_KEY) === '1';
		} catch {
			dismissed = false;
		}
		ready = true;
	});

	function dismiss() {
		dismissed = true;
		try {
			localStorage.setItem(STORAGE_KEY, '1');
		} catch {
			/* storage unavailable — dismissal lasts this page only */
		}
	}
</script>

{#if ready && !dismissed}
	<div
		role="note"
		aria-label="How results are shown"
		class="rounded border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 px-4 py-3 mb-4 transition-colors duration-200"
	>
		<div class="flex items-start justify-between gap-3">
			<ul class="text-xs text-stone-500 dark:text-slate-400 space-y-1">
				<li>
					<span class="font-semibold text-[#1A1A1A] dark:text-slate-200">Full-Text</span>: the
					complete passage is shown here (public-domain sources).
				</li>
				<li>
					<span class="font-semibold text-[#1A1A1A] dark:text-slate-200">Snippet</span>: a short
					excerpt; open the official source to read the rest.
				</li>
				<li>
					<span class="font-semibold text-[#1A1A1A] dark:text-slate-200">Concordance</span>: a
					keyword-in-context window; open the official source to read the full text.
				</li>
			</ul>
			<button
				type="button"
				onclick={dismiss}
				aria-label="Dismiss display-mode legend"
				class="shrink-0 p-1 rounded text-stone-400 dark:text-slate-500 hover:text-navy
					   dark:hover:text-slate-300 transition-colors focus-visible:outline-none
					   focus-visible:ring-2 focus-visible:ring-navy dark:focus-visible:ring-amber-400"
			>
				<X size={14} aria-hidden={true} />
			</button>
		</div>
	</div>
{/if}
