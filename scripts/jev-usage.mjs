#!/usr/bin/env node
/**
 * Jev tier-router usage report.
 *
 * Run with: `pnpm run report:jev` (or `node scripts/jev-usage.mjs [logfile]`).
 *
 * Summarizes the `jev-tier-router` plugin's journal
 * (`.opencode/journals/jev-tier-router.log`, overridable with
 * `CLI_FIVE_LOGFILE` or a positional path). The journal is the plugin's only
 * usage record; this script turns it into counts and distributions.
 *
 * Key distinction the report preserves:
 *   - `prompt classified`   = one real System One API round-trip.
 *   - `context injected`    = a CACHED reuse pushed as a system hint on a
 *                             dispatch; NO API call.
 *   - `spawn-gate:`         = one real API round-trip per evaluation.
 * So "real API calls" = prompt classifications + spawn-gate evaluations, not
 * the (much larger) injection count.
 *
 * Dependency-free (node stdlib only) so it can run anywhere the plugin does.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─── Resolve the journal path ─────────────────────────────────────────────────
// Precedence mirrors the plugin: an explicit argument, then CLI_FIVE_LOGFILE,
// then the project-relative default under cwd.
function resolveLogPath(argv) {
	const fromArg = argv[2];
	if (fromArg) return fromArg;
	if (process.env.CLI_FIVE_LOGFILE) return process.env.CLI_FIVE_LOGFILE;
	return join(process.cwd(), '.opencode', 'journals', 'jev-tier-router.log');
}

const LOG_PATH = resolveLogPath(process.argv);
if (!existsSync(LOG_PATH)) {
	console.error(`Jev journal not found: ${LOG_PATH}`);
	console.error('Pass a path: node scripts/jev-usage.mjs <logfile>');
	console.error('(or set CLI_FIVE_LOGFILE). The plugin writes it to .opencode/journals/.');
	process.exit(1);
}

// ─── Parse ────────────────────────────────────────────────────────────────────
// Every line is: `<ISO-ts> tier_classifier <message>`. Only known message
// shapes are tallied; unrecognised lines are ignored (forward-compatible with
// plugin versions that add fields).
const LINE_RE = /^(\S+Z)\s+tier_classifier\s+(.*)$/;

/** Extract `key=value` tokens; values are non-space runs. */
function fields(msg) {
	const out = {};
	for (const m of msg.matchAll(/(\w+)=([^\s]+)/g)) out[m[1]] = m[2];
	return out;
}

function inc(map, key) {
	if (key === undefined || key === null || key === '') return;
	map.set(key, (map.get(key) ?? 0) + 1);
}

const lines = readFileSync(LOG_PATH, 'utf8').split('\n').filter(Boolean);

const stats = {
	lines: lines.length,
	first: null,
	last: null,
	// API round-trips
	promptClassified: 0,
	spawnGateEvals: 0,
	// Non-API activity
	contextInjected: 0,
	promptFired: 0,
	contextFiredNoCache: 0,
	classifyErrors: 0,
	hookRegistrations: 0,
	// Distributions
	tiers: new Map(),
	sources: new Map(),
	spawnDecisions: new Map(),
	spawnModes: new Map(),
	spawnAgents: new Map(),
	sessions: new Map(),
	latencies: []
};

for (const line of lines) {
	const m = LINE_RE.exec(line);
	if (!m) continue;
	const [, ts, msg] = m;
	if (!stats.first) stats.first = ts;
	stats.last = ts;

	if (msg.includes('prompt classified')) {
		stats.promptClassified++;
		const f = fields(msg);
		inc(stats.tiers, f.tier);
		inc(stats.sources, f.source);
		inc(stats.sessions, f.session);
	} else if (msg.startsWith('spawn-gate: ')) {
		// Not the `spawn-gate-config:` registration lines.
		stats.spawnGateEvals++;
		const f = fields(msg);
		inc(stats.spawnDecisions, f.decision);
		inc(stats.spawnModes, f.mode);
		inc(stats.spawnAgents, f.agent);
		inc(stats.sessions, f.session);
		if (f.latency_ms !== undefined) stats.latencies.push(Number(f.latency_ms));
	} else if (msg.includes('context injected')) {
		stats.contextInjected++;
	} else if (msg.includes('hooks: prompt fired')) {
		stats.promptFired++;
	} else if (msg.includes('hooks: context fired') && msg.includes('no cached')) {
		stats.contextFiredNoCache++;
	} else if (msg.includes('classification error')) {
		stats.classifyErrors++;
	} else if (msg.includes('registered')) {
		stats.hookRegistrations++;
	}
}

