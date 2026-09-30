/**
 * Build the feedback `details` prefill from a report link's URL params.
 *
 * The context is plain text that lands in the existing `details` field, so the
 * submitted field set stays exactly `type`/`summary`/`details` and no PII
 * (no name, email, IP, user agent, or token) is introduced.
 *
 * Item 8 — ux-qol-improvements (Design D12)
 */

const CONTEXT_MAX = 4000;

export function buildReportPrefill(search: URLSearchParams): string {
	const source = (search.get('source') ?? '').trim();
	const passage = (search.get('passage') ?? '').trim();
	const query = (search.get('q') ?? '').trim();

	if (!source && !passage && !query) return '';

	const lines: string[] = [];
	if (passage) lines.push(`Passage: ${passage}`);
	if (source) lines.push(`Source: ${source}`);
	if (query) lines.push(`Search query: ${query}`);
	lines.push('', 'What happened, and what did you expect?');

	return lines.join('\n').slice(0, CONTEXT_MAX);
}
