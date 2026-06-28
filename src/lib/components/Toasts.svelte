<script lang="ts">
	import { X } from 'lucide-svelte';
	import { toasts, dismissToast } from '$lib/stores/toast';
</script>

{#if $toasts.length > 0}
	<div
		class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4"
		aria-live="polite"
		aria-atomic="false"
	>
		{#each $toasts as toast (toast.id)}
			<div
				class="flex items-start gap-3 px-4 py-3 rounded shadow-lg text-sm animate-fade-in
					   {toast.type === 'warning'
					   	? 'bg-amber-50 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
					   	: toast.type === 'error'
					   	  ? 'bg-red-50 dark:bg-red-950/80 text-red-900 dark:text-red-200 border border-red-200 dark:border-red-800'
					   	  : 'bg-white dark:bg-slate-800 text-stone-800 dark:text-slate-200 border border-stone-200 dark:border-slate-700'}"
				role="status"
			>
				<span class="flex-1">{toast.message}</span>
				<button
					type="button"
					onclick={() => dismissToast(toast.id)}
					class="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
					aria-label="Dismiss notification"
				>
					<X size={14} />
				</button>
			</div>
		{/each}
	</div>
{/if}
