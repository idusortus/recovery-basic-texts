<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';
	import Nav from '$lib/components/Nav.svelte';
	import Toasts from '$lib/components/Toasts.svelte';
	import { indexMeta } from '$lib/search/index';
	import { checkIndexVersion } from '$lib/stores/version';
	import { showToast } from '$lib/stores/toast';

	const { children }: { children: Snippet } = $props();
	const canonicalUrl = $derived(new URL($page.url.pathname, 'https://basictexts.org').toString());

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

<svelte:head>
	<title>basictexts.org — AA recovery search and step work concordance</title>
	<meta
		name="description"
		content="Search Alcoholics Anonymous literature for recovery, step work, sobriety, and daily reflections with a free, offline-friendly concordance."
	/>
	<meta
		name="keywords"
		content="AA recovery, step work, sobriety, Alcoholics Anonymous, Big Book, 12 steps, 12 traditions, daily reflections, recovery search"
	/>
	<meta name="robots" content="index,follow,max-image-preview:large" />
	<link rel="canonical" href={canonicalUrl} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content="basictexts.org — AA recovery search and step work concordance" />
	<meta
		property="og:description"
		content="Find recovery and step work passages across the Big Book, 12 Steps, 12 Traditions, and Daily Reflections."
	/>
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:site_name" content="basictexts.org" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="basictexts.org — AA recovery search and step work concordance" />
	<meta
		name="twitter:description"
		content="Find recovery and step work passages across the Big Book, 12 Steps, 12 Traditions, and Daily Reflections."
	/>
</svelte:head>

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

