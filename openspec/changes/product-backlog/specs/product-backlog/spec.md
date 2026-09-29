# Spec Delta

## Purpose

The project keeps one enumerated, theme-grouped backlog of known gaps so remaining MVP
work is visible, reviewable, and traceable to a clear acceptance condition before it is
built.

## ADDED Requirements

### Requirement: The project maintains a single enumerated backlog

The project SHALL maintain one tracked backlog that enumerates the known gaps in the MVP.
The backlog SHALL list every gap captured in `docs/plans/todo.md` at the time this change
was authored, and SHALL be the authoritative list once established. `docs/plans/todo.md`
is left in place as the prior source and is not edited; the backlog supersedes it by the
intent recorded in `proposal.md`. Entries SHALL remain open (unchecked) while they are
future work; an entry is not a record of completed work. A promoted entry SHALL also stay
unchecked and SHALL be marked with the change it was promoted into, rather than being
checked off.

#### Scenario: Every gap from the prior source appears once

- **WHEN** the backlog is reviewed
- **THEN** every gap that was listed in `docs/plans/todo.md` is represented by exactly one backlog entry

#### Scenario: Future work is not marked complete

- **WHEN** the backlog is reviewed before any item has been implemented
- **THEN** every entry is unchecked and no entry claims to be done

### Requirement: Each backlog entry states an observable done-when condition

Every backlog entry SHALL carry a one-line acceptance note describing the observable
condition under which the item is done. The condition SHALL be specific enough that a
reviewer can judge the item finished or not finished without further interpretation.

#### Scenario: An entry can be judged finished

- **WHEN** a reader inspects any backlog entry
- **THEN** the entry states, in one line, what observable condition marks it done

#### Scenario: A vague entry is rejected

- **WHEN** an entry has no acceptance note, or its note names no observable condition
- **THEN** the entry does not satisfy the backlog's done-when requirement

### Requirement: Backlog entries are grouped by theme

Backlog entries SHALL be grouped by theme (at least search quality and content & UX) so
related gaps are read together.

#### Scenario: Entries are grouped by theme

- **WHEN** the backlog is reviewed
- **THEN** each entry appears under a theme heading rather than in one ungrouped list

### Requirement: Picking up an item promotes it to its own spec'd change

When a backlog item is picked up, it SHALL be promoted to its own OpenSpec change carrying
the spec-level behavior for that item. The backlog entry SHALL then record the change it
was promoted into (for example, a `→ promoted to <change-name>` pointer). The item's
behavior requirements live in that change's spec, not in the backlog itself.

#### Scenario: A picked-up item becomes its own change

- **WHEN** a backlog item is selected for implementation
- **THEN** the item's behavior is specified in a dedicated change and the backlog entry records that change

#### Scenario: The backlog does not specify item behavior

- **WHEN** the backlog is read
- **THEN** it describes each gap and its done-when condition, not the behavioral requirements of the feature itself

### Requirement: Entries that depend on an unresolved decision record it

A backlog entry whose scope depends on an unresolved product decision SHALL name that
decision explicitly and SHALL NOT assume an answer. Such an entry SHALL remain open until
the decision is resolved.

#### Scenario: A decision-dependent item names its decision

- **WHEN** a backlog entry depends on an unconfirmed product decision
- **THEN** the entry states which decision must be confirmed and does not present a chosen outcome as settled
