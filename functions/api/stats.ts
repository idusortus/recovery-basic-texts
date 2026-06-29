interface LogRecord {
	q: string;
	resultCount: number;
	sourceFilter: string[] | null;
	ts: string;
}

interface Env {
	SEARCH_LOG: KVNamespace;
}

interface QueryStats {
	q: string;
	count: number;
	resultCount: number;
	lastSeen: string;
}

interface StatsResponse {
	totalRecords: number;
	latestTs: string | null;
	oldestTs: string | null;
	topQueries: QueryStats[];
	recentQueries: Array<{
		q: string;
		resultCount: number;
		ts: string;
		sourceFilter: string[] | null;
	}>;
	sourceFilterUsage: Array<{
		sourceId: string;
		count: number;
	}>;
}

function normalizeQuery(q: string): string {
	return q.trim().toLowerCase();
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
	const queryStats = new Map<string, QueryStats>();
	const recentQueries: StatsResponse['recentQueries'] = [];
	const sourceFilterUsage = new Map<string, number>();
	const timestamps: string[] = [];

	let cursor: string | undefined;
	let totalRecords = 0;

	try {
		while (true) {
			const page = await env.SEARCH_LOG.list({ limit: 1000, cursor });

			for (const key of page.keys) {
				const raw = await env.SEARCH_LOG.get(key.name, { type: 'json' });
				if (!raw || typeof raw !== 'object') continue;

				const record = raw as LogRecord;
				if (typeof record.q !== 'string' || !record.q.trim()) continue;

				totalRecords += 1;
				const q = record.q.trim();
				const normalized = normalizeQuery(q);
				const stat = queryStats.get(normalized) ?? {
					q,
					count: 0,
					resultCount: 0,
					lastSeen: record.ts
				};

				stat.count += 1;
				stat.resultCount += typeof record.resultCount === 'number' ? record.resultCount : 0;
				stat.lastSeen = record.ts;
				queryStats.set(normalized, stat);

				if (Array.isArray(record.sourceFilter)) {
					for (const sourceId of record.sourceFilter) {
						if (typeof sourceId !== 'string' || !sourceId.trim()) continue;
						const existing = sourceFilterUsage.get(sourceId) ?? 0;
						sourceFilterUsage.set(sourceId, existing + 1);
					}
				}

				timestamps.push(record.ts);
				recentQueries.push({
					q,
					resultCount: typeof record.resultCount === 'number' ? record.resultCount : 0,
					ts: record.ts,
					sourceFilter: Array.isArray(record.sourceFilter) ? record.sourceFilter : null
				});
			}

			if (page.list_complete) break;
			cursor = page.cursor;
		}
	} catch {
		return new Response(JSON.stringify({ error: 'Unable to read search stats' }), {
			status: 500,
			headers: { 'content-type': 'application/json' }
		});
	}

	const topQueries = Array.from(queryStats.values())
		.sort((a, b) => {
			if (b.count !== a.count) return b.count - a.count;
			return a.q.localeCompare(b.q);
		})
		.slice(0, 10);

	const recent = recentQueries
		.sort((a, b) => b.ts.localeCompare(a.ts))
		.slice(0, 20);

	const sourceFilterList = Array.from(sourceFilterUsage.entries())
		.map(([sourceId, count]) => ({ sourceId, count }))
		.sort((a, b) => b.count - a.count);

	const theStats: StatsResponse = {
		totalRecords,
		latestTs: timestamps.length > 0 ? timestamps.reduce((latest, ts) => (ts > latest ? ts : latest)) : null,
		oldestTs: timestamps.length > 0 ? timestamps.reduce((oldest, ts) => (ts < oldest ? ts : oldest)) : null,
		topQueries,
		recentQueries: recent,
		sourceFilterUsage: sourceFilterList
	};

	return new Response(JSON.stringify(theStats), {
		headers: { 'content-type': 'application/json' }
	});
};
