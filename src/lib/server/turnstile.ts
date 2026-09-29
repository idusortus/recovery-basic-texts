import { env } from '$env/dynamic/private';

/**
 * Server-only verification of a Cloudflare Turnstile captcha token.
 *
 * The browser widget submits a one-time token in the `cf-turnstile-response`
 * field; this module exchanges it with Cloudflare's Siteverify endpoint before
 * the caller is allowed to file a GitHub issue. It proves the submission came
 * from a human on one of our own hostnames — nothing about the visitor's
 * identity is used or retained.
 *
 * The function never throws. Cloudflare/network failures are logged server-side
 * (without the token, secret, or IP) and collapse into a friendly result so the
 * route can render a message without leaking raw provider text.
 */

export const DEFAULT_TURNSTILE_VERIFY_URL =
	'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** The Turnstile `action` value the feedback widget is expected to set. */
export const TURNSTILE_ACTION = 'feedback';

export const TURNSTILE_REQUIRED_MESSAGE =
	'Please complete the verification challenge before sending.';
export const TURNSTILE_FAILED_MESSAGE =
	'We could not verify that you are human. Please try again.';
export const TURNSTILE_UNAVAILABLE_MESSAGE =
	'The verification service is unavailable right now. Please try again.';
export const TURNSTILE_CONFIGURATION_MESSAGE =
	'Verification is not configured. Please try again later.';

/**
 * Cloudflare's published test secrets. `1x…` always passes but returns
 * `hostname: "example.com"` with no action, so the action/hostname checks are
 * skipped when one of these is configured — a deliberate local-dev affordance
 * that cannot weaken production, where the real widget secret is used.
 */
const TURNSTILE_TEST_SECRETS: ReadonlySet<string> = new Set([
	'1x0000000000000000000000000000000AA',
	'2x0000000000000000000000000000000AA',
	'3x0000000000000000000000000000000AA'
]);

/**
 * Emits one loud warning per process when a published test secret is configured.
 * The bypass is safe in local dev but catastrophic in production (any token
 * passes and the action/hostname checks are skipped), so make it impossible to
 * miss in the logs. Warns once to avoid spamming on every request.
 */
let warnedTestSecret = false;
function warnIfTestSecret(secret: string): void {
	if (!TURNSTILE_TEST_SECRETS.has(secret) || warnedTestSecret) return;
	warnedTestSecret = true;
	console.warn(
		'[feedback] TURNSTILE_SECRET_KEY is a Cloudflare PUBLISHED TEST SECRET. ' +
			'Turnstile action and hostname checks are bypassed. This must never be set in production.'
	);
}

export type TurnstileResult = { ok: true } | { ok: false; reason: string };

export interface VerifyTurnstileOptions {
	/** Override the secret. Defaults to `env.TURNSTILE_SECRET_KEY`. */
	secret?: string;
	/** Injectable fetch for tests. Defaults to global `fetch`. */
	fetchImpl?: typeof fetch;
	/** Override the Siteverify URL (tests/stubs). */
	baseUrl?: string;
	/** Expected `action` value. Defaults to `feedback`. */
	expectedAction?: string;
	/** Comma-separated hostname allow-list. Defaults to `env.TURNSTILE_HOSTNAMES`. */
	hostnames?: string;
}

interface SiteverifyBody {
	success?: boolean;
	action?: string;
	hostname?: string;
	'error-codes'?: unknown;
}

function parseHostnames(value: string | undefined | null): Set<string> {
	return new Set(
		(value ?? '')
			.split(',')
			.map((hostname) => hostname.trim().toLowerCase())
			.filter(Boolean)
	);
}

function errorCodesOf(payload: SiteverifyBody | null): string[] {
	const raw = payload?.['error-codes'];
	return Array.isArray(raw) ? raw.filter((code): code is string => typeof code === 'string') : [];
}

/**
 * Validates a Turnstile token against Cloudflare's Siteverify endpoint.
 *
 * @param token    The `cf-turnstile-response` field value. A blank/missing token
 *                 fails immediately with no network call.
 * @param remoteip The visitor's IP, forwarded as `remoteip` when present. It is
 *                 sent to Cloudflare for verification only and is never logged
 *                 or stored by this app.
 */
export async function verifyTurnstile(
	token: string | null | undefined,
	remoteip?: string | null,
	opts: VerifyTurnstileOptions = {}
): Promise<TurnstileResult> {
	const trimmed = typeof token === 'string' ? token.trim() : '';
	if (trimmed === '') {
		return { ok: false, reason: TURNSTILE_REQUIRED_MESSAGE };
	}

	const secret = opts.secret ?? env.TURNSTILE_SECRET_KEY ?? '';
	if (secret === '') {
		console.error('[feedback] TURNSTILE_SECRET_KEY is not configured; cannot verify captcha');
		return { ok: false, reason: TURNSTILE_CONFIGURATION_MESSAGE };
	}
	warnIfTestSecret(secret);

	const fetchImpl = opts.fetchImpl ?? fetch;
	const verifyUrl = opts.baseUrl ?? DEFAULT_TURNSTILE_VERIFY_URL;
	const expectedAction = opts.expectedAction ?? TURNSTILE_ACTION;
	const allowedHostnames = parseHostnames(opts.hostnames ?? env.TURNSTILE_HOSTNAMES);

	const body = new URLSearchParams();
	body.set('secret', secret);
	body.set('response', trimmed);
	if (remoteip) {
		body.set('remoteip', remoteip);
	}

	let payload: SiteverifyBody | null = null;
	try {
		const response = await fetchImpl(verifyUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: body.toString()
		});

		if (!response.ok) {
			console.error('[feedback] turnstile siteverify returned a non-2xx response', {
				status: response.status
			});
			return { ok: false, reason: TURNSTILE_UNAVAILABLE_MESSAGE };
		}

		const parsed = (await response.json()) as unknown;
		payload = parsed && typeof parsed === 'object' ? (parsed as SiteverifyBody) : null;
	} catch (error) {
		// Never log the token, secret, or IP; only the error name for debugging.
		console.error('[feedback] turnstile siteverify request failed', {
			name: error instanceof Error ? error.name : 'unknown'
		});
		return { ok: false, reason: TURNSTILE_UNAVAILABLE_MESSAGE };
	}

	if (!payload || payload.success !== true) {
		console.error('[feedback] turnstile verification failed', {
			codes: errorCodesOf(payload)
		});
		return { ok: false, reason: TURNSTILE_FAILED_MESSAGE };
	}

	// Local dev with Cloudflare's test secret: success is authoritative and the
	// dummy response carries neither our action nor hostname.
	if (TURNSTILE_TEST_SECRETS.has(secret)) {
		return { ok: true };
	}

	const action = typeof payload.action === 'string' ? payload.action : '';
	if (action !== expectedAction) {
		console.error('[feedback] turnstile action mismatch', {
			expected: expectedAction,
			actual: action
		});
		return { ok: false, reason: TURNSTILE_FAILED_MESSAGE };
	}

	if (allowedHostnames.size === 0) {
		console.error('[feedback] TURNSTILE_HOSTNAMES is not configured');
		return { ok: false, reason: TURNSTILE_CONFIGURATION_MESSAGE };
	}

	const hostname = typeof payload.hostname === 'string' ? payload.hostname.toLowerCase() : '';
	if (!allowedHostnames.has(hostname)) {
		console.error('[feedback] turnstile hostname rejected', { allowed: false });
		return { ok: false, reason: TURNSTILE_FAILED_MESSAGE };
	}

	return { ok: true };
}
