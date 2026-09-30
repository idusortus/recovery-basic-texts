# app-shell Specification

## Purpose

Defines the app-wide shell guarantees shared by every route: a styled error page
for unhandled route errors and not-found paths, an accessible mobile navigation
overlay, a single, non-duplicated toast live region, and single registration of
the PWA install prompt.

## Requirements

### Requirement: Unhandled errors render a styled page consistent with the app shell

When a path does not match or a route errors, the app SHALL render a styled page
consistent with the app shell rather than the framework's default unstyled page.
The styled page SHALL show a heading, a short plain-language explanation, and a
navigation action back to the concordance, and SHALL distinguish a not-found
(404) from a server or other error. It SHALL NOT display raw error text, stack
traces, or upstream provider output.

#### Scenario: An unknown path shows a styled not-found page

- **WHEN** a visitor opens a path that does not exist
- **THEN** a styled not-found page with a link back to the concordance is shown, not the framework's default unstyled page

#### Scenario: An error response is styled

- **WHEN** a route errors or returns an error status
- **THEN** a styled error page is shown with a generic plain-language message

#### Scenario: No raw diagnostics leak

- **WHEN** the styled error page renders
- **THEN** it shows no stack trace and no raw error message

### Requirement: The mobile navigation overlay traps focus and closes on Escape

The mobile navigation overlay SHALL expose a dialog role and an accessible name,
SHALL close when Escape is pressed, and, while open, SHALL keep keyboard focus
within the overlay and return focus to the control that opened it when the
overlay closes.

#### Scenario: The overlay is a labeled dialog

- **WHEN** the mobile overlay is open
- **THEN** it exposes a dialog role and an accessible name

#### Scenario: Escape closes the overlay

- **WHEN** the mobile menu is open and the user presses Escape
- **THEN** the menu closes and focus returns to the menu trigger

#### Scenario: Focus stays within the overlay

- **WHEN** the menu is open and the user moves focus past the last focusable item
- **THEN** focus moves to the first focusable item rather than leaving the overlay

#### Scenario: Focus returns on close

- **WHEN** the menu is closed through any close action
- **THEN** focus returns to the control that opened it

### Requirement: Toasts are announced by a single live region

The toast surface SHALL expose exactly one live region, so each toast message is
announced once. Individual toast elements SHALL NOT also act as live regions
while nested inside that live region.

#### Scenario: One live region exists

- **WHEN** the toast container is rendered
- **THEN** it exposes a single live region

#### Scenario: A toast is announced once

- **WHEN** a toast appears
- **THEN** its message is announced once rather than twice

### Requirement: The PWA install prompt is initialized exactly once per page load

The system SHALL register its `beforeinstallprompt` / `appinstalled` listeners at
most once per page load. When more than one surface would initialize the install
prompt in the same load (for example the root layout and the home page), the
initialization SHALL be idempotent so the install-available state is not driven
by duplicate listeners and the install action behaves as if it were registered
once.

#### Scenario: Co-mounted surfaces register one set of listeners

- **WHEN** the root layout and a page that both initialize the install prompt are mounted in the same page load
- **THEN** the install-available state is updated by a single set of listeners, not by duplicate registrations

#### Scenario: The install action still works

- **WHEN** a browser offers an install prompt and the user activates the install action
- **THEN** the deferred prompt is shown exactly as with a single initialization
