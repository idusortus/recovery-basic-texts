<script lang="ts">
	import { online } from '$lib/stores/online';
	import { showToast } from '$lib/stores/toast';

	const {
		href,
		children,
		class: className = '',
		...rest
	}: {
		href: string;
		children: import('svelte').Snippet;
		class?: string;
		[key: string]: unknown;
	} = $props();

	function handleClick(e: MouseEvent) {
		if (!$online) {
			e.preventDefault();
			showToast(
				"You're offline — this link needs an internet connection.",
				'warning'
			);
		}
	}
</script>

<a
	{href}
	class={className}
	onclick={handleClick}
	target="_blank"
	rel="noopener noreferrer"
	{...rest}
>
	{@render children()}
</a>
