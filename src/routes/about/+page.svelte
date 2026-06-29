<script lang="ts">
	import ExternalLink from '$lib/components/ExternalLink.svelte';
</script>

<svelte:head>
	<title>About basictexts.org — AA recovery and step work search</title>
	<meta
		name="description"
		content="Learn how basictexts.org helps people search AA literature for recovery, step work, sobriety, and daily reflection themes."
	/>
</svelte:head>

<main class="max-w-4xl mx-auto px-4 py-8">
	<h1 class="font-serif text-2xl font-semibold text-navy dark:text-slate-200 mb-6">
		About basictexts.org
	</h1>

	<div class="prose prose-stone dark:prose-invert max-w-none space-y-8">

		<!-- What it is -->
		<section aria-labelledby="what-it-is">
			<h2
				id="what-it-is"
				class="font-serif text-lg font-semibold text-navy dark:text-slate-200 mb-3"
			>
				What this is
			</h2>
			<p class="text-stone-600 dark:text-slate-400 text-sm leading-relaxed">
				basictexts.org is a free, open-source concordance for Alcoholics Anonymous literature.
				It lets you search across multiple AA texts by keyword or phrase, see every occurrence
				with surrounding context, and navigate to official or free online sources.
			</p>
			<p class="text-stone-600 dark:text-slate-400 text-sm leading-relaxed mt-3">
				It's designed to work offline as an installable Progressive Web App — useful at meetings,
				during step work, or anywhere you want to find a passage quickly.
			</p>
		</section>

		<!-- What it isn't -->
		<section aria-labelledby="what-it-isnt">
			<h2
				id="what-it-isnt"
				class="font-serif text-lg font-semibold text-navy dark:text-slate-200 mb-3"
			>
				What this isn't
			</h2>
			<ul class="text-stone-600 dark:text-slate-400 text-sm leading-relaxed space-y-1 list-disc list-inside">
				<li>Not affiliated with or endorsed by Alcoholics Anonymous World Services (AAWS) or AA Grapevine</li>
				<li>Not a replacement for the books themselves — please buy and read them</li>
				<li>Not a treatment resource or professional service</li>
				<li>Not associated with any AA group, intergroup, or service body</li>
			</ul>
		</section>

		<!-- Legal disclaimer -->
		<section aria-labelledby="disclaimer">
			<h2
				id="disclaimer"
				class="font-serif text-lg font-semibold text-navy dark:text-slate-200 mb-3"
			>
				Legal disclaimer
			</h2>
			<p class="text-stone-600 dark:text-slate-400 text-sm leading-relaxed">
				This is an independent, non-commercial project built by an AA member in service of
				the fellowship. It is not affiliated with, sponsored by, or endorsed by AAWS, AA Grapevine,
				or any AA service entity. Links are provided to official and free sources so readers can
				access the full texts.
			</p>
			<p class="text-stone-600 dark:text-slate-400 text-sm leading-relaxed mt-3">
				Public domain texts (the 1st-edition Big Book) are displayed in full. Protected texts are
				shown only as short concordance excerpts or snippets. If AAWS or any rights holder
				requests a change, we will adjust promptly.
			</p>
		</section>

		<!-- Copyright basis -->
		<section aria-labelledby="copyright">
			<h2
				id="copyright"
				class="font-serif text-lg font-semibold text-navy dark:text-slate-200 mb-3"
			>
				Copyright
			</h2>
			<p class="text-stone-600 dark:text-slate-400 text-sm leading-relaxed">
				The 1st-edition Big Book (1939) entered the public domain in the United States because
				AAWS did not renew its copyright — a matter of settled public record, confirmed by the
				U.S. Copyright Office renewal records. The 2nd-edition Big Book (1955) is similarly
				public domain for the same reason.
			</p>
			<p class="text-stone-600 dark:text-slate-400 text-sm leading-relaxed mt-3">
				The 3rd and 4th editions, the 12&amp;12, and Daily Reflections are copyright-protected
				works owned by AAWS. Protected sources are shown only as concordance-style short excerpts,
				consistent with fair use and the precedent established by sites like 164andMore.
			</p>
		</section>

		<!-- Privacy -->
		<section aria-labelledby="privacy">
			<h2
				id="privacy"
				class="font-serif text-lg font-semibold text-navy dark:text-slate-200 mb-3"
			>
				Privacy
			</h2>
			<p class="text-stone-600 dark:text-slate-400 text-sm leading-relaxed">
				Anonymous search terms are recorded to help improve the app — specifically, to identify
				passages people search for that aren't yet in the corpus. No personal data, IP addresses,
				cookies, or identifiers are collected or stored. The log records only the search query,
				result count, and a server-side timestamp.
			</p>
		</section>

		<!-- Open source -->
		<section aria-labelledby="open-source">
			<h2
				id="open-source"
				class="font-serif text-lg font-semibold text-navy dark:text-slate-200 mb-3"
			>
				Open source
			</h2>
			<p class="text-stone-600 dark:text-slate-400 text-sm leading-relaxed">
				basictexts.org is open source (MIT License). Contributions are welcome — especially
				new corpus sources and data corrections.
			</p>
			<ExternalLink
				href="https://github.com/idusortus/recovery-basic-texts"
				class="inline-block mt-2 text-sm text-navy dark:text-amber-400 hover:underline font-medium"
			>
				View on GitHub →
			</ExternalLink>
			<ExternalLink
				href="https://github.com/idusortus/recovery-basic-texts/issues/new?template=suggestion.md&title=%5BSuggestion%5D+"
				class="inline-block mt-2 ml-4 text-sm text-navy dark:text-amber-400 hover:underline font-medium"
			>
				Suggest a change or correction →
			</ExternalLink>
		</section>

		<!-- How to contribute -->
		<section aria-labelledby="contribute">
			<h2
				id="contribute"
				class="font-serif text-lg font-semibold text-navy dark:text-slate-200 mb-3"
			>
				How to contribute a corpus
			</h2>
			<p class="text-stone-600 dark:text-slate-400 text-sm leading-relaxed">
				Adding a new source requires: (1) a corpus data file in
				<code class="font-mono text-xs bg-stone-100 dark:bg-slate-800 px-1 rounded">corpus/sources/&lt;id&gt;.json</code>,
				(2) a registry entry in
				<code class="font-mono text-xs bg-stone-100 dark:bg-slate-800 px-1 rounded">corpus/sources.json</code>,
				and (3) running
				<code class="font-mono text-xs bg-stone-100 dark:bg-slate-800 px-1 rounded">npm run build:index</code>.
				No application code changes needed. See the
				<ExternalLink
					href="https://github.com/idusortus/recovery-basic-texts/blob/main/corpus/CORPUS-GUIDE.md"
					class="text-navy dark:text-amber-400 hover:underline"
				>
					Corpus Guide
				</ExternalLink>
				for full instructions, copyright evaluation criteria, and ingestion procedures.
			</p>
		</section>

		<!-- Support (reserved) -->
		<section
			aria-labelledby="support"
			class="rounded border border-stone-200 dark:border-slate-700 px-5 py-4"
		>
			<h2
				id="support"
				class="font-serif text-lg font-semibold text-navy dark:text-slate-200 mb-2"
			>
				Support this project
			</h2>
			<p class="text-stone-500 dark:text-slate-400 text-sm leading-relaxed mb-3">
				basictexts.org is free and always will be. If it's been useful to you, consider supporting
				it — it helps cover hosting costs and motivates continued development.
			</p>
			<div class="flex flex-wrap gap-3">
				<ExternalLink
					href="https://ko-fi.com/wiscodev"
					class="inline-flex items-center px-4 py-2 rounded text-sm font-medium
						   bg-navy text-white hover:bg-navy/90 transition-colors"
				>
					Support on Ko-fi
				</ExternalLink>
				<!-- GitHub Sponsors placeholder -->
				<span
					class="inline-flex items-center px-4 py-2 rounded text-sm font-medium
						   bg-stone-100 dark:bg-slate-800 text-stone-400 dark:text-slate-500
						   border border-stone-200 dark:border-slate-700 cursor-not-allowed"
					title="GitHub Sponsors link coming soon"
				>
					GitHub Sponsors (coming soon)
				</span>
			</div>
		</section>

	</div>
</main>
