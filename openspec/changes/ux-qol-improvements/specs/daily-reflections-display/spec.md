# Spec Delta

## MODIFIED Requirements

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
