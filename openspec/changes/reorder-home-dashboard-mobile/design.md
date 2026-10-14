# Design

## Context

See `proposal.md` — Why. The relevant current state: the home/empty-state dashboard in
`src/routes/+page.svelte` is a single CSS grid, `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`,
whose three direct children are, in source (DOM) order: the Library Status card, the
Today's Reflection card, and the Tools & PWA card. Below the `md` breakpoint the grid is a
single column, so DOM order is the visual order: Library → Reflection → Tools. This change
reorders the stacking at the mobile width only (see `specs/home-dashboard/spec.md`).

Relevant facts about the cards that constrain the approach:

- The Library Status card is a list of sources and display modes only — it contains **no
  focusable elements** (no links, buttons, or form controls).
- The Today's Reflection card and the Tools & PWA card each contain links (and the Tools
  card an install button).
- The dashboard renders only on the home/empty state (`{#if !debouncedQuery}`); a query
  replaces it entirely.

## Goals / Non-Goals

**Goals:**

- Make the mobile (single-column) stacking order Today's Reflection → Library Status →
  Tools & PWA, with the library directly below the reflection.
- Leave the multi-column (`md`/`lg`) order, and every card's content and behavior,
  unchanged.
- Keep the diff small and reversible, and introduce no new focusable order of the
  interactive cards.

**Non-Goals:**

- No change to the desktop/tablet layout or the number and identity of cards.
- No markup restructuring of any card, no new component, no new dependency.
- Not changing the reflection card's teaser rendering (`{@html}` of bounded KWIC) or the
  DR link-forward behavior — those are governed by `daily-reflections-display` and are
  untouched here.

## Decisions

### D1 — Reorder with CSS `order` on the grid items; leave DOM order intact

Reorder visually by applying the grid `order` property to the three cards through
responsive utility classes (a base order that produces the mobile sequence, reset at the
`md` breakpoint so the multi-column layout keeps its current order). The DOM is not
restructured.

Why this over moving the reflection card before the library card in the markup:

- **Smallest, most scoped diff.** Only class attributes change; the 72 lines of
  reflection-card markup (`src/routes/+page.svelte:856-927`, including the `{@html}` teaser
  and the offline branch) are not moved, so there is no risk of disturbing that card's
  rendering.
- **Desktop is provably unchanged.** With DOM order untouched and the utilities applied at
  the mobile width only, the multi-column result is identical to today by construction.
- **The interactive reading order is unaffected on mobile.** Because the Library Status
  card has no focusable elements, the DOM-first library card contributes nothing to the
  tab sequence; the focusable order on a phone is therefore still the reflection link and
  then the Tools links, which matches the new visual order.

Alternatives considered:

- **Reorder the DOM** (reflection card first) and restore library-first with `md:`/`lg:`
  order overrides. Rejected: a much larger markup move to fix a purely presentational
  stacking order, and it moves the visual-vs-DOM divergence to the desktop layout instead
  of removing it. Revisit only if a future requirement makes the library card interactive
  (see Risks).
- **Duplicate the reflection card** and hide one per breakpoint. Rejected: duplicated
  content and headings, bad for assistive tech and for maintenance.

### D2 — The mobile ordering is the base class; the `md` reset restores the current layout

Apply the reordering at the base (mobile-first) level and add the `md:` reset, consistent
with the file's existing mobile-first Tailwind usage. The breakpoint that matters is the
one where the grid stops being single-column (`md`, i.e. the `md:grid-cols-2` transition),
so the mobile ordering applies below it and is undone at and above it.

### D3 — All three cards' order is set explicitly

The three cards SHALL have their order defined as a set (or the reset applied to all
three), rather than changing only one. Relying on source order to break ties between
unset `order` values (all `0`) is valid CSS but fragile: leaving Tools unset while setting
only the other two can silently land Tools between them. Define the whole sequence so the
intended order is explicit and a future editor reads it unambiguously.

## Risks / Trade-offs

- **On mobile the visual order diverges from the DOM order.** The DOM (and therefore the
  virtual-cursor reading order for a screen reader) stays Library → Reflection → Tools
  while the visual order becomes Reflection → Library → Tools. Accepted, because: the
  library content is static, unordered metadata with no interactive elements; the DOM
  sequence remains a meaningful one; and the focus order is unchanged and already matches
  the new visual order. → Mitigation if this is ever judged insufficient: move the cards in
  the DOM (D1's rejected alternative).
- **Unset `order` values reorder unexpectedly.** Adding a future dashboard card without an
  explicit order could be pulled between the reordered cards on mobile. → Mitigation: set
  the order for the full set (D3) and leave a short comment at the grid explaining the
  mobile ordering.
- **Visual regression only.** This change alters no behavior, data, or route, so its
  failure mode is limited to the mobile card sequence. → Verified by the automated DOM-order
  check and the manual mobile/desktop visual check in `tasks.md`.

## Migration Plan

Single-file, class-only change in `src/routes/+page.svelte`; ships with the normal client
build. Rollback is removing the added order/reset classes, which restores today's layout
exactly. No data migration, no cache or index version implication (the search index is
untouched).
