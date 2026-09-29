import { fail } from '@sveltejs/kit';
import { version } from '$app/environment';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import {
	buildFeedbackIssue,
	validateFeedbackInput,
	TURNSTILE_FIELD,
	FEEDBACK_CONFIGURATION_ERROR_MESSAGE,
	FEEDBACK_RATE_LIMITED_MESSAGE,
	FEEDBACK_SUBMITTED_MESSAGE,
	FEEDBACK_UPSTREAM_ERROR_MESSAGE,
	FEEDBACK_SUMMARY_REQUIRED_MESSAGE,
	FEEDBACK_SUMMARY_TOO_LONG_MESSAGE,
	FEEDBACK_DETAILS_REQUIRED_MESSAGE,
	FEEDBACK_DETAILS_TOO_LONG_MESSAGE
} from '$lib/server/feedback-issue';
import { createFeedbackIssue } from '$lib/server/github-issues';
import { verifyTurnstile } from '$lib/server/turnstile';
import type { Actions, PageServerLoad } from './$types';

/**
 * Anonymous feedback page: no account, no sign-in. Turnstile is the primary
 * abuse gate; a per-IP KV counter is a secondary, best-effort limit.
 *
 * The form is public by design, so `load` only exposes the public site key.
 * Nothing here reads or returns identity data.
 */
export const load: PageServerLoad = async () => {
	return { siteKey: publicEnv.PUBLIC_TURNSTILE_SITE_KEY ?? '' };
};

// ─── Rate limiting (fixed window, best-effort) ────────────────────────────────
// Key: `rl:<ip>` (5-minute window, max 3 submissions). The IP lives only in the
// KV key and is never logged; the entry expires with the window. KV errors fail
// OPEN — Turnstile is the primary gate and it must not be possible to take the
// form down by breaking KV.
//
// Known limitations, both deliberate: (1) the counter is non-atomic (a plain
// get → put with no CAS), so concurrent requests can undercount; and (2) only
// successful filings are recorded (step 5), so failed or rejected attempts do
// not consume the budget. Turnstile is the primary abuse gate; this counter is
// a secondary, best-effort backstop and is not relied on for enforcement.

const RATE_LIMIT_WINDOW_SECONDS = 300;
const RATE_LIMIT_MAX_SUBMISSIONS = 3;

interface RateLimitState {
	count: number;
	resetAt: number;
}

function parseRateLimitState(raw: string | null): RateLimitState | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== 'object') return null;
		const state = parsed as Record<string, unknown>;
		if (typeof state.count !== 'number' || typeof state.resetAt !== 'number') return null;
		return { count: state.count, resetAt: state.resetAt };
	} catch {
		return null;
	}
}

async function isRateLimited(
	binding: KVNamespace | undefined,
	ip: string
): Promise<{ limited: boolean }> {
	if (!binding) return { limited: false };
	try {
		const state = parseRateLimitState(await binding.get(`rl:${ip}`));
		if (!state || state.resetAt <= Date.now()) return { limited: false };
		return { limited: state.count >= RATE_LIMIT_MAX_SUBMISSIONS };
	} catch (error) {
		console.error('[feedback] rate-limit check failed; allowing request', {
			name: error instanceof Error ? error.name : 'unknown'
		});
		return { limited: false };
	}
}

async function recordRateLimitHit(
	binding: KVNamespace | undefined,
	ip: string,
	now: number
): Promise<void> {
	if (!binding) return;
	try {
		const existing = parseRateLimitState(await binding.get(`rl:${ip}`));
		const base =
			existing && existing.resetAt > now
				? existing
				: { count: 0, resetAt: now + RATE_LIMIT_WINDOW_SECONDS * 1000 };
		const next: RateLimitState = { count: base.count + 1, resetAt: base.resetAt };
		// Absolute expiry so repeated writes cannot extend the window.
		await binding.put(`rl:${ip}`, JSON.stringify(next), {
			expiration: Math.ceil(next.resetAt / 1000)
		});
	} catch (error) {
		console.error('[feedback] rate-limit write failed', {
			name: error instanceof Error ? error.name : 'unknown'
		});
	}
}

/** Echo the allow-listed fields back so the form can prefill after a failure. */
function prefill(type: string, summary: string, details: string) {
	return { type, summary, details };
}

