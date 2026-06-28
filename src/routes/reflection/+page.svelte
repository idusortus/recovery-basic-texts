<script lang="ts">
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import { BookOpen } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Daily Reflection — basictexts.org</title>
</svelte:head>

<main class="max-w-4xl mx-auto px-4 py-8">
	<div class="flex items-center gap-2 mb-6">
		<BookOpen size={20} class="text-navy dark:text-slate-400" aria-hidden={true} />
		<h1 class="font-serif text-2xl font-semibold text-navy dark:text-slate-200">
			Daily Reflection
		</h1>
	</div>

	<div
		class="bg-white dark:bg-slate-900/40 rounded shadow-sm border border-stone-200
			   dark:border-slate-800 px-6 py-8 max-w-xl"
	>
		<p class="text-stone-600 dark:text-slate-400 text-sm leading-relaxed mb-6">
			Daily Reflections is a copyright-protected work published by AAWS. We're in the
			process of obtaining permission to show concordance-style excerpts. Until then,
			you can read today's reflection directly at aa.org.
		</p>

		<ExternalLink
			href="https://www.aa.org/daily-reflections"
			class="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-navy text-white
				   text-sm font-medium hover:bg-navy/90 transition-colors"
		>
			Read today's reflection at aa.org →
		</ExternalLink>

		<p class="text-stone-400 dark:text-slate-500 text-xs mt-6">
			Daily Reflections: A Book of Reflections by A.A. Members for A.A. Members.
			© Alcoholics Anonymous World Services, Inc.
		</p>
	</div>
</main>
