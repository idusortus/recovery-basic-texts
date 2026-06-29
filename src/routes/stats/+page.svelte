<script lang="ts">
	import { onMount } from 'svelte';

	interface QueryStats {
		q: string;
		count: number;
		resultCount: number;
		lastSeen: string;
	}

	interface StatsResponse {
		totalRecords: number;
		latestTs: string | null;
		oldestTs: string | null;
		topQueries: QueryStats[];
		recentQueries: Array<{
			q: string;
			resultCount: number;
			ts: string;
			sourceFilter: string[] | null;
		}>;
		sourceFilterUsage: Array<{
			sourceId: string;
			count: number;
		}>;
	}

	let stats: StatsResponse | null = $state(null);
	let error = $state<string | null>(null);
	let loading = $state(true);

	onMount(async () => {
		try {
			const response = await fetch('/api/stats');
			if (!response.ok) throw new Error('Unable to load stats');
			stats = await response.json();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unable to load stats';
		} finally {
			loading = false;
		}
	});

	function formatDate(value: string | null) {
		if (!value) return '—';
		return new Date(value).toLocaleString();
	}
</script>

<svelte:head>
	<title>Search stats — basictexts.org</title>
	<meta name="description" content="Anonymous search activity collected from basictexts.org." />
</svelte:head>

<main class="max-w-5xl mx-auto px-4 py-8">
	<div class="mb-8">
		<h1 class="font-serif text-2xl font-semibold text-navy dark:text-slate-200 mb-2">
			Search stats
		</h1>
		<p class="text-stone-500 dark:text-slate-400 text-sm">
			This page shows the anonymous search data being collected from the Cloudflare-backed log endpoint.
		</p>
	</div>

	{#if loading}
		<p class="text-sm text-stone-500 dark:text-slate-400">Loading stats…</p>
	{:else if error}
		<p class="text-sm text-red-600 dark:text-red-400">{error}</p>
	{:else if stats}
		<div class="grid gap-4 md:grid-cols-3 mb-8">
			<div class="rounded border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4">
				<p class="text-xs uppercase tracking-widest text-stone-400 dark:text-slate-500">Total records</p>
				<p class="mt-2 text-2xl font-semibold text-navy dark:text-slate-100">{stats.totalRecords}</p>
			</div>
			<div class="rounded border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4">
				<p class="text-xs uppercase tracking-widest text-stone-400 dark:text-slate-500">Latest</p>
				<p class="mt-2 text-sm text-stone-600 dark:text-slate-300">{formatDate(stats.latestTs)}</p>
			</div>
			<div class="rounded border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4">
				<p class="text-xs uppercase tracking-widest text-stone-400 dark:text-slate-500">Oldest</p>
				<p class="mt-2 text-sm text-stone-600 dark:text-slate-300">{formatDate(stats.oldestTs)}</p>
			</div>
		</div>

		<div class="grid gap-6 lg:grid-cols-2">
			<section class="rounded border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4">
				<h2 class="font-serif text-lg font-semibold text-navy dark:text-slate-200 mb-4">Top queries</h2>
				<ul class="space-y-2 text-sm">
					{#each stats.topQueries as item (item.q)}
						<li class="flex items-center justify-between gap-3 rounded bg-stone-50 dark:bg-slate-800/70 px-3 py-2">
							<span class="font-medium text-stone-700 dark:text-slate-200">{item.q}</span>
							<span class="text-stone-500 dark:text-slate-400">{item.count} ×</span>
						</li>
					{/each}
				</ul>
			</section>

			<section class="rounded border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4">
				<h2 class="font-serif text-lg font-semibold text-navy dark:text-slate-200 mb-4">Source filter usage</h2>
				<ul class="space-y-2 text-sm">
					{#each stats.sourceFilterUsage as item (item.sourceId)}
						<li class="flex items-center justify-between gap-3 rounded bg-stone-50 dark:bg-slate-800/70 px-3 py-2">
							<span class="font-medium text-stone-700 dark:text-slate-200">{item.sourceId}</span>
							<span class="text-stone-500 dark:text-slate-400">{item.count}</span>
						</li>
					{/each}
				</ul>
			</section>
		</div>

		<section class="mt-8 rounded border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4">
			<h2 class="font-serif text-lg font-semibold text-navy dark:text-slate-200 mb-4">Recent queries</h2>
			<div class="overflow-x-auto">
				<table class="min-w-full text-sm">
					<thead>
						<tr class="text-left text-stone-500 dark:text-slate-400 border-b border-stone-200 dark:border-slate-800">
							<th class="py-2 pr-4">Query</th>
							<th class="py-2 pr-4">Results</th>
							<th class="py-2 pr-4">Time</th>
							<th class="py-2">Sources</th>
						</tr>
					</thead>
					<tbody>
						{#each stats.recentQueries as item (item.ts + item.q)}
							<tr class="border-b border-stone-100 dark:border-slate-800/70">
								<td class="py-2 pr-4 text-stone-700 dark:text-slate-200">{item.q}</td>
								<td class="py-2 pr-4 text-stone-500 dark:text-slate-400">{item.resultCount}</td>
								<td class="py-2 pr-4 text-stone-500 dark:text-slate-400">{formatDate(item.ts)}</td>
								<td class="py-2 text-stone-500 dark:text-slate-400">{item.sourceFilter?.join(', ') ?? 'all'}</td>
							</tr>
						{/each}
					</tbody>
			</table>
			</div>
		</section>
	{/if}
</main>
