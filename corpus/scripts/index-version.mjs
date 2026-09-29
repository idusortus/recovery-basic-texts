/**
 * index-version.mjs
 *
 * Single source of truth for the prebuilt search index version.
 *
 * `index-meta.version` is a deterministic SHA-256 over everything that
 * determines the index's on-disk format and token content:
 *   - the enabled corpus source files + the registry (corpus inputs)
 *   - an explicit `INDEX_SCHEMA_VERSION` (bump when the emitted JSON format changes)
 *   - the index-building/tokenizer code (build-index.mjs, concordance-utils.mjs,
 *     src/lib/search/normalize.js)
 *
 * Hashing the builder/tokenizer code means a normalizer or index-schema change
 * bumps the version without a manual bump, so a client cached against the old
 * `static/index/*` is invalidated. `corpus/scripts/validate.js` re-derives this
 * version and fails when the emitted `index-meta.json` is stale.
 *
 * Area 1 — search-overhaul (review fix: version must cover the tokenizer/schema)
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Bump when the shape of the emitted static/index/* JSON changes. */
export const INDEX_SCHEMA_VERSION = 1;

/** Repo-relative files whose contents determine tokenization / index format. */
const BUILD_INPUTS = [
	'corpus/scripts/build-index.mjs',
	'corpus/scripts/concordance-utils.mjs',
	'src/lib/search/normalize.js'
];

/**
 * Compute the deterministic version for a repo root and registry.
 *
 * @param {string} repoRoot Absolute path to the repository root.
 * @param {Array<{ id: string, enabled: boolean, sortOrder: number }>} registry Parsed corpus/sources.json.
 * @returns {string} 16-character hex version.
 */
export function computeIndexVersion(repoRoot, registry) {
	const hash = createHash('sha256');
	hash.update(`schema:${INDEX_SCHEMA_VERSION}\n`);

	const corpusRoot = join(repoRoot, 'corpus');
	const sortedSources = [...registry].sort((a, b) => a.sortOrder - b.sortOrder);

	for (const source of sortedSources) {
		if (!source.enabled) continue;
		const corpusPath = join(corpusRoot, 'sources', `${source.id}.json`);
		if (existsSync(corpusPath)) {
			hash.update(`${source.id}:`);
			hash.update(readFileSync(corpusPath));
			hash.update('\n');
		}
	}

	hash.update('registry:');
	hash.update(readFileSync(join(corpusRoot, 'sources.json')));

	for (const relativePath of BUILD_INPUTS) {
		const inputPath = join(repoRoot, relativePath);
		if (existsSync(inputPath)) {
			hash.update(`build:${relativePath}:`);
			hash.update(readFileSync(inputPath));
			hash.update('\n');
		}
	}

	return hash.digest('hex').slice(0, 16);
}
