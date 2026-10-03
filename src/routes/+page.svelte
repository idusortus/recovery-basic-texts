<script lang="ts">
	import { onMount, onDestroy, untrack, tick } from 'svelte';
	import { page } from '$app/stores';
	import { goto, afterNavigate } from '$app/navigation';
	import { Tag, Info, ChevronRight } from '@lucide/svelte';
	import {
		loadSearchIndex,
		search,
		searchReady,
		searchError,
		searchProgress,
		retryLoad,
		concordanceReady,
		getSuggestionTerms
	} from '$lib/search/index';
	import { applySuggestion, moveActiveIndex, type Suggestion } from '$lib/search/suggestions';
	import { pickZeroResultSuggestions } from '$lib/search/zero-result';
	import { serializeSearchUrl, parseSearchUrl } from '$lib/search/url-state';
	import { formatPageRef, copyLabelFor } from '$lib/search/result-label';
	import {
		addRecentSearch,
		parseRecentSearches,
		serializeRecentSearches,
		clearRecentSearches,
		RECENT_SEARCH_KEY
	} from '$lib/search/recent-searches';
	import { findExceptions } from '$lib/corpus/exceptions';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import DisplayModeLegend from '$lib/components/DisplayModeLegend.svelte';
	import type { GroupedResults, KnownException, Passage } from '$lib/types';
	import { enabledSources, allSources } from '$lib/corpus/registry';
	import { CHIP_SURFACE_RING, resolveSourceAccent } from '$lib/corpus/source-accent';
	import { resolveSourceLink } from '$lib/corpus/source-link';
	import { online } from '$lib/stores/online';
	import { showToast } from '$lib/stores/toast';
	import { canInstall, promptInstall } from '$lib/stores/install';
	import {
		getTodaysReflection,
		buildReflectionTeaser,
		formatReflectionDate
	} from '$lib/corpus/reflection';
	import { enqueueLog, flushLog } from '$lib/log';
	import { SHORTCUTS } from '$lib/shortcuts';
	import { reportHref } from '$lib/report-link';

	// ─── State ──────────────────────────────────────────────────────────────────

	/**
	 * The single source of truth for the default filter set: every enabled
	 * source that may appear as a filter chip. `filterable` defaults to true, so
	 * this equals the enabled set except for sources that opt out (the reference
	 * texts). ALL default-filter consumers below reference this list, never
	 * `enabledSources`, so the chip set, the URL default, and the "all selected"
	 * sentinel cannot diverge.
	 */
	const filterableSources = $derived(enabledSources.filter((s) => s.filterable !== false));

	let query = $state('');
	let debouncedQuery = $state('');
	let results = $state<GroupedResults[]>([]);
	let hints = $state<KnownException[]>([]);
	// The registry is static for the app's lifetime, so the active set is seeded
	// once from the initial filterable set (untracked: no reactive re-run needed).
	let activeSourceIds = $state<Set<string>>(new Set(untrack(() => filterableSources.map((s) => s.id))));
	let phraseMode = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let todaysReflection = $state<Passage | null>(null);
	/** The query whose result set is currently in `results` (for restore timing). */
	let searchedQuery = $state('');

	// ─── Recent searches (local only) ──────────────────────────────────────────
	// Persisted in localStorage; never transmitted, logged, or synced. Recorded
	// only on an explicit submit, never on the debounced as-you-type search.
	let recentSearches = $state<string[]>([]);

	// ─── Back-to-search scroll restoration ─────────────────────────────────────
	// SvelteKit restores the history scroll before the async results render and
	// the browser clamps it. Hold the offset in `$state` (so assigning it in
	// `restore`, which runs after `onMount`, re-triggers the effect) and re-apply
	// it once the restored results exist.
	let pendingScrollY = $state<number | null>(null);
	// A snapshot persisted by an earlier visit is restored during hydration too;
	// only accept a restore after a history navigation so a hard reload of a
	// query URL still starts at the top.
	let allowScrollRestore = false;

	export const snapshot = {
		capture: () => window.scrollY,
		restore: (value: unknown) => {
			if (!allowScrollRestore) return;
			if (typeof value === 'number' && Number.isFinite(value)) pendingScrollY = value;
		}
	};

	afterNavigate((navigation) => {
		allowScrollRestore = navigation.type !== 'enter';
	});

	// ─── Suggestions (Area 4) ──────────────────────────────────────────────────
	// Computed synchronously on input from the loaded term dictionary; never
	// delays or replaces the debounced search below.
	let suggestions = $state<Suggestion[]>([]);
	let suggestionsOpen = $state(false);
	let activeSuggestion = $state(-1);

	// In-place Copy/Share confirmation (Design D1): the { key, label } of the
	// control that just confirmed, cleared after a short delay so the label
	// reverts. Independent of the toast, which remains a secondary cue.
	let confirmed = $state<{ key: string; label: string } | null>(null);
	let confirmTimer: ReturnType<typeof setTimeout> | null = null;

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
		recentSearches = readRecentSearches();
		const urlState = parseSearchUrl(
			$page.url.search,
			// The known/default id list is the filterable set: a hand-authored URL
			// naming a non-filterable source (e.g. `sources=twelve-steps`) is
			// intentionally ignored, so the URL default matches the chip default.
			filterableSources.map((s) => s.id)
		);
		phraseMode = urlState.phrase;
		if (urlState.sources) activeSourceIds = new Set(urlState.sources);
		query = urlState.q;
		debouncedQuery = urlState.q;
		await loadSearchIndex();
		todaysReflection = getTodaysReflection();
		if (urlState.q) {
			runSearch(urlState.q);
			hints = findExceptions(urlState.q);
		}
		if ($online) flushLog();
	});

	// ─── Debounced search ──────────────────────────────────────────────────────

	/** Recompute suggestions for the current input (no dictionary → none). */
	function refreshSuggestions() {
		suggestions = getSuggestionTerms(query);
		suggestionsOpen = suggestions.length > 0;
		activeSuggestion = -1;
	}

	function dismissSuggestions() {
		suggestionsOpen = false;
		activeSuggestion = -1;
	}

	/** Selecting a suggestion runs the SAME search path as typing. */
	function selectSuggestion(term: string) {
		const next = applySuggestion(query, term);
		query = next;
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
		debouncedQuery = next;
		runSearch(next);
		hints = findExceptions(next);
		syncUrl(next);
		recordRecentSearch(next);
		dismissSuggestions();
	}

	function handleInput() {
		// A fresh in-page query must never inherit a back-navigation offset.
		pendingScrollY = null;
		// Suggestions update immediately; the debounced search below is untouched.
		refreshSuggestions();
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			debouncedQuery = query;
			runSearch(query);
			hints = findExceptions(query);
			syncUrl(query);
		}, 150);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (suggestionsOpen && suggestions.length > 0) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				activeSuggestion = moveActiveIndex(activeSuggestion, suggestions.length, 1);
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				activeSuggestion = moveActiveIndex(activeSuggestion, suggestions.length, -1);
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				dismissSuggestions();
				return;
			}
		}

		if (e.key === 'Enter') {
			if (suggestionsOpen && activeSuggestion >= 0 && suggestions[activeSuggestion]) {
				e.preventDefault();
				selectSuggestion(suggestions[activeSuggestion].term);
				return;
			}
			if (debounceTimer) clearTimeout(debounceTimer);
			// A fresh in-page query must never inherit a back-navigation offset.
			pendingScrollY = null;
			debouncedQuery = query;
			runSearch(query);
			hints = findExceptions(query);
			syncUrl(query);
			// Log on explicit submit only — PRD §7.4
			submitLog(query);
			recordRecentSearch(query);
		}
	}

	/** The active source ids in registry order, or null when all are selected. */
	function activeSourceList(): string[] | null {
		if (activeSourceIds.size >= filterableSources.length) return null;
		return filterableSources.filter((s) => activeSourceIds.has(s.id)).map((s) => s.id);
	}

	/** Enqueue the anonymous log record for an explicit submit (Enter / toggle). */
	function submitLog(q: string) {
		if (!q.trim()) return;
		enqueueLog(
			q.trim(),
			results.reduce((n, g) => n + g.results.length, 0),
			activeSourceList()
		);
		if ($online) flushLog();
	}

	function runSearch(q: string) {
		if (!$searchReady) return;
		searchedQuery = q;
		results = search(q, {
			sourceFilter: activeSourceList() ?? undefined,
			phraseMode
		});
	}

	function syncUrl(q: string) {
		const search = serializeSearchUrl({ q, phrase: phraseMode, sources: activeSourceList() });
		goto(`${window.location.pathname}${search ? `?${search}` : ''}`, {
			replaceState: true,
			keepFocus: true
		});
	}

	// ─── Recent-search storage adapter (degrades when storage is unavailable) ──

	/** Read the local recent list; [] when storage is unavailable/unreadable. */
	function readRecentSearches(): string[] {
		try {
			return parseRecentSearches(window.localStorage.getItem(RECENT_SEARCH_KEY));
		} catch {
			return [];
		}
	}

	/** Persist the local recent list; a write failure never surfaces to search. */
	function writeRecentSearches(list: string[]) {
		try {
			window.localStorage.setItem(RECENT_SEARCH_KEY, serializeRecentSearches(list));
		} catch {
			// Private mode / quota — keep the in-memory list only.
		}
	}

	/** Record an explicitly-submitted query as the most recent (local only). */
	function recordRecentSearch(q: string) {
		if (!q.trim()) return;
		recentSearches = addRecentSearch(recentSearches, q);
		writeRecentSearches(recentSearches);
	}

	/** Clear the list and hide the row; storage unavailability is a no-op. */
	function clearRecentSearchesRow() {
		recentSearches = [];
		try {
			clearRecentSearches(window.localStorage);
		} catch {
			// Storage unavailable — the in-memory clear still hides the row.
		}
	}

	// Activating a recent entry mirrors an Enter submit exactly: run the search,
	// sync the URL, enqueue the anonymous log as an ordinary submitted search,
	// and re-record the query as most recent. Only the query is logged; the
	// stored list itself is never transmitted.
	function runRecentSearch(q: string) {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
		query = q;
		debouncedQuery = q;
		runSearch(q);
		hints = findExceptions(q);
		syncUrl(q);
		submitLog(q);
		recordRecentSearch(q);
		dismissSuggestions();
	}

	/**
	 * Link to a full-text passage, carrying the active query in the URL so the
	 * passage page can highlight it (mirrors `syncUrl`): `q` when non-empty, plus
	 * `phrase=1` in exact-phrase mode.
	 */
	function passageHref(sourceId: string, passageId: string): string {
		const q = debouncedQuery.trim();
		const base = `/passage/${sourceId}/${passageId}`;
		if (!q) return base;
		const params = new URLSearchParams({ q });
		if (phraseMode) params.set('phrase', '1');
		return `${base}?${params.toString()}`;
	}

	$effect(() => {
		if ($searchReady) {
			if (debouncedQuery) runSearch(debouncedQuery);
			todaysReflection = getTodaysReflection();
		}
	});

	// Re-run the active search when concordance finishes loading in the background.
	// This upgrades results from MiniSearch (fallback) to exact concordance matches.
	$effect(() => {
		if ($concordanceReady && $searchReady && debouncedQuery) {
			runSearch(debouncedQuery);
		}
	});

	// Suggestions become available once the term dictionary has loaded.
	$effect(() => {
		if ($concordanceReady) {
			untrack(() => refreshSuggestions());
		}
	});

	// Back-to-search: re-apply the restored history scroll once the restored
	// query's results have rendered. SvelteKit's own restore runs before the
	// async list exists and the browser clamps it. A restored zero-result query
	// has nothing to scroll to and lands at the top.
	$effect(() => {
		if (pendingScrollY === null || !$searchReady) return;
		if (searchedQuery !== debouncedQuery) return;
		const target = pendingScrollY;
		if (results.length === 0) {
			// An empty result set is only authoritative once the concordance
			// index has settled; before that a later re-run may still produce
			// results, so keep the pending offset until then.
			if (!$concordanceReady) return;
			pendingScrollY = null;
			return;
		}
		tick().then(() => {
			if (pendingScrollY !== target) return;
			window.scrollTo(0, target);
			pendingScrollY = null;
		});
	});

	function searchTopic(topic: string) {
		query = topic.toLowerCase();
		debouncedQuery = query;
		runSearch(query);
		hints = findExceptions(query);
		syncUrl(query);
		recordRecentSearch(query);
		dismissSuggestions();
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
		syncUrl(debouncedQuery);
		submitLog(debouncedQuery);
	}

	/** True when this chip is the only selected source (cannot be deselected). */
	function isLastActiveSource(sourceId: string): boolean {
		return activeSourceIds.has(sourceId) && activeSourceIds.size === 1;
	}

	/** Flash an in-place confirmation on one control, then revert. */
	function confirmInPlace(key: string, label: string) {
		confirmed = { key, label };
		if (confirmTimer) clearTimeout(confirmTimer);
		confirmTimer = setTimeout(() => {
			confirmed = null;
		}, 2500);
	}

	async function copyPassage(citation: string, key: string) {
		try {
			await navigator.clipboard.writeText(citation);
			showToast('Passage copied to clipboard.', 'info', 2500);
			confirmInPlace(`copy:${key}`, 'Copied ✓');
		} catch {
			showToast('Could not copy. Please select and copy manually.', 'warning');
		}
	}

	async function sharePassage(sourceId: string, passageId: string) {
		const url = `${window.location.origin}/passage/${sourceId}/${passageId}`;
		try {
			if (navigator.share) {
				await navigator.share({ url, title: 'basictexts.org' });
				confirmInPlace(`share:${passageId}`, 'Shared ✓');
			} else {
				await navigator.clipboard.writeText(url);
				showToast('Link copied to clipboard.', 'info', 2500);
				confirmInPlace(`share:${passageId}`, 'Link copied');
			}
		} catch (err) {
			// AbortError is the user dismissing the native share sheet; anything
			// else is a real failure and must be surfaced, never shown as success.
			if (err instanceof Error && err.name === 'AbortError') return;
			showToast('Could not share. Please copy the address manually.', 'warning');
		}
	}

	onDestroy(() => {
		if (confirmTimer) clearTimeout(confirmTimer);
		if (debounceTimer) clearTimeout(debounceTimer);
	});

	const totalCount = $derived(results.reduce((acc, g) => acc + g.results.length, 0));

	const todayMmDd = (() => {
		const d = new Date();
		return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	})();

	/** Accessible name for a result card, announcing position and source. */
	function resultAriaLabel(
		source: { id: string; shortTitle: string },
		passage: { chapterRef: string | null; title: string },
		index: number,
		total: number
	): string {
		const chapter = passage.chapterRef ?? passage.title;
		// Daily Reflections leads with the date, then the source label.
		if (source.id === 'daily-reflections') {
			return `Result ${index + 1} of ${total}: ${chapter}, DR`;
		}
		return `Result ${index + 1} of ${total}: ${source.shortTitle}, ${chapter}`;
	}

	// Bounded concordance-only KWIC window for the date's indexed entry —
	// never the reflection's full text (protected source).
	const reflectionTeaserHtml = $derived(
		todaysReflection ? buildReflectionTeaser(todaysReflection.text) : ''
	);

	// Zero-result recovery (Design D5): topic suggestions + at most one
	// did-you-mean from the loaded index; empty unless there are zero results.
	const zeroResultRecovery = $derived(
		results.length === 0 && debouncedQuery
			? pickZeroResultSuggestions(TOPIC_CHIPS, debouncedQuery, getSuggestionTerms(debouncedQuery, 8))
			: { topics: [] as string[], didYouMean: null as string | null }
	);
