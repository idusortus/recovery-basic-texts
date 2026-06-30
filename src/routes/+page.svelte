<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Tag, Info, ChevronRight } from '@lucide/svelte';
	import { loadSearchIndex, search, searchReady, searchError } from '$lib/search/index';
	import { findExceptions } from '$lib/corpus/exceptions';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import type { GroupedResults, KnownException, Passage } from '$lib/types';
	import { enabledSources, allSources } from '$lib/corpus/registry';
	import { online } from '$lib/stores/online';
	import { showToast } from '$lib/stores/toast';
	import { canInstall, initInstallPrompt, promptInstall } from '$lib/stores/install';
	import { getTodaysReflection, reflectionTeaser, formatReflectionDate } from '$lib/corpus/reflection';
	import { enqueueLog, flushLog } from '$lib/log';

	// ─── State ──────────────────────────────────────────────────────────────────

	let query = $state('');
	let debouncedQuery = $state('');
	let results = $state<GroupedResults[]>([]);
	let hints = $state<KnownException[]>([]);
	let activeSourceIds = $state<Set<string>>(new Set(enabledSources.map((s) => s.id)));
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let todaysReflection = $state<Passage | null>(null);

	const TOPIC_CHIPS = [
		'Acceptance', 'Resentment', 'Fear', 'Gratitude',
		'Humility', 'God', 'Honesty', 'Anger', 'Ego', 'Self'
	];

	const websiteSchema = {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: 'basictexts.org',
		url: 'https://basictexts.org',
		description:
			'Free AA recovery and step work search tool for Alcoholics Anonymous literature and daily reflections.',
		potentialAction: {
			'@type': 'SearchAction',
			target: 'https://basictexts.org/?q={search_term_string}',
			'query-input': 'required name=search_term_string'
		}
	};

	// ─── Load index on mount; restore query from URL ──────────────────────────

	onMount(async () => {
		initInstallPrompt();
		const urlQuery = $page.url.searchParams.get('q') ?? '';
		query = urlQuery;
		debouncedQuery = urlQuery;
		await loadSearchIndex();
		todaysReflection = getTodaysReflection();
		if (urlQuery) {
			runSearch(urlQuery);
			hints = findExceptions(urlQuery);
		}
		if ($online) flushLog();
	});

	// ─── Debounced search ──────────────────────────────────────────────────────

	function handleInput() {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			debouncedQuery = query;
			runSearch(query);
			hints = findExceptions(query);
			syncUrl(query);
		}, 150);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			if (debounceTimer) clearTimeout(debounceTimer);
			debouncedQuery = query;
			runSearch(query);
			hints = findExceptions(query);
			syncUrl(query);
			// Log on Enter (explicit submit only — PRD §7.4)
			if (query.trim()) {
				const sf = activeSourceIds.size < enabledSources.length ? [...activeSourceIds] : null;
				enqueueLog(query.trim(), results.reduce((n, g) => n + g.results.length, 0), sf);
				if ($online) flushLog();
			}
		}
	}

	function runSearch(q: string) {
		if (!$searchReady) return;
		results = search(q, {
			sourceFilter: activeSourceIds.size < enabledSources.length
				? [...activeSourceIds]
				: undefined
		});
	}

	function syncUrl(q: string) {
		const url = new URL(window.location.href);
		if (q) { url.searchParams.set('q', q); } else { url.searchParams.delete('q'); }
		goto(url.pathname + url.search, { replaceState: true, keepFocus: true });
	}

	$effect(() => {
		if ($searchReady) {
			if (debouncedQuery) runSearch(debouncedQuery);
			todaysReflection = getTodaysReflection();
		}
	});

	function searchTopic(topic: string) {
		query = topic.toLowerCase();
		debouncedQuery = query;
		runSearch(query);
		hints = findExceptions(query);
		syncUrl(query);
	}

	function toggleSource(sourceId: string) {
		const next = new Set(activeSourceIds);
		if (next.has(sourceId)) {
			if (next.size === 1) return;
			next.delete(sourceId);
		} else {
			next.add(sourceId);
		}
		activeSourceIds = next;
		runSearch(debouncedQuery);
	}

	async function copyPassage(citation: string) {
		try {
			await navigator.clipboard.writeText(citation);
			showToast('Passage copied to clipboard.', 'info', 2500);
		} catch {
			showToast('Could not copy — please select and copy manually.', 'warning');
		}
	}

	async function sharePassage(sourceId: string, passageId: string) {
		const url = `${window.location.origin}/passage/${sourceId}/${passageId}`;
		try {
			if (navigator.share) {
				await navigator.share({ url, title: 'basictexts.org' });
			} else {
				await navigator.clipboard.writeText(url);
				showToast('Link copied to clipboard.', 'info', 2500);
			}
		} catch { /* User cancelled */ }
	}

	async function shareSearch(q: string) {
		const url = `https://basictexts.org/?q=${encodeURIComponent(q)}`;
		try {
			if (navigator.share) {
				await navigator.share({ url, title: 'basictexts.org — ' + q });
			} else {
				await navigator.clipboard.writeText(url);
				showToast('Search link copied to clipboard.', 'info', 2500);
			}
		} catch { /* User cancelled */ }
	}

	const totalCount = $derived(results.reduce((acc, g) => acc + g.results.length, 0));

	const todayMmDd = (() => {
		const d = new Date();
		return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	})();
