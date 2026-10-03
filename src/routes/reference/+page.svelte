<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import { loadSearchIndex, searchReady, searchError, getPassages } from '$lib/search/index';
	import { getSourceById } from '$lib/corpus/registry';
	import type { Passage, Source } from '$lib/types';
	import { resolveSourceAccent } from '$lib/corpus/source-accent';
	import { Volume2 } from '@lucide/svelte';
	import {
		REFERENCE_VIEWS,
		resolveReferenceView
	} from '$lib/reference/views';
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

	// ─── View selection (addressable via ?text=) ────────────────────────────────

	const requestedView = $derived($page.url.searchParams.get('text'));
	const view = $derived(resolveReferenceView(requestedView));

	/** Select a view, keeping the route addressable and focus in place. */
	function selectView(key: string) {
		if (key === view.key) return;
		goto(`/reference?text=${encodeURIComponent(key)}`, { replaceState: true, keepFocus: true });
	}

	// ─── Content (offline, from the shipped corpus data) ────────────────────────

	let source = $state<Source | null>(null);
	/** Passages of the selected full-text source, in corpus order. */
	let passages = $state<Passage[]>([]);

	$effect(() => {
		const currentView = view;
		if (!$searchReady) return;

		const src = getSourceById(currentView.sourceId) ?? null;
		source = src;

		// Guard BEFORE getPassages(): only an enabled `full-text` source may
		// render text. A missing, disabled, or non-full-text source never reads
		// the corpus, so no protected text can leak into the placeholder.
		if (!src || !src.enabled || src.displayMode !== 'full-text') {
			passages = [];
			return;
		}

		const all = getPassages();
		passages = all
			? Object.values(all)
					.filter((p): p is Passage => p.sourceId === currentView.sourceId)
					.sort((a, b) => a.sequence - b.sequence)
			: [];
	});

	/** Whether the selected source is gateable to the placeholder. */
	const isGated = $derived(
		!!source && (!source.enabled || source.displayMode !== 'full-text')
	);

	// ─── Reader display preferences (full-text views only) ──────────────────────

	const FONT_SIZE_LABELS: Record<FontSizeStep, string> = {
		default: 'Default',
		large: 'Large',
		larger: 'Larger',
		largest: 'Largest'
	};

	let readerPrefs = $state<ReaderPrefs>({ ...DEFAULT_READER_PREFS });
	let prefsOpen = $state(false);

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

	// ─── Listen (full-text views only) ──────────────────────────────────────────

	let ttsSupported = $state(false);
	let speechState = $state<'stopped' | 'playing' | 'paused'>('stopped');
	let speechUtterances: SpeechSynthesisUtterance[] = [];

	const speechStatus = $derived(
		speechState === 'playing' ? 'Listening' : speechState === 'paused' ? 'Paused' : 'Stopped'
	);

	/** Text assembled only from the rendered full-text passages. */
	function speechText(): string {
		if (!source || source.displayMode !== 'full-text' || !source.enabled) return '';
		return buildSpeechText(passages.map((p) => p.text));
	}

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
			utterance.onerror = () => stopSpeech();
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

	// ─── Lifecycle ──────────────────────────────────────────────────────────────

	onMount(async () => {
		readerPrefs = readStoredReaderPrefs();
		ttsSupported = isTtsSupported(window);
		await loadSearchIndex();
	});

	// Switching views stops any in-flight speech: same-route navigation changes
	// only the query parameter, so `onDestroy` does not fire.
	$effect(() => {
		void view.key;
		stopSpeech();
	});

	onDestroy(() => {
		stopSpeech();
	});
</script>

<svelte:head>
	<title>Reference texts | basictexts.org</title>
	<meta
		name="description"
		content="Read the Twelve Steps, the long-form Twelve Traditions, the Twelve Concepts, and the Promises and step prayers from the basictexts.org corpus, offline and on mobile."
	/>
</svelte:head>

