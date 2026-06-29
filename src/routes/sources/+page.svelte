<script lang="ts">
	import { allSources } from '$lib/corpus/registry';
	import ExternalLink from '$lib/components/ExternalLink.svelte';

	const COPYRIGHT_LABELS: Record<string, string> = {
		'public-domain': 'Public domain',
		protected: 'Copyright protected',
		unknown: 'Copyright status under review'
	};

	const DISPLAY_MODE_LABELS: Record<string, string> = {
		'full-text': 'Full text shown',
		'concordance-only': 'Concordance only — links to official source',
		snippet: 'Short excerpts — links to official source'
	};

	const FREE_RESOURCES = [
		{ label: 'Big Book at aa.org', url: 'https://www.aa.org/the-big-book' },
		{ label: 'Big Book at anonpress.org (full text)', url: 'https://anonpress.org/bb/' },
		{ label: 'Free PDF at anonpress.org', url: 'https://anonpress.org/pdf/' },
		{ label: 'AA history archive at silkworth.net', url: 'https://silkworth.net/' },
		{ label: 'Big Book scan at archive.org', url: 'https://archive.org/search?query=alcoholics+anonymous+first+edition' },
		{ label: 'Daily Reflections at aa.org', url: 'https://www.aa.org/daily-reflections' }
	];
</script>

<svelte:head>
	<title>AA sources indexed by basictexts.org — Big Book, 12 Steps, Daily Reflections</title>
	<meta
		name="description"
		content="Browse the AA literature sources indexed by basictexts.org, including the Big Book, 12 Steps, 12 Traditions, and Daily Reflections."
	/>
</svelte:head>

<main class="max-w-4xl mx-auto px-4 py-8">
	<h1 class="font-serif text-2xl font-semibold text-navy dark:text-slate-200 mb-2">
		Sources
	</h1>
	<p class="text-stone-500 dark:text-slate-400 text-sm mb-8">
		All texts indexed by basictexts.org, with copyright status and display mode.
	</p>

	<!-- Source cards -->
	<div class="space-y-4 mb-12">
		{#each allSources as source (source.id)}
			<div
				class="bg-white dark:bg-slate-900/40 rounded shadow-sm border border-stone-200
					   dark:border-slate-800 px-5 py-4 transition-colors duration-200
					   {!source.enabled ? 'opacity-60' : ''}"
			>
				<div class="flex items-start gap-3">
					<span
						class="mt-1 inline-block w-3 h-3 rounded-full flex-shrink-0"
						style="background-color: {source.color};"
						aria-hidden="true"
					></span>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 flex-wrap mb-1">
							<h2 class="font-serif font-semibold text-navy dark:text-slate-200">
								{source.title}
							</h2>
							<span
								class="text-xs px-2 py-0.5 rounded-full border
									   {source.copyright === 'public-domain'
									   	? 'border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
									   	: source.copyright === 'protected'
									   	  ? 'border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
									   	  : 'border-stone-200 dark:border-slate-700 text-stone-500 dark:text-slate-400'}"
							>
								{COPYRIGHT_LABELS[source.copyright] ?? source.copyright}
							</span>
							{#if !source.enabled}
								<span
									class="text-xs px-2 py-0.5 rounded-full border
										   border-stone-200 dark:border-slate-700 text-stone-400 dark:text-slate-500"
								>
									Coming soon
								</span>
							{/if}
						</div>
						<p class="text-stone-500 dark:text-slate-400 text-sm mb-2">{source.description}</p>
						<p class="text-stone-400 dark:text-slate-500 text-xs mb-3">
							Display mode: <span class="font-medium">{DISPLAY_MODE_LABELS[source.displayMode] ?? source.displayMode}</span>
						</p>
						<div class="flex flex-wrap gap-3">
							{#if source.officialUrl}
								<ExternalLink
									href={source.officialUrl}
									class="text-xs text-navy dark:text-amber-400 hover:underline font-medium"
								>
									Official source →
								</ExternalLink>
							{/if}
							{#if source.freeUrl}
								<ExternalLink
									href={source.freeUrl}
									class="text-xs text-navy dark:text-amber-400 hover:underline font-medium"
								>
									Free version →
								</ExternalLink>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/each}
	</div>

	<!-- Free resources -->
	<section aria-labelledby="free-resources-heading">
		<h2
			id="free-resources-heading"
			class="font-serif text-lg font-semibold text-navy dark:text-slate-200 mb-4"
		>
			Free Resources
		</h2>
		<ul class="space-y-2">
			{#each FREE_RESOURCES as resource (resource.url)}
				<li>
					<ExternalLink
						href={resource.url}
						class="text-sm text-navy dark:text-amber-400 hover:underline"
					>
						{resource.label}
					</ExternalLink>
				</li>
			{/each}
		</ul>
	</section>
</main>
