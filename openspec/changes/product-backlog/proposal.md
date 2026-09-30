# Proposal: Product backlog

## Why

Known gaps in the basictexts.org MVP are currently scattered across `docs/plans/todo.md`
and ad-hoc notes, with no shared priority, no acceptance condition attached, and no
record of what has already been decided. Consolidating them into one tracked backlog
makes the remaining work visible and reviewable in the same place as the specs, so each
item can be promoted into its own spec'd change when it is picked up.

## What Changes

- **Establish a single tracked backlog** as this change (`product-backlog`), superseding the
  loose `docs/plans/todo.md` list as the authoritative enumeration of known MVP gaps. The
  overlap between the backlog and `todo.md` is intentional for now: `todo.md` remains the
  prior source and is left untouched, and this proposal — not `todo.md` — records the
  supersede intent.
- **The change stays open as the living backlog.** It is not archived when its planning
  artifacts are done. It remains the open, long-lived backlog until it is empty or its
  remaining entries are handed off. Picking an item up creates its own spec'd change and
  annotates the backlog entry with a `→ promoted to <change-name>` pointer so the entry
  records where it went.
- **Enumerate the known gaps by theme** (search quality; content & UX), each with a
  one-line, observable "done when" acceptance note so an item can be judged finished.
- **Record the edition decision as resolved.** The one decision this backlog tracked —
  whether to keep only the 2nd-edition Big Book and drop the redundant edition — was
  confirmed by the maintainer (per `AGENTS.md`, "ask rather than guessing") and is recorded
  in `decisions.md` (2026-09-29, "Big Book: 2nd edition only (drop the 1st edition)"); its
  backlog entry (2.5) is closed by that decision, with no further work pending.
- **Adapt the feedback-to-GitHub flow** carried over from the archived carpool change:
  that flow was signed-in-only, but this repo forbids authentication, so the backlog item
  specifies an **anonymous** feedback path protected by server-verified Cloudflare
  Turnstile plus rate limiting, with a no-PII, server-built issue body.
- **No behavioral change to the app ships with this change.** Every unimplemented item
  stays unchecked; each is promoted to its own spec'd change when picked up.

Non-goals:

- Not implementing any backlog item here — this change plans, it does not build.
- Not adding auth, accounts, bookmarks, notes, non-AA literature, or full-text rendering
  of protected/concordance-only sources (MVP guardrails in `AGENTS.md` and the PRD).
- Not editing or deleting `docs/plans/todo.md`; the backlog supersedes it by intent while
  the file stays in place as its prior source.
- Not introducing a database, admin UI, or issue-tracking tooling beyond what an item
  itself would need.

## Capabilities

### New Capabilities

- `product-backlog`: The project maintains an enumerated, theme-grouped backlog of known
  gaps; each backlog entry carries an observable "done when" condition; items are promoted
  to their own spec'd change when picked up, and the entry records that change.

### Modified Capabilities

- None. This change does not alter any existing capability's requirements; there are no
  specs under `openspec/specs/` yet and no app behavior changes.

## Impact

- **Docs/planning only:** new artifacts under `openspec/changes/product-backlog/`
  (`proposal.md`, `specs/product-backlog/spec.md`, `design.md`, `tasks.md`).
- **Lifecycle:** the change is intentionally left open as the living backlog rather than
  archived on completion; promoted entries point at the changes that consumed them.
- **No source code:** no changes under `src/`, `corpus/`, `static/`, or `wrangler.jsonc`.
- **No runtime, API, dependency, schema, or data changes.** The future work items named in
  `tasks.md` will each carry their own impact when promoted to a change.
