#!/usr/bin/env node
/**
 * build-index.mjs
 *
 * Reads corpus/sources.json (registry) + all corpus/sources/<id>.json files,
 * builds a deterministic minisearch index and concordance index, and emits
 * four static assets:
 *
 *   static/index/minisearch.json    — serialized minisearch index
 *   static/index/passages.json      — id → passage lookup (with text for KWIC)
 *   static/index/concordance.json   — normalized term → [{passageId, offsets}]
 *   static/index/index-meta.json    — { version, builtAt, sources, concordance }
 *
 * Version is a deterministic SHA-256 over the corpus inputs AND the
 * tokenizer/index-schema code (see ./index-version.mjs), so identical inputs
 * always produce the same version and a normalizer/format change bumps it.
 *
 * Usage:  node corpus/scripts/build-index.mjs
 * Wired into: npm run build via package.json
 *
 * LUW 4 — PRD §7.2
 * Issue B — concordance index
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import MiniSearch from 'minisearch';
import { buildConcordance } from './concordance-utils.mjs';
import { computeIndexVersion } from './index-version.mjs';
import { tokenize, processTerm } from '../../src/lib/search/normalize.js';

// ─── Paths ───────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(__filename, '../../..');
const corpusRoot = join(repoRoot, 'corpus');
const outDir = join(repoRoot, 'static', 'index');

// ─── Load registry ────────────────────────────────────────────────────────────

const registryPath = join(corpusRoot, 'sources.json');
const registry = JSON.parse(readFileSync(registryPath, 'utf-8'));

console.log(`[build-index] Registry: ${registry.length} source(s) found`);

// ─── Load corpus files ────────────────────────────────────────────────────────

/** @typedef {{ id: string, sourceId: string, title: string, sequence: number, date: string|null, pageRef: string|null, chapterRef: string|null, text: string, linkData: Record<string,string>|null }} Passage */

/** @type {Passage[]} */
const allPassages = [];
/** @type {Record<string, { id: string, passageCount: number }>} */
const sourceMeta = {};

// Process sources in sortOrder (deterministic)
const sortedSources = [...registry].sort((a, b) => a.sortOrder - b.sortOrder);

for (const source of sortedSources) {
	if (!source.enabled) {
		console.log(`[build-index] Skipping disabled source: ${source.id}`);
		continue;
	}

	const corpusPath = join(corpusRoot, 'sources', `${source.id}.json`);
	if (!existsSync(corpusPath)) {
		console.warn(`[build-index] WARN: No corpus file for enabled source "${source.id}" at ${corpusPath}`);
		continue;
	}

	const raw = JSON.parse(readFileSync(corpusPath, 'utf-8'));
	if (!Array.isArray(raw)) {
		throw new Error(`Corpus file for "${source.id}" is not an array`);
	}

	// Validate and normalize passages
	const passages = raw.map((p, i) => {
		if (typeof p.id !== 'string' || !p.id) {
			throw new Error(`${source.id}[${i}].id must be a non-empty string`);
		}
		if (p.sourceId !== source.id) {
			throw new Error(
				`${source.id}[${i}].sourceId "${p.sourceId}" does not match registry id "${source.id}"`
			);
		}
		if (typeof p.text !== 'string' || !p.text) {
			throw new Error(`${source.id}[${i}].text must be a non-empty string`);
		}
		return {
			id: p.id,
			sourceId: p.sourceId,
			title: String(p.title ?? ''),
			sequence: Number(p.sequence ?? 0),
			date: p.date ?? null,
			pageRef: p.pageRef ?? null,
			chapterRef: p.chapterRef ?? null,
			text: p.text,
			linkData: p.linkData ?? null
		};
	});

	// Sort by sequence (deterministic)
	passages.sort((a, b) => a.sequence - b.sequence);

	allPassages.push(...passages);
	sourceMeta[source.id] = { id: source.id, passageCount: passages.length };
	console.log(`[build-index] Loaded ${passages.length} passages from "${source.id}"`);
}

console.log(`[build-index] Total: ${allPassages.length} passages across ${Object.keys(sourceMeta).length} source(s)`);

// ─── Build minisearch index ───────────────────────────────────────────────────

// Tokenization comes from the shared canonical module (src/lib/search/normalize.ts)
// so MiniSearch tokenizes indexed fields and queries exactly like the concordance
// index. No separate field-level normalization is applied — processTerm handles
// lowercasing/apostrophe stripping on both sides.
const ms = new MiniSearch({
	fields: ['text', 'title', 'chapterRef'],
	storeFields: ['id', 'sourceId'],
	idField: 'id',
	tokenize,
	processTerm
});

ms.addAll(
	allPassages.map((p) => ({
		id: p.id,
		sourceId: p.sourceId,
		title: p.title ?? '',
		chapterRef: p.chapterRef ?? '',
		text: p.text
	}))
);

// ─── Build passages lookup ────────────────────────────────────────────────────

/** @type {Record<string, Omit<Passage, 'text'> & { text: string }>} */
const passageLookup = {};
for (const p of allPassages) {
	passageLookup[p.id] = p;
}

// ─── Build concordance index ──────────────────────────────────────────────────

const concordance = buildConcordance(allPassages);
const termCount = Object.keys(concordance).length;
const totalOccurrences = Object.values(concordance).reduce(
	(sum, occs) => sum + occs.reduce((s, o) => s + o.offsets.length, 0),
	0
);

console.log(`[build-index] Concordance: ${termCount} terms, ${totalOccurrences} total occurrences`);

// ─── Compute deterministic version hash ──────────────────────────────────────

// The version covers the corpus inputs AND the tokenizer/index-schema code, so a
// normalizer or index-format change invalidates cached clients. See
// ./index-version.mjs (also used by ./validate.js to detect a stale index).
const version = computeIndexVersion(repoRoot, registry);

// ─── Emit output files ────────────────────────────────────────────────────────

mkdirSync(outDir, { recursive: true });

const minisearchJson = JSON.stringify(ms.toJSON());
writeFileSync(join(outDir, 'minisearch.json'), minisearchJson, 'utf-8');

const passagesJson = JSON.stringify(passageLookup);
writeFileSync(join(outDir, 'passages.json'), passagesJson, 'utf-8');

const concordanceJson = JSON.stringify(concordance);
writeFileSync(join(outDir, 'concordance.json'), concordanceJson, 'utf-8');

const indexMeta = {
	version,
	builtAt: new Date().toISOString(),
	sources: Object.values(sourceMeta),
	concordance: { termCount, totalOccurrences }
};
writeFileSync(join(outDir, 'index-meta.json'), JSON.stringify(indexMeta, null, 2), 'utf-8');

console.log(`[build-index] ✓ Emitted static/index/ (version: ${version})`);
console.log(`  minisearch.json   ${(minisearchJson.length / 1024).toFixed(1)} KB`);
console.log(`  passages.json     ${(passagesJson.length / 1024).toFixed(1)} KB`);
console.log(`  concordance.json  ${(concordanceJson.length / 1024).toFixed(1)} KB  (${termCount} terms)`);
console.log(`  index-meta.json   (version: ${version})`);