</script>

<svelte:head>
	<title>basictexts.org | AA recovery search and step work concordance</title>
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
			<div
				class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-stone-200
				dark:border-slate-700 bg-white dark:bg-slate-900 text-xs
				text-stone-500 dark:text-slate-400 mb-5"
			>
				<span aria-hidden="true">🏛️</span>
				Free, Open-Source &amp; PWA Installable
			</div>
			<h1
				class="font-serif text-4xl sm:text-5xl font-bold text-navy dark:text-slate-100 mb-4 leading-tight"
			>
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
			role="combobox"
			aria-expanded={suggestionsOpen && suggestions.length > 0}
			aria-controls="search-suggestions"
			aria-haspopup="listbox"
			aria-autocomplete="list"
			aria-activedescendant={activeSuggestion >= 0
				? `search-suggestion-${activeSuggestion}`
				: undefined}
			bind:value={query}
			oninput={handleInput}
			onkeydown={handleKeydown}
			onblur={dismissSuggestions}
			placeholder="Search phrases, keywords (e.g., 'higher power')"
			autocomplete="off"
			autocorrect="off"
			autocapitalize="off"
			spellcheck="false"
			class="w-full rounded border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900
				   px-4 py-3.5 text-base text-[#1A1A1A] dark:text-slate-200 placeholder-stone-400
				   dark:placeholder-slate-500 shadow-sm focus-visible:outline-none
				   focus-visible:ring-2 focus-visible:ring-navy dark:focus-visible:ring-amber-400
				   transition-colors duration-200"
		/>
		{#if suggestionsOpen && suggestions.length > 0}
			<ul
				id="search-suggestions"
				role="listbox"
				aria-label="Search suggestions"
				class="absolute z-20 left-0 right-0 mt-1 max-h-72 overflow-auto rounded border
					   border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg
					   py-1 transition-colors duration-200"
			>
				{#each suggestions as suggestion, i (suggestion.term)}
					<li
						id={`search-suggestion-${i}`}
						role="option"
						aria-selected={i === activeSuggestion}
						class="px-4 py-2 text-sm cursor-pointer text-[#1A1A1A] dark:text-slate-200
							   {i === activeSuggestion
							? 'bg-navy/10 dark:bg-amber-400/20'
							: 'hover:bg-stone-100 dark:hover:bg-slate-800'}"
						onmousedown={(e) => {
							e.preventDefault();
							selectSuggestion(suggestion.term);
						}}
					>
						{suggestion.term}
						{#if suggestion.kind === 'didyoumean'}
							<span class="sr-only">(did you mean)</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<!-- ── RECENT SEARCHES (home/empty state only, local to this device) ───── -->
	{#if !debouncedQuery && recentSearches.length > 0}
		<div class="flex flex-wrap items-center gap-2 mb-4" role="group" aria-label="Recent searches">
			<span
				class="text-xs text-stone-400 dark:text-slate-500 uppercase tracking-wide font-medium mr-1 shrink-0"
			>
				Recent:
			</span>
			{#each recentSearches as recent (recent)}
				<button
					type="button"
					onclick={() => runRecentSearch(recent)}
					aria-label={`Search again for ${recent}`}
					class="px-3 py-1.5 rounded text-sm border border-stone-200 dark:border-slate-700
						   bg-white dark:bg-slate-900 text-stone-600 dark:text-slate-400
						   hover:border-navy hover:text-navy dark:hover:border-amber-400 dark:hover:text-amber-400
						   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy dark:focus-visible:ring-amber-400
						   transition-colors duration-150"
				>
					{recent}
				</button>
			{/each}
			<button
				type="button"
				onclick={clearRecentSearchesRow}
				aria-label="Clear recent searches"
				class="text-xs text-stone-400 dark:text-slate-500 hover:text-navy dark:hover:text-slate-300
					   underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy
					   dark:focus-visible:ring-amber-400 transition-colors"
			>
				Clear
			</button>
		</div>
	{/if}

	<!-- ── SHORTCUT HINT (rendered from the wired registry) ─────────────────── -->
	<p
		class="hidden sm:flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-400 dark:text-slate-500 mb-4"
	>
		{#each SHORTCUTS as shortcut (shortcut.keys)}
			<span class="inline-flex items-center gap-1">
				<kbd
					class="px-1.5 py-0.5 rounded border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-[10px]"
					>{shortcut.keys}</kbd
				>
				{shortcut.description}
			</span>
		{/each}
	</p>

	<!-- ── INDEX LOAD STATE (first-load + search) ───────────────────────────── -->
	{#if !$searchReady && !$searchError}
		<p class="text-stone-400 dark:text-slate-500 text-sm mb-4" role="status">
			{#if $searchProgress === 'fetching'}
				Loading library…
			{:else if $searchProgress === 'preparing'}
				Preparing search…
			{:else}
				Loading search index…
			{/if}
		</p>
	{/if}

	{#if $searchError}
		<div
			class="rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 mb-4"
			role="alert"
		>
			<p class="text-red-600 dark:text-red-400 text-sm mb-1">Failed to load the search index.</p>
			<p class="text-stone-500 dark:text-slate-400 text-xs mb-3">{$searchError}</p>
			<button
				type="button"
				onclick={() => retryLoad()}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-navy text-white text-xs font-medium hover:bg-navy/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy dark:focus-visible:ring-amber-400"
			>
				Retry
			</button>
		</div>
	{/if}

	<!-- ── FILTER SOURCES (always) ──────────────────────────────────────────── -->
	{#if filterableSources.length > 0}
		<div class="flex flex-wrap items-center gap-2 mb-4" role="group" aria-label="Filter by source">
			<span
				class="text-xs text-stone-400 dark:text-slate-500 uppercase tracking-wide font-medium mr-1 shrink-0"
			>
				Filter Sources:
			</span>
			{#each filterableSources as source (source.id)}
				{@const accent = resolveSourceAccent(source.color)}
				<button
					type="button"
					onclick={() => toggleSource(source.id)}
					aria-pressed={activeSourceIds.has(source.id)}
					aria-disabled={isLastActiveSource(source.id)}
					aria-describedby={isLastActiveSource(source.id) ? 'filter-last-source-note' : undefined}
					class="inline-flex items-center gap-1.5 px-3 py-1 rounded text-sm font-medium
						   border transition-colors duration-150
						   {isLastActiveSource(source.id)
						? 'border-dashed border-stone-300 dark:border-slate-600 cursor-not-allowed'
						: activeSourceIds.has(source.id)
							? 'border-transparent'
							: 'border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-stone-500 dark:text-slate-400'}"
					style={activeSourceIds.has(source.id)
						? `background-color: ${accent.fill}; color: ${accent.onFill};`
						: ''}
				>
					<span
						class="inline-block w-2 h-2 rounded-full shrink-0"
						style="background-color: {accent.fill}; box-shadow: 0 0 0 1.5px {activeSourceIds.has(
							source.id
						)
							? accent.ring
							: CHIP_SURFACE_RING};"
						aria-hidden="true"
					></span>
					{source.shortTitle}
				</button>
			{/each}
			<p id="filter-last-source-note" class="sr-only">
				The last selected source cannot be deselected. Select another source first.
			</p>
			<!-- Exact phrase mode toggle -->
			<button
				type="button"
				onclick={() => {
					phraseMode = !phraseMode;
					// Sync debouncedQuery with current input and run immediately
					if (debounceTimer) {
						clearTimeout(debounceTimer);
						debounceTimer = null;
					}
					debouncedQuery = query;
					runSearch(query);
					hints = findExceptions(query);
					syncUrl(query);
					submitLog(query);
					dismissSuggestions();
				}}
				aria-pressed={phraseMode}
				aria-label={phraseMode
					? 'Exact phrase mode on. Click to switch to word match'
					: 'Word match mode. Click to search exact phrase'}
				class="inline-flex items-center gap-1.5 px-3 py-1 rounded text-sm font-medium
					   border transition-colors duration-150 ml-auto
					   {phraseMode
					? 'border-transparent bg-navy text-white dark:bg-amber-400 dark:text-slate-900'
					: 'border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-stone-500 dark:text-slate-400'}"
			>
				Exact phrase
				<span
					aria-hidden="true"
					class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide
						   {phraseMode
						? 'bg-white/25 text-white dark:bg-slate-900/25 dark:text-slate-900'
						: 'bg-stone-100 text-stone-600 dark:bg-slate-800 dark:text-slate-400'}"
					>{phraseMode ? 'On' : 'Off'}</span
				>
			</button>
		</div>
	{/if}

	<!-- ── DISPLAY-MODE LEGEND (search surface) ─────────────────────────────── -->
	<DisplayModeLegend />

	<!-- ── HOME STATE ───────────────────────────────────────────────────────── -->
	{#if !debouncedQuery}
		<!-- Popular searches -->
		<div class="mb-8">
			<span
				class="text-xs text-stone-400 dark:text-slate-500 uppercase tracking-wide font-medium block mb-2"
			>
				Popular Recovery Searches:
			</span>
			<div class="flex flex-wrap gap-2 items-center" role="group" aria-label="Quick topic searches">
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
				<a
					href="/topics"
					class="text-sm text-navy dark:text-amber-400 hover:underline transition-colors ml-1"
				>
					Browse All A-Z ›
				</a>
			</div>
		</div>

		<!-- ── DASHBOARD GRID ──────────────────────────────────────────────── -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
			<!-- ─ Library Status ──────────────────────────────────────────────── -->
			<div
				class="bg-white dark:bg-slate-900/40 rounded shadow-sm border border-stone-200
				   dark:border-slate-800 p-4 transition-colors duration-200"
			>
				<h2
					class="text-xs uppercase tracking-widest text-stone-400 dark:text-slate-500 font-semibold mb-3"
				>
					Library Status
				</h2>
				<ul class="space-y-2" role="list">
					{#each allSources as source (source.id)}
						<li class="flex items-center justify-between gap-2">
							<div class="flex items-center gap-2 min-w-0">
								<span
									class="inline-block w-2 h-2 rounded-full shrink-0"
									style="background-color: {source.color};"
									aria-hidden="true"
								></span>
								<span class="text-sm text-[#1A1A1A] dark:text-slate-200 truncate">
									{source.shortTitle === 'Big Book'
										? 'Alcoholics Anonymous'
										: source.shortTitle === '12&12'
											? '12 Steps & 12 Trad.'
											: source.title}
								</span>
							</div>
							{#if !source.enabled}
								<span
									class="text-xs text-stone-300 dark:text-slate-600 font-medium uppercase tracking-wide shrink-0"
									>Soon</span
								>
							{:else if source.displayMode === 'full-text'}
								<span
									class="text-xs text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wide shrink-0"
									>Full-Text</span
								>
							{:else if source.displayMode === 'concordance-only'}
								<span
									class="text-xs text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wide shrink-0"
									>Concordance</span
								>
							{:else}
								<span
									class="text-xs text-stone-400 dark:text-slate-500 font-medium uppercase tracking-wide shrink-0"
									>Snippet</span
								>
							{/if}
						</li>
					{/each}
				</ul>
				<div class="mt-4 pt-3 border-t border-stone-100 dark:border-slate-800">
					<p class="text-xs leading-relaxed">
						<span class="font-semibold text-amber-700 dark:text-amber-400">Disclaimer:</span>
						<span class="text-stone-400 dark:text-slate-500 italic">
							basictexts is a free community-sourced index. Respect copyrighted material. Always
							purchase official editions.
						</span>
					</p>
				</div>
			</div>

			<!-- ─ Today's Reflection (2 cols) ────────────────────────────────── -->
			<div
				class="md:col-span-1 lg:col-span-2 bg-white dark:bg-slate-900/40 rounded shadow-sm
				   border border-stone-200 dark:border-slate-800 p-4 flex flex-col
				   transition-colors duration-200 min-h-[240px]"
			>
				{#if todaysReflection}
					<div class="flex items-center justify-between mb-3">
						<h2
							class="text-xs uppercase tracking-widest text-stone-400 dark:text-slate-500 font-semibold"
						>
							Today's Reflection
						</h2>
						<time
							datetime={todayMmDd}
							class="text-xs text-stone-400 dark:text-slate-500 font-medium tabular-nums"
						>
							{formatReflectionDate(todayMmDd)}
						</time>
					</div>
					<h3
						class="font-serif font-bold text-[#1A1A1A] dark:text-slate-100 text-lg uppercase tracking-wide mb-3"
					>
						{formatReflectionDate(todayMmDd)} · {todaysReflection.title}
					</h3>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					<p class="text-stone-600 dark:text-slate-400 text-sm italic leading-relaxed flex-1 line-clamp-5 mb-4">{@html reflectionTeaserHtml}</p>
					<div
						class="flex items-center justify-between mt-auto pt-3 border-t border-stone-100 dark:border-slate-800"
					>
						<span class="text-xs text-stone-400 dark:text-slate-500"
							>Ref: {formatReflectionDate(todayMmDd)}</span
						>
						<a
							href="/reflection"
							class="text-xs font-medium text-navy dark:text-amber-400 hover:underline transition-colors"
						>
							Read full reflection →
						</a>
					</div>
				{:else}
					<div class="flex items-center justify-between mb-3">
						<h2
							class="text-xs uppercase tracking-widest text-stone-400 dark:text-slate-500 font-semibold"
						>
							Today's Reflection
						</h2>
						<time
							datetime={todayMmDd}
							class="text-xs text-stone-400 dark:text-slate-500 font-medium tabular-nums"
						>
							{formatReflectionDate(todayMmDd)}
						</time>
					</div>
					<div class="flex-1 flex flex-col justify-center py-4">
						<p class="text-stone-400 dark:text-slate-500 text-sm italic leading-relaxed mb-5">
							Daily Reflections are available at aa.org. We link directly to the official source.
						</p>
						<a
							href="/reflection"
							class="self-start inline-flex items-center gap-2 px-4 py-2 rounded bg-navy text-white
								   text-sm font-medium hover:bg-navy/90 transition-colors"
						>
							Read today's reflection →
						</a>
					</div>
					<div class="pt-3 border-t border-stone-100 dark:border-slate-800">
						<p class="text-xs text-stone-300 dark:text-slate-600 italic">
							© Alcoholics Anonymous World Services, Inc.
						</p>
					</div>
				{/if}
			</div>

			<!-- ─ Tools & PWA ─────────────────────────────────────────────────── -->
			<div
				class="bg-white dark:bg-slate-900/40 rounded shadow-sm border border-stone-200
				   dark:border-slate-800 p-4 transition-colors duration-200"
			>
				<h2
					class="text-xs uppercase tracking-widest text-stone-400 dark:text-slate-500 font-semibold mb-3"
				>
					Tools &amp; PWA
				</h2>
				<nav aria-label="Quick links">
					<a
						href="/topics"
						class="flex items-center justify-between py-2.5 border-b border-stone-100
							   dark:border-slate-800 text-sm text-[#1A1A1A] dark:text-slate-200
							   hover:text-navy dark:hover:text-amber-400 transition-colors"
					>
						<span class="flex items-center gap-2">
							<Tag
								size={14}
								class="text-stone-400 dark:text-slate-500 shrink-0"
								aria-hidden={true}
							/>
							Browse A-Z Topics
						</span>
						<ChevronRight
							size={14}
							class="text-stone-300 dark:text-slate-600 shrink-0"
							aria-hidden={true}
						/>
					</a>
					<a
						href="/about"
						class="flex items-center justify-between py-2.5 text-sm text-[#1A1A1A]
							   dark:text-slate-200 hover:text-navy dark:hover:text-amber-400 transition-colors"
					>
						<span class="flex items-center gap-2">
							<Info
								size={14}
								class="text-stone-400 dark:text-slate-500 shrink-0"
								aria-hidden={true}
							/>
							Legal &amp; Copyright
						</span>
						<ChevronRight
							size={14}
							class="text-stone-300 dark:text-slate-600 shrink-0"
							aria-hidden={true}
						/>
					</a>
				</nav>
				<div class="mt-4 pt-3 border-t border-stone-100 dark:border-slate-800">
					<div class="flex items-center gap-2 mb-3">
						<div
							class="w-8 h-8 bg-navy rounded flex items-center justify-center shrink-0"
							aria-hidden="true"
						>
							<span class="text-white font-serif italic text-sm font-bold leading-none">bt</span>
						</div>
						<div class="min-w-0">
							<div class="text-xs font-semibold text-[#1A1A1A] dark:text-slate-200 truncate">
								basictexts PWA
							</div>
							<div class="text-xs text-stone-400 dark:text-slate-500">v1.0.0 · Offline Ready</div>
						</div>
					</div>
					{#if $canInstall}
						<button
							type="button"
							onclick={promptInstall}
							class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded
								   bg-navy text-white text-xs font-medium hover:bg-navy/90 transition-colors
								   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
						>
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
								class="inline-flex items-center gap-1 mt-2 text-amber-700 dark:text-amber-400 font-medium hover:underline text-xs"
							>
								{hint.link.label}
							</ExternalLink>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		{#if $searchReady}
			{#if results.length === 0 && debouncedQuery}
				<div class="text-center py-12 animate-fade-in">
					<p class="text-stone-500 dark:text-slate-400 mb-2">
						No results for <strong>"{debouncedQuery}"</strong>
					</p>
					<p class="text-stone-400 dark:text-slate-500 text-sm">
						{#if phraseMode}
							No passages contain the exact phrase <strong>"{debouncedQuery}"</strong>. Try turning
							off Exact phrase mode to search for individual words.
						{:else}
							Try different keywords, or check spelling. Quoted phrases require an exact match.
						{/if}
					</p>
					{#if zeroResultRecovery.didYouMean}
						{@const didYouMean = zeroResultRecovery.didYouMean}
						<p class="mt-4 text-sm text-stone-500 dark:text-slate-400">
							Did you mean
							<button
								type="button"
								onclick={() => searchTopic(didYouMean)}
								class="font-medium text-navy dark:text-amber-400 hover:underline"
								>{didYouMean}</button
							>?
						</p>
					{/if}
					{#if zeroResultRecovery.topics.length > 0}
						<div class="mt-6">
							<p
								class="text-xs uppercase tracking-wide text-stone-400 dark:text-slate-500 font-medium mb-2"
							>
								Try these searches:
							</p>
							<div
								class="flex flex-wrap justify-center gap-2"
								role="group"
								aria-label="Suggested searches"
							>
								{#each zeroResultRecovery.topics as topic (topic)}
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
						</div>
					{/if}
				</div>
			{:else if results.length > 0}
				<p
					class="text-stone-400 dark:text-slate-500 text-sm mb-6"
					aria-live="polite"
					aria-atomic="true"
				>
					{totalCount} result{totalCount === 1 ? '' : 's'} for
					<strong class="text-stone-600 dark:text-slate-300">"{debouncedQuery}"</strong>
					{#if phraseMode}
						<span
							class="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium
							bg-navy/10 text-navy dark:bg-amber-400/20 dark:text-amber-300 border border-navy/20 dark:border-amber-400/30"
						>
							exact phrase
						</span>
					{/if}
				</p>

				{#each results as group (group.source.id)}
					<section class="mb-10 animate-fade-in" aria-label="{group.source.title} results">
						<div
							class="flex items-center gap-3 mb-4 pb-2 border-b border-stone-200 dark:border-slate-800"
						>
							<span
								class="inline-block w-3 h-3 rounded-full shrink-0"
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
						<div class="space-y-3">
							{#each group.results as result, i (result.passage.id)}
								{@const pageRefLabel = formatPageRef(result.passage.pageRef)}
								{@const copyLabel = copyLabelFor(group.source.displayMode)}
								<article
									aria-label={resultAriaLabel(
										group.source,
										result.passage,
										i,
										group.results.length
									)}
									class="bg-white dark:bg-slate-900/40 rounded shadow-sm border border-stone-200
									   dark:border-slate-800 px-5 py-4 transition-colors duration-200"
								>
									{#if result.pinned}
										<p
											class="text-xs font-bold uppercase tracking-widest mb-2"
											style="color: {group.source.color};"
										>
											Quick Reference
										</p>
									{:else if result.notableLabel}
										<p
											class="text-xs font-bold uppercase tracking-widest mb-2"
											style="color: {group.source.color};"
										>
											{result.notableLabel.toUpperCase()}
										</p>
									{:else if result.matchedBySynonym}
										<p
											class="text-xs text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5"
										>
											<span aria-hidden="true">~</span> Similar result · matched via a related term
										</p>
									{/if}
									<div class="flex items-baseline gap-2 mb-2">
										<h3 class="font-serif text-xs font-bold text-stone-600 dark:text-slate-300 uppercase tracking-wide">
											{#if group.source.id === 'daily-reflections' && result.passage.chapterRef}
												{result.passage.chapterRef.toUpperCase()} · {group.source.title.toUpperCase()}
											{:else if group.source.edition?.edition}
												{group.source.shortTitle}, {group.source.edition.edition.toUpperCase()} ED.
												{#if result.passage.chapterRef}
													· {result.passage.chapterRef.toUpperCase()}
												{/if}
											{:else}
												{group.source.shortTitle.toUpperCase()}
												{#if result.passage.chapterRef}
													· {result.passage.chapterRef.toUpperCase()}
												{:else}
													· {result.passage.title.toUpperCase()}
												{/if}
											{/if}
										</h3>
										{#if pageRefLabel}
											<span
												class="text-xs font-medium text-stone-500 dark:text-slate-400 tabular-nums shrink-0"
												>{pageRefLabel}</span
											>
										{/if}
									</div>
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									<p class="text-[#1A1A1A] dark:text-slate-200 leading-relaxed text-sm">{@html result.kwic}</p>
									<div class="mt-3 flex flex-wrap items-center gap-4">
										<button
											type="button"
											class="text-xs text-stone-400 dark:text-slate-500 hover:text-navy dark:hover:text-slate-300 transition-colors"
											aria-label={confirmed?.key === `copy:${result.passage.id}`
												? confirmed.label
												: `${copyLabel} to clipboard`}
											onclick={() => copyPassage(result.citation, result.passage.id)}
										>
											{confirmed?.key === `copy:${result.passage.id}` ? confirmed.label : copyLabel}
										</button>
										<a
											href={passageHref(result.passage.sourceId, result.passage.id)}
											class="text-xs text-stone-400 dark:text-slate-500 hover:text-navy dark:hover:text-slate-300 transition-colors"
										>
											View passage
										</a>
										{#if group.source.displayMode !== 'full-text'}
											{@const officialHref = resolveSourceLink(
												group.source,
												result.passage,
												debouncedQuery
											)}
											{#if officialHref}
												<ExternalLink
													href={officialHref}
													class="text-xs font-medium text-navy dark:text-amber-400 hover:underline transition-colors"
												>
													Read at official source →
												</ExternalLink>
											{/if}
										{/if}
										<a
											href={reportHref(result.passage.sourceId, result.passage.id, debouncedQuery)}
											aria-label={`Report this passage: ${group.source.shortTitle}, ${result.passage.chapterRef ?? result.passage.title}`}
											class="text-xs text-stone-400 dark:text-slate-500 hover:text-navy dark:hover:text-slate-300 transition-colors"
										>
											Report
										</a>
										<button
											type="button"
											class="text-xs text-stone-400 dark:text-slate-500 hover:text-navy dark:hover:text-slate-300 transition-colors ml-auto"
											aria-label={confirmed?.key === `share:${result.passage.id}`
												? confirmed.label
												: 'Share passage link'}
											onclick={() => sharePassage(result.passage.sourceId, result.passage.id)}
										>
											{confirmed?.key === `share:${result.passage.id}` ? confirmed.label : 'Share'}
										</button>
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
