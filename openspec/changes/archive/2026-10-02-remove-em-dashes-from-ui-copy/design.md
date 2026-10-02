# Design

## Context

See `proposal.md` - Why. An inventory of U+2014 in `src/` separates three kinds of
occurrence:

1. **App-authored, visitor-facing copy** (the target): 47 lines across 14 files
   (roughly 52 U+2014 characters, since a few lines hold two), spanning
   components, routes, and three `src/lib` modules.
2. **Source comments and JSDoc** (out of scope), which account for most of the
   ~156 raw hits.
3. **One data literal**, `'Chapter 5 — How It Works'` in
   `src/lib/search/index.ts`, compared against corpus `chapterRef` (out of scope;
   changing it would break the chapter-5 Quick Reference match).

Most targets are inline markup or string literals, but four are code, so they are
not caught by a markup-only pass:

- `buildCitation()` in `src/lib/search/kwic.ts` (line 530);
- the passage page's `formatCitationHeader()` (line 408) and its copy-citation
  assembly (line 420), plus its `<svelte:head>` title (line 459);
- the `body` notice in `src/lib/corpus/exceptions.ts` (line 34).

## Goals / Non-Goals

**Goals:**

- No em dash (U+2014) in app-authored copy a visitor reads, hears, or copies.
- Every replacement reads naturally in its sentence.
- Behavior, layout, and interaction are unchanged.
- Out-of-scope occurrences (corpus, comments, data literals) are left untouched.

**Non-Goals:**

- Editing third-party corpus text.
- Editing comments, JSDoc, or OpenSpec prose.
- Changing en dashes (the `83–84` page range stays) or hyphens.

## Decisions

### D1: Visibility rule for scope

A string is in scope if it can reach a visitor's eyes, ears (screen reader), or
clipboard: rendered template text, `<title>` / meta description / og / twitter
tags, aria-labels and titles, toast / error / empty / offline copy, feedback copy,
and the app-authored labels and separators inside citation and copied-excerpt
strings. Corpus text, comments/JSDoc, and data-matching literals are out of scope.

### D2: Contextual replacement, not a mechanical swap

Choose punctuation per sentence sense, using this mapping:

| Category | Example before | Target |
| --- | --- | --- |
| Document / social title separator | `basictexts.org — AA recovery ...` | `basictexts.org \| AA recovery ...` |
| Copied-excerpt attribution lead-in | `text\n\n— Source, Chapter` | `text\n\nFrom Source, Chapter` |
| Citation header (source + chapter) | `SOURCE — CHAPTER` | `SOURCE: CHAPTER` |
| Status / label plus qualifier | `Offline — search still works` | `Offline: search still works` |
| Prose clause join | `the app — specifically, to identify ...` | `the app, specifically to identify ...` (comma / semicolon / colon / parentheses per sense) |
| Result-row metadata separator | `— CHAPTER`, `Similar result — matched ...` | `· CHAPTER`, `Similar result · matched ...` (middle dot or comma, consistent within the chrome) |
| aria-label fragment separator | `Title — CHAPTER` | `Title, CHAPTER` |

Exact wording per sentence is chosen during implementation; the mapping fixes only
the character and the intent.

Alternatives rejected: a uniform comma substitution (reads awkwardly in several
sentences) and a hyphen substitution (leaves a visually similar dash, contrary to
the request).

### D3: One attribution convention across both copy paths

`buildCitation()` and the passage page assemble the same "text + attribution"
payload. Both use the same replacement (`From `) so copied text is consistent
wherever it is produced.

### D4: Regression guard follows the repo's node-test pattern

Add `scripts/test-ui-copy.mjs` (registered as `test:ui-copy`), matching the
existing `scripts/test-*.mjs` convention. It imports the pure helper
`buildCitation` from `src/lib/search/kwic.ts` directly (the
`scripts/test-url-state.mjs` import pattern) and asserts its app-authored
attribution uses no U+2014. It also scans `src/**/*.{svelte,ts,js}` (the `.js`
glob matters: the proposal claims coverage of "user-visible strings in `src/`")
for U+2014 after stripping every comment form: HTML comments (`<!-- -->`), line
comments (`//`, mid-line as well as line-start), block comments (`/* */`), and
JSDoc (`/** */`). Mid-line and HTML stripping are both required, because the tree
has trailing `//` comments (e.g. `kwic.ts:405`) and Svelte HTML comments (e.g.
`passage/[sourceId]/[passageId]/+page.svelte:492`) that themselves contain em
dashes; a line-start-only stripper would false-positive. The only allowed hit is
the known data literal `'Chapter 5 — How It Works'` in
`src/lib/search/index.ts`; any other hit fails. Corpus files are never scanned,
since they legitimately contain em dashes.

A pure Playwright-only guard was rejected as the primary check: it cannot easily
prove the copied-text path (which is what D3 changes) and is slower to run. The
source scan is acceptable here because the comment/JSDoc noise is mechanically
strippable and the single data-literal exception is explicit and stable.

Two permitted remainders, both explicit: the data literal above, and the
`{#if SHOW_SUPPORT}` block on `src/routes/about/+page.svelte`. The latter is
unrendered (the flag is `false`) and owned by the sibling
`hide-support-project-info` change, so its copy is not "copy shown to visitors"
and must not be edited here; the scan strips that block before checking.

## Risks / Trade-offs

- [An occurrence is missed] → the inventory above, plus a final
  `grep -rn $'\u2014' src` pass that classifies every remaining hit as comment,
  data literal, or intentional corpus text.
- [A replacement touches the data literal or corpus] → explicit exclusion list;
  corpus files are never opened for this change.
- [Title-format change affects SEO/social previews] → only the separator character
  changes; no behavioral impact, but previews should be eyeballed.
- [e2e flakiness on the reflection online redirect] → limit the route sweep to
  routes whose chrome renders deterministically; cover the rest via the clipboard
  and citation assertions.

## Migration Plan

No schema or data migration. Deploy with the copy change; rollback is `git revert`.
No on-disk state is involved.

## Open Questions

None.
