#!/usr/bin/env node
/**
 * Dependency-free tests for the Listen (text-to-speech) helpers.
 *
 * Run with: `pnpm run test:tts`.
 *
 * Contract under test (passage-view spec): Listen is offered only for
 * `full-text` sources and only when the browser provides speech synthesis;
 * the spoken text is assembled from the rendered passage text only; a long
 * chapter is split into bounded chunks; and nothing is transmitted.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { isTtsSupported, canOfferListen, buildSpeechText, splitSpeechChunks } = await import(
	'../src/lib/passage/tts.ts'
);

const utterance = function SpeechSynthesisUtterance() {};
const synthesis = { speak() {}, cancel() {}, pause() {}, resume() {} };

// Support requires BOTH a speechSynthesis object and a callable utterance.
assert.equal(isTtsSupported({ speechSynthesis: synthesis, SpeechSynthesisUtterance: utterance }), true);
assert.equal(isTtsSupported(undefined), false);
assert.equal(isTtsSupported(null), false);
assert.equal(isTtsSupported({}), false);
assert.equal(isTtsSupported({ speechSynthesis: synthesis }), false, 'missing utterance constructor');
assert.equal(isTtsSupported({ SpeechSynthesisUtterance: utterance }), false, 'missing synthesis object');
assert.equal(isTtsSupported({ speechSynthesis: 'nope', SpeechSynthesisUtterance: utterance }), false);
assert.equal(isTtsSupported({ speechSynthesis: synthesis, SpeechSynthesisUtterance: 'nope' }), false);
assert.equal(isTtsSupported({ speechSynthesis: null, SpeechSynthesisUtterance: utterance }), false);

// Gating: full-text AND supported.
assert.equal(canOfferListen('full-text', true), true);
assert.equal(canOfferListen('full-text', false), false);
assert.equal(canOfferListen('concordance-only', true), false);
assert.equal(canOfferListen('snippet', true), false);
assert.equal(canOfferListen('', true), false);

// buildSpeechText trims, drops blanks, and preserves order.
assert.equal(buildSpeechText(['  First.  ', '', '   ', 'Second.', null, undefined]), 'First.\n\nSecond.');
assert.equal(buildSpeechText(['One']), 'One');
assert.equal(buildSpeechText([]), '');
assert.equal(buildSpeechText(['   ']), '');

// splitSpeechChunks: bounded, content-preserving, sentence-aware.
const chapter = 'First sentence here. Second sentence follows. Third one closes it out.';
const chunks = splitSpeechChunks(chapter, 40);
assert.ok(chunks.length >= 2, 'a longer text splits into multiple chunks');
for (const chunk of chunks) {
	assert.ok(chunk.length <= 40, `chunk within maxChars: "${chunk}"`);
}
assert.equal(chunks.join(' '), chapter, 'fitting chunks reconstruct the collapsed text');

// An overlong unbroken run is hard-split and never exceeds maxChars.
const run = 'a'.repeat(55);
const runChunks = splitSpeechChunks(run, 10);
assert.ok(runChunks.every((chunk) => chunk.length <= 10));
assert.equal(runChunks.join('').replace(/\s+/g, ''), run, 'hard-split preserves content');

// Whitespace is collapsed and blank input yields no chunks.
assert.deepEqual(splitSpeechChunks('   '), []);
assert.deepEqual(splitSpeechChunks(''), []);
assert.equal(splitSpeechChunks('One   two.\n\nThree.', 200).join(' '), 'One two. Three.');

// Hardening: the module never transmits.
const ttsSource = readFileSync(new URL('../src/lib/passage/tts.ts', import.meta.url), 'utf8');
assert.ok(!/\bfetch\b/.test(ttsSource), 'tts.ts must not call fetch');
assert.ok(!/XMLHttpRequest|sendBeacon|enqueueLog/.test(ttsSource), 'tts.ts must not transmit or log');

// Hardening: the Listen control and speech-text source are gated by displayMode
// explicitly (NOT the copyright-derived chapterPassages), inside the full-text
// branch, and guarded by canOfferListen.
const pageSource = readFileSync(
	new URL('../src/routes/passage/[sourceId]/[passageId]/+page.svelte', import.meta.url),
	'utf8'
);
assert.ok(
	/canOfferListen\(\s*source\.displayMode/.test(pageSource),
	'+page.svelte must gate Listen with canOfferListen(source.displayMode, …)'
);
assert.ok(
	/source\.displayMode\s*!==\s*'full-text'/.test(pageSource),
	'the speech-text builder must guard displayMode !== full-text'
);
assert.ok(/buildSpeechText\(/.test(pageSource), '+page.svelte must build speech text via buildSpeechText');
assert.ok(
	/\{#if source\.displayMode === 'full-text'\}(?:(?!\{:else\})[\s\S])*?canOfferListen\(\s*source\.displayMode/.test(
		pageSource
	),
	'the Listen control must live inside the displayMode === full-text branch (no else)'
);

console.log('[test-tts] ✓ All checks passed');
