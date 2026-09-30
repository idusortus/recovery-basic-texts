<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { loadSearchIndex, searchReady, searchError, getPassages, derivePassageParams } from '$lib/search/index';
	import { analyzePassage } from '$lib/search/match';
	import { buildFullTextHighlight } from '$lib/search/kwic';
	import { getSourceById } from '$lib/corpus/registry';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import { ArrowLeft, ArrowRight, Copy, Share2 } from '@lucide/svelte';
	import type { Passage, Source } from '$lib/types';
	import { showToast } from '$lib/stores/toast';
	import { reportHref } from '$lib/report-link';

	// ─── Params ──────────────────────────────────────────────────────────────────

	const sourceId = $derived($page.params.sourceId);
	const passageId = $derived($page.params.passageId);

	// ─── Highlight params (persisted in the URL alone — no storage) ──────────────
	// `q` is the query and `phrase=1` marks exact-phrase mode, mirroring the home
	// page's syncUrl. Params are derived through the same query→params step search
	// uses, so the highlight cannot diverge from the search result.
	const query = $derived($page.url.searchParams.get('q') ?? '');
	const phrase = $derived($page.url.searchParams.get('phrase') === '1');
	const passageParams = $derived(derivePassageParams(query, phrase));

	/**
	 * Whole-text highlighted HTML for a passage (every occurrence marked, no
	 * clipping), or null when there is nothing to highlight — an absent/empty
	 * query, or no query term in this passage. Null falls back to plain text.
	 */
	function highlightHtml(text: string): string | null {
		if (!query) return null;
		const match = analyzePassage(text, passageParams.phraseTokens, passageParams.keywords);
		if (match.offsets.length === 0) return null;
		return buildFullTextHighlight(text, match.offsets);
	}

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

	// Highlighted occurrences currently rendered, in document order, and the
	// index of the active one. The initial index is the first mark inside the
	// target passage (the occurrence the entry scroll centers).
	let matches: HTMLElement[] = [];
	let matchCount = $state(0);
	let matchIndex = $state(0);

	// In-place Copy/Share confirmation (Design D1) — independent of the toast.
	let passageConfirmed = $state<{ key: string; label: string } | null>(null);
	let passageConfirmTimer: ReturnType<typeof setTimeout> | null = null;

	function confirmPassageInPlace(key: string, label: string) {
		passageConfirmed = { key, label };
		if (passageConfirmTimer) clearTimeout(passageConfirmTimer);
		passageConfirmTimer = setTimeout(() => {
			passageConfirmed = null;
		}, 2500);
	}

	// ─── Load ────────────────────────────────────────────────────────────────────

	onMount(async () => {
		await loadSearchIndex();
	});

	// Reactively load passage when index is ready and params change
	$effect(() => {
		if (!$searchReady) return;
		if (sourceId && passageId) loadPassage(sourceId, passageId);
	});

	// SvelteKit resets the scroll position during client-side navigation *after*
	// rendering but *before* navigation-complete callbacks run
	// (`client.js:1999-2014` then `:2042`), so a render-time effect alone is too
	// early: our scroll is overwritten and the page stays at the top. Re-apply
	// here, after that reset, so search → passage clicks land on the highlight.
	afterNavigate(async () => {
		await tick();
		applyQueryFocusAndScroll();
	});

	async function loadPassage(sid: string, pid: string) {
		// Read the highlight params synchronously, before any `await`, so the
		// driving $effect tracks them: a back/forward that changes only the query
		// (or phrase) for the same passage must re-apply focus/scroll. Reads after
		// an `await` are not tracked by the effect.
		void passageParams;

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

			// Scroll to the target passage after render. The actual focus/scroll is
			// shared with the `afterNavigate` hook (see above) so the full-load and
			// client-navigation entry paths behave identically.
			await tick();
			applyQueryFocusAndScroll();
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

	/**
	 * Land the view on the current target passage. With a query whose terms occur
	 * in that passage, move focus to the passage and scroll its first highlight
	 * into view immediately (no smooth animation, so it cannot race the focus).
	 * Without a query — or when the query has no occurrence in the target passage
	 * — keep the smooth scroll to the ringed passage. Idempotent, and a safe no-op
	 * before the target has rendered (e.g. while the index is still loading).
	 */
	function applyQueryFocusAndScroll() {
		collectMatches();
		const el = document.getElementById(`passage-${passageId}`);
		if (!el) return;
		const mark = el.querySelector('mark');
		if (mark) {
			el.focus({ preventScroll: true });
			// Center the first highlight in the viewport. A top-aligned scroll
			// (block: 'start') leaves the mark's upper half under the app's sticky
			// header (`Nav.svelte` — `sticky top-0 z-40`, ~56px), so only the bottom
			// half is visible; centering clears the header and lands the user on the
			// term they searched for.
			mark.scrollIntoView({ block: 'center' });
		} else {
			el.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	/** Collect the rendered highlights and seed the current match from the target passage. */
	function collectMatches() {
		const root = document.querySelector('main');
		if (!root) {
			matches = [];
			matchCount = 0;
			matchIndex = 0;
			return;
		}
		matches = Array.from(root.querySelectorAll<HTMLElement>('mark'));
		matchCount = matches.length;
		const target = document.getElementById(`passage-${passageId}`);
		const firstInTarget = target ? matches.findIndex((mark) => target.contains(mark)) : -1;
		matchIndex = firstInTarget >= 0 ? firstInTarget : 0;
	}

	/** Move the current match by `delta`, clamping at the ends. */
	function goToMatch(delta: number) {
		if (matches.length < 2) return;
		const next = Math.min(Math.max(matchIndex + delta, 0), matches.length - 1);
		if (next === matchIndex) return;
		matchIndex = next;
		matches[next].scrollIntoView({ block: 'center' });
	}

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
			confirmPassageInPlace('copy', 'Copied ✓');
		} catch {
			showToast('Could not copy — please select and copy manually.', 'warning');
		}
	}

	async function sharePassage() {
		const url = window.location.href;
		try {
			if (navigator.share) {
				await navigator.share({ url, title: 'basictexts.org' });
				confirmPassageInPlace('share', 'Shared ✓');
			} else {
				await navigator.clipboard.writeText(url);
				showToast('Link copied to clipboard.', 'info', 2500);
				confirmPassageInPlace('share', 'Link copied');
			}
		} catch (err) {
			// AbortError is the user dismissing the native share sheet; anything
			// else is a real failure and must be surfaced, never shown as success.
			if (err instanceof Error && err.name === 'AbortError') return;
			showToast('Could not share — please copy the address manually.', 'warning');
		}
	}

	onDestroy(() => {
		if (passageConfirmTimer) clearTimeout(passageConfirmTimer);
	});
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
							{@const html = highlightHtml(cp.text)}
							<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
							<p
								id="passage-{cp.id}"
								tabindex={cp.id === passageId ? -1 : undefined}
								class="text-[#1A1A1A] dark:text-slate-200 leading-relaxed mb-4 last:mb-0
									   focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-navy
									   dark:focus:outline-amber-400
									   {cp.id === passageId ? 'scroll-mt-4 ring-1 ring-stone-300 dark:ring-slate-600 rounded px-2 -mx-2' : ''}"
							>
								{#if html}
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									{@html html}
								{:else}
									{cp.text}
								{/if}
							</p>
						{/each}
					{:else}
						{@const html = highlightHtml(passage.text)}
						<p class="text-[#1A1A1A] dark:text-slate-200 leading-relaxed">
							{#if html}
								<!-- eslint-disable-next-line svelte/no-at-html-tags -->
								{@html html}
							{:else}
								{passage.text}
							{/if}
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
				<div class="flex items-center gap-4 mb-4">
					<button
						type="button"
						onclick={copyPassage}
						class="inline-flex items-center gap-1.5 text-sm text-stone-400 dark:text-slate-500
							   hover:text-navy dark:hover:text-slate-300 transition-colors"
					>
						<Copy size={14} aria-hidden={true} />
						{passageConfirmed?.key === 'copy'
							? passageConfirmed.label
							: chapterPassages.length > 0
								? 'Copy chapter'
								: 'Copy passage'}
					</button>
					<button
						type="button"
						onclick={sharePassage}
						class="inline-flex items-center gap-1.5 text-sm text-stone-400 dark:text-slate-500
							   hover:text-navy dark:hover:text-slate-300 transition-colors"
					>
						<Share2 size={14} aria-hidden={true} />
						{passageConfirmed?.key === 'share' ? passageConfirmed.label : 'Share'}
					</button>
				</div>
			{/if}

			<!-- Report this passage (prefills the anonymous feedback form) -->
			<div class="mb-8">
				<a
					href={reportHref(sourceId ?? '', passageId ?? '', query)}
					class="inline-flex items-center gap-1.5 text-xs text-stone-400 dark:text-slate-500
						   hover:text-navy dark:hover:text-slate-300 transition-colors"
				>
					Report this passage
				</a>
			</div>

			<!-- Match navigation (highlighted occurrences only) -->
			{#if matchCount >= 2}
				<div class="flex items-center gap-3 mb-8" role="group" aria-label="Match navigation">
					<button
						type="button"
						onclick={() => goToMatch(-1)}
						disabled={matchIndex === 0}
						class="inline-flex items-center gap-1.5 text-sm text-stone-400 dark:text-slate-500
							   hover:text-navy dark:hover:text-slate-300 transition-colors
							   disabled:opacity-40 disabled:cursor-not-allowed"
					>
						<ArrowLeft size={14} aria-hidden={true} />
						Previous match
					</button>
					<span
						class="text-xs text-stone-400 dark:text-slate-500 tabular-nums"
						aria-live="polite"
						aria-atomic="true"
					>
						Match {matchIndex + 1} of {matchCount}
					</span>
					<button
						type="button"
						onclick={() => goToMatch(1)}
						disabled={matchIndex === matchCount - 1}
						class="inline-flex items-center gap-1.5 text-sm text-stone-400 dark:text-slate-500
							   hover:text-navy dark:hover:text-slate-300 transition-colors
							   disabled:opacity-40 disabled:cursor-not-allowed"
					>
						Next match
						<ArrowRight size={14} aria-hidden={true} />
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
