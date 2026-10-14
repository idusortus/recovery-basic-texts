# Proposal: Reorder home dashboard cards on mobile

## Why

On the home page the dashboard cards render in a single column on mobile in the
order Library Status → Today's Reflection → Tools & PWA. The Daily Reflections
teaser is the page's most time-sensitive, editorial content, but on a phone it is
pushed below a full library-status list and its disclaimer, so a visitor must
scroll past the library before reaching the reflection. On the wider layouts the
cards sit side by side and the library-first reading order still works, so only
the mobile (single-column) stacking needs to change.

## What Changes

- **Mobile card order.** At the single-column (mobile) breakpoint the home
  dashboard SHALL present the cards in the order Today's Reflection → Library
  Status → Tools & PWA, so the reflection snippet sits directly above the library
  section.
- **Order-only change.** The change is presentational and mobile-scoped: no card's
  content, heading, links, or behavior changes, and the desktop/tablet grid order
  is unchanged. It introduces no new data, route, or dependency.

Non-goals:

- Not changing the desktop (`md`/`lg`) grid order or the number/identity of cards.
- Not changing any card's content, copy, accessibility labeling, or links.
- Not adding, removing, or restyling the reflection or library sections.
- Not touching the search surface — this is the home/empty state dashboard only.

## Capabilities

### New Capabilities

- `home-dashboard`: The home/empty-state dashboard — its cards, their content
  contracts, and the responsive reading order in which they stack.

### Modified Capabilities

- None. No existing capability's requirements cover the home dashboard card order,
  so no existing spec is modified.

## Impact

- `src/routes/+page.svelte` — the home dashboard grid (the library-status,
  Today's Reflection, and Tools & PWA cards) gains mobile-order styling; the card
  markup itself is unchanged.
- No API, dependency, or data changes.
