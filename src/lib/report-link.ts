/**
 * Build the anonymous feedback link for a result or passage.
 *
 * The context travels as non-submitted URL params; the feedback page reads them
 * into the existing `details` field, so the submitted field set stays exactly
 * `type`/`summary`/`details` and no PII is introduced.
 *
 * Item 8 — ux-qol-improvements (Design D12)
 */

export function reportHref(sourceId: string, passageId: string, query: string): string {
	const params = new URLSearchParams({ type: 'bug', source: sourceId, passage: passageId });
	const trimmed = query.trim();
	if (trimmed) params.set('q', trimmed);
	return `/feedback?${params.toString()}`;
}
