<script lang="ts">
	import { onMount } from 'svelte';
	import { BookOpen } from '@lucide/svelte';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import { loadSearchIndex, searchReady } from '$lib/search/index';
	import { getTodaysReflection, formatReflectionDate } from '$lib/corpus/reflection';
	import type { Passage } from '$lib/types';

	let reflection = $state<Passage | null>(null);
	let indexLoaded = $state(false);

	onMount(async () => {
		await loadSearchIndex();
		indexLoaded = true;
		reflection = getTodaysReflection();
	});

	$effect(() => {
		if ($searchReady && indexLoaded) {
			reflection = getTodaysReflection();
		}
	});

	const today = new Date();
	const mm = String(today.getMonth() + 1).padStart(2, '0');
	const dd = String(today.getDate()).padStart(2, '0');
	const todayKey = `${mm}-${dd}`;
	const displayDate = today.toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});
</script>

<svelte:head>
	<title>Daily Reflection — basictexts.org</title>
</svelte:head>

<main class="max-w-4xl mx-auto px-4 py-8">
	<div class="flex items-center gap-2 mb-6">
		<BookOpen size={20} class="text-navy dark:text-slate-400" aria-hidden={true} />
		<h1 class="font-serif text-2xl font-semibold text-navy dark:text-slate-200">
			Daily Reflection
		</h1>
	</div>

	<!-- Loading state -->
	{#if !indexLoaded}
		<div class="text-stone-400 dark:text-slate-500 text-sm py-8 text-center">
			Loading…
		</div>

	<!-- Reflection available -->
	{:else if reflection}
		<article
			class="bg-white dark:bg-slate-900/40 rounded shadow-sm border border-stone-200
				   dark:border-slate-800 px-6 py-8 max-w-2xl transition-colors duration-200"
		>
			<!-- Date header -->
			<div class="flex items-center justify-between mb-4">
				<p class="text-xs uppercase tracking-widest text-stone-400 dark:text-slate-500 font-medium">
					Today's Reflection
				</p>
				<time
					datetime={todayKey}
					class="text-xs text-stone-400 dark:text-slate-500 font-medium"
				>
					{displayDate}
				</time>
			</div>

			<!-- Title -->
			<h2 class="font-serif text-xl font-bold text-[#1A1A1A] dark:text-slate-100 mb-6 uppercase tracking-wide">
				{reflection.title}
			</h2>

			<!-- Full reflection text -->
			<div class="text-[#1A1A1A] dark:text-slate-200 text-base leading-relaxed space-y-4 mb-8">
				{#each reflection.text.split(/\n\n+/) as paragraph}
					<p class="italic">{paragraph}</p>
				{/each}
			</div>

			<!-- Attribution + aa.org link -->
			<div class="border-t border-stone-100 dark:border-slate-800 pt-5 space-y-3">
				<ExternalLink
					href="https://www.aa.org/daily-reflections"
					class="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-navy text-white
						   text-sm font-medium hover:bg-navy/90 transition-colors"
				>
					Read at aa.org →
				</ExternalLink>
				<p class="text-stone-400 dark:text-slate-500 text-xs leading-relaxed">
					<em>Daily Reflections: A Book of Reflections by A.A. Members for A.A. Members.</em><br />
					© Alcoholics Anonymous World Services, Inc. All rights reserved.<br />
					Used here as a concordance reference only. Please purchase the official edition to support AA.
				</p>
			</div>
		</article>

	<!-- No entry for today -->
	{:else}
		<div
			class="bg-white dark:bg-slate-900/40 rounded shadow-sm border border-stone-200
				   dark:border-slate-800 px-6 py-8 max-w-xl transition-colors duration-200"
		>
			<p class="text-stone-500 dark:text-slate-400 text-sm leading-relaxed mb-2">
				<strong>{formatReflectionDate(todayKey)}</strong>
			</p>
			<p class="text-stone-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
				Today's reflection is available at aa.org. We link you directly to the
				official source.
			</p>

			<ExternalLink
				href="https://www.aa.org/daily-reflections"
				class="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-navy text-white
					   text-sm font-medium hover:bg-navy/90 transition-colors"
			>
				Read today's reflection at aa.org →
			</ExternalLink>

			<p class="text-stone-400 dark:text-slate-500 text-xs mt-6 leading-relaxed">
				<em>Daily Reflections: A Book of Reflections by A.A. Members for A.A. Members.</em><br />
				© Alcoholics Anonymous World Services, Inc.
			</p>
		</div>
	{/if}
</main>
