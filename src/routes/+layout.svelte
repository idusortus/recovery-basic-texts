<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import Nav from '$lib/components/Nav.svelte';
	import Toasts from '$lib/components/Toasts.svelte';
	import { indexMeta } from '$lib/search/index';
	import { checkIndexVersion } from '$lib/stores/version';
	import { showToast } from '$lib/stores/toast';

	const { children }: { children: Snippet } = $props();

	// ─── Theme ───────────────────────────────────────────────────────────────────

	let isDark = $state(false);

	onMount(() => {
		const saved = localStorage.getItem('basictexts-theme');
		if (saved) {
			isDark = saved === 'dark';
		} else {
			isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		}
		applyTheme(isDark);

		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const listener = (e: MediaQueryListEvent) => {
			if (!localStorage.getItem('basictexts-theme')) {
				isDark = e.matches;
				applyTheme(isDark);
			}
		};
		mq.addEventListener('change', listener);
		return () => mq.removeEventListener('change', listener);
	});

	function applyTheme(dark: boolean) {
		document.documentElement.classList.toggle('dark', dark);
	}

	function toggleTheme() {
		isDark = !isDark;
		localStorage.setItem('basictexts-theme', isDark ? 'dark' : 'light');
		applyTheme(isDark);
	}

	// ─── Index version check (LUW 8) ─────────────────────────────────────────────

	$effect(() => {
		const meta = $indexMeta;
		if (meta?.version) {
			checkIndexVersion(meta.version).then(() => {
				// Version check result is in indexVersionStore; watch it separately
			});
		}
	});

	import { indexVersionStore } from '$lib/stores/version';

	$effect(() => {
		if ($indexVersionStore.updateAvailable) {
			showToast(
				'Updated library available — refresh to load the latest content.',
				'info',
				10000
			);
		}
	});
</script>

<div class="min-h-screen bg-parchment dark:bg-slate-950 transition-colors duration-200">
	<Nav {isDark} ontoggleTheme={toggleTheme} />
	{@render children()}
	<Toasts />
</div>

