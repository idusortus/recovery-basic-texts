# daily-reflections-display Specification

## Purpose

Defines how the Daily Reflections (DR) surface — the home "Today's Reflection" card and the
`/reflection` route — presents a protected, concordance-only source link-forward: local display
is limited to a KWIC teaser for the date's indexed entry, the official aa.org page is linked on
every surface that renders the reflection locally, `/reflection` stays a client-side redirect
while online and no AAWS permission exists, and an offline fallback renders the indexed
concordance entry for the date instead of reproducing its text.

## Requirements

### Requirement: Link-forward reflection surface

Every Daily Reflections surface that renders the reflection locally SHALL drive the user
toward the official page rather than toward locally reproduced text. The offline
`/reflection` fallback SHALL present the official page at
`https://www.aa.org/daily-reflections` as a visible, prominent external link. The site
navigation's "Daily Reflection" entry and the home "Today's Reflection" card's reflection
actions SHALL target the in-app `/reflection` route instead of opening the external aa.org
URL directly, so the offline fallback route is reachable and is not bypassed by every entry
point; the `/reflection` route then presents the official page (online, by client-side
redirect) or the indexed fallback (offline). While online and while no written AAWS
permission to fetch or reproduce Daily Reflections content exists, the `/reflection` route
SHALL resolve to that official page as a client-side redirect and SHALL NOT render the day's
reflection text in place of the redirect; when offline, only the AAWS-unavailable fallback
requirement below governs `/reflection`.

#### Scenario: Home card links to the official page

- **WHEN** the home "Today's Reflection" card renders for a date with an indexed entry
- **THEN** its reflection action navigates to the in-app `/reflection` route, whose destination is the official page at `https://www.aa.org/daily-reflections`

#### Scenario: `/reflection` redirects online

- **WHEN** `/reflection` loads while the client is online and no AAWS permission exists
- **THEN** the client navigates to `https://www.aa.org/daily-reflections` (via a client-side
  redirect, with a non-JavaScript meta-refresh fallback) and does not render the day's
  reflection text

#### Scenario: The offline external link informs instead of failing

- **WHEN** the user activates the official link on the reflection surface while offline
- **THEN** navigation is intercepted and the user is told the link needs an internet connection

#### Scenario: The offline fallback presents the official link

- **WHEN** the offline `/reflection` fallback renders the indexed entry for the date
- **THEN** it presents a visible, prominent link to `https://www.aa.org/daily-reflections`

#### Scenario: The navigation entry routes through the in-app surface

- **WHEN** a visitor activates the "Daily Reflection" navigation entry
- **THEN** the browser navigates to the in-app `/reflection` route rather than opening the external aa.org URL directly

#### Scenario: The home card does not bypass the offline fallback

- **WHEN** the home reflection card's action is inspected
- **THEN** it targets the in-app `/reflection` route, so activating it while offline reaches the indexed fallback instead of a dead external navigation

#### Scenario: Offline navigation still reaches the fallback

- **WHEN** the client is offline and the visitor activates the "Daily Reflection" navigation entry
- **THEN** the in-app `/reflection` surface renders the indexed concordance entry for the date rather than attempting the unreachable redirect

### Requirement: Local display is limited to the concordance-only KWIC teaser

For the date it is showing, the reflection surface SHALL render at most a KWIC teaser derived
from that date's indexed Daily Reflections entry, clipped by the source's display mode
(`concordance-only`) and its `contextWords`, through the same KWIC machinery used for search
results. The surface SHALL NOT render the entry's full `text`, and no affordance on the surface
SHALL copy the entry's full `text`.

#### Scenario: The rendered teaser is a bounded KWIC window

- **WHEN** the reflection surface renders the date's indexed entry, whose `text` is longer than
  the KWIC window
- **THEN** the rendered prose is a window of at most the source's `contextWords` words on each
  side of the anchored term and is a strict subset of the entry's `text`

#### Scenario: The full reflection text is never rendered

- **WHEN** any Daily Reflections surface renders
- **THEN** the entry's complete `text` is never present in the rendered output

#### Scenario: No copy path exposes the full reflection text

- **WHEN** the Daily Reflections surface is inspected for copy affordances
- **THEN** no affordance places the entry's full `text` on the clipboard (any copy path, if
  present, copies only the clipped KWIC teaser plus citation)

#### Scenario: A short entry is still not reproduced in full

- **WHEN** the date's indexed entry is short enough that a full-text window would fit
- **THEN** the displayed window still excludes part of the entry so the full `text` is never
  reproduced

### Requirement: AAWS-unavailable fallback to the indexed concordance entry

When AAWS is unavailable — the client is offline, so the redirect cannot reach the official
page — `/reflection` SHALL render the indexed concordance entry for the date it is showing: the
date label, the entry title, the concordance-only KWIC teaser, and the external link, with the
offline link guard. If the local index has no entry for that date, the surface SHALL state that
no reflection is available for the date and SHALL NOT substitute another date's content.

#### Scenario: Offline fallback shows the indexed entry for the date

- **WHEN** `/reflection` loads while the client is offline
- **THEN** it renders the indexed Daily Reflections entry for the date it is showing (date label,
  title, KWIC teaser, external link) instead of attempting the redirect

#### Scenario: The offline fallback needs no network

- **WHEN** `/reflection` is loaded offline and the local index has an entry for the date
- **THEN** the date label, title, and KWIC teaser are rendered from the local index with no
  network access

#### Scenario: No entry for the date is not substituted

- **WHEN** the relevant date has no entry in the local index
- **THEN** the surface reports that no reflection is available for that date and does not show
  another date's reflection

#### Scenario: Connectivity returning restores the link-forward redirect

- **WHEN** connectivity returns while the offline fallback is shown
- **THEN** the `/reflection` surface resumes its online behavior and the client-side redirect to
  `https://www.aa.org/daily-reflections` is in effect again

### Requirement: No fetching or scraping of AAWS content

The system SHALL NOT fetch, scrape, proxy, or embed AAWS Daily Reflections content. All Daily
Reflections prose shown locally SHALL come from the prebuilt local index; the only reference to
aa.org SHALL be a user-initiated navigation link. While online, the `/reflection` client-side
redirect SHALL remain in place unless and until written AAWS permission is recorded per
`corpus/CORPUS-GUIDE.md`.

#### Scenario: Rendering the DR surface fetches nothing from aa.org

- **WHEN** any Daily Reflections surface is rendered
- **THEN** no request is made to aa.org to obtain reflection content; the surface renders from
  the local index and points to aa.org only as a navigation link

#### Scenario: Offline reminder of the permission constraint

- **WHEN** the client is offline and has never obtained a written AAWS permission
- **THEN** no attempt is made to fetch or scrape reflection content and the local indexed entry
  is used instead
