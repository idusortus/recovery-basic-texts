#!/usr/bin/env node
/**
 * validate.js
 *
 * Schema + referential-integrity validation for corpus files.
 * Exits with code 1 if any validation fails.
 *
 * Usage:  node corpus/scripts/validate.js
 *         node corpus/scripts/validate.js big-book-1ed   (single source)
 *
 * LUW 4 — PRD §6.5
 * Updated for Issue A: validates locator/citation/checksum fields when present,
 * and enforces edition metadata when a pagemap exists for the source.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(__filename, '../../..');
const corpusRoot = join(repoRoot, 'corpus');

const VALID_DISPLAY_MODES = new Set(['full-text', 'concordance-only', 'snippet']);
const VALID_COPYRIGHT = new Set(['public-domain', 'protected', 'unknown']);
const SHA1_RE = /^[0-9a-f]{40}$/;

let errors = 0;

function fail(msg) {
	console.error(`  ✗ ${msg}`);
	errors++;
}

function pass(msg) {
	console.log(`  ✓ ${msg}`);
}

// ─── Load and validate registry ───────────────────────────────────────────────

const registryPath = join(corpusRoot, 'sources.json');
console.log('\n[validate] Registry: corpus/sources.json');

let registry;
try {
	registry = JSON.parse(readFileSync(registryPath, 'utf-8'));
} catch (e) {
	fail(`Failed to parse sources.json: ${e.message}`);
	process.exit(1);
}

if (!Array.isArray(registry)) {
	fail('sources.json must be an array');
	process.exit(1);
}

const seenSourceIds = new Set();
for (const [i, source] of registry.entries()) {
	const prefix = `sources.json[${i}]`;

	if (typeof source.id !== 'string' || !source.id) fail(`${prefix}.id must be a non-empty string`);
	else if (seenSourceIds.has(source.id)) fail(`${prefix}: duplicate id "${source.id}"`);
	else seenSourceIds.add(source.id);

	if (typeof source.title !== 'string') fail(`${prefix}.title must be a string`);
	if (typeof source.shortTitle !== 'string') fail(`${prefix}.shortTitle must be a string`);
	if (!VALID_DISPLAY_MODES.has(source.displayMode))
		fail(`${prefix}.displayMode must be one of: ${[...VALID_DISPLAY_MODES].join(', ')}`);
	if (!VALID_COPYRIGHT.has(source.copyright))
		fail(`${prefix}.copyright must be one of: ${[...VALID_COPYRIGHT].join(', ')}`);
	if (typeof source.contextWords !== 'number')
		fail(`${prefix}.contextWords must be a number`);
	if (typeof source.sortOrder !== 'number') fail(`${prefix}.sortOrder must be a number`);
	if (typeof source.enabled !== 'boolean') fail(`${prefix}.enabled must be a boolean`);

	// Validate edition metadata when present
	if (source.edition != null) {
		const e = source.edition;
		const ep = `${prefix}.edition`;
		if (typeof e.edition !== 'string') fail(`${ep}.edition must be a string`);
		if (typeof e.year !== 'number') fail(`${ep}.year must be a number`);
		if (typeof e.publisher !== 'string') fail(`${ep}.publisher must be a string`);
	}

	// Require edition metadata when a pagemap file exists
	const pagemapPath = join(corpusRoot, 'sources', `${source.id}.pagemap.json`);
	if (existsSync(pagemapPath) && source.edition == null) {
		fail(`${prefix}: has a pagemap but is missing required "edition" metadata in sources.json`);
	}
}

if (errors === 0) pass(`Registry: ${registry.length} sources valid`);

// ─── Validate corpus files ────────────────────────────────────────────────────

const targetId = process.argv[2];
const sourcesToCheck = targetId
	? registry.filter((s) => s.id === targetId)
	: registry.filter((s) => s.enabled);

for (const source of sourcesToCheck) {
	const corpusPath = join(corpusRoot, 'sources', `${source.id}.json`);
	console.log(`\n[validate] ${source.id}: ${corpusPath}`);

	if (!existsSync(corpusPath)) {
		if (source.enabled) fail(`Missing corpus file for enabled source "${source.id}"`);
		else pass(`Corpus file not yet present (source is disabled)`);
		continue;
	}

	let passages;
	try {
		passages = JSON.parse(readFileSync(corpusPath, 'utf-8'));
	} catch (e) {
		fail(`Failed to parse ${source.id}.json: ${e.message}`);
		continue;
	}

	if (!Array.isArray(passages)) {
		fail(`${source.id}.json must be an array`);
		continue;
	}

	const seenIds = new Set();
	for (const [i, p] of passages.entries()) {
		const prefix = `${source.id}[${i}]`;

		if (typeof p.id !== 'string' || !p.id)
			fail(`${prefix}.id must be a non-empty string`);
		else if (seenIds.has(p.id))
			fail(`${prefix}: duplicate id "${p.id}"`);
		else
			seenIds.add(p.id);

		if (p.sourceId !== source.id)
			fail(`${prefix}.sourceId "${p.sourceId}" must match registry id "${source.id}"`);
		if (typeof p.title !== 'string') fail(`${prefix}.title must be a string`);
		if (typeof p.sequence !== 'number') fail(`${prefix}.sequence must be a number`);
		if (p.date !== null && typeof p.date !== 'string') fail(`${prefix}.date must be a string or null`);
		if (p.pageRef !== undefined && p.pageRef !== null && typeof p.pageRef !== 'string')
			fail(`${prefix}.pageRef must be a string or null`);
		if (typeof p.text !== 'string' || !p.text.trim())
			fail(`${prefix}.text must be a non-empty string`);

		// Validate optional locator field when present
		if (p.locator != null) {
			const loc = p.locator;
			if (typeof loc.chapter !== 'string' || !loc.chapter)
				fail(`${prefix}.locator.chapter must be a non-empty string`);
			if (typeof loc.chapterTitle !== 'string')
				fail(`${prefix}.locator.chapterTitle must be a string`);
			if (loc.printedPage !== null && typeof loc.printedPage !== 'number')
				fail(`${prefix}.locator.printedPage must be a number or null`);
			if (typeof loc.paragraphIndex !== 'number' || loc.paragraphIndex < 0)
				fail(`${prefix}.locator.paragraphIndex must be a non-negative number`);
		}

		// Validate optional citation field when present
		if (p.citation != null && typeof p.citation !== 'string')
			fail(`${prefix}.citation must be a string or null`);

		// Validate optional checksum field when present — must be a SHA-1 hex string
		if (p.checksum != null) {
			if (typeof p.checksum !== 'string' || !SHA1_RE.test(p.checksum))
				fail(`${prefix}.checksum must be a 40-character lowercase hex string (SHA-1)`);
		}
	}

	pass(`${passages.length} passages, ${seenIds.size} unique IDs`);

	// ── Validate pagemap schema if present ──────────────────────────────────
	const pagemapPath = join(corpusRoot, 'sources', `${source.id}.pagemap.json`);
	if (existsSync(pagemapPath)) {
		let pagemap;
		try {
			pagemap = JSON.parse(readFileSync(pagemapPath, 'utf-8'));
		} catch (e) {
			fail(`Failed to parse ${source.id}.pagemap.json: ${e.message}`);
			continue;
		}
		if (pagemap.sourceId !== source.id)
			fail(`${source.id}.pagemap.json sourceId "${pagemap.sourceId}" must match "${source.id}"`);
		if (typeof pagemap.editionRef !== 'string' || !pagemap.editionRef)
			fail(`${source.id}.pagemap.json editionRef must be a non-empty string`);
		if (!Array.isArray(pagemap.entries))
			fail(`${source.id}.pagemap.json entries must be an array`);
		else {
			for (const [i, entry] of pagemap.entries.entries()) {
				const ep = `${source.id}.pagemap.json entries[${i}]`;
				if (typeof entry.corpusPageRef !== 'string' || !entry.corpusPageRef)
					fail(`${ep}.corpusPageRef must be a non-empty string`);
				if (entry.printedPage !== null && typeof entry.printedPage !== 'number')
					fail(`${ep}.printedPage must be a number or null`);
				if (typeof entry.chapter !== 'string' || !entry.chapter)
					fail(`${ep}.chapter must be a non-empty string`);
				if (typeof entry.anchor !== 'string' || !entry.anchor)
					fail(`${ep}.anchor must be a non-empty string`);
			}
			pass(`Pagemap: ${pagemap.entries.length} entries valid`);
		}
	}
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('');
if (errors > 0) {
	console.error(`[validate] FAILED — ${errors} error(s) found`);
	process.exit(1);
} else {
	console.log('[validate] ✓ All checks passed');
}
