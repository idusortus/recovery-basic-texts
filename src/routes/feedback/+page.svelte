<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { Bug, Lightbulb, Send } from '@lucide/svelte';
	import TurnstileWidget from '$lib/components/TurnstileWidget.svelte';
	import { buildReportPrefill } from '$lib/feedback/report-context';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let submitting = $state(false);

	// Turnstile tokens are single-use: bumping this key resets the widget after a
	// failed submit so the next attempt gets a fresh token.
	let resetKey = $state(0);
	// Not reactive — only read and written from the effect below.
	let lastForm: unknown;

	/** Reads an allow-listed string field the action echoes back on failure. */
	function readString(source: unknown, key: string): string {
		if (source && typeof source === 'object') {
			const value = (source as Record<string, unknown>)[key];
			if (typeof value === 'string') return value;
		}
		return '';
	}

	const message = $derived(readString(form, 'message') || null);
	const failed = $derived(message !== null && $page.status >= 400);
	const succeeded = $derived(message !== null && $page.status < 400);
	// Which field failed validation ('' when the failure is not field-specific),
	// so only the affected input is marked invalid and tied to the error.
	const errorField = $derived(readString(form, 'errorField'));

	// Preserve the user's input across a failed submit. Default the type so a
	// choice is always made and there is no empty state. A "report this passage"
	// link may preselect the type and prefill `details` from its URL params.
	const urlType = $derived($page.url.searchParams.get('type'));
	const typeFromForm = $derived(readString(form, 'type'));
	const selectedType = $derived(
		typeFromForm === 'bug' || typeFromForm === 'suggestion'
			? typeFromForm
			: urlType === 'bug'
				? 'bug'
				: 'suggestion'
	);
	const summaryValue = $derived(readString(form, 'summary'));
	const reportContext = $derived(buildReportPrefill($page.url.searchParams));
	const detailsValue = $derived(readString(form, 'details') || reportContext);

	// A failed submit consumes the token; reset the widget for the next try.
	$effect(() => {
		const result = form;
		if (result === lastForm) return;
		lastForm = result;
		if (result && $page.status >= 400) {
			resetKey += 1;
		}
	});
</script>

<svelte:head>
	<title>Send feedback | basictexts.org</title>
	<meta
		name="description"
		content="Report a bug or suggest an improvement to basictexts.org. No account needed."
	/>
</svelte:head>

