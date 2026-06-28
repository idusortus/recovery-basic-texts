#!/usr/bin/env node
/**
 * source-daily-reflections.mjs
 *
 * Ingestion script for the Daily Reflections corpus.
 * Scrapes aa.org/daily-reflections/en/{month}/{day} for all 366 entries
 * and writes a properly-formatted corpus file to corpus/sources/daily-reflections.json
 *
 * BEFORE RUNNING: Email ippolicy@aa.org explaining your intent (concordance-only,
 * links back to aa.org). See CORPUS-GUIDE.md §Source 4. Wait for a response.
 *
 * Usage:
 *   node corpus/scripts/source-daily-reflections.mjs
 *   node corpus/scripts/source-daily-reflections.mjs --dry-run   (test first entry only)
 *
 * Output: corpus/sources/daily-reflections.json
 *
 * Phase A — PRD §4.4, §6.4
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(__filename, '../../..');
const outPath = join(repoRoot, 'corpus', 'sources', 'daily-reflections.json');

const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 1500; // polite delay between requests

// Full year of dates (including leap-year Feb 29)
function allDates() {
	const dates = [];
	const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
	const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	for (let m = 0; m < 12; m++) {
		for (let d = 1; d <= daysInMonth[m]; d++) {
			dates.push({
				month: String(m + 1).padStart(2, '0'),
				day: String(d).padStart(2, '0')
			});
		}
	}
	return dates;
}

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch and parse one daily reflection from aa.org.
 * Returns null if the page is unavailable or parsing fails.
 */
async function fetchReflection(month, day) {
	const url = `https://www.aa.org/daily-reflections/en/${month}/${day}`;
	try {
		const res = await fetch(url, {
			headers: {
				'User-Agent':
					'basictexts-corpus-builder/1.0 (open-source AA concordance; contact via github.com/[owner]/basictexts)'
			}
		});
		if (!res.ok) {
			console.warn(`  HTTP ${res.status} for ${month}/${day}`);
			return null;
		}
		const html = await res.text();
		return parseReflection(html, month, day);
	} catch (err) {
		console.warn(`  Fetch error for ${month}/${day}: ${err.message}`);
		return null;
	}
}

/**
 * Extract title and text from the aa.org HTML response.
 * NOTE: The selectors below are approximations; inspect the actual HTML
 * and adjust the parsing logic as needed.
 */
function parseReflection(html, month, day) {
	// Try to extract the title from common heading patterns
	const titleMatch =
		html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
		html.match(/<h2[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h2>/i);
	const title = titleMatch ? titleMatch[1].trim() : `Reflection for ${month}-${day}`;

	// Extract body paragraphs from the main content area
	const bodyMatch = html.match(
		/<div[^>]*class="[^"]*field--name-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i
	);
	let text = '';
	if (bodyMatch) {
		// Strip HTML tags, collapse whitespace
		text = bodyMatch[1]
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	if (!text) {
		console.warn(`  Could not parse body for ${month}/${day}`);
		return null;
	}

	return { title, text };
}

async function run() {
	console.log('Daily Reflections ingestion script');
	console.log('Source: https://www.aa.org/daily-reflections');
	if (DRY_RUN) console.log('DRY RUN — fetching first entry only');
	console.log('');

	const dates = DRY_RUN ? allDates().slice(0, 1) : allDates();
	const passages = [];
	let sequence = 1;

	// Load existing file to resume partial runs
	let existing = {};
	if (existsSync(outPath)) {
		try {
			const prev = JSON.parse(readFileSync(outPath, 'utf-8'));
			if (Array.isArray(prev)) {
				prev.forEach((p) => {
					existing[p.date] = p;
				});
				console.log(`Resuming — ${prev.length} entries already present`);
			}
		} catch {
			// Ignore parse errors, start fresh
		}
	}

	for (const { month, day } of dates) {
		const dateKey = `${month}-${day}`;
		if (existing[dateKey]) {
			passages.push(existing[dateKey]);
			sequence++;
			continue;
		}

		process.stdout.write(`Fetching ${month}/${day}… `);
		const result = await fetchReflection(month, day);

		if (result) {
			const passage = {
				id: `dr-${month}-${day}`,
				sourceId: 'daily-reflections',
				title: result.title,
				sequence: sequence++,
				date: dateKey,
				pageRef: null,
				chapterRef: `${month}-${day}`,
				text: result.text,
				linkData: null
			};
			passages.push(passage);
			console.log(`✓ "${result.title.slice(0, 40)}"`);
		} else {
			console.log('skip');
		}

		// Write progress after each batch of 10
		if (passages.length % 10 === 0) {
			writeFileSync(outPath, JSON.stringify(passages, null, 2));
		}

		await sleep(DELAY_MS);
	}

	writeFileSync(outPath, JSON.stringify(passages, null, 2));
	console.log(`\nDone — ${passages.length} entries written to ${outPath}`);
	console.log('Run `npm run build:index` to rebuild the search index.');
}

run().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
