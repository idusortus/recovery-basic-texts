# Spec Delta

## Purpose

A cross-cutting writing-style guarantee for the copy the app authors and shows to
visitors: that copy uses plain punctuation and contains no em dashes.

## ADDED Requirements

### Requirement: App-authored copy contains no em dash

App-authored copy that is shown to visitors SHALL NOT contain the em dash
character (U+2014). This includes rendered template text, document metadata (page
title, meta description, and social tags), accessible names and titles, toast and
error/empty/offline messages, feedback copy, and the app-authored labels and
separators assembled around source text in the citation header and the
copy-to-clipboard excerpt. Where an em dash would have joined clauses, the copy
SHALL use plain punctuation (a comma, colon, or parentheses) or a reworded clause
so the sentence still reads naturally.

Third-party source text, non-visible string identifiers and data values that the
UI compares against corpus data, and source comments and JSDoc are out of scope.
They SHALL NOT be altered by this requirement, and third-party source text may
still contain em dashes of its own.

#### Scenario: Rendered page copy has no em dash

- **WHEN** any route renders its headings, paragraphs, labels, or list items
- **THEN** the visible app-authored text contains no em dash character

#### Scenario: Metadata and accessible names have no em dash

- **WHEN** a page emits its `<title>`, meta description, or social tags, or a control exposes an accessible name or title
- **THEN** those strings contain no em dash character

#### Scenario: Dynamic and formatted strings have no em dash

- **WHEN** the app shows a toast, error, empty, or offline message, or produces a citation header or a copy-to-clipboard excerpt
- **THEN** the app-authored parts of the produced string contain no em dash character

#### Scenario: Corpus text and identifiers are untouched

- **WHEN** third-party source text is displayed or copied, or the UI compares a value against a string identifier used to match corpus data
- **THEN** those characters are unchanged, even where the source text itself contains an em dash
