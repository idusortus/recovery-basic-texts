/**
 * Cloudflare Pages Function — POST /api/log
 *
 * Receives an array of anonymous search log records from the client and
 * appends them to Cloudflare KV (SEARCH_LOG binding).
 *
 * Stored per record: { q, resultCount, sourceFilter, ts }
 * Explicitly NOT stored: IP address, user agent, cookies, or any identifier.
 *
 * Phase D — PRD §7.4
 */

interface LogRecord {
	q: string;
	resultCount: number;
	sourceFilter: string[] | null;
	ts: string;
}

interface Env {
	SEARCH_LOG: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
	// Parse body
	let records: unknown;
	try {
		records = await request.json();
	} catch {
		return new Response('Bad Request', { status: 400 });
	}

	if (!Array.isArray(records)) {
		return new Response('Bad Request', { status: 400 });
	}

	const now = new Date().toISOString();

	for (const item of records) {
		if (typeof item !== 'object' || item === null) continue;
		const raw = item as Record<string, unknown>;

		if (typeof raw.q !== 'string' || !raw.q.trim()) continue;

		const record: LogRecord = {
			// Server-side timestamp (never trust client clock for log ordering)
			ts: now,
			q: String(raw.q).slice(0, 500),
			resultCount: typeof raw.resultCount === 'number' ? Math.max(0, raw.resultCount) : 0,
			sourceFilter: Array.isArray(raw.sourceFilter)
				? (raw.sourceFilter as unknown[])
						.filter((s) => typeof s === 'string')
						.map((s) => String(s).slice(0, 50))
						.slice(0, 10)
				: null
		};

		// Key format: ISO timestamp + random suffix (lexicographically sortable)
		const key = `${now.replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`;

		try {
			await env.SEARCH_LOG.put(key, JSON.stringify(record));
		} catch {
			// KV write failure — continue with remaining records
		}
	}

	return new Response('OK', { status: 200 });
};
