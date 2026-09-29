# Tasks

> Built and confirmed working before this change was authored; every task below is already
> complete and is checked to record the shipped implementation.

## 1. Feedback domain logic (pure, no I/O)

- [x] 1.1 Add `src/lib/server/feedback-issue.ts` with `FEEDBACK_TYPES` (`suggestion` | `bug`), `SUMMARY_MAX_LENGTH` (120), `DETAILS_MAX_LENGTH` (4000), and the `TURNSTILE_FIELD`, label, and friendly message constants — verify the module imports with no server-only dependencies
- [x] 1.2 Implement `validateFeedbackInput`, which reads only `type`, `summary`, and `details`, trims them, and rejects a missing/invalid type, a blank summary or details, or an over-length field with a field-specific friendly message — verify `pnpm run test:feedback` covers the boundary cases
- [x] 1.3 Implement `buildFeedbackIssue` to assemble the title (`[Bug] `/`[Suggestion] ` prefix, clipped to 256 chars) and body (summary + details + route + app version + UTC timestamp) with labels `from-app` plus `bug`/`suggestion`, fencing the text with a delimiter longer than any backtick run — verify the payload-shape and fence tests pass
- [x] 1.4 Add `scripts/test-feedback.mjs` proving structurally that non-allow-listed input (name, email, IP, user agent) cannot reach the issue — verify `pnpm run test:feedback` passes

## 2. Server integration modules

- [x] 2.1 Add `src/lib/server/turnstile.ts` implementing `verifyTurnstile` against Cloudflare's Siteverify endpoint, requiring `success`, `action === 'feedback'`, and a `hostname` on the `TURNSTILE_HOSTNAMES` allow-list; never throw and never log the token, secret, or IP
- [x] 2.2 In `verifyTurnstile`, fail a blank token before any network call, fail with a configuration message when the secret is unset, and skip action/hostname checks only for Cloudflare's published test secrets — verify each branch returns the intended friendly `reason` without throwing
- [x] 2.3 Emit a one-time `console.warn` when a published test secret is configured — verify a test-secret run logs the warning once
- [x] 2.4 Add `src/lib/server/github-issues.ts` implementing `createFeedbackIssue` as a non-throwing client that POSTs to `idusortus/recovery-basic-texts` with `Bearer` auth, a 10s timeout, and no response-body leakage, mapping HTTP status to discriminated failure kinds — verify a missing token and each status map to the expected kind

## 3. Route handler and rate limiting

- [x] 3.1 Add `src/routes/feedback/+page.server.ts` `load` exposing only `PUBLIC_TURNSTILE_SITE_KEY` — verify the returned payload contains no identity data
- [x] 3.2 Implement the per-IP fixed-window rate limit in the route over the `FEEDBACK_RATE_LIMIT` binding (`rl:<ip>` key, 3 per 5-minute window, absolute expiry), using the IP only as the key and failing open on a missing binding or KV error — verify a KV error still allows the submission
- [x] 3.3 Order the action as validate → rate-limit check → Turnstile verify → build and file → record hit, so Turnstile gating precedes filing and the hit record — verify an invalid token files nothing and records no hit
- [x] 3.4 Return `fail(...)` responses that echo the allow-listed `type`, `summary`, and `details` and carry a server-computed `errorField` for field-specific failures, and never surface raw upstream text — verify each failure path keeps the typed text
- [x] 3.5 Handle the unexpected-throw path with a structured, PII-free log and a friendly message that still echoes the typed text — verify the catch block returns 500 with prefill

## 4. Feedback form UI and entry points

- [x] 4.1 Add `src/lib/components/TurnstileWidget.svelte` rendering the widget explicitly, writing the token into the `cf-turnstile-response` hidden field, and resetting on `resetKey` change or removal on destroy — verify a bumped `resetKey` clears the stale token
- [x] 4.2 Add `src/routes/feedback/+page.svelte` with the `type` radios, `summary` input (maxlength 120), and `details` textarea (maxlength 4000), success and error regions, and `aria-invalid`/`aria-describedby` wired from the server `errorField` — verify a failed submit re-marks the affected input
- [x] 4.3 Preserve the visitor's typed text across a failed submit and bump the widget `resetKey` on failure so the single-use token is refreshed — verify the form refills and the widget reloads after an error
- [x] 4.4 Add the footer link to `/feedback` in `src/routes/+layout.svelte` — verify the link appears on pages that render the footer
- [x] 4.5 Add the feedback card linking to `/feedback` in `src/routes/about/+page.svelte` — verify the About page renders the card

## 5. Configuration and documentation

- [x] 5.1 Extend `src/app.d.ts` with the `FEEDBACK_RATE_LIMIT` KV binding and the `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_HOSTNAMES`, and `GITHUB_TOKEN` platform env members — verify `pnpm run check` type-checks the route
- [x] 5.2 Add the non-secret `PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_HOSTNAMES` vars and the `FEEDBACK_RATE_LIMIT` KV binding to `wrangler.jsonc` — verify the config parses and declares the binding
- [x] 5.3 Document local test keys in `.env.example` and the production secrets, labels, and rate-limit binding in `README.md` ("Feedback form (maintainers)") — verify the README lists `TURNSTILE_SECRET_KEY`, `GITHUB_TOKEN`, and the `from-app`/`suggestion`/`bug` labels as prerequisites

## 6. Verification

- [x] 6.1 Run `pnpm run test:feedback` and confirm all assertions pass — verify the no-PII and payload-shape coverage passes
- [x] 6.2 Run `pnpm run check` and confirm SvelteKit/TypeScript checks pass for the feedback route and modules — verify no type errors
- [x] 6.3 Manually file one suggestion and one bug in a local/preview environment and confirm each produces exactly one issue with the expected labels — verify the issue body contains only the user's text plus route, version, and timestamp
