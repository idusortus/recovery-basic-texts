<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { loadSearchIndex, searchReady, searchError, getPassages } from '$lib/search/index';
	import { getSourceById } from '$lib/corpus/registry';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import { ArrowLeft, ArrowRight, Copy, Share2 } from 'lucide-svelte';
	import type { Passage, Source } from '$lib/types';
	import { showToast } from '$lib/stores/toast';

	// ─── Params ──────────────────────────────────────────────────────────────────

	const sourceId = $derived($page.params.sourceId);
	const passageId = $derived($page.params.passageId);

	// ─── State ───────────────────────────────────────────────────────────────────

	let passage = $state<Passage | null>(null);
	let source = $state<Source | null>(null);
	let prevPassage = $state<Passage | null>(null);
	let nextPassage = $state<Passage | null>(null);
	let notFound = $state(false);

	// ─── Load ────────────────────────────────────────────────────────────────────

	onMount(async () => {
		await loadSearchIndex();
	});

	// Reactively load passage when index is ready and params change
	$effect(() => {
		if (!$searchReady) return;
		if (sourceId && passageId) loadPassage(sourceId, passageId);
	});

	async function loadPassage(sid: string, pid: string) {
		const passages = getPassages();
		if (!passages) { notFound = true; return; }

		const p = passages[pid] as Passage | undefined;
		if (!p || p.sourceId !== sid) { notFound = true; return; }

		passage = p;
		source = getSourceById(sid) ?? null;
		notFound = false;

		// Find adjacent passages in same source by sequence
		const sourcePassages = Object.values(passages)
			.filter((q): q is Passage => (q as Passage).sourceId === sid)
			.sort((a, b) => (a as Passage).sequence - (b as Passage).sequence);

		const idx = sourcePassages.findIndex((q) => q.id === pid);
		prevPassage = idx > 0 ? sourcePassages[idx - 1] : null;
		nextPassage = idx < sourcePassages.length - 1 ? sourcePassages[idx + 1] : null;
	}

	// ─── Actions ─────────────────────────────────────────────────────────────────

	async function copyPassage() {
		if (!passage || !source) return;
		const parts = [source.title];
		if (passage.chapterRef) parts.push(passage.chapterRef);
		if (passage.pageRef) parts.push(`p.${passage.pageRef.replace(/^p\.?/, '')}`);
		const citation = `${passage.text}\n\n— ${parts.join(', ')}`;
		try {
			await navigator.clipboard.writeText(citation);
			showToast('Passage copied to clipboard.', 'info', 2500);
		} catch {
			showToast('Could not copy — please select and copy manually.', 'warning');
		}
	}

	async function sharePassage() {
		const url = window.location.href;
		try {
			if (navigator.share) {
				await navigator.share({ url, title: 'basictexts.org' });
			} else {
				await navigator.clipboard.writeText(url);
				showToast('Link copied to clipboard.', 'info', 2500);
			}
		} catch {
			// User cancelled
		}
	}
</script>

<svelte:head>
	<title>
		{passage ? `${passage.title} — basictexts.org` : 'Passage — basictexts.org'}
	</title>
</svelte:head>

