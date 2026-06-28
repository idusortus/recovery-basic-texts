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
	import { initInstallPrompt } from '$lib/stores/install';
	import { online } from '$lib/stores/online';
	import { flushLog } from '$lib/log';

	$effect(() => {
		if ($indexVersionStore.updateAvailable) {
			showToast(
				'Updated library available — refresh to load the latest content.',
				'info',
				10000
			);
		}
	});

	// Flush queued log records whenever connectivity is restored
	$effect(() => {
		if ($online) flushLog();
	});

	onMount(() => {
		initInstallPrompt();
	});
</script>

<div class="min-h-screen bg-parchment dark:bg-slate-950 transition-colors duration-200">
	<!-- Skip navigation — WCAG 2.4.1 -->
	<a
		href="#main-content"
		class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4
			   focus:px-4 focus:py-2 focus:rounded focus:bg-navy focus:text-white
			   focus:ring-2 focus:ring-white focus:outline-none text-sm font-medium"
	>
		Skip to main content
	</a>
	<Nav {isDark} ontoggleTheme={toggleTheme} />
	<div id="main-content" tabindex="-1">
		{@render children()}
	</div>
	<Toasts />
</div>

