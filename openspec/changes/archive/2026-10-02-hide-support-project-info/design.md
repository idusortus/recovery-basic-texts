# Design

## Context

See `proposal.md` - Why. The support section is rendered inline in
`src/routes/about/+page.svelte` as `<section aria-labelledby="support">`, holding
a "Support this project" heading, a paragraph, a Ko-fi `ExternalLink`, and a
disabled GitHub Sponsors placeholder `<span>`. The PRD describes this as a small,
easily-removable component. Repo constraints: MVP scope, no auth, no new
dependencies, calm design. There is no existing capability spec for `/about`, and
nothing in `src/` or `e2e/` links to `#support`.

## Goals / Non-Goals

**Goals:**

- `/about` renders with no support heading, copy, or donation/sponsorship links.
- The section's markup and copy stay in the source, restorable with a one-line change.
- No other About content, behavior, or styling changes.

**Non-Goals:**

- Permanently deleting the markup or copy.
- Adding a feature-flag system, config surface, or new dependency.
- Changing the feedback flow or any other route.

## Decisions

### D1: Withhold by guard, retain the markup

Wrap the existing section in an `{#if SHOW_SUPPORT}` guard driven by a single
`const SHOW_SUPPORT = false;` in the component's script, with a short comment
naming this change and the `about-page` spec.

Alternatives considered:

- **Delete outright:** loses a cheap restore and invites a lossy re-add from git.
- **Comment the block out:** nested HTML/Svelte comments are error-prone and
  Prettier-hostile.
- **Runtime/build feature flag:** over-engineered; the MVP has no config surface
  and adding one contradicts "no new machinery".

The guard keeps the section's ids, classes, and copy byte-identical, so restoring
is a single token flip.

### D2: Keep the section in place

Leave the section where it is in the source (after the feedback section) and keep
its border/background styling intact, so re-enabling reproduces the prior layout.

### D3: Scope boundary with the em-dash change

The retained support copy contains an em dash (the sentence joining "it" and "it
helps cover hosting costs"). Because the section is not rendered, the sibling
`remove-em-dashes-from-ui-copy` change does not touch it and this change does not
edit that copy. If support returns, its copy is cleaned as part of re-enabling it.

## Risks / Trade-offs

- [Retained but hidden code drifts or is forgotten] → the guard comment and the
  `about-page` spec record the withheld state; revisiting re-opens the spec.
- [A contributor re-enables without a spec change] → the named constant and
  comment make the intent explicit; the guard is the only switch.
- [Lint/type warning for an unused constant] → it is referenced by the template
  guard, so it is used; confirm with `npm run check` and `npm run lint`.

## Migration Plan

Single deploy; no data or schema migration. Rollback (or revisit) is setting the
constant to `true`, plus an `about-page` spec modification when support returns.

## Open Questions

None.
