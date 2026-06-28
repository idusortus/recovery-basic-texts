#!/usr/bin/env node
/**
 * build-index.mjs
 *
 * Reads corpus/sources.json (registry) + all corpus/sources/<id>.json files,
 * builds a deterministic minisearch index, and emits three static assets:
 *
 *   static/index/minisearch.json   — serialized minisearch index
 *   static/index/passages.json     — id → passage lookup (with text for KWIC)
 *   static/index/index-meta.json   — { version, builtAt, sources }
 *
 * Version is a SHA-256 content hash of all corpus inputs combined deterministically,
 * so identical inputs always produce the same version hash.
 *
 * Usage:  node corpus/scripts/build-index.mjs
 * Wired into: npm run build via package.json
 *
 * LUW 4 — PRD §7.2
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import MiniSearch from 'minisearch';

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

const ms = new MiniSearch({
	fields: ['text', 'title', 'chapterRef'],
	storeFields: ['id', 'sourceId'],
	idField: 'id',
	searchOptions: {
		boost: { text: 2 },
		prefix: false,
		fuzzy: 0.15
	}
});

ms.addAll(allPassages);

// ─── Build passages lookup ────────────────────────────────────────────────────

/** @type {Record<string, Omit<Passage, 'text'> & { text: string }>} */
const passageLookup = {};
for (const p of allPassages) {
	passageLookup[p.id] = p;
}

// ─── Compute deterministic version hash ──────────────────────────────────────

// Hash the inputs in a deterministic order (source IDs sorted, then passage IDs sorted)
const hash = createHash('sha256');

for (const source of sortedSources) {
	if (!source.enabled) continue;
	const corpusPath = join(corpusRoot, 'sources', `${source.id}.json`);
	if (existsSync(corpusPath)) {
		// Hash the raw file bytes for determinism
		hash.update(source.id + ':');
		hash.update(readFileSync(corpusPath));
		hash.update('\n');
	}
}

// Also hash the registry itself
hash.update('registry:');
hash.update(readFileSync(registryPath));

const version = hash.digest('hex').slice(0, 16);

// ─── Emit output files ────────────────────────────────────────────────────────

mkdirSync(outDir, { recursive: true });

const minisearchJson = JSON.stringify(ms.toJSON());
writeFileSync(join(outDir, 'minisearch.json'), minisearchJson, 'utf-8');

const passagesJson = JSON.stringify(passageLookup);
writeFileSync(join(outDir, 'passages.json'), passagesJson, 'utf-8');

const indexMeta = {
	version,
	builtAt: new Date().toISOString(),
	sources: Object.values(sourceMeta)
};
writeFileSync(join(outDir, 'index-meta.json'), JSON.stringify(indexMeta, null, 2), 'utf-8');

console.log(`[build-index] ✓ Emitted static/index/ (version: ${version})`);
console.log(`  minisearch.json  ${(minisearchJson.length / 1024).toFixed(1)} KB`);
console.log(`  passages.json    ${(passagesJson.length / 1024).toFixed(1)} KB`);
console.log(`  index-meta.json  (version: ${version})`);
