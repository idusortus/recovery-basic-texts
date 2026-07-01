<script lang="ts">
	import { onMount } from 'svelte';

	// Daily Reflections are hosted by AAWS at aa.org.
	// We do not render the full text locally — redirect immediately.
	onMount(() => {
		window.location.replace('https://www.aa.org/daily-reflections');
	});
</script>

<svelte:head>
	<title>Daily Reflections — redirecting to aa.org</title>
	<!-- Fallback for environments where JS is slow or disabled -->
	<meta http-equiv="refresh" content="0; url=https://www.aa.org/daily-reflections" />
</svelte:head>

<!-- Shown only if JS hasn't fired yet -->
<main class="max-w-xl mx-auto px-4 py-12 text-center">
	<p class="text-stone-500 dark:text-slate-400 mb-4">
		Taking you to today's Daily Reflection at aa.org…
	</p>
	<a
		href="https://www.aa.org/daily-reflections"
		class="text-navy dark:text-amber-400 underline text-sm"
	>
		Click here if not redirected automatically
	</a>
</main>
