# Design

## Context

See `proposal.md` — Why. This change builds an anonymous feedback path that already ships in
the repository; this design records the decisions behind how it is put together. Current
state and constraints that shape the approach:

- `AGENTS.md` forbids authentication, accounts, bookmarks, notes, and non-AA content, so the
  signed-in carpool flow cannot be reused; the feedback path must work for an anonymous
  visitor.
- The target is Cloudflare Pages (SvelteKit + `@sveltejs/adapter-cloudflare`). `wrangler.jsonc`
  already declares KV bindings (`SEARCH_LOG`) and non-secret `vars`; secrets are set per
  environment with `wrangler pages secret put`.
- The app has no database and no server-side search; a KV key-value store is already the
  established lightweight persistence mechanism.
- The pure logic lives in `src/lib/server/feedback-issue.ts` (no I/O) so it can be tested by a
  dependency-free Node script (`scripts/test-feedback.mjs`). The I/O lives in
  `src/lib/server/turnstile.ts` and `src/lib/server/github-issues.ts`, and the request flow in
  `src/routes/feedback/+page.server.ts`.

## Goals / Non-Goals

**Goals:**

- Accept a report from an anonymous visitor with no account and no stored identity.
- Bound abuse cheaply and defensively (captcha first, best-effort rate limit second).
- Make the no-PII guarantee structural (allow-list builder), not a promise.
- Keep the feedback path self-contained and removable without affecting search.

**Non-Goals:**

- No feedback inbox, admin UI, or status tracking for the visitor.
- No file attachments, screenshots, or follow-up email/thread.
- No authentication, accounts, or any way to identify or contact the reporter.
- No change to existing search, corpus, or rendering behavior.

## Decisions

### Anonymous + Turnstile + KV rate limit, instead of sign-in

The carpool flow gated submission behind sign-in. `AGENTS.md` forbids accounts, so the path
is anonymous and the abuse gate moves to the edge: Cloudflare Turnstile is the primary gate,
and a per-IP KV counter is a secondary backstop. Alternative considered: a signed-in flow (as
in carpool) — rejected because it violates the repo's no-auth guardrail. Alternative
considered: no gate at all — rejected because a public posting endpoint to GitHub invites
spam and cost.

### Turnstile verification is server-side and ordered first

The browser submits a single-use token in the `cf-turnstile-response` field; the server
exchanges it with Cloudflare's Siteverify endpoint and requires `success`,
`action === 'feedback'`, and a `hostname` on the `TURNSTILE_HOSTNAMES` allow-list. The token
is verified before the submission has any effect, so an invalid token cannot file an issue or
record a rate-limit hit. The verifier never throws and never logs the token, secret, or IP —
provider failures collapse into a friendly result. Alternative considered: verifying in the
browser — rejected because a client cannot be trusted to gate a server-side write.

### KV fixed-window rate limit that fails open

`FEEDBACK_RATE_LIMIT` stores a small JSON `{ count, resetAt }` under the key `rl:<ip>` with an
absolute expiry, allowing 3 submissions per 5-minute window. The read-modify-write is
deliberately non-atomic and only successful filings are recorded; Turnstile remains the
primary gate, and the counter is a best-effort backstop, not an enforcement mechanism. The IP
is used only as the key — never logged or filed. KV errors return "allow" so breaking KV
cannot take the form down. Alternative considered: a Durable Object for an atomic counter —
rejected as over-built for a best-effort limit. Alternative considered: Cloudflare WAF rate
limiting rules — rejected as an out-of-repo, less testable configuration for this MVP.

### Structural no-PII via a pure allow-list builder

`validateFeedbackInput` reads only `type`, `summary`, and `details` and ignores every other
property, and `buildFeedbackIssue` assembles the body from those fields plus route, app
version, and a UTC timestamp. Because the builder never accepts identity fields, extra request
data (name, email, user agent, token) cannot reach GitHub even when present on the input
object; the typed input interface enforces this at compile time and
`scripts/test-feedback.mjs` proves it at runtime. Alternative considered: filtering out known
PII keys from the request — rejected because allow-listing is provably safer than
deny-listing.

### Fenced issue body to prevent markdown injection

The visitor's text is wrapped in a backtick fence one longer than the longest backtick run it
contains, so the text cannot close the fence and inject headings, mentions, or HTML comments
into the issue. The title is prefixed `[Bug]`/`[Suggestion]` and clipped to GitHub's
256-character title limit.

### A test-secret `console.warn` that fires once per process

Cloudflare's published Turnstile test secrets always pass but return `hostname: example.com`
with no action, so the action and hostname checks are skipped when one is configured — a
deliberate local-dev affordance that ships in `.env.example`. Because the same bypass would be
catastrophic in production, the verifier emits one loud `console.warn` per process when it sees
a test secret. Warn-once avoids spamming the logs on every request while making the condition
impossible to miss.

### Server-computed `errorField` for accessible error wiring

A field-specific validation failure returns an `errorField` naming the input that failed
(`summary` or `details`; `''` when the failure is not field-specific). The form uses it to set
`aria-invalid` and point `aria-describedby` at the error for that input only, so screen readers
announce the right association. Computing the field server-side keeps the mapping next to the
messages and avoids string-matching provider copy in the browser.

### Single-use tokens drive a client reset key

Turnstile tokens are single-use, so a failed submit would otherwise leave a spent token in the
form. The page tracks a `resetKey` and bumps it whenever a submit fails; the widget observes
the change, clears its stale token, and re-renders. This is why the widget is rendered
explicitly rather than implicitly.

### Missing labels are a deployment prerequisite, surfaced as "not set up"

Filing with a label that does not exist makes GitHub return HTTP 422. `createFeedbackIssue`
maps 401/403/404/422 to a `configuration` kind, which the route renders as the friendly
"not set up yet" message instead of filing or showing raw upstream text. The `from-app`,
`suggestion`, and `bug` labels must exist on the repository; the README documents creating
them.

## Risks / Trade-offs

- [The rate-limit counter is non-atomic and only counts successful filings] → It is explicitly
  best-effort; Turnstile is the primary gate and the counter only needs to blunt casual abuse.
- [A KV outage could otherwise disable feedback] → The limit fails open by design; availability
  is preferred over strictness for a secondary control.
- [A test secret accidentally set in production would bypass checks] → A one-time loud
  `console.warn` fires whenever a published test secret is used; real secrets are set per
  environment via `wrangler pages secret put`.
- [A missing label or token looks like a generic failure to the visitor] → 422/401/403 map to
  the distinct "not set up" message, and the README lists labels as a deployment prerequisite.
- [The public endpoint files public GitHub issues] → The body is allow-listed and fenced, and
  the visitor is told in the form copy that reports become public issues.

## Migration Plan

1. Create the issue labels `from-app`, `suggestion`, and `bug` on
   `idusortus/recovery-basic-texts`.
2. Set the secrets per environment:
   `wrangler pages secret put TURNSTILE_SECRET_KEY --project-name basictexts` and
   `wrangler pages secret put GITHUB_TOKEN --project-name basictexts`.
3. Confirm the non-secret `vars` (`PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_HOSTNAMES`) and the
   `FEEDBACK_RATE_LIMIT` KV binding in `wrangler.jsonc`.
4. Deploy and verify one suggestion and one bug file the expected labels.
5. Rollback: revert the change; the feedback route is self-contained and removing it does not
   affect search or corpus behavior.
