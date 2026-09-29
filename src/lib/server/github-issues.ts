import { env } from '$env/dynamic/private';

/**
 * Server-only client for filing issues in this project's GitHub tracker.
 *
 * Never throws and never surfaces GitHub's response body: callers get a
 * discriminated result whose failure `kind` maps to friendly copy in
 * `$lib/server/feedback-issue`. The token is read from the environment and is
 * never logged or included in a result.
 *
 * Deployment prerequisite: the repository must already define the issue labels
 * the payload requests. Filing with a label that does not exist makes GitHub
 * return HTTP 422, which maps to the `configuration` kind and the "not set up"
 * message (`FEEDBACK_CONFIGURATION_ERROR_MESSAGE`) rather than filing. The
 * `from-app`, `bug`, and `suggestion` labels are created on this repository.
 */

export const GITHUB_ISSUES_REPO = 'idusortus/recovery-basic-texts';

const DEFAULT_API_BASE = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';
const USER_AGENT = 'basictexts-feedback';
const DEFAULT_TIMEOUT_MS = 10_000;

export type CreateIssueFailureKind = 'configuration' | 'rate-limited' | 'upstream';

export interface GitHubIssuePayload {
	title: string;
	body: string;
	labels: string[];
}

export interface CreateFeedbackIssueOptions {
	/** Defaults to `env.GITHUB_TOKEN`. */
	token?: string;
	/** Override the API base (tests/stubs). Defaults to api.github.com. */
	baseUrl?: string;
	/** Injectable fetch for tests. Defaults to global `fetch`. */
	fetchImpl?: typeof fetch;
	/** Abort the request after this many milliseconds. */
	timeoutMs?: number;
}

export type CreateIssueResult =
	| { ok: true; issueNumber: number | null; issueUrl: string | null }
	| { ok: false; kind: CreateIssueFailureKind; status?: number };

function mapStatusToFailureKind(status: number): CreateIssueFailureKind {
	// 422 is a validation/configuration failure — most often a requested label
	// (`from-app`/`suggestion`/`bug`) missing from the repo — not throttling. It
	// must not surface rate-limit copy, so it becomes `configuration`, which the
	// route renders as the "not set up" message.
	if (status === 401 || status === 403 || status === 404 || status === 422) {
		return 'configuration';
	}
	if (status === 429) {
		return 'rate-limited';
	}
	return 'upstream';
}

function normalizeBaseUrl(value: string | undefined): string {
	const base = value?.trim() || DEFAULT_API_BASE;
	return base.replace(/\/+$/, '');
}

export async function createFeedbackIssue(
	payload: GitHubIssuePayload,
	options: CreateFeedbackIssueOptions = {}
): Promise<CreateIssueResult> {
	const fetchImpl = options.fetchImpl ?? fetch;
	const token = options.token ?? env.GITHUB_TOKEN ?? '';
	const baseUrl = normalizeBaseUrl(options.baseUrl);
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	if (!token) {
		console.error('[feedback] GITHUB_TOKEN is not configured');
		return { ok: false, kind: 'configuration' };
	}

	const url = `${baseUrl}/repos/${GITHUB_ISSUES_REPO}/issues`;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetchImpl(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: 'application/vnd.github+json',
				'X-GitHub-Api-Version': GITHUB_API_VERSION,
				'User-Agent': USER_AGENT,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(payload),
			signal: controller.signal
		});

		if (!response.ok) {
			const kind = mapStatusToFailureKind(response.status);
			console.error('[feedback] GitHub issue creation failed', {
				status: response.status,
				kind
			});
			return { ok: false, kind, status: response.status };
		}

		let data: unknown = null;
		try {
			data = await response.json();
		} catch {
			data = null;
		}

		const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
		const issueNumber = typeof record.number === 'number' ? record.number : null;
		const issueUrl = typeof record.html_url === 'string' ? record.html_url : null;

		return { ok: true, issueNumber, issueUrl };
	} catch (error) {
		// Covers network failures and our AbortController timeout alike. Log only
		// the error name; the token and any response body stay out of the logs.
		console.error('[feedback] GitHub request failed', {
			name: error instanceof Error ? error.name : 'unknown'
		});
		return { ok: false, kind: 'upstream' };
	} finally {
		clearTimeout(timeout);
	}
}
