/**
 * Minimal Node ESM loader for the dependency-free search tests.
 *
 * The app's search service is TypeScript that imports via the `$lib` alias and
 * imports JSON without import attributes — neither is resolvable by plain Node.
 * This loader (Node built-ins only, no test framework, no bundler) maps:
 *   - `$lib/*`          → `<repo>/src/lib/*` (with extension probing)
 *   - extensionless `./x` → the real `.ts`/`.js`/`.json` file
 *   - `*.json`          → loaded as a JSON module without an import attribute
 *
 * Node's built-in type stripping handles the `.ts` files themselves.
 *
 * Registered by scripts/test-search.mjs. Area 1/2 — search-overhaul.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const libDir = path.join(repoRoot, 'src', 'lib');

/** Return the first existing candidate (with common extensions) or null. */
function probe(base) {
	const candidates = [
		base,
		`${base}.ts`,
		`${base}.js`,
		`${base}.mjs`,
		path.join(base, 'index.ts'),
		path.join(base, 'index.js')
	];
	for (const candidate of candidates) {
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

export async function resolve(specifier, context, nextResolve) {
	if (specifier === '$lib' || specifier.startsWith('$lib/')) {
		const rel = specifier === '$lib' ? 'index' : specifier.slice('$lib/'.length);
		const target = probe(path.join(libDir, rel));
		if (target) return { url: pathToFileURL(target).href, shortCircuit: true };
	}
	if (specifier.startsWith('.') && context.parentURL && context.parentURL.startsWith('file:')) {
		const parentDir = path.dirname(fileURLToPath(context.parentURL));
		const target = probe(path.resolve(parentDir, specifier));
		if (target) return { url: pathToFileURL(target).href, shortCircuit: true };
	}
	return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
	if (url.endsWith('.json')) {
		const source = await readFile(fileURLToPath(url), 'utf8');
		return { format: 'json', source, shortCircuit: true };
	}
	return nextLoad(url, context);
}
