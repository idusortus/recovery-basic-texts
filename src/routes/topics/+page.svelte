<script lang="ts">
	import { goto } from '$app/navigation';
	import { Search } from 'lucide-svelte';

	const TOPICS_A_Z = [
		'Acceptance', 'Action', 'Anger', 'Anonymity', 'Belief',
		'Change', 'Courage', 'Defects', 'Denial', 'Ego',
		'Faith', 'Fear', 'Forgiveness', 'God', 'Grace',
		'Gratitude', 'Higher Power', 'Honesty', 'Hope', 'Humility',
		'Inventory', 'Love', 'Peace', 'Prayer', 'Pride',
		'Recovery', 'Resentment', 'Self', 'Serenity', 'Service',
		'Sobriety', 'Spiritual', 'Steps', 'Surrender', 'Trust',
		'Truth', 'Willingness'
	].sort();

	const FEATURED = [
		'Fear', 'Acceptance', 'Resentment', 'Gratitude',
		'Humility', 'God', 'Honesty', 'Anger', 'Ego', 'Self'
	];

	function searchTopic(topic: string) {
		goto(`/?q=${encodeURIComponent(topic.toLowerCase())}`);
	}
</script>

<svelte:head>
	<title>Topics — basictexts.org</title>
</svelte:head>

<main class="max-w-4xl mx-auto px-4 py-8">
	<h1 class="font-serif text-2xl font-semibold text-navy dark:text-slate-200 mb-2">
		Browse by Topic
	</h1>
	<p class="text-stone-500 dark:text-slate-400 text-sm mb-8">
		Select a topic to search across all available sources.
	</p>

	<!-- Featured topics -->
	<section class="mb-10" aria-labelledby="featured-heading">
		<h2
			id="featured-heading"
			class="font-serif text-sm font-semibold text-stone-400 dark:text-slate-500
				   uppercase tracking-widest mb-4"
		>
			Common Searches
		</h2>
		<div class="flex flex-wrap gap-2">
			{#each FEATURED as topic (topic)}
				<button
					type="button"
					onclick={() => searchTopic(topic)}
					class="inline-flex items-center gap-1.5 px-4 py-2 rounded border
						   border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900
						   text-stone-700 dark:text-slate-300 text-sm font-medium
						   hover:border-navy hover:text-navy dark:hover:border-amber-400 dark:hover:text-amber-400
						   transition-colors duration-150"
				>
					<Search size={12} aria-hidden={true} />
					{topic}
				</button>
			{/each}
		</div>
	</section>

	<!-- A–Z list -->
	<section aria-labelledby="az-heading">
		<h2
			id="az-heading"
			class="font-serif text-sm font-semibold text-stone-400 dark:text-slate-500
				   uppercase tracking-widest mb-4"
		>
			A–Z
		</h2>
		<div class="columns-2 sm:columns-3 md:columns-4 gap-x-8">
			{#each TOPICS_A_Z as topic (topic)}
				<div class="break-inside-avoid mb-1">
					<button
						type="button"
						onclick={() => searchTopic(topic)}
						class="text-sm text-stone-600 dark:text-slate-400
							   hover:text-navy dark:hover:text-amber-400
							   hover:underline transition-colors duration-150 text-left"
					>
						{topic}
					</button>
				</div>
			{/each}
		</div>
	</section>
</main>
