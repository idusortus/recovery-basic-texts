#!/usr/bin/env node
/**
 * Dependency-free tests for the result-card label helpers.
 *
 * Run with: `pnpm run test:result-label`.
 *
 * Contract under test (search-ui spec): a page reference renders as `p.<n>` when
 * present and is omitted cleanly when absent, and the Copy control's label
 * matches the payload its display mode copies.
 */
import assert from 'node:assert/strict';

const { formatPageRef, copyLabelFor } = await import('../src/lib/search/result-label.ts');

// Absent / blank page references render nothing.
assert.equal(formatPageRef(null), null);
assert.equal(formatPageRef(undefined), null);
assert.equal(formatPageRef(''), null);
assert.equal(formatPageRef('   '), null);

// Bare numbers and already-prefixed refs normalize to the displayed `p.<n>`.
assert.equal(formatPageRef('58'), 'p.58');
assert.equal(formatPageRef('p.58'), 'p.58');
assert.equal(formatPageRef('P.58'), 'p.58');
assert.equal(formatPageRef('  p.58 '), 'p.58');

// The Copy label follows the copied payload.
assert.equal(copyLabelFor('full-text'), 'Copy passage');
assert.equal(copyLabelFor('snippet'), 'Copy excerpt');
assert.equal(copyLabelFor('concordance-only'), 'Copy excerpt');

console.log('[test-result-label] ✓ All checks passed');
