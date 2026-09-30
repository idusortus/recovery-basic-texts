#!/usr/bin/env node
/**
 * Dependency-free tests for zero-result recovery selection.
 *
 * Run with: `pnpm run test:zero-result`.
 *
 * Contract under test (search-ui spec): the zero-result state offers "Try these
 * searches" (topic chips) and at most one "Did you mean".
 */
import assert from 'node:assert/strict';

const { pickZeroResultSuggestions } = await import('../src/lib/search/zero-result.ts');

const TOPICS = ['Acceptance', 'Resentment', 'Fear', 'Gratitude', 'Humility', 'God', 'Honesty', 'Anger'];

// The query term is excluded from the topic chips (case-insensitively).
const noFear = pickZeroResultSuggestions(TOPICS, 'fear', []);
assert.ok(!noFear.topics.some((topic) => topic.toLowerCase() === 'fear'), 'query topic excluded');
assert.equal(noFear.didYouMean, null, 'no did-you-mean when none suggested');

// At most one did-you-mean, taken from the didyoumean kind only.
const mixed = pickZeroResultSuggestions(TOPICS, 'zzz', [
	{ term: 'zeal', kind: 'prefix' },
	{ term: 'fear', kind: 'didyoumean' },
	{ term: 'fearful', kind: 'didyoumean' }
]);
assert.equal(mixed.didYouMean, 'fear', 'first did-you-mean is used');
assert.equal(typeof mixed.didYouMean, 'string');

// Prefix/exact suggestions alone produce no did-you-mean.
const prefixOnly = pickZeroResultSuggestions(TOPICS, 'gr', [
	{ term: 'gratitude', kind: 'prefix' },
	{ term: 'gra', kind: 'exact' }
]);
assert.equal(prefixOnly.didYouMean, null, 'non-didyoumean kinds are ignored');

// Topic list is capped.
const capped = pickZeroResultSuggestions(TOPICS, 'nomatch', [], 3);
assert.equal(capped.topics.length, 3, 'topics are capped');

console.log('[test-zero-result] ✓ All checks passed');