<main class="max-w-3xl mx-auto px-4 py-8">
	<h1 class="font-serif text-2xl font-semibold text-navy dark:text-slate-200 mb-2">
		Reference
	</h1>
	<p class="text-stone-500 dark:text-slate-400 text-sm mb-5">
		The short meeting-referenced AA texts, each as its own view. Select a text below.
	</p>

	<!-- ── View selector ─────────────────────────────────────────────────────── -->
	<div
		class="flex flex-wrap gap-2 mb-8"
		role="group"
		aria-label="Choose a reference text"
	>
		{#each REFERENCE_VIEWS as item (item.key)}
			<button
				type="button"
				onclick={() => selectView(item.key)}
				aria-pressed={item.key === view.key}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium
					   border transition-colors duration-150 focus-visible:outline-none
					   focus-visible:ring-2 focus-visible:ring-navy dark:focus-visible:ring-amber-400
					   {item.key === view.key
					? 'border-transparent bg-navy text-white dark:bg-amber-400 dark:text-slate-900'
					: 'border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-stone-600 dark:text-slate-400 hover:border-navy dark:hover:border-amber-400'}"
			>
				{#if item.key === view.key}
					<span aria-hidden="true" class="font-bold">✓</span>
				{/if}
				{item.label}
			</button>
		{/each}
	</div>

	<!-- ── Content ───────────────────────────────────────────────────────────── -->
	{#if !$searchReady && !$searchError}
		<p class="text-stone-400 dark:text-slate-500 text-sm" role="status">Loading…</p>
	{:else if $searchError}
		<div
			class="rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3"
			role="alert"
		>
			<p class="text-red-600 dark:text-red-400 text-sm">Failed to load the library: {$searchError}</p>
		</div>
	{:else if isGated && source}
		<!-- Gated placeholder: title, copyright notice, official link — NO text. -->
		<article class="animate-fade-in">
			<div class="flex items-center gap-2 mb-3">
				<span
					class="inline-block w-3 h-3 rounded-full flex-shrink-0"
					style="background-color: {source.color};"
					aria-hidden="true"
				></span>
				<h2 class="font-serif text-xl font-semibold text-navy dark:text-slate-200">
					{source.title}
				</h2>
			</div>
			<div
				class="bg-white dark:bg-slate-900/40 rounded shadow-sm border border-stone-200
					   dark:border-slate-800 px-5 py-6"
			>
				<p class="text-stone-600 dark:text-slate-300 text-sm leading-relaxed mb-3">
					This text is not reproduced here. It remains under copyright review and no
					reproduction basis is recorded, so the reader does not display its text.
				</p>
				<p class="text-stone-500 dark:text-slate-400 text-xs mb-4">
					{source.title}. © Alcoholics Anonymous World Services, Inc. All rights reserved.
				</p>
				{#if source.officialUrl}
					<ExternalLink
						href={source.officialUrl}
						class="text-sm font-medium text-navy dark:text-amber-400 hover:underline"
					>
						Read at the official AA source →
					</ExternalLink>
				{/if}
			</div>
		</article>
	{:else if source && passages.length > 0}
		<!-- Full-text view: all of the source's passages in corpus order. -->
		{@const accent = resolveSourceAccent(source.color)}
		<article class="animate-fade-in">
			<div class="flex items-center gap-2 mb-3">
				<span
					class="inline-block w-3 h-3 rounded-full flex-shrink-0"
					style="background-color: {accent.fill};"
					aria-hidden="true"
				></span>
				<h2 class="font-serif text-xl font-semibold text-navy dark:text-slate-200">
					{source.title}
				</h2>
			</div>

			<!-- Reading settings + Listen (full-text views only) -->
			<div class="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
				<button
					type="button"
					aria-expanded={prefsOpen}
					aria-controls="reference-reading-settings"
					onclick={() => (prefsOpen = !prefsOpen)}
					class="inline-flex items-center gap-1.5 text-sm text-stone-400 dark:text-slate-500
						   hover:text-navy dark:hover:text-slate-300 transition-colors focus-visible:outline-none
						   focus-visible:ring-2 focus-visible:ring-navy dark:focus-visible:ring-amber-400 rounded"
				>
					<span aria-hidden="true" class="font-serif">Aa</span>
					<span class="sr-only">Reading settings</span>
				</button>

				{#if prefsOpen}
					<div
						id="reference-reading-settings"
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

			<div
				class="bg-white dark:bg-slate-900/40 rounded shadow-sm border border-stone-200
					   dark:border-slate-800 px-6 py-6"
			>
				{#each passages as passage (passage.id)}
					<h3
						class="font-serif text-sm font-bold text-stone-600 dark:text-slate-300 uppercase
							   tracking-wide mb-2 {passage.sequence > 1 ? 'mt-6' : ''}"
					>
						{passage.title}
					</h3>
					<p
						class="text-[#1A1A1A] dark:text-slate-200 leading-relaxed whitespace-pre-line
							   {passage.sequence < passages.length ? 'mb-4' : ''}"
						style={bodyStyle || undefined}
					>
						{passage.text}
					</p>
				{/each}
			</div>
		</article>
	{:else}
		<p class="text-stone-500 dark:text-slate-400">No text is available for this view.</p>
	{/if}
</main>
