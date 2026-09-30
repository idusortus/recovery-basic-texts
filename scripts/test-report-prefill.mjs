#!/usr/bin/env node
/**
 * Dependency-free tests for the report-link `details` prefill.
 *
 * Run with: `pnpm run test:report-prefill`.
 *
 * Contract under test (feedback-to-github spec): a report link prefills the
 * existing `details` field with passage/source/query context only, with no new
 * submitted field and no PII, and the context is treated as visitor text.
 */
import assert from 'node:assert/strict';

const { buildReportPrefill } = await import('../src/lib/feedback/report-context.ts');

// Context params produce a details prefill containing each value.
const prefill = buildReportPrefill(
	new URLSearchParams('type=bug&source=twelve-steps-traditions&passage=tst-p001&q=higher+power')
);
assert.ok(prefill.includes('tst-p001'), 'includes the passage id');
assert.ok(prefill.includes('twelve-steps-traditions'), 'includes the source id');
assert.ok(prefill.includes('higher power'), 'includes the query');
assert.ok(prefill.length <= 4000, 'stays within the details limit');

// No context params: nothing is prefilled.
assert.equal(buildReportPrefill(new URLSearchParams('type=bug')), '');
assert.equal(buildReportPrefill(new URLSearchParams('')), '');

// No PII is ever introduced by the builder.
assert.ok(!/email|@|\bip\b|user.?agent|token/i.test(prefill), 'no PII markers');

// Overlong context is truncated to the details limit.
const longQuery = 'x'.repeat(5000);
const truncated = buildReportPrefill(new URLSearchParams(`source=s&passage=p&q=${longQuery}`));
assert.equal(truncated.length, 4000, 'truncated to the details limit');

console.log('[test-report-prefill] ✓ All checks passed');
