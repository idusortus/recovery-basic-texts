# Spec Delta

## Purpose

The home/empty-state dashboard is the screen a visitor sees before searching: the
Daily Reflections teaser, a library-status list of sources and their display modes,
and a small set of tool/PWA shortcuts. This capability fixes which cards the dashboard
presents and the reading order in which they stack across viewport widths, so the
reflection snippet is not buried beneath the library list on a phone.

## ADDED Requirements

### Requirement: The home dashboard presents reflection and library sections

On the home/empty state — before any query is active — the dashboard SHALL present,
among its cards, a Today's Reflection section and a Library Status section. This
capability governs only the presence of those sections and the order in which the
dashboard cards stack: what the Today's Reflection section renders is the contract of the
`daily-reflections-display` capability, and the Library Status section's source and
display-mode list is the source registry's contract.

#### Scenario: The reflection section is present on the home state

- **WHEN** the home/empty-state dashboard renders
- **THEN** a Today's Reflection section is present among the dashboard cards

#### Scenario: The library section is present on the home state

- **WHEN** the home/empty-state dashboard renders
- **THEN** a Library Status section is present among the dashboard cards

### Requirement: On mobile the library section stacks below the reflection section

At the mobile (single-column) layout — the narrow viewports at which the dashboard lays
its cards out one per row — the dashboard SHALL order its cards so the Today's Reflection
section appears above the Library Status section, which in turn appears above the
Tools & PWA section. A visitor viewing the dashboard on a phone SHALL therefore reach the
reflection snippet before the library section, with the library section directly below it.

#### Scenario: The reflection precedes the library on mobile

- **WHEN** the dashboard renders in its single-column (mobile) layout
- **THEN** the Today's Reflection section is ordered above the Library Status section

#### Scenario: The library precedes the tools section on mobile

- **WHEN** the dashboard renders in its single-column (mobile) layout
- **THEN** the Library Status section is ordered above the Tools & PWA section

#### Scenario: The library sits directly below the reflection

- **WHEN** the dashboard renders in its single-column (mobile) layout
- **THEN** no dashboard card is ordered between the Today's Reflection section and the Library Status section

### Requirement: The order change is scoped to the mobile layout

The multi-column (tablet/desktop) layout SHALL retain its existing card order, with the
Library Status card appearing first in reading order (leftmost) and the Today's Reflection
card following it. The reordering SHALL NOT change the multi-column reading order, and
across every width it SHALL NOT alter any card's heading, links, copy, or behavior.

#### Scenario: The multi-column order is unchanged

- **WHEN** the dashboard renders in its multi-column (tablet/desktop) layout
- **THEN** the Library Status card appears leftmost and the Today's Reflection card follows it, as before

#### Scenario: Content and behavior are unaffected

- **WHEN** the dashboard renders at any viewport width
- **THEN** every card's heading, links, copy, and behavior are unchanged, and only the mobile stacking order differs
