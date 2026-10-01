<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { loadSearchIndex, searchReady, searchError, getPassages, derivePassageParams } from '$lib/search/index';
	import { analyzePassage } from '$lib/search/match';
	import { buildFullTextHighlight } from '$lib/search/kwic';
	import { getSourceById } from '$lib/corpus/registry';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import { ArrowLeft, ArrowRight, Copy, Share2, Volume2 } from '@lucide/svelte';
	import type { Passage, Source } from '$lib/types';
	import { showToast } from '$lib/stores/toast';
	import { reportHref } from '$lib/report-link';
	import {
		READER_PREFS_KEY,
		FONT_SIZE_STEPS,
		DEFAULT_READER_PREFS,
		stepFontSize,
		fontSizeRem,
		lineHeightValue,
		parseReaderPrefs,
		serializeReaderPrefs,
		type FontSizeStep,
		type ReaderPrefs
	} from '$lib/passage/reader-prefs';
	import { isTtsSupported, canOfferListen, buildSpeechText, splitSpeechChunks } from '$lib/passage/tts';

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

	// ─── Reader display preferences (namespaced localStorage) ───────────────────
	// Separate from the URL-only highlight/focus state; display comfort only.
	let readerPrefs = $state<ReaderPrefs>({ ...DEFAULT_READER_PREFS });
	let prefsOpen = $state(false);

	// ─── Listen (speech synthesis) ──────────────────────────────────────────────
	// Support is detected client-side on mount; no control renders when absent.
	let ttsSupported = $state(false);
	let speechState = $state<'stopped' | 'playing' | 'paused'>('stopped');
	let speechUtterances: SpeechSynthesisUtterance[] = [];

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

	// ─── Reader preferences ──────────────────────────────────────────────────────

	const FONT_SIZE_LABELS: Record<FontSizeStep, string> = {
		default: 'Default',
		large: 'Large',
		larger: 'Larger',
		largest: 'Largest'
	};

	// Resolved to null at the default step, so no inline style is applied and the
	// browser/user text size and the page's own leading-relaxed are untouched.
	const resolvedFontSize = $derived(fontSizeRem(readerPrefs.fontSize));
	const resolvedLineHeight = $derived(lineHeightValue(readerPrefs.lineSpacing));
	const bodyStyle = $derived(
		[
			resolvedFontSize ? `font-size: ${resolvedFontSize}` : '',
			resolvedLineHeight !== null ? `line-height: ${resolvedLineHeight}` : ''
		]
			.filter(Boolean)
			.join('; ')
	);
	const stepLabel = $derived(
		`Text size: ${FONT_SIZE_LABELS[readerPrefs.fontSize]}; line spacing: ${
			readerPrefs.lineSpacing === 'relaxed' ? 'relaxed' : 'normal'
		}`
	);

	function readStoredReaderPrefs(): ReaderPrefs {
		try {
			return parseReaderPrefs(window.localStorage.getItem(READER_PREFS_KEY));
		} catch {
			return { ...DEFAULT_READER_PREFS };
		}
	}

	function writeReaderPrefs(prefs: ReaderPrefs) {
		try {
			window.localStorage.setItem(READER_PREFS_KEY, serializeReaderPrefs(prefs));
		} catch {
			// Storage unavailable (private mode/disabled) — the pref still applies
			// for this session; the write is a no-op.
		}
	}

	function setReaderPrefs(next: ReaderPrefs) {
		readerPrefs = next;
		writeReaderPrefs(next);
	}

	function decreaseFontSize() {
		if (readerPrefs.fontSize === FONT_SIZE_STEPS[0]) return;
		setReaderPrefs({ ...readerPrefs, fontSize: stepFontSize(readerPrefs.fontSize, -1) });
	}

	function increaseFontSize() {
		if (readerPrefs.fontSize === FONT_SIZE_STEPS.at(-1)) return;
		setReaderPrefs({ ...readerPrefs, fontSize: stepFontSize(readerPrefs.fontSize, 1) });
	}

	function toggleLineSpacing() {
		setReaderPrefs({
			...readerPrefs,
			lineSpacing: readerPrefs.lineSpacing === 'relaxed' ? 'normal' : 'relaxed'
		});
	}

	// ─── Listen (text-to-speech) ─────────────────────────────────────────────────

	const speechStatus = $derived(
		speechState === 'playing' ? 'Listening' : speechState === 'paused' ? 'Paused' : 'Stopped'
	);

	/**
	 * The text to read aloud, assembled only from what the `full-text` branch
	 * renders. Guarded by `displayMode` explicitly — `chapterPassages` is
	 * populated by `copyright`, not `displayMode`.
	 */
	function speechText(): string {
		if (!source || source.displayMode !== 'full-text') return '';
		if (chapterPassages.length > 0) return buildSpeechText(chapterPassages.map((p) => p.text));
		if (passage) return buildSpeechText([passage.text]);
		return '';
	}

	/** Cancel any in-flight speech and reset the control. Idempotent. */
	function stopSpeech() {
		if (typeof window !== 'undefined' && window.speechSynthesis) {
			window.speechSynthesis.cancel();
		}
		speechUtterances = [];
		speechState = 'stopped';
	}

	function startListening() {
		if (!canOfferListen(source?.displayMode ?? '', ttsSupported)) return;
		if (typeof window === 'undefined' || !window.speechSynthesis) return;
		stopSpeech();
		const text = speechText();
		if (!text) return;
		const chunks = splitSpeechChunks(text);
		speechUtterances = chunks.map((chunk, index) => {
			const utterance = new SpeechSynthesisUtterance(chunk);
			utterance.onend = () => {
				if (index === chunks.length - 1) {
					speechUtterances = [];
					speechState = 'stopped';
				}
			};
			// A mid-queue engine error means the final `onend` may never fire, so
			// reset through the same cancel/clear path as a terminal `onend`.
			utterance.onerror = () => {
				stopSpeech();
			};
			return utterance;
		});
		speechState = 'playing';
		for (const utterance of speechUtterances) window.speechSynthesis.speak(utterance);
	}

	function pauseListening() {
		if (speechState !== 'playing') return;
		if (!ttsSupported || typeof window === 'undefined' || !window.speechSynthesis) return;
		window.speechSynthesis.pause();
		speechState = 'paused';
	}

	function resumeListening() {
		if (speechState !== 'paused') return;
		if (!ttsSupported || typeof window === 'undefined' || !window.speechSynthesis) return;
		window.speechSynthesis.resume();
		speechState = 'playing';
	}

	function toggleListening() {
		if (speechState === 'playing') pauseListening();
		else if (speechState === 'paused') resumeListening();
		else startListening();
	}

	// ─── Load ────────────────────────────────────────────────────────────────────

	onMount(async () => {
		readerPrefs = readStoredReaderPrefs();
		ttsSupported = isTtsSupported(window);
		await loadSearchIndex();
	});

	// Reactively load passage when index is ready and params change. Also stop any
	// speech here: same-route chapter/passage navigation changes only the params,
	// so `onDestroy` does NOT fire and speech would otherwise read into the next
	// passage.
	$effect(() => {
		if (!$searchReady) return;
		if (sourceId && passageId) {
			stopSpeech();
			loadPassage(sourceId, passageId);
		}
	});

	// SvelteKit resets the scroll position during client-side navigation *after*
	// rendering but *before* navigation-complete callbacks run
	// (`client.js:1999-2014` then `:2042`), so a render-time effect alone is too
	// early: our scroll is overwritten and the page stays at the top. Re-apply
	// here, after that reset, so search → passage clicks land on the highlight.
	afterNavigate(async () => {
		stopSpeech();
		await tick();
		applyQueryFocusAndScroll();
	});

	async function loadPassage(sid: string, pid: string) {
		// Read the highlight params synchronously, before any `await`, so the
		// driving $effect tracks them: a back/forward that changes only the query
		// (or phrase) for the same passage must re-apply focus/scroll. Reads after
		// an `await` are not tracked by the effect.
		void passageParams;

		stopSpeech();

		const passages = getPassages();
		if (!passages) { notFound = true; return; }

		const p = passages[pid] as Passage | undefined;
		if (!p || p.sourceId !== sid) { notFound = true; return; }

		passage = p;
		// Keep the looked-up source in a local for the rest of the load: reading
		// the `source` `$state` back inside the load `$effect` would add it as a
		// dependency of the effect (see the chapter-local note below).
		const src = getSourceById(sid) ?? null;
		source = src;
		notFound = false;

		if (!src) return;

		if (src.copyright === 'public-domain') {
			// Chapter-level view: collect all passages in the same chapter
			const allSource = Object.values(passages)
				.filter((q): q is Passage => (q as Passage).sourceId === sid)
				.sort((a, b) => a.sequence - b.sequence);

			// Read the chapter from this local, never back from `chapterPassages`:
			// this runs inside the load `$effect`, so reading the `$state` after
			// writing it would make the effect depend on its own output and loop
			// (`effect_update_depth_exceeded`).
			const chapter = allSource.filter((q) => q.chapterRef === p.chapterRef);
			chapterPassages = chapter;

			// Find the first passage of the previous chapter
			const firstInChapter = chapter[0];
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
			const lastInChapter = chapter.at(-1)!;
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
		// Last-resort cleanup for a true unmount (leaving the route entirely);
		// same-route navigation is handled by the param-change stops above.
		stopSpeech();
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
								style={bodyStyle || undefined}
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
						<p
							class="text-[#1A1A1A] dark:text-slate-200 leading-relaxed"
							style={bodyStyle || undefined}
						>
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

			<!-- Reading settings + Listen (full-text sources only) -->
			{#if source.displayMode === 'full-text'}
				<div class="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
					<!-- "Aa" reading-settings disclosure -->
					<button
						type="button"
						aria-expanded={prefsOpen}
						aria-controls="reading-settings"
						onclick={() => (prefsOpen = !prefsOpen)}
						class="inline-flex items-center gap-1.5 text-sm text-stone-400 dark:text-slate-500
							   hover:text-navy dark:hover:text-slate-300 transition-colors"
					>
						<span aria-hidden="true" class="font-serif">Aa</span>
						<span class="sr-only">Reading settings</span>
					</button>

					{#if prefsOpen}
						<div
							id="reading-settings"
							role="group"
							aria-label="Reading settings"
							class="flex flex-wrap items-center gap-3"
						>
							<button
								type="button"
								aria-label="Decrease text size"
								aria-disabled={readerPrefs.fontSize === FONT_SIZE_STEPS[0]}
								onclick={decreaseFontSize}
								class="inline-flex items-center gap-1 text-sm text-stone-500 dark:text-slate-400
									   hover:text-navy dark:hover:text-slate-200 transition-colors
									   {readerPrefs.fontSize === FONT_SIZE_STEPS[0] ? 'opacity-40' : ''}"
							>
								<span aria-hidden="true">A−</span>
							</button>
							<button
								type="button"
								aria-label="Increase text size"
								aria-disabled={readerPrefs.fontSize === FONT_SIZE_STEPS.at(-1)}
								onclick={increaseFontSize}
								class="inline-flex items-center gap-1 text-sm text-stone-500 dark:text-slate-400
									   hover:text-navy dark:hover:text-slate-200 transition-colors
									   {readerPrefs.fontSize === FONT_SIZE_STEPS.at(-1) ? 'opacity-40' : ''}"
							>
								<span aria-hidden="true">A+</span>
							</button>
							<button
								type="button"
								aria-pressed={readerPrefs.lineSpacing === 'relaxed'}
								onclick={toggleLineSpacing}
								class="inline-flex items-center gap-1 text-sm text-stone-500 dark:text-slate-400
									   hover:text-navy dark:hover:text-slate-200 transition-colors
									   {readerPrefs.lineSpacing === 'relaxed' ? 'font-medium text-navy dark:text-amber-400' : ''}"
							>
								Line spacing
							</button>
							<span class="sr-only" aria-live="polite" aria-atomic="true">{stepLabel}</span>
						</div>
					{/if}

					{#if canOfferListen(source.displayMode, ttsSupported)}
						<button
							type="button"
							onclick={toggleListening}
							aria-pressed={speechState === 'playing'}
							class="inline-flex items-center gap-1.5 text-sm text-stone-400 dark:text-slate-500
								   hover:text-navy dark:hover:text-slate-300 transition-colors"
						>
							<Volume2 size={14} aria-hidden={true} />
							{speechState === 'playing' ? 'Pause' : speechState === 'paused' ? 'Resume' : 'Listen'}
						</button>
						{#if speechState !== 'stopped'}
							<button
								type="button"
								onclick={stopSpeech}
								class="inline-flex items-center gap-1.5 text-sm text-stone-400 dark:text-slate-500
									   hover:text-navy dark:hover:text-slate-300 transition-colors"
							>
								Stop
							</button>
						{/if}
						<span class="sr-only" aria-live="polite" aria-atomic="true">{speechStatus}</span>
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
