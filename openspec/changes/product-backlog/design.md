# Design

## Context

See `proposal.md` — Why. This is a planning/docs change: it establishes a backlog and does
not change app behavior. Current state that shapes the approach:

- `docs/plans/todo.md` is a flat, unprioritized bullet list with no acceptance conditions.
- `openspec/specs/` is empty; no capability describes the backlog practice yet.
- `AGENTS.md` requires MVP scope discipline, forbids auth/bookmarks/notes/accounts, forbids
  non-AA literature, forbids rendering full text for protected/concordance-only sources,
  and instructs the agent to ask rather than guess on unclear requirements.
- `src/lib/search/index.ts` already normalizes apostrophes in the concordance path
  (`_normalizedTerm`, `normalizeForSearch`) while the MiniSearch fallback and KWIC paths
  normalize differently — relevant to the apostrophe and "tornado" backlog items.
- The corpus's only "tornado" occurrence is passage
  `big-book-2ed-chapter-6-into-action-p0142` (`pageRef: "p.103"`, chapter 6 "Into Action").
  Its text begins with a leaked page header `82 ALCOHOLICS ANONYMOUS`, and the search
  never returns it — so a page-ref/paragraph-merge defect and the tokenizer/concordance
  gap are related. Relevant to backlog items 1.2 and 1.3.
- `corpus/sources.json` carries only `big-book-2ed`; `CORPUS-GUIDE.md` records that the
  1st edition was removed pending re-ingestion. The PRD, ingestion scripts, `README.md`,
  `QUICKSTART.md`, and `docs/plans/basic-texts-implementation-plan.md` previously still
  referenced `big-book-1ed`; those stale 1st-edition references were reconciled to the
  2nd edition in a later pass, leaving the duplicate-edition question as the remaining
  open decision item.
- The archived carpool change at
  `/home/sam/dev/carpool/openspec/changes/archive/2026-09-27-app-feedback-to-github/`
  provides a reusable feedback→GitHub-issue flow, but it is signed-in-only.

## Goals / Non-Goals

**Goals:**

- One authoritative, theme-grouped backlog with a done-when note per item.
- A promotion rule: an item becomes its own spec'd change before it is built, and the
  backlog entry records which change consumed it.
- A persistence model: say where the authoritative list lives once the planning artifacts
  are done.
- Record the anonymous-feedback adaptation as a decision, not an implementation.
- Record the duplicate-edition question as an open decision per `AGENTS.md`.

**Non-Goals:**

- Implementing any backlog item, and writing behavior specs for items not yet picked up.
- Defining a global numeric-priority scheme or owner/status metadata; theme grouping and
  ordered entries are sufficient at this size.
- Adding tooling (no issue tracker, database, or admin surface).

## Decisions

### Backlog lives as an OpenSpec change, not a new file format

The backlog is this change (`openspec/changes/product-backlog/`), with the enumerated items
in `tasks.md`. Alternative considered: keep it in `docs/plans/todo.md`. Rejected because
that file is unprioritized, has no acceptance conditions, and is not reviewable alongside
specs; `AGENTS.md` also implies a spec/change-driven workflow. `todo.md` is left untouched
and referenced only as the prior source.

### The change stays open as the living backlog (persistence model)

This change is **not archived** when its planning artifacts are done. It remains the open,
long-lived backlog: `openspec/changes/product-backlog/` is the authoritative list while it
is open, and it is archived only once it is empty or its remaining entries are handed off.
Alternative considered: archive it immediately and mirror the list into a tracked doc such
as `docs/plans/backlog.md`. Rejected because it duplicates the list in two places and the
OpenSpec change already has a lifecycle, an id, and validation; the mirror adds drift risk
for no gain.

### Promotion is recorded on the entry and in the promoted change

When an item is picked up, a new change is created for it, and the backlog entry is
annotated in place with `→ promoted to <change-name>`. The promoted change's proposal
references the backlog entry. Consequences: the backlog entry stops being actionable once
annotated, and the item's behavior requirements live only in the promoted change's spec
(not here). Alternative considered: delete picked-up entries. Rejected because it loses the
record of what was done and makes the backlog's history opaque.

### Items stay unchecked and carry a one-line done-when note

Each item is an unchecked task with an observable acceptance note. Alternative considered:
a table with priority/owner/status columns. Rejected as over-structured for a solo MVP
backlog; the done-when line is the part that prevents "done" from being a judgment call.

### Item behavior belongs in the item's own future change

The backlog spec covers the backlog practice only. A picked-up item is promoted to its own
change whose spec carries that item's behavioral requirements. This keeps the backlog
honest and avoids inventing requirements the app does not need yet.

### One entry per gap, including decision-dependent gaps

The duplicate-edition gap is a single backlog entry whose heading is the open question
("which edition(s) do we keep?") and whose text carries the decision to confirm plus the
stale-reference cleanup. This satisfies the spec's "exactly one entry" rule and keeps the
decision and its follow-through together. Alternative considered: a separate
"decisions to confirm" list. Rejected because it split one gap across two entries.

### Anonymous feedback, not signed-in feedback

The carpool flow gates feedback behind sign-in. This repo's `AGENTS.md` forbids
authentication/accounts, so the adapted item specifies an anonymous path protected by
server-verified Cloudflare Turnstile plus rate limiting, with a no-PII, server-built issue
body. The adaptation is captured in the item's acceptance note so the future change starts
from the right premise.

### Daily Reflections stays link-forward

The concordance view may link out to the day's reflection at aa.org, but any local display
remains the concordance-only KWIC teaser for the indexed entry; full protected text is
never rendered or copied. Fetching or scraping AAWS content would additionally require
written AAWS permission per `CORPUS-GUIDE.md`, so the backlog entry does not assume it. The
existing `/reflection` client-side redirect remains the baseline.

### Duplicate-edition removal is an open decision, not an instruction

`corpus/sources.json` already contains only `big-book-2ed`. The PRD, corpus scripts,
`README.md`, `QUICKSTART.md`, and the implementation plan previously still referenced a 1st
edition; those references have since been reconciled to the 2nd edition. Per `AGENTS.md`
("ask rather than guessing") the item was recorded as a decision to confirm rather than a
directive to delete.

## Risks / Trade-offs

- [Long-lived open change accumulates drift and is never archived] → The promotion
  annotation and the "archive once empty or handed off" rule keep it bounded; the change is
  the single source while open.
- [Backlog drifts from reality as items are picked up] → The promotion rule requires the
  entry to record the dedicated change at pickup time.
- [Backlog becomes a dumping ground and loses priority signal] → Items are theme-grouped
  and ordered; unresolved decisions are called out explicitly rather than buried.
- [Readers mistake the backlog for a promise of scope] → The Non-goals in `proposal.md` and
  the promotion requirement state that nothing here ships with this change.
- [The anonymous-feedback item could reintroduce auth pressure] → Its acceptance note names
  Turnstile + rate limiting and no sign-in, aligning with the `AGENTS.md` guardrail.
- [A DR item is read as a license to mirror AAWS content] → Its acceptance note requires
  link-forward behavior, KWIC-only local display, and written AAWS permission before any
  fetching.

## Open Questions

- Which backlog item ships first is deliberately not resolved here; it is a scheduling
  choice that does not change the specs, approach, or task breakdown.
