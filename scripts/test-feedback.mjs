#!/usr/bin/env node
/**
 * Dependency-free tests for the pure feedback logic.
 *
 * Run with: node scripts/test-feedback.mjs
 *
 * Node's built-in TypeScript type-stripping (Node >= 22.18 / 23.6) lets us
 * import `src/lib/server/feedback-issue.ts` directly — no test framework and no
 * build step. The module under test is deliberately pure (no I/O, no server
 * imports) so it can run in a plain Node process.
 */
import assert from 'node:assert/strict';
import {
	FEEDBACK_TYPES,
	SUMMARY_MAX_LENGTH,
	DETAILS_MAX_LENGTH,
	ISSUE_LABEL_BASE,
	ISSUE_LABEL_BUG,
	ISSUE_LABEL_SUGGESTION,
	validateFeedbackInput,
	buildFeedbackIssue
} from '../src/lib/server/feedback-issue.ts';

let passed = 0;
function test(name, fn) {
	try {
		fn();
		passed += 1;
		console.log(`  ok  ${name}`);
	} catch (error) {
		console.error(`FAIL  ${name}`);
		throw error;
	}
}

console.log('feedback-issue: validation boundaries');

test('accepts exactly the suggestion and bug types', () => {
	assert.deepEqual([...FEEDBACK_TYPES], ['suggestion', 'bug']);
});

test('accepts a well-formed suggestion', () => {
	const result = validateFeedbackInput({
		type: 'suggestion',
		summary: 'Add keyboard shortcuts',
		details: 'Pressing / could focus the search field.'
	});
	assert.equal(result.ok, true);
	assert.equal(result.value.type, 'suggestion');
});

test('rejects a missing or unknown type with a friendly message', () => {
	for (const type of ['', 'feature', 'BUG', undefined, 42]) {
		const result = validateFeedbackInput({ type, summary: 'x', details: 'y' });
		assert.equal(result.ok, false);
		assert.match(result.message, /suggestion or a bug/i);
	}
});

test('rejects a blank summary', () => {
	const result = validateFeedbackInput({ type: 'bug', summary: '   ', details: 'y' });
	assert.equal(result.ok, false);
	assert.match(result.message, /summary/i);
});

test('accepts a summary at the limit and rejects one over it', () => {
	const atLimit = validateFeedbackInput({
		type: 'bug',
		summary: 'a'.repeat(SUMMARY_MAX_LENGTH),
		details: 'y'
	});
	assert.equal(atLimit.ok, true);

	const overLimit = validateFeedbackInput({
		type: 'bug',
		summary: 'a'.repeat(SUMMARY_MAX_LENGTH + 1),
		details: 'y'
	});
	assert.equal(overLimit.ok, false);
	assert.match(overLimit.message, new RegExp(`${SUMMARY_MAX_LENGTH}`));
});

test('trims surrounding whitespace from summary and details', () => {
	const result = validateFeedbackInput({
		type: 'bug',
		summary: '  spaced  ',
		details: '  content  '
	});
	assert.equal(result.ok, true);
	assert.equal(result.value.summary, 'spaced');
	assert.equal(result.value.details, 'content');
});

test('accepts details at the limit and rejects one over it', () => {
	const atLimit = validateFeedbackInput({
		type: 'suggestion',
		summary: 'x',
		details: 'b'.repeat(DETAILS_MAX_LENGTH)
	});
	assert.equal(atLimit.ok, true);

	const overLimit = validateFeedbackInput({
		type: 'suggestion',
		summary: 'x',
		details: 'b'.repeat(DETAILS_MAX_LENGTH + 1)
	});
	assert.equal(overLimit.ok, false);
	assert.match(overLimit.message, new RegExp(`${DETAILS_MAX_LENGTH}`));
});

console.log('feedback-issue: issue payload shape');

test('builds a [Bug] issue with from-app + bug labels', () => {
	const issue = buildFeedbackIssue({
		type: 'bug',
		summary: 'Search returns nothing',
		details: 'Searching for "solution" on mobile shows no results.',
		version: '0.1.0',
		now: new Date('2026-09-29T12:00:00.000Z')
	});
	assert.equal(issue.title, '[Bug] Search returns nothing');
	assert.deepEqual(issue.labels, [ISSUE_LABEL_BASE, ISSUE_LABEL_BUG]);
	assert.match(issue.body, /Search returns nothing/);
	assert.match(issue.body, /solution/);
	assert.match(issue.body, /- Route: \/feedback/);
	assert.match(issue.body, /- App version: 0\.1\.0/);
	assert.match(issue.body, /- Submitted \(UTC\): 2026-09-29T12:00:00\.000Z/);
});

test('builds a [Suggestion] issue with from-app + suggestion labels', () => {
	const issue = buildFeedbackIssue({
		type: 'suggestion',
		summary: 'Dark mode for print',
		details: 'A print stylesheet would help.',
		version: '0.1.0',
		now: new Date('2026-09-29T12:00:00.000Z')
	});
	assert.equal(issue.title, '[Suggestion] Dark mode for print');
	assert.deepEqual(issue.labels, [ISSUE_LABEL_BASE, ISSUE_LABEL_SUGGESTION]);
});

console.log('feedback-issue: no PII can reach the issue (structural allow-list)');

// Every value below is tied to an identity/transport concern and must never
// appear in the payload. Only `type`, `summary`, `details`, and `version` are
// read by the builder.
const FORBIDDEN = {
	name: 'zz-name-marker-9f2',
	email: 'zz-email-marker-9f2@example.com',
	ip: '203.0.113.77',
	userAgent: 'zz-user-agent-marker-9f2',
	turnstileToken: 'zz-turnstile-token-marker-9f2',
	secret: 'zz-secret-marker-9f2'
};

test('ignores every non-allow-listed property, even when present', () => {
	const issue = buildFeedbackIssue({
		type: 'bug',
		summary: 'Allow-list proof',
		details: 'Only the text the reporter typed should appear.',
		version: '0.1.0',
		now: new Date('2026-09-29T12:00:00.000Z'),
		// Adversarial extras that must be structurally unreachable:
		...FORBIDDEN
	});

	const haystack = `${issue.title}\n${issue.body}\n${issue.labels.join(',')}`.toLowerCase();
	for (const [label, value] of Object.entries(FORBIDDEN)) {
		assert.ok(
			!haystack.includes(value.toLowerCase()),
			`forbidden ${label} value leaked into the issue payload`
		);
	}
	// The specific patterns the brief calls out must also be absent.
	assert.ok(!haystack.includes('@'), 'an email-like token reached the issue');
	assert.ok(!/\b\d{1,3}(\.\d{1,3}){3}\b/.test(haystack), 'an IP address reached the issue');
});

test('validated extras still cannot leak through buildFeedbackIssue', () => {
	const validation = validateFeedbackInput({
		type: 'bug',
		summary: 'Validated summary',
		details: 'Validated details',
		...FORBIDDEN
	});
	assert.equal(validation.ok, true);
	const issue = buildFeedbackIssue({
		...validation.value,
		version: '0.1.0',
		now: new Date('2026-09-29T12:00:00.000Z')
	});
	const haystack = `${issue.title}\n${issue.body}\n${issue.labels.join(',')}`.toLowerCase();
	for (const value of Object.values(FORBIDDEN)) {
		assert.ok(!haystack.includes(value.toLowerCase()));
	}
});

console.log(`\nAll ${passed} assertions passed.`);
