<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { loadSearchIndex, search, searchReady, searchError } from '$lib/search/index';
	import { findExceptions } from '$lib/corpus/exceptions';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import type { GroupedResults, KnownException } from '$lib/types';
	import { enabledSources } from '$lib/corpus/registry';
	import { online } from '$lib/stores/online';
	import { showToast } from '$lib/stores/toast';

	// ─── State ──────────────────────────────────────────────────────────────────

	let query = $state('');
	let debouncedQuery = $state('');
	let results = $state<GroupedResults[]>([]);
	let hints = $state<KnownException[]>([]);
	let activeSourceIds = $state<Set<string>>(new Set(enabledSources.map((s) => s.id)));
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	const TOPIC_CHIPS = [
		'Fear', 'Acceptance', 'Resentment', 'Gratitude',
		'Humility', 'God', 'Honesty', 'Anger', 'Ego', 'Self'
	];

	// ─── Load index on mount; restore query from URL ──────────────────────────

	onMount(async () => {
		const urlQuery = $page.url.searchParams.get('q') ?? '';
		query = urlQuery;
		debouncedQuery = urlQuery;
		await loadSearchIndex();
		if (urlQuery) {
			runSearch(urlQuery);
			hints = findExceptions(urlQuery);
		}
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
		if (q) {
			url.searchParams.set('q', q);
		} else {
			url.searchParams.delete('q');
		}
		goto(url.pathname + url.search, { replaceState: true, keepFocus: true });
	}

	// Re-run search when index becomes ready
	$effect(() => {
		if ($searchReady && debouncedQuery) {
			runSearch(debouncedQuery);
		}
	});

	// ─── Topic chip click ──────────────────────────────────────────────────────

	function searchTopic(topic: string) {
		query = topic.toLowerCase();
		debouncedQuery = query;
		runSearch(query);
		hints = findExceptions(query);
		syncUrl(query);
	}

	// ─── Source filter ──────────────────────────────────────────────────────────

	function toggleSource(sourceId: string) {
		const next = new Set(activeSourceIds);
		if (next.has(sourceId)) {
			if (next.size === 1) return; // prevent deselecting the last source
			next.delete(sourceId);
		} else {
			next.add(sourceId);
		}
		activeSourceIds = next;
		runSearch(debouncedQuery);
	}

	// ─── Copy passage ──────────────────────────────────────────────────────────

	async function copyPassage(citation: string) {
		try {
			await navigator.clipboard.writeText(citation);
			showToast('Passage copied to clipboard.', 'info', 2500);
		} catch {
			showToast('Could not copy — please select and copy manually.', 'warning');
		}
	}

	// ─── Share passage ─────────────────────────────────────────────────────────

	async function sharePassage(sourceId: string, passageId: string) {
		const url = `${window.location.origin}/passage/${sourceId}/${passageId}`;
		try {
			if (navigator.share) {
				await navigator.share({ url, title: 'basictexts.org' });
			} else {
				await navigator.clipboard.writeText(url);
				showToast('Link copied to clipboard.', 'info', 2500);
			}
		} catch {
			// User cancelled share — ignore
		}
	}

	// ─── Totals ─────────────────────────────────────────────────────────────────

	const totalCount = $derived(results.reduce((acc, g) => acc + g.results.length, 0));
</script>

<main class="max-w-6xl mx-auto px-4 py-8">

	<!-- Welcome header (shown when no query) -->
	{#if !debouncedQuery}
		<div class="text-center mb-10 animate-fade-in">
			<h1 class="font-serif text-3xl font-semibold text-navy dark:text-slate-200 mb-2">
				Search AA Literature
			</h1>
			<p class="text-stone-500 dark:text-slate-400 max-w-md mx-auto text-sm mb-8">
				Keyword and phrase search across the Big Book, the 12&amp;12, and more.
				Wrap phrases in <code class="font-mono bg-stone-100 dark:bg-slate-800 px-1 rounded">"quotes"</code>
				for exact matching.
			</p>
		</div>
	{/if}

	<!-- Search bar -->
	<div class="relative mb-5">
		<label for="search-input" class="sr-only">Search AA literature</label>
		<input
			id="search-input"
			type="search"
			bind:value={query}
			oninput={handleInput}
			onkeydown={handleKeydown}
			placeholder='Search by keyword or "exact phrase"'
			autocomplete="off"
			autocorrect="off"
			autocapitalize="off"
			spellcheck="false"
			class="w-full rounded border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900
				   px-4 py-3 text-base text-[#1A1A1A] dark:text-slate-200 placeholder-stone-400
				   dark:placeholder-slate-500 shadow-sm focus-visible:outline-none
				   focus-visible:ring-2 focus-visible:ring-navy dark:focus-visible:ring-amber-400
				   transition-colors duration-200"
		/>
	</div>

	<!-- Topic chips (shown when no query) -->
	{#if !debouncedQuery}
		<div class="flex flex-wrap gap-2 justify-center mb-10" aria-label="Quick topic searches">
			{#each TOPIC_CHIPS as topic (topic)}
				<button
					type="button"
					onclick={() => searchTopic(topic)}
					class="px-3 py-1.5 rounded text-sm border border-stone-200 dark:border-slate-700
						   bg-white dark:bg-slate-900 text-stone-600 dark:text-slate-400
						   hover:border-navy hover:text-navy dark:hover:border-amber-400 dark:hover:text-amber-400
						   transition-colors duration-150"
				>
					{topic}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Source filter bar (shown when query active) -->
	{#if debouncedQuery && $searchReady && enabledSources.length > 1}
		<div class="flex flex-wrap gap-2 mb-5" role="group" aria-label="Filter by source">
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
					<span
						class="inline-block w-2 h-2 rounded-full flex-shrink-0"
						style="background-color: {source.color};"
						aria-hidden="true"
					></span>
					{source.shortTitle}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Loading state -->
	{#if !$searchReady && !$searchError}
		<p class="text-stone-400 dark:text-slate-500 text-sm text-center py-8">
			Loading search index…
		</p>
	{/if}

	<!-- Error state -->
	{#if $searchError}
		<div class="text-center py-12">
			<p class="text-red-600 dark:text-red-400 text-sm mb-2">
				Failed to load search index.
			</p>
			<p class="text-stone-400 dark:text-slate-500 text-xs">{$searchError}</p>
		</div>
	{/if}

	<!-- Known-exception hints -->
	{#if hints.length > 0}
		<div class="mb-6 space-y-3">
			{#each hints as hint (hint.title)}
				<div
					class="rounded border border-amber-200 dark:border-amber-800 bg-amber-50
						   dark:bg-amber-950/30 px-4 py-3 text-sm"
					role="note"
				>
					<p class="font-semibold text-amber-900 dark:text-amber-300 mb-1">{hint.title}</p>
					<p class="text-amber-800 dark:text-amber-400">{hint.body}</p>
					{#if hint.link}
						<ExternalLink
							href={hint.link.url}
							class="inline-flex items-center gap-1 mt-2 text-amber-700 dark:text-amber-400
								   font-medium hover:underline text-xs"
						>
							{hint.link.label}
						</ExternalLink>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Results -->
	{#if debouncedQuery && $searchReady}
		{#if results.length === 0 && hints.length === 0}
			<div class="text-center py-12 animate-fade-in">
				<p class="text-stone-500 dark:text-slate-400 mb-2">
					No results for <strong>"{debouncedQuery}"</strong>
				</p>
				<p class="text-stone-400 dark:text-slate-500 text-sm">
					Try different keywords, or check spelling. Quoted phrases require an exact match.
				</p>
			</div>
		{:else if results.length > 0}
			<p
				class="text-stone-400 dark:text-slate-500 text-sm mb-6"
				aria-live="polite"
				aria-atomic="true"
			>
				{totalCount} result{totalCount === 1 ? '' : 's'} for
				<strong class="text-stone-600 dark:text-slate-300">"{debouncedQuery}"</strong>
			</p>

			{#each results as group (group.source.id)}
				<section class="mb-10 animate-fade-in" aria-label="{group.source.title} results">

					<!-- Group header -->
					<div class="flex items-center gap-3 mb-4 pb-2 border-b border-stone-200 dark:border-slate-800">
						<span
							class="inline-block w-3 h-3 rounded-full flex-shrink-0"
							style="background-color: {group.source.color};"
							aria-hidden="true"
						></span>
						<h2 class="font-serif font-semibold text-lg text-navy dark:text-slate-200">
							{group.source.title}
						</h2>
						<span class="ml-auto text-stone-400 dark:text-slate-500 text-sm">
							{group.results.length} result{group.results.length === 1 ? '' : 's'}
						</span>
					</div>

					<!-- Result cards -->
					<div class="space-y-3">
						{#each group.results as result (result.passage.id)}
							<article
								class="bg-white dark:bg-slate-900/40 rounded shadow-sm border border-stone-200
									   dark:border-slate-800 px-5 py-4 transition-colors duration-200"
							>
								<!-- Chapter / page label -->
								<p class="font-serif text-xs text-stone-400 dark:text-slate-500 mb-2 uppercase tracking-wide">
									{result.passage.chapterRef ?? result.passage.title}
									{#if result.passage.pageRef}
										· p.{result.passage.pageRef.replace(/^p\.?/, '')}
									{/if}
								</p>

								<!-- KWIC text -->
								<!-- eslint-disable-next-line svelte/no-at-html-tags -->
								<p class="text-[#1A1A1A] dark:text-slate-200 leading-relaxed text-sm">
									{@html result.kwic}
								</p>

								<!-- Actions row -->
								<div class="mt-3 flex flex-wrap items-center gap-4">
									{#if group.source.displayMode === 'full-text'}
										<button
											type="button"
											class="text-xs text-stone-400 dark:text-slate-500
												   hover:text-navy dark:hover:text-slate-300 transition-colors"
											onclick={() => copyPassage(result.citation)}
										>
											Copy
										</button>
									{/if}

									{#if group.source.displayMode === 'full-text'}
										<a
											href="/passage/{result.passage.sourceId}/{result.passage.id}"
											class="text-xs text-stone-400 dark:text-slate-500
												   hover:text-navy dark:hover:text-slate-300 transition-colors"
										>
											View passage
										</a>
									{/if}

									{#if group.source.displayMode !== 'full-text' && group.source.officialUrl}
										<ExternalLink
											href={group.source.officialUrl}
											class="text-xs font-medium text-navy dark:text-amber-400
												   hover:underline transition-colors"
										>
											Read at official source →
										</ExternalLink>
									{/if}

									<button
										type="button"
										class="text-xs text-stone-400 dark:text-slate-500
											   hover:text-navy dark:hover:text-slate-300 transition-colors ml-auto"
										onclick={() => sharePassage(result.passage.sourceId, result.passage.id)}
									>
										Share
									</button>
								</div>
							</article>
						{/each}
					</div>
				</section>
			{/each}
		{/if}
	{/if}
</main>
