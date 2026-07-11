#!/usr/bin/env node
/**
 * verify-citations.mjs
 *
 * Verifies pagemap artifacts against their corpus files.
 *
 * For each source that has a <source-id>.pagemap.json file this script:
 *   1. Checks every chapter boundary listed in the pagemap exists in the corpus.
 *   2. Checks the anchor text appears at the start of the first passage for that chapter/pageRef.
 *   3. Verifies any passage-level checksum fields match a fresh SHA-1 of the normalised text.
 *
 * Exits with code 1 if any check fails.
 *
 * Usage:  node corpus/scripts/verify-citations.mjs
 *         node corpus/scripts/verify-citations.mjs big-book-2ed   (single source)
 *
 * Issue A — PR 1 (issue-6-pr-issue-breakdown.md)
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(__filename, '../../..');
const corpusRoot = join(repoRoot, 'corpus');

let errors = 0;
let warnings = 0;

function fail(msg) {
	console.error(`  ✗ ${msg}`);
	errors++;
}

function warn(msg) {
	console.warn(`  ⚠ ${msg}`);
	warnings++;
}

function pass(msg) {
	console.log(`  ✓ ${msg}`);
}

/**
 * Normalise passage text the same way checksums should be computed:
 * lower-case, collapse all whitespace to single spaces, trim.
 * @param {string} text
 * @returns {string}
 */
function normaliseText(text) {
	return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Compute SHA-1 hex digest of the normalised text.
 * @param {string} text
 * @returns {string}
 */
function sha1(text) {
	return createHash('sha1').update(normaliseText(text), 'utf-8').digest('hex');
}

// ─── Load registry ────────────────────────────────────────────────────────────

const registryPath = join(corpusRoot, 'sources.json');
let registry;
try {
	registry = JSON.parse(readFileSync(registryPath, 'utf-8'));
} catch (e) {
	console.error(`[verify-citations] Failed to parse sources.json: ${e.message}`);
	process.exit(1);
}

// ─── Determine which sources to check ────────────────────────────────────────

const targetId = process.argv[2];
const sourcesToCheck = targetId ? registry.filter((s) => s.id === targetId) : registry;

if (targetId && sourcesToCheck.length === 0) {
	console.error(`[verify-citations] Source "${targetId}" not found in sources.json`);
	process.exit(1);
}

let pagemapsChecked = 0;

for (const source of sourcesToCheck) {
	const pagemapPath = join(corpusRoot, 'sources', `${source.id}.pagemap.json`);

	if (!existsSync(pagemapPath)) {
		console.log(`[verify-citations] ${source.id}: no pagemap — skipping`);
		continue;
	}

	console.log(`\n[verify-citations] ${source.id}: ${source.id}.pagemap.json`);
	pagemapsChecked++;

	// Load pagemap
	let pagemap;
	try {
		pagemap = JSON.parse(readFileSync(pagemapPath, 'utf-8'));
	} catch (e) {
		fail(`Failed to parse ${source.id}.pagemap.json: ${e.message}`);
		continue;
	}

	// Load corpus
	const corpusPath = join(corpusRoot, 'sources', `${source.id}.json`);
	if (!existsSync(corpusPath)) {
		fail(`Corpus file missing: corpus/sources/${source.id}.json`);
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
		fail(`corpus/sources/${source.id}.json must be an array`);
		continue;
	}

	// Index passages by chapterRef + pageRef for fast lookup
	/** @type {Map<string, object[]>} key = "chapterRef|pageRef" */
	const byChapterPage = new Map();
	/** @type {Map<string, object[]>} key = chapterRef */
	const byChapter = new Map();

	for (const p of passages) {
		const cpKey = `${p.chapterRef}|${p.pageRef}`;
		if (!byChapterPage.has(cpKey)) byChapterPage.set(cpKey, []);
		byChapterPage.get(cpKey).push(p);

		const cKey = p.chapterRef ?? '';
		if (!byChapter.has(cKey)) byChapter.set(cKey, []);
		byChapter.get(cKey).push(p);
	}

	// ── 1. Verify pagemap entries ─────────────────────────────────────────────

	let entryPasses = 0;
	for (const [i, entry] of pagemap.entries.entries()) {
		const label = `entries[${i}] (${entry.chapter}, ${entry.corpusPageRef})`;

		// Check the chapter exists in the corpus
		if (!byChapter.has(entry.chapter)) {
			fail(`${label}: chapter "${entry.chapter}" not found in corpus`);
			continue;
		}

		// Find the first passage in that chapter at the expected pageRef
		const cpKey = `${entry.chapter}|${entry.corpusPageRef}`;
		const candidates = byChapterPage.get(cpKey);

		if (!candidates || candidates.length === 0) {
			fail(`${label}: no passage found with chapterRef="${entry.chapter}" and pageRef="${entry.corpusPageRef}"`);
			continue;
		}

		// Sort by sequence and take the first
		const firstPassage = candidates.slice().sort((a, b) => a.sequence - b.sequence)[0];

		// Check anchor text appears at the start of the passage text (case-insensitive)
		const textLower = firstPassage.text.toLowerCase();
		const anchorLower = entry.anchor.toLowerCase();

		if (!textLower.startsWith(anchorLower)) {
			// Allow anchor to appear within the first 80 chars (handles chapter headings split across lines)
			if (textLower.slice(0, 80).includes(anchorLower)) {
				warn(`${label}: anchor found in first 80 chars but not at position 0`);
			} else {
				fail(
					`${label}: anchor text not found at start of passage.\n` +
					`  Expected anchor: "${entry.anchor}"\n` +
					`  Passage starts:  "${firstPassage.text.slice(0, 80)}..."`
				);
				continue;
			}
		}

		entryPasses++;
	}

	pass(`${entryPasses}/${pagemap.entries.length} pagemap entries verified`);

	// ── 2. Verify passage checksums ───────────────────────────────────────────

	let checksumPasses = 0;
	let checksumMismatches = 0;
	let checksumPresent = 0;

	for (const p of passages) {
		if (p.checksum == null) continue;
		checksumPresent++;

		const expected = sha1(p.text);
		if (p.checksum !== expected) {
			fail(
				`passage "${p.id}": checksum mismatch.\n` +
				`  Stored:   ${p.checksum}\n` +
				`  Expected: ${expected}`
			);
			checksumMismatches++;
		} else {
			checksumPasses++;
		}
	}

	if (checksumPresent === 0) {
		console.log(`  (no passages have checksums yet — add them for stronger integrity)`);
	} else {
		pass(`${checksumPasses}/${checksumPresent} passage checksums verified`);
	}
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('');

if (pagemapsChecked === 0) {
	console.log('[verify-citations] No pagemaps found — nothing to verify');
	process.exit(0);
}

if (errors > 0) {
	console.error(`[verify-citations] FAILED — ${errors} error(s)`);
	if (warnings > 0) console.warn(`[verify-citations] ${warnings} warning(s)`);
	process.exit(1);
} else {
	if (warnings > 0) console.warn(`[verify-citations] ✓ Passed with ${warnings} warning(s)`);
	else console.log('[verify-citations] ✓ All checks passed');
}
