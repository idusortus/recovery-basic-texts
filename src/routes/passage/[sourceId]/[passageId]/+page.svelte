<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/stores';
	import { loadSearchIndex, searchReady, searchError, getPassages } from '$lib/search/index';
	import { getSourceById } from '$lib/corpus/registry';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import { ArrowLeft, ArrowRight, Copy, Share2 } from '@lucide/svelte';
	import type { Passage, Source } from '$lib/types';
	import { showToast } from '$lib/stores/toast';

	// ─── Params ──────────────────────────────────────────────────────────────────

	const sourceId = $derived($page.params.sourceId);
	const passageId = $derived($page.params.passageId);

	// ─── State ───────────────────────────────────────────────────────────────────

	let passage = $state<Passage | null>(null);
	let source = $state<Source | null>(null);
	/** All passages in the same chapter (public-domain sources only). */
	let chapterPassages = $state<Passage[]>([]);
	/** First passage of the previous chapter (for chapter-level nav). */
	let prevChapterPassage = $state<Passage | null>(null);
	/** First passage of the next chapter (for chapter-level nav). */
	let nextChapterPassage = $state<Passage | null>(null);
	/** Prev/next single-passage nav (used for non-public-domain sources). */
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

		const src = source;
		if (!src) return;

		if (src.copyright === 'public-domain') {
			// Chapter-level view: collect all passages in the same chapter
			const allSource = Object.values(passages)
				.filter((q): q is Passage => (q as Passage).sourceId === sid)
				.sort((a, b) => a.sequence - b.sequence);

			chapterPassages = allSource.filter((q) => q.chapterRef === p.chapterRef);

			// Find the first passage of the previous chapter
			const firstInChapter = chapterPassages[0];
			const prevCandidate = allSource
				.filter((q) => q.chapterRef !== p.chapterRef && q.sequence < firstInChapter.sequence)
				.at(-1);
			if (prevCandidate) {
				// Walk back to find the first passage of prevCandidate's chapter
				prevChapterPassage = allSource.find((q) => q.chapterRef === prevCandidate.chapterRef) ?? null;
			} else {
				prevChapterPassage = null;
			}

			// Find the first passage of the next chapter
			const lastInChapter = chapterPassages.at(-1)!;
			const nextCandidate = allSource.find(
				(q) => q.chapterRef !== p.chapterRef && q.sequence > lastInChapter.sequence
			);
			nextChapterPassage = nextCandidate ?? null;

			prevPassage = null;
			nextPassage = null;

			// Scroll to the target passage after render
			await tick();
			const el = document.getElementById(`passage-${pid}`);
			if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
		} else {
			// Single-passage view for protected/unknown sources
			chapterPassages = [];
			prevChapterPassage = null;
			nextChapterPassage = null;

			const sourcePassages = Object.values(passages)
				.filter((q): q is Passage => (q as Passage).sourceId === sid)
				.sort((a, b) => a.sequence - b.sequence);

			const idx = sourcePassages.findIndex((q) => q.id === pid);
			prevPassage = idx > 0 ? sourcePassages[idx - 1] : null;
			nextPassage = idx < sourcePassages.length - 1 ? sourcePassages[idx + 1] : null;
		}
	}

	// ─── Helpers ──────────────────────────────────────────────────────────────────

	/** Format the citation header: "SOURCE, Xth ED. — CHAPTER NAME" (all uppercase). */
	function formatCitationHeader(src: Source, p: Passage): string {
		const sourceLabel = src.edition?.edition
			? `${src.shortTitle.toUpperCase()}, ${src.edition.edition.toUpperCase()} ED.`
			: src.shortTitle.toUpperCase();
		const chapterLabel = (p.chapterRef ?? p.title).toUpperCase();
		return `${sourceLabel} — ${chapterLabel}`;
	}

	// ─── Actions ─────────────────────────────────────────────────────────────────

	async function copyPassage() {
		if (!passage || !source) return;
		const textToCopy = chapterPassages.length > 0
			? chapterPassages.map((cp) => cp.text).join('\n\n')
			: passage.text;
		const parts = [source.title];
		if (passage.chapterRef) parts.push(passage.chapterRef);
		const citation = `${textToCopy}\n\n— ${parts.join(', ')}`;
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
			<!-- Citation header: SOURCE, Xth ED. — CHAPTER NAME -->
			<div class="flex items-center gap-2 mb-4">
				<span
					class="inline-block w-3 h-3 rounded-full flex-shrink-0"
					style="background-color: {source.color};"
					aria-hidden="true"
				></span>
				<p class="font-serif text-xs font-bold text-stone-600 dark:text-slate-300 uppercase tracking-wide">
					{formatCitationHeader(source, passage)}
				</p>
			</div>

			<!-- Passage text -->
			{#if source.displayMode === 'full-text'}
				<div
					class="bg-white dark:bg-slate-900/40 rounded shadow-sm border border-stone-200
						   dark:border-slate-800 px-6 py-6 mb-6"
				>
					{#if chapterPassages.length > 0}
						<!-- Public-domain chapter view: render all paragraphs -->
						{#each chapterPassages as cp (cp.id)}
							<p
								id="passage-{cp.id}"
								class="text-[#1A1A1A] dark:text-slate-200 leading-relaxed mb-4 last:mb-0
									   {cp.id === passageId ? 'scroll-mt-4 ring-1 ring-stone-300 dark:ring-slate-600 rounded px-2 -mx-2' : ''}"
							>
								{cp.text}
							</p>
						{/each}
					{:else}
						<p class="text-[#1A1A1A] dark:text-slate-200 leading-relaxed">
							{passage.text}
						</p>
					{/if}
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
						{chapterPassages.length > 0 ? 'Copy chapter' : 'Copy passage'}
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

			<!-- Navigation -->
			{#if chapterPassages.length > 0}
				<!-- Chapter-level navigation for public-domain sources -->
				<nav class="flex items-center justify-between gap-4" aria-label="Chapter navigation">
					{#if prevChapterPassage}
						<a
							href="/passage/{prevChapterPassage.sourceId}/{prevChapterPassage.id}"
							class="inline-flex items-center gap-1.5 text-sm text-stone-400 dark:text-slate-500
								   hover:text-navy dark:hover:text-slate-300 transition-colors"
						>
							<ArrowLeft size={14} aria-hidden={true} />
							<span class="truncate max-w-[180px]">
								{prevChapterPassage.chapterRef ?? prevChapterPassage.title}
							</span>
						</a>
					{:else}
						<div></div>
					{/if}

					{#if nextChapterPassage}
						<a
							href="/passage/{nextChapterPassage.sourceId}/{nextChapterPassage.id}"
							class="inline-flex items-center gap-1.5 text-sm text-stone-400 dark:text-slate-500
								   hover:text-navy dark:hover:text-slate-300 transition-colors text-right"
						>
							<span class="truncate max-w-[180px]">
								{nextChapterPassage.chapterRef ?? nextChapterPassage.title}
							</span>
							<ArrowRight size={14} aria-hidden={true} />
						</a>
					{:else}
						<div></div>
					{/if}
				</nav>
			{:else}
				<!-- Passage-level navigation for protected sources -->
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
			{/if}
		</article>
	{/if}
</main>
