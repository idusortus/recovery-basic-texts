# feedback-to-github Specification

## Purpose

Lets any visitor of basictexts.org report a bug or suggest an improvement without an
account, and delivers each report to the maintainer as exactly one labeled GitHub issue
that contains the visitor's text and minimal non-identifying context only.

## Requirements

### Requirement: Anonymous public feedback form

The system SHALL expose a public feedback form at `/feedback` that any visitor can use
without authentication or an account. The form SHALL accept exactly three fields: `type`
(`suggestion` or `bug`), `summary` (at most 120 characters), and `details` (at most 4000
characters). A submission that omits an accepted `type`, omits `summary` or `details`, or
exceeds either length limit SHALL be rejected and SHALL NOT be filed.

#### Scenario: A visitor submits without signing in

- **WHEN** an anonymous visitor completes the form with an accepted type, a summary, and details
- **THEN** the submission is accepted with no authentication step and no account required

#### Scenario: An invalid type is rejected

- **WHEN** a submission's `type` is missing or is not `suggestion` or `bug`
- **THEN** the submission is rejected with the friendly choose-a-type message and nothing is filed

#### Scenario: An oversized field is rejected

- **WHEN** the `summary` exceeds 120 characters or the `details` exceed 4000 characters
- **THEN** the submission is rejected with the matching length message and nothing is filed

### Requirement: Server-side Turnstile verification gates filing

The system SHALL verify the submitted Cloudflare Turnstile token server-side before the
submission has any effect. Verification SHALL require a successful response with
`action === 'feedback'` and a `hostname` on the configured allow-list. The action and
hostname checks SHALL be bypassed only when `TURNSTILE_SECRET_KEY` is one of Cloudflare's
published test secrets (a local/dev-only affordance); in production the checks are enforced,
and an empty allow-list fails closed. A missing or invalid token SHALL block filing and
return a friendly message. No issue SHALL be filed and no rate-limit hit SHALL be recorded
unless verification succeeds.

#### Scenario: A valid token allows filing to proceed

- **WHEN** the server verifies a token whose response is successful, whose `action` is `feedback`, and whose `hostname` is on the allow-list
- **THEN** the submission may proceed to file the issue

#### Scenario: A missing or invalid token blocks filing

- **WHEN** the token is missing, expired, or fails the success, action, or hostname check
- **THEN** no issue is filed and the visitor sees a friendly verification message

#### Scenario: Verification precedes every effect

- **WHEN** a submission fails Turnstile verification
- **THEN** no GitHub request is made and no rate-limit hit is recorded

### Requirement: Per-IP rate limit is best-effort and key-only

The system SHALL apply a per-IP fixed-window rate limit backed by the `FEEDBACK_RATE_LIMIT`
KV binding, allowing at most 3 successful submissions per 5-minute window. The limit is
best-effort: it bounds successful submissions only (the counter records a hit only after a
filing succeeds) and its read-modify-write is deliberately non-atomic, so concurrent
requests may under-count. The IP address SHALL be used as the rate-limit key and forwarded
to Cloudflare's Siteverify only to verify the challenge (`remoteip`), and SHALL NOT be
stored, logged, or included in the filed issue. When the binding is absent or a KV
operation errors, the limit SHALL fail open so the form cannot be taken down by KV.

#### Scenario: Excessive submissions are limited

- **WHEN** a visitor exceeds 3 submissions within the 5-minute window
- **THEN** further submissions are rejected with a friendly rate-limit message and nothing is filed

#### Scenario: The IP never reaches the issue

- **WHEN** any submission is filed
- **THEN** the issue contains no IP address, and the IP is not stored or logged, appearing only in the rate-limit key and the transient Siteverify request

#### Scenario: A KV failure fails open

- **WHEN** the `FEEDBACK_RATE_LIMIT` binding is absent or a KV read or write errors
- **THEN** the submission proceeds rather than being blocked, because Turnstile is the primary gate

### Requirement: The filed issue carries only allow-listed content

The system SHALL build the GitHub issue body from the visitor's `summary` and `details`
plus the route, the app version, and a UTC timestamp only. The body SHALL NOT include a
name, email address, IP address, user agent, Turnstile token, or secret. The visitor's text
SHALL be enclosed in a backtick fence longer than any run of backticks it contains so it
cannot inject markdown outside the fence.

#### Scenario: The body carries only allow-listed fields

- **WHEN** a valid submission is filed
- **THEN** the body contains the summary, details, route, app version, and UTC timestamp and nothing that identifies the visitor

#### Scenario: Extra request data cannot leak

- **WHEN** the submitted form data includes fields beyond `type`, `summary`, and `details`
- **THEN** those fields do not appear in the filed issue

#### Scenario: User text cannot break out of its fence

- **WHEN** the summary or details contain backticks or markdown
- **THEN** the text is fenced with a delimiter longer than any backtick run it contains

### Requirement: Exactly one labeled issue is filed per valid submission

Each valid submission SHALL cause exactly one GitHub issue to be created in
`idusortus/recovery-basic-texts` using a server-side token, labeled `from-app` plus `bug`
for a bug report or `suggestion` for a suggestion. The issue title SHALL be prefixed
`[Bug]` or `[Suggestion]` and clipped to GitHub's 256-character title limit.

#### Scenario: A valid bug report files one labeled issue

- **WHEN** a valid `bug` submission passes validation and Turnstile verification
- **THEN** exactly one issue is filed with labels `from-app` and `bug`

#### Scenario: A valid suggestion files one labeled issue

- **WHEN** a valid `suggestion` submission passes validation and Turnstile verification
- **THEN** exactly one issue is filed with labels `from-app` and `suggestion`

### Requirement: Failures are friendly and preserve the visitor's input

When a submission cannot be filed — through validation, Turnstile, the rate limit, a GitHub
failure, or a configuration error such as a missing label or token — the system SHALL
return a friendly, prewritten message that never includes raw upstream provider text, SHALL
echo the visitor's `type`, `summary`, and `details` so the form can prefill them, and SHALL
reset the Turnstile widget so the next attempt gets a fresh single-use token. For a
field-specific validation failure, the system SHALL identify the failing field so the form
can associate the error with that input.

#### Scenario: A failed submit preserves the typed text

- **WHEN** a submission fails
- **THEN** the response echoes the visitor's type, summary, and details and the form shows them again

#### Scenario: A failed submit resets the widget

- **WHEN** a submission fails
- **THEN** the form discards the spent Turnstile token and reloads the widget for the next attempt

#### Scenario: A validation failure names the field

- **WHEN** a field-specific validation failure on `summary` or `details` occurs
- **THEN** the response identifies that field so the form marks it invalid and associates the error with it

#### Scenario: Raw upstream text is never surfaced

- **WHEN** GitHub or Turnstile returns an error
- **THEN** the visitor sees only the prewritten friendly message, not the provider's response

### Requirement: Feedback is reachable from the app

The system SHALL provide entry points to `/feedback`: a link in the site footer and a card
on the About page.

#### Scenario: The footer links to the form

- **WHEN** a visitor views any page that renders the site footer
- **THEN** a link to `/feedback` is present

#### Scenario: The About page links to the form

- **WHEN** a visitor views the About page
- **THEN** a card links to `/feedback`