<main class="max-w-4xl mx-auto px-4 py-8">

	<!-- Back link -->
	<a
		href="/"
		class="inline-flex items-center gap-1.5 text-sm text-stone-400 dark:text-slate-500
			   hover:text-navy dark:hover:text-slate-300 mb-6 transition-colors"
	>
		<ArrowLeft size={14} aria-hidden={true} />
		Back to search
	</a>

	{#if !$searchReady && !$searchError}
		<p class="text-stone-400 dark:text-slate-500 text-sm text-center py-8">
			Loading…
		</p>
	{:else if $searchError}
		<p class="text-red-600 dark:text-red-400 text-sm text-center py-8">
			Failed to load: {$searchError}
		</p>
	{:else if notFound}
		<div class="text-center py-12">
			<p class="text-stone-500 dark:text-slate-400 mb-2">Passage not found.</p>
			<a href="/" class="text-sm text-navy dark:text-amber-400 hover:underline">
				Return to search
			</a>
		</div>
	{:else if passage && source}
		<article class="animate-fade-in">
			<!-- Source badge + chapter -->
			<div class="flex items-center gap-2 mb-4">
				<span
					class="inline-block w-3 h-3 rounded-full flex-shrink-0"
					style="background-color: {source.color};"
					aria-hidden="true"
				></span>
				<span class="text-sm font-medium text-stone-500 dark:text-slate-400">
					{source.shortTitle}
				</span>
				{#if passage.chapterRef}
					<span class="text-stone-300 dark:text-slate-600" aria-hidden="true">·</span>
					<span class="font-serif text-sm text-stone-400 dark:text-slate-500">
						{passage.chapterRef}
					</span>
				{/if}
				{#if passage.pageRef}
					<span class="text-stone-300 dark:text-slate-600" aria-hidden="true">·</span>
					<span class="text-xs text-stone-400 dark:text-slate-500">
						p.{passage.pageRef.replace(/^p\.?/, '')}
					</span>
				{/if}
			</div>

			<!-- Passage text -->
			{#if source.displayMode === 'full-text'}
				<div
					class="bg-white dark:bg-slate-900/40 rounded shadow-sm border border-stone-200
						   dark:border-slate-800 px-6 py-6 mb-6"
				>
					<p class="text-[#1A1A1A] dark:text-slate-200 leading-relaxed">
						{passage.text}
					</p>
				</div>
			{:else}
				<!-- Protected source: concordance only -->
				<div
					class="bg-white dark:bg-slate-900/40 rounded shadow-sm border border-stone-200
						   dark:border-slate-800 px-6 py-6 mb-6"
				>
					<p class="text-stone-500 dark:text-slate-400 text-sm leading-relaxed italic mb-4">
						Full text not available — {source.title} is a copyright-protected work.
					</p>
					{#if source.officialUrl}
						<ExternalLink
							href={source.officialUrl}
							class="text-sm font-medium text-navy dark:text-amber-400 hover:underline"
						>
							Read at official source →
						</ExternalLink>
					{/if}
				</div>
			{/if}

			<!-- Actions -->
			{#if source.displayMode === 'full-text'}
				<div class="flex items-center gap-4 mb-8">
					<button
						type="button"
						onclick={copyPassage}
						class="inline-flex items-center gap-1.5 text-sm text-stone-400 dark:text-slate-500
							   hover:text-navy dark:hover:text-slate-300 transition-colors"
					>
						<Copy size={14} aria-hidden={true} />
						Copy passage
					</button>
					<button
						type="button"
						onclick={sharePassage}
						class="inline-flex items-center gap-1.5 text-sm text-stone-400 dark:text-slate-500
							   hover:text-navy dark:hover:text-slate-300 transition-colors"
					>
						<Share2 size={14} aria-hidden={true} />
						Share
					</button>
				</div>
			{/if}

			<!-- Adjacent passage navigation -->
			<nav class="flex items-center justify-between gap-4" aria-label="Adjacent passages">
				{#if prevPassage}
					<a
						href="/passage/{prevPassage.sourceId}/{prevPassage.id}"
						class="inline-flex items-center gap-1.5 text-sm text-stone-400 dark:text-slate-500
							   hover:text-navy dark:hover:text-slate-300 transition-colors"
					>
						<ArrowLeft size={14} aria-hidden={true} />
						<span class="truncate max-w-[180px]">
							{prevPassage.chapterRef ?? prevPassage.title}
						</span>
					</a>
				{:else}
					<div></div>
				{/if}

				{#if nextPassage}
					<a
						href="/passage/{nextPassage.sourceId}/{nextPassage.id}"
						class="inline-flex items-center gap-1.5 text-sm text-stone-400 dark:text-slate-500
							   hover:text-navy dark:hover:text-slate-300 transition-colors text-right"
					>
						<span class="truncate max-w-[180px]">
							{nextPassage.chapterRef ?? nextPassage.title}
						</span>
						<ArrowRight size={14} aria-hidden={true} />
					</a>
				{:else}
					<div></div>
				{/if}
			</nav>
		</article>
	{/if}
</main>