<main class="max-w-2xl mx-auto px-4 py-8">
	<h1 class="font-serif text-2xl font-semibold text-navy dark:text-slate-200 mb-2">
		Send feedback
	</h1>
	<p class="text-stone-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
		Found a bug or have an idea? Send it to the people who build basictexts.org. No account is
		needed, and we ask only for what helps us act on your report.
	</p>

	{#if succeeded}
		<div
			class="rounded border border-emerald-200 dark:border-emerald-800 bg-emerald-50
				   dark:bg-emerald-950/30 px-5 py-4"
			role="status"
		>
			<p class="text-emerald-900 dark:text-emerald-300 text-sm font-medium mb-1">
				{message}
			</p>
			<p class="text-emerald-800 dark:text-emerald-400 text-sm">
				Thank you. Your report went straight to the maintainer's GitHub tracker.
			</p>
			<a
				href="/"
				class="inline-block mt-3 text-sm font-medium text-navy dark:text-amber-400 hover:underline"
			>
				Back to the concordance →
			</a>
		</div>
	{:else}
		{#if failed}
			<div
				id="form-error"
				class="rounded border border-red-200 dark:border-red-800 bg-red-50
					   dark:bg-red-950/30 px-4 py-3 mb-5 text-sm text-red-800 dark:text-red-300"
				role="alert"
			>
				{message}
			</div>
		{/if}

		<form
			method="POST"
			class="space-y-5 bg-white dark:bg-slate-900/40 rounded shadow-sm border
				   border-stone-200 dark:border-slate-800 px-5 py-6 transition-colors duration-200"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					submitting = false;
					await update({ reset: false });
				};
			}}
		>
			<fieldset>
				<legend class="text-sm font-medium text-[#1A1A1A] dark:text-slate-200 mb-2">
					What would you like to send?
				</legend>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<label
						class="flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors
							   duration-150
							   {selectedType === 'suggestion'
								   ? 'border-navy dark:border-amber-400 bg-navy/5 dark:bg-amber-400/10'
								   : 'border-stone-200 dark:border-slate-700 hover:border-stone-300 dark:hover:border-slate-600'}"
					>
						<input
							type="radio"
							name="type"
							value="suggestion"
							checked={selectedType === 'suggestion'}
							required
							class="mt-1 accent-navy dark:accent-amber-400"
						/>
						<span>
							<span class="flex items-center gap-1.5 font-medium text-sm text-[#1A1A1A] dark:text-slate-200">
								<Lightbulb size={14} aria-hidden="true" /> Suggestion
							</span>
							<span class="block mt-0.5 text-xs text-stone-500 dark:text-slate-400">
								An idea or improvement
							</span>
						</span>
					</label>
					<label
						class="flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors
							   duration-150
							   {selectedType === 'bug'
								   ? 'border-navy dark:border-amber-400 bg-navy/5 dark:bg-amber-400/10'
								   : 'border-stone-200 dark:border-slate-700 hover:border-stone-300 dark:hover:border-slate-600'}"
					>
						<input
							type="radio"
							name="type"
							value="bug"
							checked={selectedType === 'bug'}
							required
							class="mt-1 accent-navy dark:accent-amber-400"
						/>
						<span>
							<span class="flex items-center gap-1.5 font-medium text-sm text-[#1A1A1A] dark:text-slate-200">
								<Bug size={14} aria-hidden="true" /> Bug
							</span>
							<span class="block mt-0.5 text-xs text-stone-500 dark:text-slate-400">
								Something isn't working
							</span>
						</span>
					</label>
				</div>
			</fieldset>

			<div>
				<label
					for="summary"
					class="block text-sm font-medium text-[#1A1A1A] dark:text-slate-200 mb-1"
				>
					Summary
				</label>
				<input
					id="summary"
					name="summary"
					type="text"
					required
					maxlength="120"
					autocomplete="off"
					value={summaryValue}
					placeholder="A one-line title"
					aria-invalid={errorField === 'summary'}
					aria-describedby={errorField === 'summary'
						? 'summary-help form-error'
						: 'summary-help'}
					class="w-full rounded border border-stone-200 dark:border-slate-700 bg-white
						   dark:bg-slate-900 px-3 py-2 text-sm text-[#1A1A1A] dark:text-slate-200
						   placeholder-stone-400 dark:placeholder-slate-500 shadow-sm
						   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy
						   dark:focus-visible:ring-amber-400 transition-colors duration-200"
				/>
				<p id="summary-help" class="mt-1 text-xs text-stone-500 dark:text-slate-400">
					Up to 120 characters.
				</p>
			</div>

			<div>
				<label
					for="details"
					class="block text-sm font-medium text-[#1A1A1A] dark:text-slate-200 mb-1"
				>
					Details
				</label>
				<textarea
					id="details"
					name="details"
					required
					rows="6"
					maxlength="4000"
					value={detailsValue}
					placeholder="What happened, and what did you expect?"
					aria-invalid={errorField === 'details'}
					aria-describedby={errorField === 'details'
						? 'details-help form-error'
						: 'details-help'}
					class="w-full rounded border border-stone-200 dark:border-slate-700 bg-white
						   dark:bg-slate-900 px-3 py-2 text-sm text-[#1A1A1A] dark:text-slate-200
						   placeholder-stone-400 dark:placeholder-slate-500 shadow-sm
						   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy
						   dark:focus-visible:ring-amber-400 transition-colors duration-200"
				></textarea>
				<p id="details-help" class="mt-1 text-xs text-stone-500 dark:text-slate-400">
					Up to 4000 characters. Please don't include personal details, no names, addresses,
					phone numbers, or anything identifying you.
				</p>
			</div>

			<TurnstileWidget siteKey={data.siteKey} action="feedback" {resetKey} />

			<button
				type="submit"
				disabled={submitting}
				aria-busy={submitting}
				class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded
					   bg-navy text-white text-sm font-medium hover:bg-navy/90 transition-colors
					   disabled:opacity-60 disabled:cursor-not-allowed
					   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy
					   dark:focus-visible:ring-amber-400"
			>
				<Send size={15} aria-hidden="true" />
				{submitting ? 'Sending…' : 'Send feedback'}
			</button>
		</form>

		<p class="mt-4 text-xs text-stone-500 dark:text-slate-400 leading-relaxed">
			Reports are filed publicly as GitHub issues using only the text above plus a timestamp
			and app version. We don't ask for or collect your name, email address, or account.
			We don't store or log your IP address; it's used transiently to rate-limit abuse and
			sent to Cloudflare only to verify the challenge.
		</p>
	{/if}
</main>
