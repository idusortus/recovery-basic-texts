<script lang="ts">
	import { page } from '$app/stores';
	import { online } from '$lib/stores/online';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import { loadSearchIndex } from '$lib/search/index';
	import {
		getReflectionFallback,
		isValidReflectionDate,
		todayReflectionKey,
		type ReflectionFallback
	} from '$lib/corpus/reflection';

	// Daily Reflections are hosted by AAWS at aa.org. While online we redirect
	// there (we never fetch or reproduce the day's text). While offline the
	// redirect cannot succeed, so we render the date's indexed concordance entry.
	const OFFICIAL_URL = 'https://www.aa.org/daily-reflections';

	let fallback = $state<ReflectionFallback | null>(null);

	// Date in context: a valid ?date=MM-DD, otherwise today.
	const requestedDate = $derived.by(() =>
		isValidReflectionDate($page.url.searchParams.get('date'))
			? ($page.url.searchParams.get('date') as string)
			: todayReflectionKey()
	);

	// Client-side only ($effect runs after mount). While online, redirect; if
	// connectivity returns while the fallback is shown, redirect again. While
	// offline, resolve the date's entry from the local index only.
	$effect(() => {
		if ($online) {
			window.location.replace(OFFICIAL_URL);
			return;
		}
		const key = requestedDate;
		loadSearchIndex().then(() => {
			fallback = getReflectionFallback(key);
		});
	});
</script>

<svelte:head>
	<title>Daily Reflections | basictexts</title>
	{#if $online}
		<!-- Fallback for environments where JS is slow or disabled -->
		<meta http-equiv="refresh" content="0; url=https://www.aa.org/daily-reflections" />
	{/if}
</svelte:head>

<main class="max-w-xl mx-auto px-4 py-12">
	{#if $online}
		<div class="text-center">
			<p class="text-stone-500 dark:text-slate-400 mb-4">
				Taking you to today's Daily Reflection at aa.org…
			</p>
			<ExternalLink href={OFFICIAL_URL} class="text-navy dark:text-amber-400 underline text-sm">
				Click here if not redirected automatically
			</ExternalLink>
		</div>
	{:else if fallback && fallback.reflection}
		<div
			class="bg-white dark:bg-slate-900/40 rounded shadow-sm border border-stone-200
				   dark:border-slate-800 p-5 transition-colors duration-200"
		>
			<div class="flex items-center justify-between mb-3">
				<h1 class="text-xs uppercase tracking-widest text-stone-400 dark:text-slate-500 font-semibold">
					Daily Reflection
				</h1>
				<time
					datetime={fallback.date}
					class="text-xs text-stone-400 dark:text-slate-500 font-medium tabular-nums"
				>
					{fallback.dateLabel}
				</time>
			</div>
			<h2 class="font-serif font-bold text-[#1A1A1A] dark:text-slate-100 text-lg uppercase tracking-wide mb-3">
				{fallback.reflection.title}
			</h2>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<p class="text-stone-600 dark:text-slate-400 text-sm italic leading-relaxed mb-4">{@html fallback.teaser}</p>
			<div class="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-slate-800">
				<span class="text-xs text-stone-400 dark:text-slate-500">
					Offline: showing the indexed concordance entry.
				</span>
				<ExternalLink
					href={OFFICIAL_URL}
					class="text-xs font-medium text-navy dark:text-amber-400 hover:underline transition-colors"
				>
					Read full reflection at aa.org →
				</ExternalLink>
			</div>
		</div>
	{:else if fallback}
		<div
			class="bg-white dark:bg-slate-900/40 rounded shadow-sm border border-stone-200
				   dark:border-slate-800 p-5 text-center transition-colors duration-200"
		>
			<p class="text-stone-500 dark:text-slate-400 text-sm italic mb-4">
				{fallback.message}
			</p>
			<ExternalLink
				href={OFFICIAL_URL}
				class="inline-flex items-center gap-2 px-4 py-2 rounded bg-navy text-white
					   text-sm font-medium hover:bg-navy/90 transition-colors"
			>
				Read today's reflection at aa.org →
			</ExternalLink>
		</div>
	{/if}
</main>
