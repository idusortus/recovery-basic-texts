<script lang="ts">
	import { page } from '$app/stores';
	import { online } from '$lib/stores/online';
	import {
		Search,
		BookOpen,
		Tag,
		Library,
		Info,
		Sun,
		Moon,
		Wifi,
		WifiOff,
		Menu,
		X
	} from '@lucide/svelte';

	const {
		isDark,
		ontoggleTheme
	}: {
		isDark: boolean;
		ontoggleTheme: () => void;
	} = $props();

	let mobileOpen = $state(false);

	const navLinks = [
		{ href: '/', label: 'Concordance', Icon: Search },
		{
			href: 'https://www.aa.org/daily-reflections',
			label: 'Daily Reflection',
			Icon: BookOpen,
			external: true
		},
		{ href: '/topics', label: 'Topics', Icon: Tag },
		{ href: '/sources', label: 'Sources', Icon: Library },
		{ href: '/about', label: 'About', Icon: Info }
	];

	function isActive(href: string): boolean {
		if (href === '/') return $page.url.pathname === '/';
		if (href.startsWith('http')) return false;
		return $page.url.pathname.startsWith(href);
	}

	function closeMobile() {
		mobileOpen = false;
	}
</script>

<nav
	class="sticky top-0 z-40 border-b border-stone-200 dark:border-slate-800
		   bg-stone-50/90 dark:bg-slate-950/90 backdrop-blur-sm transition-colors duration-200"
	aria-label="Main navigation"
>
	<div class="max-w-6xl mx-auto px-4">
		<div class="flex items-center h-14 gap-4">

			<!-- Logo -->
			<a
				href="/"
				onclick={closeMobile}
				class="flex items-center gap-2.5 flex-shrink-0 focus-visible:outline-none
					   focus-visible:ring-2 focus-visible:ring-navy dark:focus-visible:ring-amber-400 rounded"
				aria-label="basictexts.org home"
			>
				<span
					class="flex items-center justify-center w-8 h-8 rounded bg-navy text-white
						   font-serif italic text-sm leading-none select-none"
					aria-hidden="true"
				>bt</span>
				<span class="hidden sm:block">
					<span class="block text-sm font-semibold text-navy dark:text-slate-200 leading-tight">
						basictexts.org
					</span>
					<span class="block text-[10px] text-stone-400 dark:text-slate-500 uppercase tracking-widest leading-tight">
						AA Concordance
					</span>
				</span>
			</a>

			<!-- Desktop nav links -->
			<div class="hidden md:flex items-center gap-1 ml-2">
				{#each navLinks as { href, label, Icon, external = false } (href)}
					<a
						{href}
						target={external ? '_blank' : undefined}
						rel={external ? 'noopener noreferrer' : undefined}
						class="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium
							   transition-colors duration-150
							   {isActive(href)
								   ? 'bg-navy text-white dark:bg-slate-800 dark:text-amber-400'
								   : 'text-stone-600 dark:text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-800'}"
						aria-current={isActive(href) ? 'page' : undefined}
					>
						<Icon size={14} aria-hidden={true} />
						{label}
					</a>
				{/each}
			</div>

			<!-- Spacer -->
			<div class="flex-1"></div>

			<!-- Online/offline badge -->
			<div
				class="hidden sm:flex items-center gap-1 text-xs font-medium
					   {$online
					   	? 'text-green-600 dark:text-green-400'
					   	: 'text-amber-600 dark:text-amber-400'}"
				role="status"
				aria-label={$online ? 'Online' : 'Offline'}
				title={$online ? 'Connected' : 'Offline — search still works'}
			>
				{#if $online}
					<Wifi size={14} aria-hidden={true} />
				{:else}
					<span class="animate-pulse">
						<WifiOff size={14} aria-hidden={true} />
					</span>
					<span class="hidden lg:inline">Offline</span>
				{/if}
			</div>

			<!-- Theme toggle -->
			<button
				type="button"
				onclick={ontoggleTheme}
				class="flex items-center justify-center w-8 h-8 rounded
					   text-stone-500 dark:text-slate-400
					   hover:bg-stone-100 dark:hover:bg-slate-800
					   transition-colors duration-150 focus-visible:outline-none
					   focus-visible:ring-2 focus-visible:ring-navy dark:focus-visible:ring-amber-400"
				aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
			>
				{#if isDark}
					<Sun size={16} aria-hidden={true} />
				{:else}
					<Moon size={16} aria-hidden={true} />
				{/if}
			</button>

			<!-- Mobile hamburger -->
			<button
				type="button"
				onclick={() => (mobileOpen = !mobileOpen)}
				class="md:hidden flex items-center justify-center w-8 h-8 rounded
					   text-stone-500 dark:text-slate-400
					   hover:bg-stone-100 dark:hover:bg-slate-800
					   transition-colors duration-150 focus-visible:outline-none
					   focus-visible:ring-2 focus-visible:ring-navy dark:focus-visible:ring-amber-400"
				aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
				aria-expanded={mobileOpen}
			>
				{#if mobileOpen}
					<X size={18} aria-hidden={true} />
				{:else}
					<Menu size={18} aria-hidden={true} />
				{/if}
			</button>
		</div>
	</div>

	<!-- Mobile overlay menu -->
	{#if mobileOpen}
		<div
			class="md:hidden border-t border-stone-200 dark:border-slate-800
				   bg-stone-50 dark:bg-slate-950 animate-fade-in"
			role="dialog"
			aria-modal="true"
			aria-label="Mobile navigation"
		>
			<div class="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-1">
				{#each navLinks as { href, label, Icon, external = false } (href)}
					<a
						{href}
						target={external ? '_blank' : undefined}
						rel={external ? 'noopener noreferrer' : undefined}
						onclick={closeMobile}
						class="flex items-center gap-2.5 px-3 py-2.5 rounded text-sm font-medium
							   transition-colors duration-150
							   {isActive(href)
								   ? 'bg-navy text-white dark:bg-slate-800 dark:text-amber-400'
								   : 'text-stone-700 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800'}"
						aria-current={isActive(href) ? 'page' : undefined}
					>
						<Icon size={16} aria-hidden={true} />
						{label}
					</a>
				{/each}

				<!-- Online badge in mobile menu -->
				<div
					class="flex items-center gap-1.5 px-3 py-2 text-xs font-medium
						   {$online ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}"
				>
					{#if $online}
						<Wifi size={14} aria-hidden={true} />
						<span>Online</span>
					{:else}
						<WifiOff size={14} aria-hidden={true} class="animate-pulse" />
						<span>Offline — search still works</span>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</nav>
