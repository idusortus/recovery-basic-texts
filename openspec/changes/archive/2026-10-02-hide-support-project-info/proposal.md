# Proposal: Hide the "Support this project" information

## Why

The reserved financial-support section on the About page (a Ko-fi link plus a
GitHub Sponsors placeholder) is not ready to show. The maintainer wants it hidden
for now while the project reconsiders how, or whether, it will ever ask visitors
for money. Displaying an unready ask undercuts the calm, non-commercial tone the
PRD calls for, and a placeholder "coming soon" button reads as unfinished.

## What Changes

- Stop rendering the "Support this project" section on `/about`. Its heading,
  explanatory paragraph, Ko-fi button, and GitHub Sponsors placeholder no longer
  appear to visitors.
- Keep the section's markup and copy in the About page source, present but not
  rendered, so a later decision to offer support is a small, low-risk edit rather
  than a recovery from git history.
- Leave every other About section unchanged: "What this is", "What this isn't",
  legal disclaimer, copyright, privacy, open source, how to contribute, and the
  feedback section all render exactly as they do today.
- Add nothing new: no route, dependency, configuration, feature flag, or external
  service.

Non-goals:

- Not removing or changing the anonymous feedback flow; that stays.
- Not introducing any replacement support mechanism, donation link, or sponsor
  program.
- Not deleting the support markup or copy permanently.

## Capabilities

### New Capabilities

- `about-page`: the content guarantees of the `/about` route. This change records
  that the reserved financial-support section is not displayed while support is
  off, and that the rest of the About content is unaffected.

### Modified Capabilities

- None. No existing capability in `openspec/specs/` covers the About page or its
  support section, so there is no requirement to modify.

## Impact

- **Code:** `src/routes/about/+page.svelte` only.
- **No runtime, API, dependency, schema, or data changes.** The corpus and the
  service worker are untouched.
- **Lifecycle:** if support is revisited, the new `about-page` spec is modified
  to re-add the section, and the guarded markup is re-enabled.
