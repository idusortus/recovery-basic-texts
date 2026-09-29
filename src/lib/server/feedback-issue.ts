/**
 * Pure validation and GitHub-issue construction for the anonymous in-app
 * feedback form.
 *
 * No I/O lives here: the route parses the request, validates it through
 * `validateFeedbackInput`, verifies the Turnstile token, and hands the result
 * of `buildFeedbackIssue` to `$lib/server/github-issues`. Keeping this module
 * pure is what makes the privacy guarantee below testable in isolation.
 *
 * PRIVACY (structural, not best-effort): the builder reads only the
 * allow-listed fields it is given — `type`, `summary`, `details`, and
 * `version`. It never accepts, forwards, or serialises a name, email, IP
 * address, user agent, Turnstile token, or secret. Because the issue body is
 * assembled from those fields plus a server timestamp and route label, such
 * data cannot reach GitHub even if it is present on the input object. The typed
 * input interface enforces this at compile time; `scripts/test-feedback.mjs`
 * proves it at runtime.
 */

/** Accepted feedback kinds. The union is derived so the set cannot drift. */
export const FEEDBACK_TYPES = ['suggestion', 'bug'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const SUMMARY_MAX_LENGTH = 120;
export const DETAILS_MAX_LENGTH = 4000;
/** GitHub's hard cap for an issue title. */
export const TITLE_MAX_LENGTH = 256;

/** The POST field carrying the Turnstile widget response. */
export const TURNSTILE_FIELD = 'cf-turnstile-response';

export const ISSUE_LABEL_BASE = 'from-app';
export const ISSUE_LABEL_BUG = 'bug';
export const ISSUE_LABEL_SUGGESTION = 'suggestion';

// Friendly, field-specific validation copy. Raw upstream provider text must
// never reach a user, so every message is chosen from constants.
export const FEEDBACK_TYPE_REQUIRED_MESSAGE =
	'Choose whether this is a suggestion or a bug report.';
export const FEEDBACK_SUMMARY_REQUIRED_MESSAGE = 'Add a short summary.';
export const FEEDBACK_SUMMARY_TOO_LONG_MESSAGE = `Keep the summary to ${SUMMARY_MAX_LENGTH} characters or fewer.`;
export const FEEDBACK_DETAILS_REQUIRED_MESSAGE = 'Add some details so this can be acted on.';
export const FEEDBACK_DETAILS_TOO_LONG_MESSAGE = `Keep the details to ${DETAILS_MAX_LENGTH} characters or fewer.`;

// User-facing outcome copy used by the route and the form.
export const FEEDBACK_SUBMITTED_MESSAGE = 'Thanks! Your report has been sent to the maintainer.';
export const FEEDBACK_CONFIGURATION_ERROR_MESSAGE =
	'Feedback is not set up yet, so your report could not be sent. Please try again later.';
export const FEEDBACK_RATE_LIMITED_MESSAGE =
	'Too many reports right now. Please try again in a few minutes.';
export const FEEDBACK_UPSTREAM_ERROR_MESSAGE =
	'We could not send your report right now. Please try again later.';

export interface FeedbackFields {
	type: FeedbackType;
	summary: string;
	details: string;
}

export type FeedbackValidation =
	| { ok: true; value: FeedbackFields }
	| { ok: false; message: string };

export interface BuildFeedbackIssueInput extends FeedbackFields {
	/** App build/version stamp echoed into the issue context. */
	version: string;
	/** Originating route. Defaults to `/feedback`. */
	route?: string;
	/** Injectable clock for deterministic output in tests. */
	now?: Date;
}

export interface FeedbackIssue {
	title: string;
	body: string;
	labels: string[];
}

/**
 * Per-type presentation keyed by the `FeedbackType` union. The
 * `Record<FeedbackType, …>` type means adding a type without a matching entry
 * fails typecheck, so labels and title prefixes cannot drift from the type list.
 */
const FEEDBACK_TYPE_CONFIG: Record<FeedbackType, { label: string; titlePrefix: string }> = {
	suggestion: { label: ISSUE_LABEL_SUGGESTION, titlePrefix: 'Suggestion' },
	bug: { label: ISSUE_LABEL_BUG, titlePrefix: 'Bug' }
};

/** Membership is derived from `FEEDBACK_TYPES`, so the accepted set cannot drift. */
const FEEDBACK_TYPE_SET: ReadonlySet<string> = new Set(FEEDBACK_TYPES);

function asRecord(raw: unknown): Record<string, unknown> {
	return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

function asTrimmedString(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function parseType(value: unknown): FeedbackType | null {
	return typeof value === 'string' && FEEDBACK_TYPE_SET.has(value)
		? (value as FeedbackType)
		: null;
}

/**
 * Validates only the allow-listed fields. Reads `type`, `summary`, and
 * `details` and ignores every other property, so extra input (identity, tokens,
 * user agent, …) can never influence or leak into the result.
 */
export function validateFeedbackInput(raw: unknown): FeedbackValidation {
	const input = asRecord(raw);

	const type = parseType(input.type);
	if (!type) {
		return { ok: false, message: FEEDBACK_TYPE_REQUIRED_MESSAGE };
	}

	const summary = asTrimmedString(input.summary);
	if (!summary) {
		return { ok: false, message: FEEDBACK_SUMMARY_REQUIRED_MESSAGE };
	}
	if (summary.length > SUMMARY_MAX_LENGTH) {
		return { ok: false, message: FEEDBACK_SUMMARY_TOO_LONG_MESSAGE };
	}

	const details = asTrimmedString(input.details);
	if (!details) {
		return { ok: false, message: FEEDBACK_DETAILS_REQUIRED_MESSAGE };
	}
	if (details.length > DETAILS_MAX_LENGTH) {
		return { ok: false, message: FEEDBACK_DETAILS_TOO_LONG_MESSAGE };
	}

	return { ok: true, value: { type, summary, details } };
}

function longestBacktickRun(text: string): number {
	let longest = 0;
	let current = 0;
	for (const char of text) {
		if (char === '`') {
			current += 1;
			longest = Math.max(longest, current);
		} else {
			current = 0;
		}
	}
	return longest;
}

/**
 * A backtick fence longer than any run in the content, so the content cannot
 * close the fence and inject markdown (headings, mentions, HTML comments)
 * outside it.
 */
function fenceFor(text: string): string {
	return '`'.repeat(Math.max(3, longestBacktickRun(text) + 1));
}

/** `[Bug] <summary>` / `[Suggestion] <summary>`, clipped to GitHub's title cap. */
export function formatIssueTitle(type: FeedbackType, summary: string): string {
	const prefix = `[${FEEDBACK_TYPE_CONFIG[type].titlePrefix}] `;
	const available = Math.max(0, TITLE_MAX_LENGTH - prefix.length);
	const trimmed = summary.trim();
	const clipped = trimmed.length > available ? trimmed.slice(0, available) : trimmed;
	return `${prefix}${clipped}`;
}

function buildIssueBody(summary: string, details: string, input: BuildFeedbackIssueInput): string {
	const fence = fenceFor(`${summary}\n${details}`);
	const route = input.route?.trim() || '/feedback';
	const version = input.version?.trim() || 'unknown';
	const submittedAt = (input.now ?? new Date()).toISOString();

	return [
		fence,
		summary,
		'',
		details,
		fence,
		'',
		'### Context (from app)',
		'',
		`- Route: ${route}`,
		`- App version: ${version}`,
		`- Submitted (UTC): ${submittedAt}`
	].join('\n');
}

/**
 * Builds the GitHub issue payload from already-validated feedback. The caller
 * must run `validateFeedbackInput` first; this function assumes a valid type.
 */
export function buildFeedbackIssue(input: BuildFeedbackIssueInput): FeedbackIssue {
	const config = FEEDBACK_TYPE_CONFIG[input.type];
	const summary = input.summary.trim();
	const details = input.details.trim();

	return {
		title: formatIssueTitle(input.type, summary),
		body: buildIssueBody(summary, details, input),
		labels: [ISSUE_LABEL_BASE, config.label]
	};
}