/**
 * Maps a field-validation message to the form field it belongs to, so the form
 * can set `aria-invalid`/`aria-describedby` on the right input. `''` means the
 * failure was not field-specific (e.g. Turnstile or rate limiting) and no input
 * should be marked invalid.
 */
function errorFieldFor(message: string): string {
	if (
		message === FEEDBACK_SUMMARY_REQUIRED_MESSAGE ||
		message === FEEDBACK_SUMMARY_TOO_LONG_MESSAGE
	) {
		return 'summary';
	}
	if (
		message === FEEDBACK_DETAILS_REQUIRED_MESSAGE ||
		message === FEEDBACK_DETAILS_TOO_LONG_MESSAGE
	) {
		return 'details';
	}
	return '';
}

export const actions: Actions = {
	default: async ({ request, url, getClientAddress, platform }) => {
		// Declared outside the try so an unexpected throw can still echo back what
		// the reporter had typed, even if it happens mid-parse.
		let type = '';
		let summary = '';
		let details = '';

		try {
			const formData = await request.formData();
			type = String(formData.get('type') ?? '');
			summary = String(formData.get('summary') ?? '');
			details = String(formData.get('details') ?? '');
			const turnstileResponse = String(formData.get(TURNSTILE_FIELD) ?? '');

			// 1. Validate only the allow-listed fields.
			const validation = validateFeedbackInput({ type, summary, details });
			if (!validation.ok) {
				return fail(400, {
					message: validation.message,
					errorField: errorFieldFor(validation.message),
					...prefill(type, summary, details)
				});
			}

			// 2. Rate-limit check (fails open). The IP is used as a key only.
			const ip = getClientAddress();
			const limited = await isRateLimited(platform?.env?.FEEDBACK_RATE_LIMIT, ip);
			if (limited.limited) {
				return fail(429, {
					message: FEEDBACK_RATE_LIMITED_MESSAGE,
					...prefill(type, summary, details)
				});
			}

			// 3. Verify the captcha before any GitHub call. The token is consumed
			// here and never placed in the issue.
			const captcha = await verifyTurnstile(turnstileResponse, ip, {
				secret: env.TURNSTILE_SECRET_KEY,
				hostnames: env.TURNSTILE_HOSTNAMES
			});
			if (!captcha.ok) {
				return fail(400, {
					message: captcha.reason,
					...prefill(type, summary, details)
				});
			}

			// 4. Build (allow-list only) and file exactly one issue.
			const issue = buildFeedbackIssue({
				...validation.value,
				version,
				route: url.pathname
			});
			const created = await createFeedbackIssue(issue, { token: env.GITHUB_TOKEN });
			if (!created.ok) {
				if (created.kind === 'configuration') {
					// Most often a missing label (`from-app`/`suggestion`/`bug`) makes
					// GitHub return 422; a bad token or scope maps here too. The labels
					// are deployment prerequisites and already exist on the repo.
					return fail(500, {
						message: FEEDBACK_CONFIGURATION_ERROR_MESSAGE,
						...prefill(type, summary, details)
					});
				}
				if (created.kind === 'rate-limited') {
					return fail(429, {
						message: FEEDBACK_RATE_LIMITED_MESSAGE,
						...prefill(type, summary, details)
					});
				}
				return fail(502, {
					message: FEEDBACK_UPSTREAM_ERROR_MESSAGE,
					...prefill(type, summary, details)
				});
			}

			// 5. Record the successful submission against the window. Only successful
			// filings count, and the read-modify-write is non-atomic — see the known
			// limitations above. Turnstile remains the primary gate.
			await recordRateLimitHit(platform?.env?.FEEDBACK_RATE_LIMIT, ip, Date.now());

			console.log('[feedback] submission filed', { issueNumber: created.issueNumber });

			return { message: FEEDBACK_SUBMITTED_MESSAGE };
		} catch (error) {
			// Unexpected throw (the verifier and issue client do not throw by design).
			// Log a structured, PII-free summary and keep the reporter's text instead
			// of falling through to a generic error page.
			console.error('[feedback] submission failed unexpectedly', {
				path: url.pathname,
				name: error instanceof Error ? error.name : 'unknown'
			});
			return fail(500, {
				message: FEEDBACK_UPSTREAM_ERROR_MESSAGE,
				...prefill(type, summary, details)
			});
		}
	}
};
