# Proposal: Anonymous feedback to GitHub

## Why

basictexts.org has no way for a visitor to report a bug or suggest an improvement. The
feedback→GitHub-issue flow carried over from the archived carpool change
(`/home/sam/dev/carpool/openspec/changes/archive/2026-09-27-app-feedback-to-github/`) is
**signed-in-only**, and this repository's `AGENTS.md` forbids authentication and accounts.
The path therefore has to be rebuilt as an **anonymous** one: any visitor can reach the
maintainer without an account, with abuse bounded by a captcha and a rate limit and with no
personal data collected.

## What Changes

- Add a **public** feedback page at `/feedback` (no auth, no account) accepting exactly
  three fields: `type` (`suggestion` | `bug`), `summary` (≤120 chars), `details` (≤4000
  chars).
- Verify a **server-side Cloudflare Turnstile** token (`success`, `action === 'feedback'`,
  and a `hostname` on a configured allow-list) **before the submission has any effect**. A
  missing or invalid token blocks filing.
- Add a best-effort **per-IP rate limit** backed by the `FEEDBACK_RATE_LIMIT` KV binding
  (5-minute fixed window, max 3 submissions) that **fails open** when KV is missing or
  errors. The IP is used only as the rate-limit key — never stored, logged, or filed.
- File **exactly one labeled GitHub issue** per valid submission (`from-app` plus `bug` or
  `suggestion`) to `idusortus/recovery-basic-texts` through a server-side token. The issue
  body contains only the visitor's `summary`/`details` plus route, app version, and a UTC
  timestamp — never a name, email, IP, user agent, Turnstile token, or secret.
- Return **friendly errors** that retain the visitor's typed text and reset the single-use
  Turnstile widget, and never surface raw upstream provider text.
- Add two entry points: a **footer link** (`src/routes/+layout.svelte`) and an
  **About-page card** (`src/routes/about/+page.svelte`).

## Capabilities

### New Capabilities

- `feedback-to-github`: An anonymous, abuse-gated public feedback form that files exactly
  one labeled GitHub issue per valid submission, built from an allow-list of the visitor's
  text plus minimal non-identifying context.

### Modified Capabilities

- None. `openspec/specs/` is empty, and no existing capability's requirements change.

## Impact

- **New source files:** `src/routes/feedback/+page.server.ts`,
  `src/routes/feedback/+page.svelte`, `src/lib/server/feedback-issue.ts`,
  `src/lib/server/turnstile.ts`, `src/lib/server/github-issues.ts`,
  `src/lib/components/TurnstileWidget.svelte`, and a dependency-free test at
  `scripts/test-feedback.mjs` (run via `pnpm run test:feedback`).
- **Modified source files:** `src/app.d.ts` (platform env shape), `src/routes/+layout.svelte`
  (footer link), `src/routes/about/+page.svelte` (About card), `README.md` and
  `.env.example`.
- **`wrangler.jsonc`:** new non-secret `vars` `PUBLIC_TURNSTILE_SITE_KEY` and
  `TURNSTILE_HOSTNAMES`, and a new `FEEDBACK_RATE_LIMIT` KV binding under `kv_namespaces`.
- **Deployment prerequisites:** Pages secrets `TURNSTILE_SECRET_KEY` and `GITHUB_TOKEN`
  (`wrangler pages secret put`); the issue labels `from-app`, `suggestion`, and `bug` must
  exist on the repository.
- **No new npm dependencies.** No database, no admin surface, and no app behavior beyond
  the feedback path.
