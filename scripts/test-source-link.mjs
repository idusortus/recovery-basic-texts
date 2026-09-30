#!/usr/bin/env node
/**
 * Dependency-free tests for `resolveSourceLink`.
 *
 * Run with: `pnpm run test:source-link`.
 *
 * Contract under test (search-ui spec): the non-full-text external action uses
 * the source's `linkTemplate` with the query URL-encoded into `{{query}}` and
 * other placeholders taken from `passage.linkData`, falling back to
 * `officialUrl`/`freeUrl` when a placeholder cannot be resolved or no template
 * exists.
 */
import assert from 'node:assert/strict';

const { resolveSourceLink } = await import('../src/lib/corpus/source-link.ts');

const twelveAndTwelve = {
	linkTemplate: 'https://www.google.com/search?q=aa+12x12+{{query}}',
	officialUrl: 'https://www.aa.org/twelve-steps-twelve-traditions',
	freeUrl: null
};
const dailyReflections = {
	linkTemplate: 'https://www.aa.org/daily-reflections',
	officialUrl: 'https://www.aa.org/daily-reflections',
	freeUrl: null
};
const bigBook = {
	linkTemplate: null,
	officialUrl: 'https://www.aa.org/the-big-book',
	freeUrl: 'https://example.org/bb.pdf'
};

// A query template resolves and URL-encodes the query.
assert.equal(
	resolveSourceLink(twelveAndTwelve, { linkData: null }, 'higher power'),
	'https://www.google.com/search?q=aa+12x12+higher%20power',
	'12&12 template resolves the encoded query'
);

// A static template resolves unchanged.
assert.equal(
	resolveSourceLink(dailyReflections, { linkData: null }, 'fear'),
	'https://www.aa.org/daily-reflections',
	'static template resolves unchanged'
);

// Link data placeholders resolve, and their values are encoded.
assert.equal(
	resolveSourceLink(
		{ linkTemplate: 'https://example.org/p/{{passageId}}?q={{query}}', officialUrl: null, freeUrl: null },
		{ linkData: { passageId: 'abc 1' } },
		'a&b'
	),
	'https://example.org/p/abc%201?q=a%26b',
	'linkData placeholders resolve and are encoded'
);

// An unresolvable placeholder falls back to officialUrl, not a broken link.
assert.equal(
	resolveSourceLink(
		{ linkTemplate: 'https://example.org/{{missing}}', officialUrl: 'https://official.example', freeUrl: null },
		{ linkData: null },
		'x'
	),
	'https://official.example',
	'unresolvable placeholder falls back to officialUrl'
);

// No template: officialUrl, then freeUrl, then null.
assert.equal(
	resolveSourceLink(bigBook, { linkData: null }, 'tornado'),
	'https://www.aa.org/the-big-book',
	'no template uses officialUrl'
);
assert.equal(
	resolveSourceLink({ linkTemplate: null, officialUrl: null, freeUrl: 'https://free.example/x' }, { linkData: null }, 'x'),
	'https://free.example/x',
	'no template and no officialUrl uses freeUrl'
);
assert.equal(
	resolveSourceLink({ linkTemplate: null, officialUrl: null, freeUrl: null }, { linkData: null }, 'x'),
	null,
	'no link target yields null'
);

console.log('[test-source-link] ✓ All checks passed');
