#!/usr/bin/env node
/**
 * running-header-utils.mjs
 *
 * Shared, dependency-free detection of leaked page running headers at the START
 * of a passage's text. This is the single implementation of the rule set in
 * `openspec/changes/fix-corpus-running-headers/design.md` Decision 2, used by
 * both the one-off repair (`fix-running-headers.mjs`) and the regression test
 * (`test-corpus-headers.mjs`).
 *
 * Design notes:
 *  - Detection is PREFIX-ONLY. The rules are anchored to position 0 of the
 *    passage text and never scan mid-text, because legitimate content such as
 *    `ALCOHOLICS ANONYMOUS, p. 25` or `WORLD SERVICES, INC. BOX 459` would
 *    otherwise false-positive.
 *  - The ALL-CAPS run after/before the page number is bounded to the known
 *    running titles below. This is what stops a header from swallowing the
 *    first body word: without it, `2 ALCOHOLICS ANONYMOUS I took a night law
 *    course` would match the greedy run `ALCOHOLICS ANONYMOUS I` and drop the
 *    body word `I`.
 *  - Rule priority is fixed and explicit: Rule 1 -> Rule 2 -> Rule 3 (either
 *    order) -> Rule 4 (conditional trailing-page-number cleanup). The first
 *    matching rule wins.
 *
 * No new dependencies; Node built-ins only.
 */

/**
 * The running titles / front-matter headings observed as leaked page headers in
 * `corpus/sources/big-book-2ed.json`. Sorted longest-first so the alternation
 * prefers the most specific match (e.g. `FOREWORD TO THE FIRST EDITION` over
 * `FOREWORD`).
 *
 * @type {string[]}
 */
export const RUNNING_TITLES = [
	'FOREWORD TO THE FIRST EDITION',
	"THE DOCTOR'S OPINION",
	'ALCOHOLICS ANONYMOUS',
	'MORE ABOUT ALCOHOLISM',
	'WORKING WITH OTHERS',
	'THE FAMILY AFTERWARD',
	'THERE IS A SOLUTION',
	'A VISION FOR YOU',
	'THE A.A. TRADITION',
	"BILL'S STORY",
	'INTO ACTION',
	'HOW IT WORKS',
	'WE AGNOSTICS',
	'TO EMPLOYERS',
	'TO WIVES',
	'FOREWORD',
	'PREFACE'
];

/** Escape a literal string for safe inclusion in a RegExp alternation. */
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const TITLE_ALT = [...RUNNING_TITLES]
	.sort((a, b) => b.length - a.length)
	.map(escapeRegExp)
	.join('|');

/** A known running title (longest-first alternation). */
const TITLE = `(?:${TITLE_ALT})`;
/** 1-4 digit page number. */
const NUM = '\\d{1,4}';
/** Lowercase roman numeral of 2+ characters (front-matter page numbers). */
const ROMAN = '[ivxlcdm]{2,}';
/** The header must end at a non-word boundary so it never swallows a body word. */
const BOUND = '(?=[^A-Za-z0-9]|$)';

// Rules, in priority order. Each captures the page token and the title token.
const RULE_1 = new RegExp(`^(${NUM}) (${TITLE})${BOUND}`); // number-first: 82 ALCOHOLICS ANONYMOUS
const RULE_2 = new RegExp(`^(${TITLE}) (${NUM})${BOUND}`); // title-last:  INTO ACTION 81

/**
 * The roman (Rule 3) paths deliberately differ from `ingest.py`'s roman rule:
 * they do NOT validate that the page token is a well-formed roman numeral.
 * They rely entirely on adjacency to an allowlisted `TITLE`, because that
 * allowlist — not the numeral shape — is what prevents false positives: an
 * ordinary word made only of roman letters is structurally valid (`MIX` is
 * `M` + `IX`), so `MIX IT UP` must not be treated as a header. `ingest.py`
 * additionally validates the numeral (and uses the same allowlist), so the two
 * implementations are aligned by sharing the allowlist signal while differing
 * on purpose in how strictly they check the numeral.
 */
const RULE_3A = new RegExp(`^(${ROMAN}) (${TITLE})${BOUND}`); // roman-first: xii PREFACE
const RULE_3B = new RegExp(`^(${TITLE}) (${ROMAN})${BOUND}`); // roman-last:  FOREWORD xvii

/**
 * Rule 4 (conditional): a standalone page-number token at the start of the
 * remainder, immediately followed by whitespace. It must NOT match a number
 * followed by list/ordinal punctuation (`12.`), so the twelfth-step list number
 * survives. Matches the digits only; the following whitespace is trimmed by the
 * caller.
 */
const RULE_4 = /^(\d{1,4})(?=\s)/;

/**
 * Broad, NON-allowlisted "looks like a header" shape used only to surface
 * unmatched candidates for operator review (task 1.4). It is intentionally
 * greedier than the strip rules.
 */
const CANDIDATE = new RegExp(
	`^(?:(?:${NUM}|${ROMAN}) (?:[A-Z][A-Z0-9.'\u2019\\-]*)(?: [A-Z][A-Z0-9.'\u2019\\-]*)+` +
		`|(?:[A-Z][A-Z0-9.'\u2019\\-]*)(?: [A-Z][A-Z0-9.'\u2019\\-]*)+ (?:${NUM}|${ROMAN}))${BOUND}`
);

/**
 * Detect a leaked running header at the start of `text`.
 *
 * @param {string} text
 * @returns {{ rule: 1|2|3, header: string } | null}
 */
export function detectRunningHeader(text) {
	if (typeof text !== 'string' || text.length === 0) return null;

	let m;
	if ((m = RULE_1.exec(text))) return { rule: 1, header: `${m[1]} ${m[2]}` };
	if ((m = RULE_2.exec(text))) return { rule: 2, header: `${m[1]} ${m[2]}` };
	if ((m = RULE_3A.exec(text))) return { rule: 3, header: `${m[1]} ${m[2]}` };
	if ((m = RULE_3B.exec(text))) return { rule: 3, header: `${m[1]} ${m[2]}` };
	return null;
}

/** True when `text` begins with a leaked running header. */
export function isRunningHeaderPrefix(text) {
	return detectRunningHeader(text) !== null;
}

/**
 * Strip a leaked running header from the start of `text`.
 *
 * @param {string} text
 * @returns {{
 *   matched: boolean,
 *   rule: 1|2|3|null,
 *   header: string|null,
 *   trailingNumber: string|null,
 *   remainder: string
 * }}
 */
export function stripRunningHeader(text) {
	const det = detectRunningHeader(text);
	if (det === null) {
		return { matched: false, rule: null, header: null, trailingNumber: null, remainder: text };
	}

	let remainder = text.slice(det.header.length).replace(/^[ \t]+/, '');
	let trailingNumber = null;

	const m4 = remainder.match(RULE_4);
	if (m4) {
		trailingNumber = m4[1];
		remainder = remainder.slice(m4[1].length).replace(/^[ \t]+/, '');
	}

	return { matched: true, rule: det.rule, header: det.header, trailingNumber, remainder };
}

/**
 * True when `text` begins with a broad header *shape* (page number adjacent to
 * two or more ALL-CAPS words, either order). Used to surface candidate headers
 * that the title-bounded rules did NOT strip, for manual review.
 *
 * @param {string} text
 */
export function looksLikeHeaderShape(text) {
	if (typeof text !== 'string' || text.length === 0) return false;
	return CANDIDATE.test(text);
}