</script>

<svelte:head>
	<title>basictexts.org — AA recovery search and step work concordance</title>
	<meta
		name="description"
		content="Search AA recovery passages, step work themes, sobriety reflections, and daily readings across the Big Book, 12 Steps, 12 Traditions, and more."
	/>
	<meta
		name="keywords"
		content="AA recovery, step work, sobriety, Big Book, 12 steps, 12 traditions, daily reflections, recovery search"
	/>
	<script type="application/ld+json">
		{JSON.stringify(websiteSchema)}
	</script>
</svelte:head>

<main class="max-w-6xl mx-auto px-4 py-8">

	<!-- ── HERO (home state only) ───────────────────────────────────────────── -->
	{#if !debouncedQuery}
		<div class="text-center mb-8 animate-fade-in">
			<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-stone-200
				dark:border-slate-700 bg-white dark:bg-slate-900 text-xs
				text-stone-500 dark:text-slate-400 mb-5">
				<span aria-hidden="true">🏛️</span>
				Free, Open-Source &amp; PWA Installable
			</div>
			<h1 class="font-serif text-4xl sm:text-5xl font-bold text-navy dark:text-slate-100 mb-4 leading-tight">
				There is a solution.<br class="hidden sm:block" />
			</h1>
			<p class="text-stone-500 dark:text-slate-400 max-w-xl mx-auto text-sm leading-relaxed">
				Find recovery passages and references in our basic literature.
			</p>
		</div>
	{/if}

	<!-- ── SEARCH BAR (always) ──────────────────────────────────────────────── -->
	<div class="relative mb-4">
		<label for="search-input" class="sr-only">Search AA literature</label>
		<input
			id="search-input"
			type="search"
			bind:value={query}
			oninput={handleInput}
			onkeydown={handleKeydown}
			placeholder="Search phrases, keywords (e.g., 'acceptance')"
			autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
			class="w-full rounded border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900
				   px-4 py-3.5 text-base text-[#1A1A1A] dark:text-slate-200 placeholder-stone-400
				   dark:placeholder-slate-500 shadow-sm focus-visible:outline-none
				   focus-visible:ring-2 focus-visible:ring-navy dark:focus-visible:ring-amber-400
				   transition-colors duration-200"
		/>
	</div>

	<!-- ── FILTER SOURCES (always) ──────────────────────────────────────────── -->
	{#if enabledSources.length > 0}
		<div class="flex flex-wrap items-center gap-2 mb-4" role="group" aria-label="Filter by source">
			<span class="text-xs text-stone-400 dark:text-slate-500 uppercase tracking-wide font-medium mr-1 shrink-0">
				Filter Sources:
			</span>
			{#each enabledSources as source (source.id)}
				<button
					type="button"
					onclick={() => toggleSource(source.id)}
					aria-pressed={activeSourceIds.has(source.id)}
					class="inline-flex items-center gap-1.5 px-3 py-1 rounded text-sm font-medium
						   border transition-colors duration-150
						   {activeSourceIds.has(source.id)
						   	? 'border-transparent text-white'
						   	: 'border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-stone-500 dark:text-slate-400'}"
					style={activeSourceIds.has(source.id) ? `background-color: ${source.color};` : ''}
				>
					<span class="inline-block w-2 h-2 rounded-full shrink-0"
					style="background-color: {activeSourceIds.has(source.id) ? 'white' : source.color};" aria-hidden="true"></span>
					{source.shortTitle}
				</button>
			{/each}
		</div>
	{/if}

	<!-- ── HOME STATE ───────────────────────────────────────────────────────── -->
	{#if !debouncedQuery}

		<!-- Popular searches -->
		<div class="mb-8">
			<span class="text-xs text-stone-400 dark:text-slate-500 uppercase tracking-wide font-medium block mb-2">
				Popular Recovery Searches:
			</span>
			<div class="flex flex-wrap gap-2 items-center" role="group" aria-label="Quick topic searches">
				{#each TOPIC_CHIPS as topic (topic)}
					<button type="button" onclick={() => searchTopic(topic)}
						class="px-3 py-1.5 rounded text-sm border border-stone-200 dark:border-slate-700
							   bg-white dark:bg-slate-900 text-stone-600 dark:text-slate-400
							   hover:border-navy hover:text-navy dark:hover:border-amber-400 dark:hover:text-amber-400
							   transition-colors duration-150">
						{topic}
					</button>
				{/each}
				<a href="/topics" class="text-sm text-navy dark:text-amber-400 hover:underline transition-colors ml-1">
					Browse All A-Z ›
				</a>
			</div>
		</div>

		<!-- ── DASHBOARD GRID ──────────────────────────────────────────────── -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">

			<!-- ─ Library Status ──────────────────────────────────────────────── -->
			<div class="bg-white dark:bg-slate-900/40 rounded shadow-sm border border-stone-200
				   dark:border-slate-800 p-4 transition-colors duration-200">
				<h2 class="text-xs uppercase tracking-widest text-stone-400 dark:text-slate-500 font-semibold mb-3">
					Library Status
				</h2>
				<ul class="space-y-2" role="list">
					{#each allSources as source (source.id)}
						<li class="flex items-center justify-between gap-2">
							<div class="flex items-center gap-2 min-w-0">
								<span class="inline-block w-2 h-2 rounded-full shrink-0"
									style="background-color: {source.color};" aria-hidden="true"></span>
								<span class="text-sm text-[#1A1A1A] dark:text-slate-200 truncate">
									{source.shortTitle === 'Big Book' ? 'Alcoholics Anonymous' :
									 source.shortTitle === '12&12' ? '12 Steps & 12 Trad.' : source.title}
								</span>
							</div>
							{#if !source.enabled}
								<span class="text-xs text-stone-300 dark:text-slate-600 font-medium uppercase tracking-wide shrink-0">Soon</span>
							{:else if source.displayMode === 'full-text'}
								<span class="text-xs text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wide shrink-0">Full-Text</span>
							{:else if source.displayMode === 'concordance-only'}
								<span class="text-xs text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wide shrink-0">Concordance</span>
							{:else}
								<span class="text-xs text-stone-400 dark:text-slate-500 font-medium uppercase tracking-wide shrink-0">Snippet</span>
							{/if}
						</li>
					{/each}
				</ul>
				<div class="mt-4 pt-3 border-t border-stone-100 dark:border-slate-800">
					<p class="text-xs leading-relaxed">
						<span class="font-semibold text-amber-700 dark:text-amber-400">Disclaimer:</span>
						<span class="text-stone-400 dark:text-slate-500 italic">
							basictexts is a free community-sourced index. Respect copyrighted material.
							Always purchase official editions.
						</span>
					</p>
				</div>
			</div>

			<!-- ─ Today's Reflection (2 cols) ────────────────────────────────── -->
			<div class="md:col-span-1 lg:col-span-2 bg-white dark:bg-slate-900/40 rounded shadow-sm
				   border border-stone-200 dark:border-slate-800 p-4 flex flex-col
				   transition-colors duration-200 min-h-[240px]">

				{#if todaysReflection}
					<div class="flex items-center justify-between mb-3">
						<h2 class="text-xs uppercase tracking-widest text-stone-400 dark:text-slate-500 font-semibold">
							Today's Reflection
						</h2>
						<time datetime={todayMmDd} class="text-xs text-stone-400 dark:text-slate-500 font-medium tabular-nums">
							{formatReflectionDate(todayMmDd)}
						</time>
					</div>
					<h3 class="font-serif font-bold text-[#1A1A1A] dark:text-slate-100 text-lg uppercase tracking-wide mb-3">
						{todaysReflection.title}
					</h3>
					<p class="text-stone-600 dark:text-slate-400 text-sm italic leading-relaxed flex-1 line-clamp-5 mb-4">
						"{reflectionTeaser(todaysReflection.text, 250)}"
					</p>
					<div class="flex items-center justify-between mt-auto pt-3 border-t border-stone-100 dark:border-slate-800">
						<span class="text-xs text-stone-400 dark:text-slate-500">Ref: {formatReflectionDate(todayMmDd)}</span>
						<div class="flex items-center gap-3">
							<ExternalLink href="https://www.aa.org/daily-reflections"
								class="text-xs text-stone-400 dark:text-slate-500 hover:text-navy dark:hover:text-amber-400 transition-colors">
								aa.org →
							</ExternalLink>
							<a href="/reflection" class="text-xs font-medium text-navy dark:text-amber-400 hover:underline transition-colors">
								Read full reflection →
							</a>
						</div>
					</div>

				{:else}
					<div class="flex items-center justify-between mb-3">
						<h2 class="text-xs uppercase tracking-widest text-stone-400 dark:text-slate-500 font-semibold">
							Today's Reflection
						</h2>
						<time datetime={todayMmDd} class="text-xs text-stone-400 dark:text-slate-500 font-medium tabular-nums">
							{formatReflectionDate(todayMmDd)}
						</time>
					</div>
					<div class="flex-1 flex flex-col justify-center py-4">
						<p class="text-stone-400 dark:text-slate-500 text-sm italic leading-relaxed mb-5">
							Daily Reflections are available at aa.org. We link directly to the official source.
						</p>
						<ExternalLink href="https://www.aa.org/daily-reflections"
							class="self-start inline-flex items-center gap-2 px-4 py-2 rounded bg-navy text-white
								   text-sm font-medium hover:bg-navy/90 transition-colors">
							Read today's reflection at aa.org →
						</ExternalLink>
					</div>
					<div class="pt-3 border-t border-stone-100 dark:border-slate-800">
						<p class="text-xs text-stone-300 dark:text-slate-600 italic">
							© Alcoholics Anonymous World Services, Inc.
						</p>
					</div>
				{/if}
			</div>

			<!-- ─ Tools & PWA ─────────────────────────────────────────────────── -->
			<div class="bg-white dark:bg-slate-900/40 rounded shadow-sm border border-stone-200
				   dark:border-slate-800 p-4 transition-colors duration-200">
				<h2 class="text-xs uppercase tracking-widest text-stone-400 dark:text-slate-500 font-semibold mb-3">
					Tools &amp; PWA
				</h2>
				<nav aria-label="Quick links">
					<a href="/topics"
						class="flex items-center justify-between py-2.5 border-b border-stone-100
							   dark:border-slate-800 text-sm text-[#1A1A1A] dark:text-slate-200
							   hover:text-navy dark:hover:text-amber-400 transition-colors">
						<span class="flex items-center gap-2">
							<Tag size={14} class="text-stone-400 dark:text-slate-500 shrink-0" aria-hidden={true} />
							Browse A-Z Topics
						</span>
						<ChevronRight size={14} class="text-stone-300 dark:text-slate-600 shrink-0" aria-hidden={true} />
					</a>
					<a href="/about"
						class="flex items-center justify-between py-2.5 text-sm text-[#1A1A1A]
							   dark:text-slate-200 hover:text-navy dark:hover:text-amber-400 transition-colors">
						<span class="flex items-center gap-2">
							<Info size={14} class="text-stone-400 dark:text-slate-500 shrink-0" aria-hidden={true} />
							Legal &amp; Copyright
						</span>
						<ChevronRight size={14} class="text-stone-300 dark:text-slate-600 shrink-0" aria-hidden={true} />
					</a>
				</nav>
				<div class="mt-4 pt-3 border-t border-stone-100 dark:border-slate-800">
					<div class="flex items-center gap-2 mb-3">
						<div class="w-8 h-8 bg-navy rounded flex items-center justify-center shrink-0" aria-hidden="true">
							<span class="text-white font-serif italic text-sm font-bold leading-none">bt</span>
						</div>
						<div class="min-w-0">
							<div class="text-xs font-semibold text-[#1A1A1A] dark:text-slate-200 truncate">basictexts PWA</div>
							<div class="text-xs text-stone-400 dark:text-slate-500">v1.0.0 · Offline Ready</div>
						</div>
					</div>
					{#if $canInstall}
						<button type="button" onclick={promptInstall}
							class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded
								   bg-navy text-white text-xs font-medium hover:bg-navy/90 transition-colors
								   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy">
						<span aria-hidden="true">⬇</span> Install App Offline
						</button>
					{:else}
						<p class="text-xs text-stone-400 dark:text-slate-500 leading-relaxed">
							Use your browser's "Add to Home Screen" to install for offline use.
						</p>
					{/if}
				</div>
			</div>
		</div>

	<!-- ── SEARCH STATE ──────────────────────────────────────────────────────── -->
	{:else}

		{#if !$searchReady && !$searchError}
			<p class="text-stone-400 dark:text-slate-500 text-sm text-center py-8">Loading search index…</p>
		{/if}

		{#if $searchError}
			<div class="text-center py-12">
				<p class="text-red-600 dark:text-red-400 text-sm mb-2">Failed to load search index.</p>
				<p class="text-stone-400 dark:text-slate-500 text-xs">{$searchError}</p>
			</div>
		{/if}

		{#if hints.length > 0}
			<div class="mb-6 space-y-3">
				{#each hints as hint (hint.title)}
					<div class="rounded border border-amber-200 dark:border-amber-800 bg-amber-50
							   dark:bg-amber-950/30 px-4 py-3 text-sm" role="note">
						<p class="font-semibold text-amber-900 dark:text-amber-300 mb-1">{hint.title}</p>
						<p class="text-amber-800 dark:text-amber-400">{hint.body}</p>
						{#if hint.link}
							<ExternalLink href={hint.link.url}
								class="inline-flex items-center gap-1 mt-2 text-amber-700 dark:text-amber-400 font-medium hover:underline text-xs">
								{hint.link.label}
							</ExternalLink>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		{#if $searchReady}
			{#if results.length === 0 && hints.length === 0 && debouncedQuery}
				<div class="text-center py-12 animate-fade-in">
					<p class="text-stone-500 dark:text-slate-400 mb-2">
						No results for <strong>"{debouncedQuery}"</strong>
					</p>
					<p class="text-stone-400 dark:text-slate-500 text-sm">
						Try different keywords, or check spelling. Quoted phrases require an exact match.
					</p>
				</div>
			{:else if results.length > 0}
				<p class="text-stone-400 dark:text-slate-500 text-sm mb-6" aria-live="polite" aria-atomic="true">
					{totalCount} result{totalCount === 1 ? '' : 's'} for
					<strong class="text-stone-600 dark:text-slate-300">"{debouncedQuery}"</strong>
				</p>

				{#each results as group (group.source.id)}
					<section class="mb-10 animate-fade-in" aria-label="{group.source.title} results">
						<div class="flex items-center gap-3 mb-4 pb-2 border-b border-stone-200 dark:border-slate-800">
							<span class="inline-block w-3 h-3 rounded-full shrink-0"
								style="background-color: {group.source.color};" aria-hidden="true"></span>
							<h2 class="font-serif font-semibold text-lg text-navy dark:text-slate-200">{group.source.title}</h2>
							<span class="ml-auto text-stone-400 dark:text-slate-500 text-sm">
								{group.results.length} result{group.results.length === 1 ? '' : 's'}
							</span>
						</div>
						<div class="space-y-3">
							{#each group.results as result (result.passage.id)}
								<article class="bg-white dark:bg-slate-900/40 rounded shadow-sm border border-stone-200
									   dark:border-slate-800 px-5 py-4 transition-colors duration-200">								{#if result.matchedBySynonym}
									<p class="text-xs text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
										<span aria-hidden="true">~</span> Similar result — matched via a related term
									</p>
								{/if}									<p class="font-serif text-xs text-stone-400 dark:text-slate-500 mb-2 uppercase tracking-wide">
										{result.passage.chapterRef ?? result.passage.title}
										{#if result.passage.pageRef}
											· p.{result.passage.pageRef.replace(/^p\.?/, '')}
										{/if}
									</p>
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									<p class="text-[#1A1A1A] dark:text-slate-200 leading-relaxed text-sm">{@html result.kwic}</p>
									<div class="mt-3 flex flex-wrap items-center gap-4">
										{#if group.source.displayMode === 'full-text'}
											<button type="button"
												class="text-xs text-stone-400 dark:text-slate-500 hover:text-navy dark:hover:text-slate-300 transition-colors"											aria-label="Copy passage to clipboard"												onclick={() => copyPassage(result.citation)}>Copy</button>
										{/if}
										{#if group.source.displayMode === 'full-text'}
											<a href="/passage/{result.passage.sourceId}/{result.passage.id}"
												class="text-xs text-stone-400 dark:text-slate-500 hover:text-navy dark:hover:text-slate-300 transition-colors">
												View passage
											</a>
										{/if}
										{#if group.source.displayMode !== 'full-text' && group.source.officialUrl}
											<ExternalLink href={group.source.officialUrl}
												class="text-xs font-medium text-navy dark:text-amber-400 hover:underline transition-colors">
												Read at official source →
											</ExternalLink>
										{/if}
									{#if group.source.displayMode === 'full-text'}
											<button type="button"
												class="text-xs text-stone-400 dark:text-slate-500 hover:text-navy dark:hover:text-slate-300 transition-colors ml-auto"
												aria-label="Share passage link"
												onclick={() => sharePassage(result.passage.sourceId, result.passage.id)}>Share</button>
										{:else}
											<button type="button"
												class="text-xs text-stone-400 dark:text-slate-500 hover:text-navy dark:hover:text-slate-300 transition-colors ml-auto"
												aria-label="Share search link"
												onclick={() => shareSearch(debouncedQuery)}>Share search</button>
										{/if}
									</div>
								</article>
							{/each}
						</div>
					</section>
				{/each}
			{/if}
		{/if}

	{/if}
</main>