// ─── Render ───────────────────────────────────────────────────────────────────
const apiCalls = stats.promptClassified + stats.spawnGateEvals;

/** Sort a count map descending by value, tie-broken by key. */
function sorted(map) {
	return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Render `label  value` rows with aligned columns. */
function table(rows) {
	const width = Math.max(0, ...rows.map(([label]) => label.length));
	return rows.map(([label, value]) => `  ${label.padEnd(width)}  ${value}`).join('\n');
}

function pct(part, whole) {
	return whole === 0 ? '0%' : `${Math.round((part / whole) * 100)}%`;
}

console.log('=== Jev tier-router usage ===');
console.log(
	table([
		['journal', LOG_PATH],
		['window', `${stats.first ?? '-'} -> ${stats.last ?? '-'}`],
		['lines', String(stats.lines)]
	])
);

console.log('\nREAL JEV API CALLS (one System One round-trip each)');
console.log(
	table([
		['prompt classifications', String(stats.promptClassified)],
		['spawn-gate evaluations', String(stats.spawnGateEvals)],
		['TOTAL', String(apiCalls)]
	])
);

console.log('\nNON-API ACTIVITY');
console.log(
	table([
		['cached context injections (free)', String(stats.contextInjected)],
		['prompt firings', String(stats.promptFired)],
		['context firings without cache', String(stats.contextFiredNoCache)],
		['classification errors / fallbacks', String(stats.classifyErrors)],
		['hook registrations', String(stats.hookRegistrations)]
	])
);

console.log('\nTIER DISTRIBUTION (prompt classifications)');
if (stats.tiers.size === 0) {
	console.log('  (none)');
} else {
	console.log(
		table(sorted(stats.tiers).map(([t, n]) => [t, `${n}  (${pct(n, stats.promptClassified)})`]))
	);
}

console.log('\nSOURCE DISTRIBUTION (which path answered)');
if (stats.sources.size === 0) {
	console.log('  (none)');
} else {
	console.log(
		table(sorted(stats.sources).map(([s, n]) => [s, `${n}  (${pct(n, stats.promptClassified)})`]))
	);
}
console.log('  note: jev_api = real API; local_heuristic = credential missing / API failed.');

console.log('\nSPAWN GATE');
if (stats.spawnGateEvals === 0) {
	console.log('  (no evaluations)');
} else {
	const rows = [
		['evaluations', String(stats.spawnGateEvals)],
		[
			'decisions',
			sorted(stats.spawnDecisions)
				.map(([k, v]) => `${k}:${v}`)
				.join('  ')
		],
		[
			'modes',
			sorted(stats.spawnModes)
				.map(([k, v]) => `${k}:${v}`)
				.join('  ')
		],
		[
			'agents',
			sorted(stats.spawnAgents)
				.map(([k, v]) => `${k}:${v}`)
				.join('  ')
		]
	];
	if (stats.latencies.length) {
		const avg = Math.round(stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length);
		rows.push([
			'latency (ms)',
			`avg ${avg}, min ${Math.min(...stats.latencies)}, max ${Math.max(...stats.latencies)}`
		]);
	}
	console.log(table(rows));
}

console.log('\nSESSIONS');
console.log(
	table([
		['distinct sessions seen', String(stats.sessions.size)],
		[
			'busiest',
			sorted(stats.sessions)
				.slice(0, 3)
				.map(([s, n]) => `${s.slice(0, 18)}…:${n}`)
				.join('  ') || '(none)'
		]
	])
);

console.log('\nnote: token usage is not journaled by the plugin; only call counts.');
