# Proposal: Remove em dashes from user-visible copy

## Why

Em dashes (U+2014) are scattered through the app's written copy: page titles and
meta descriptions, section prose, toasts, empty and error states, citation
headers, and the copy-to-clipboard excerpt. They read as machine-authored and are
inconsistent with the plain, calm voice this project wants. The maintainer wants
them gone from everything a visitor reads or shares.

## What Changes

- Replace every em dash in user-visible copy with contextually appropriate
  punctuation (a comma, colon, parentheses, or a reworded clause) so each
  sentence still reads naturally. No mechanical character swap.
- Cover every visitor-facing surface that authors its own copy:
  - rendered template text (headings, paragraphs, list items, labels);
  - document metadata (`<title>`, meta description, and og/twitter tags);
  - `aria-label`/`title` attributes and other accessible names;
  - toast, error, empty, and offline-state messages;
  - the feedback page copy;
  - citation headers and the formatted copy-to-clipboard excerpt.
- Exempt third-party text: the committed corpus is source literature and is never
  edited.
- Exempt non-copy identifiers: string literals the UI compares against corpus data
  or uses as keys (for example the chapter reference used to match chapter 5) are
  data, not written copy, and must not be changed.
- Exempt source comments and JSDoc: they are not user-visible copy.

Non-goals:

- Not touching corpus content, test fixtures, or OpenSpec prose.
- Not changing any behavior, layout, or interaction; this is a copy edit only.
- Not a blanket find-and-replace across `src/`; only visitor-facing strings change.

## Capabilities

### New Capabilities

- `ui-copy`: a cross-cutting writing-style guarantee for visitor-facing copy.
  It requires that app-authored copy shown to visitors contains no em dash
  (U+2014), and defines corpus text and non-visible identifiers as out of scope.

### Modified Capabilities

- None. No existing requirement asserts the exact copy being changed (checked:
  none of the nine specs pins a literal title, toast, or citation string that
  contains an em dash), so no requirement's behavior changes. This adds a new
  cross-cutting style capability instead.

## Impact

- **Code:** user-visible strings in `src/` across components, routes, and a small
  number of `src/lib` modules. The notable non-template ones are the known-exception
  notice body and the KWIC/citation format helpers.
- **No behavior, API, dependency, schema, or data changes.** Corpus files are
  untouched.
- **Docs:** OpenSpec spec prose and code comments are out of scope and are left
  as-is.
