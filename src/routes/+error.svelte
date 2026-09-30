<script lang="ts">
	import { page } from '$app/stores';

	// Self-contained and styled: a root-level error can render outside the normal
	// layout, so this page does not rely on the nav/footer. It never prints the
	// raw error message or a stack trace.
	const isNotFound = $derived($page.status === 404);
</script>

<svelte:head>
	<title>{isNotFound ? 'Page not found' : 'Something went wrong'} — basictexts.org</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="max-w-xl mx-auto px-4 py-16 text-center">
	<p class="text-xs uppercase tracking-widest text-stone-400 dark:text-slate-500 font-medium mb-3">
		Error {$page.status}
	</p>
	<h1 class="font-serif text-2xl font-semibold text-navy dark:text-slate-100 mb-3">
		{isNotFound ? 'Page not found' : 'Something went wrong'}
	</h1>
	<p class="text-stone-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
		{isNotFound
			? "We couldn't find that page. It may have moved, or the link may be out of date."
			: 'Something interrupted this page. Please try again, or head back to the concordance.'}
	</p>
	<a
		href="/"
		class="inline-flex items-center gap-2 px-4 py-2 rounded bg-navy text-white text-sm font-medium
			   hover:bg-navy/90 transition-colors focus-visible:outline-none focus-visible:ring-2
			   focus-visible:ring-navy dark:focus-visible:ring-amber-400"
	>
		Back to the concordance →
	</a>
</main>
