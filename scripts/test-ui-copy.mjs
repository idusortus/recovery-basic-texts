#!/usr/bin/env node
/**
 * Dependency-free regression guard for the `ui-copy` capability: app-authored
 * copy shown to visitors must contain no em dash (U+2014).
 *
 * Run with: `pnpm run test:ui-copy`.
 *
 * Contract under test (ui-copy spec): the app-authored parts of rendered copy,
 * document metadata, accessible names, messages, and the clipboard/citation
 * strings contain no U+2014. Corpus text, source comments/JSDoc, and
 * data-matching identifiers are out of scope.
 *
 * Two checks:
 *   1. `buildCitation()` — the clipboard payload's app-authored attribution
 *      must use no U+2014.
 *   2. Source scan — every `src/**\/*.{svelte,ts,js}` file has all comment
 *      forms stripped before scanning, because the tree legitimately contains
 *      em dashes inside comments. Two out-of-scope remainders are permitted:
 *      the data literal `'Chapter 5 — How It Works'` in
 *      `src/lib/search/index.ts` (compared against corpus `chapterRef`), and
 *      the reserved, unrendered `{#if SHOW_SUPPORT}` block on `about/+page.svelte`
 *      (owned by the separate `hide-support-project-info` change).
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { buildCitation } = await import('../src/lib/search/kwic.ts');

const EM_DASH = '\u2014';
const ROOT = fileURLToPath(new URL('..', import.meta.url));

// ─── 1. Clipboard citation helper ─────────────────────────────────────────────

// A representative full-text citation: excerpt + source, chapter, and page.
const citation = buildCitation(
	'We are going to know a new freedom.',
	'Alcoholics Anonymous',
	'Chapter 5',
	'83'
);
assert.ok(
	!citation.includes(EM_DASH),
	`buildCitation() app-authored attribution contains U+2014:\n${citation}`
);
// Guard against an empty/renamed helper silently passing the check.
assert.ok(
	citation.includes('From Alcoholics Anonymous'),
	`buildCitation() attribution lead-in is not "From ...":\n${citation}`
);

// ─── 2. Source scan ───────────────────────────────────────────────────────────

/**
 * Remove every comment form so only potentially-visible source remains:
 * HTML comments (`<!-- ... -->`, Svelte templates), block comments including
 * JSDoc (`/* ... *\/`), and line comments (`//`, at line start or mid-line).
 *
 * Line comments are stripped line by line; HTML/block comments are stripped
 * across the whole file. This is deliberately not a full parser — it is
 * conservative enough that any surviving U+2014 is real source, not a comment.
 */
function stripComments(source) {
	// HTML comments (can span lines).
	let out = source.replace(/<!--[\s\S]*?-->/g, '');
	// JSDoc/block comments (can span lines).
	out = out.replace(/\/\*[\s\S]*?\*\//g, '');
	// Line comments, including mid-line trailing comments. Naive `//` stripping
	// could mangle a string containing `//` (e.g. a URL scheme); no such literal
	// carries an em dash on the same line, so a false strip cannot hide a hit we
	// need, and a false positive is impossible because we only remove text.
	out = out
		.split('\n')
		.map((line) => {
			const idx = line.indexOf('//');
			return idx === -1 ? line : line.slice(0, idx);
		})
		.join('\n');
	return out;
}

/**
 * Remove `{#if SHOW_SUPPORT}...{/if}` blocks. That section in
 * `about/+page.svelte` is reserved, unrendered (the flag is `false`), and owned
 * by the separate `hide-support-project-info` change; its copy is never shown
 * to a visitor, so it is not "app-authored copy shown to visitors" and is
 * explicitly out of scope for this change. The replacement is newline-preserving
 * so line numbers in reported violations stay accurate.
 */
function stripGuardedSupportBlocks(source) {
	return source.replace(/\{#if SHOW_SUPPORT\}[\s\S]*?\{\/if\}/g, (match) =>
		'\n'.repeat((match.match(/\n/g) ?? []).length)
	);
}

function collectFiles(dir, acc = []) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) collectFiles(full, acc);
		else if (/\.(svelte|ts|js)$/.test(entry.name)) acc.push(full);
	}
	return acc;
}

// The one permitted remainder: the corpus-matching data literal in
// `src/lib/search/index.ts`. Kept explicit and stable so the exception cannot
// silently widen.
const ALLOWED_DATA_LITERAL = "'Chapter 5 \u2014 How It Works'";
const INDEX_FILE = join('src', 'lib', 'search', 'index.ts');

const violations = [];
for (const file of collectFiles(join(ROOT, 'src'))) {
	const source = readFileSync(file, 'utf8');
	if (!source.includes(EM_DASH)) continue;
	const stripped = stripComments(source);
	if (!stripped.includes(EM_DASH)) continue;
	const visible = stripGuardedSupportBlocks(stripped);
	if (!visible.includes(EM_DASH)) continue;

	const rel = file.slice(ROOT.length);
	visible.split('\n').forEach((line, i) => {
		if (!line.includes(EM_DASH)) return;
		if (rel === INDEX_FILE && line.includes(ALLOWED_DATA_LITERAL)) return;
		violations.push(`${rel}:${i + 1}: ${line.trim()}`);
	});
}

if (violations.length > 0) {
	console.error('U+2014 found in app-authored copy (after stripping comments):\n');
	for (const v of violations) console.error(`  ${v}`);
	console.error(`\n${violations.length} violation(s).`);
	process.exit(1);
}

console.log('ui-copy: no U+2014 in app-authored copy (citation helper + src scan).');
