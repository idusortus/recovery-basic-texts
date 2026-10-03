# reference-reader Specification

## Purpose

A calm, mobile-first reader at a single top-level route that presents each
short meeting-referenced AA text — the Twelve Steps, the long-form Twelve
Traditions, the Twelve Concepts, and the Promises and step prayers — as its own
self-contained, formatted view selected from the route, working fully offline
from the app's existing corpus data and rendering no protected or disabled text.

## Requirements

### Requirement: A top-level reference reader route presents one view per text

The application SHALL expose a single top-level route at `/reference` that
renders a reader presenting the reference texts as a set of selectable,
self-contained views. The reader SHALL be reachable from a new top-level entry
in the main navigation, added to the same navigation source that drives both the
desktop and mobile menus so the two menus cannot diverge. Selecting a view SHALL
update the route so the selected view is directly addressable (for example via a
path segment or query parameter), and a direct visit to that address SHALL render
the same view. The reader SHALL render exactly these views:

- **Twelve Steps** — the `twelve-steps` source;
- **Twelve Traditions** — the long-form `twelve-traditions` source;
- **Twelve Concepts** — a gated placeholder view for the disabled
  `twelve-concepts` source (see the gating requirement below);
- **Promises & Prayers** — the `promises-and-prayers` source, rendered as one
  view containing all of that source's passages.

The reader SHALL NOT create one view per passage; each text is one view.

#### Scenario: The reader is reachable from the main navigation

- **WHEN** the main navigation is rendered on desktop or mobile
- **THEN** it contains an entry linking to `/reference`, and activating it opens the reader

#### Scenario: Each reference text is its own view

- **WHEN** the reader is open
- **THEN** it offers a selectable view for the Twelve Steps, the Twelve Traditions, the Twelve Concepts, and the Promises and step prayers

#### Scenario: A selected view is directly addressable

- **WHEN** a view is selected and the resulting address is opened directly (or reloaded)
- **THEN** the reader opens on that same view

#### Scenario: Promises and prayers are one view, not separate views

- **WHEN** the Promises & Prayers view is open
- **THEN** it shows the Ninth Step Promises and the Third and Seventh Step prayers together as the passages of the `promises-and-prayers` source

### Requirement: The reader loads content offline from existing corpus data

The reader SHALL render its text from data the application already ships for
offline use (the source registry and the corpus/index data already used by
search and the passage view). It SHALL NOT fetch content from aa.org or any
other network host to display a reference text, so the reader works offline in
the installed PWA exactly as search does. The reader SHALL render only the text
of an enabled, documented-basis source; the reader SHALL never render text that
is not part of the shipped corpus.

#### Scenario: Misleading link is not needed

- **WHEN** the reader renders a reference text
- **THEN** the text comes from the shipped corpus/registry data and no request is made to aa.org or another host for that text

#### Scenario: The reader works offline

- **WHEN** the reader is opened with no network connectivity after the app has been loaded once
- **THEN** the reference text views still render their text

#### Scenario: Only shipped corpus text is rendered

- **WHEN** a reference text view renders
- **THEN** every paragraph it shows comes from the registered source's corpus passages

### Requirement: The Twelve Concepts view is a gated placeholder

Because the `twelve-concepts` source ships disabled with no documented
reproduction basis, the reader SHALL render for it a gated placeholder view and
SHALL NOT render any of its text. The placeholder SHALL show the text's title,
a copyright notice, and a link to the official aa.org source, and SHALL state
plainly that the text is not reproduced. The reader's behavior for this view
SHALL follow the source's registry state: while the source is disabled, the
placeholder is shown and no text is rendered; if the source is later enabled
with a documented basis, the view MAY render its text on the same terms as the
other views.

#### Scenario: Concepts renders a placeholder, not text

- **WHEN** the Twelve Concepts view is selected while `twelve-concepts` is disabled
- **THEN** the view shows the title, a copyright notice, and a link to aa.org, and renders none of the source's text

#### Scenario: No text is obtainable from the placeholder

- **WHEN** the Twelve Concepts placeholder is shown
- **THEN** no passage text from `twelve-concepts` is displayed, announced, copied, or included in the page

#### Scenario: The placeholder follows the registry state

- **WHEN** the `twelve-concepts` source is enabled with a documented basis
- **THEN** the reader is permitted to render its text like the other reference views, and the gated placeholder is no longer required

### Requirement: The reader is mobile-first, accessible, and calm

The reader SHALL be readable on a small screen as its primary target: text
SHALL wrap without horizontal scrolling, tap targets SHALL be adequately sized,
and the typography SHALL follow the app's existing calm, readable presentation
with sufficient contrast in both light and dark themes. The reader SHALL be
keyboard operable: the view selector and every interactive control SHALL be
reachable and operable by keyboard with visible focus, the active view SHALL be
exposed to assistive technology (not by color alone), and the text SHALL use a
correct heading structure so headings can be navigated. The reader SHALL NOT
introduce authentication, accounts, bookmarks, notes, or any user-data surface,
and SHALL NOT change existing search or passage-view behavior.

#### Scenario: The reader is usable on a phone

- **WHEN** the reader is viewed at a mobile viewport width
- **THEN** the text and controls fit without horizontal scrolling and remain legible and operable

#### Scenario: The view selector is keyboard and AT friendly

- **WHEN** a keyboard or assistive-technology user reaches the view selector
- **THEN** each view is focusable and operable, the active view is announced as active (not by color alone), and focus is visible

#### Scenario: Text has a navigable heading structure

- **WHEN** the reader renders a text view
- **THEN** it exposes headings that denote the text and its sections so the content can be navigated by heading

#### Scenario: Contrast holds in both themes

- **WHEN** the reader is viewed in the light theme and in the dark theme
- **THEN** text and interactive controls meet the existing contrast expectations

#### Scenario: No new user-data surface

- **WHEN** the reader is used
- **THEN** no account, sign-in, bookmark, note, or server-side personal state is created
