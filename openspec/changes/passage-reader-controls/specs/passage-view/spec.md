# Spec Delta

## ADDED Requirements

### Requirement: Reader preferences adjust the full-text passage body

On the passage page for a source whose `displayMode` is `full-text`, a labeled
"reading settings" control SHALL let the reader adjust the passage **body** font
size across a finite set of steps and toggle line spacing between normal and
relaxed. The preferences SHALL affect only the passage body text, not the
surrounding chrome (citation header, actions, match/navigation controls). The
chosen preferences SHALL persist in local browser storage under a namespaced key;
they SHALL require no account and SHALL NOT be transmitted or synced. When the
reader has never changed the setting, the page SHALL NOT apply an explicit
font-size override, so the browser/user's own text-size setting still applies.
The control SHALL be keyboard-operable; its controls SHALL be a labeled group
with descriptive accessible names; the current state SHALL be conveyed by more
than color alone; and a change SHALL be able to return to the default step. The
preferences SHALL NOT alter the existing query highlighting, the entry
scroll/focus, or match navigation on that page. A source whose `displayMode` is
not `full-text` SHALL NOT offer the control.

#### Scenario: A full-text passage page offers reading settings

- **WHEN** the passage page is opened for a `full-text` source
- **THEN** a labeled reading-settings control is present and adjusts the passage body font size and line spacing

#### Scenario: A non-full-text passage page offers no reading settings

- **WHEN** the passage page is opened for a source whose `displayMode` is not `full-text`
- **THEN** no reading-settings control is present, and no passage body text is rendered

#### Scenario: The default does not override the browser's text size

- **WHEN** the passage page is opened and the reader has never changed the setting
- **THEN** the passage body carries no explicit font-size override, so the browser/user's own text-size setting applies

#### Scenario: A changed preference applies to the body and persists

- **WHEN** the reader increases the font size and toggles line spacing to relaxed
- **THEN** the passage body renders at the chosen size and spacing, and the choice is still applied after a reload on the same browser

#### Scenario: The preference is local only

- **WHEN** the reader changes the preference
- **THEN** no network request, account, sync, or usage-log record carries it, and no account is required

#### Scenario: The control is keyboard-operable, labeled, and not color-only

- **WHEN** a keyboard or assistive-technology user reaches the reading-settings group
- **THEN** the controls are keyboard-operable, the group is labeled with descriptive accessible names, and the current state is conveyed by more than color alone

#### Scenario: Chrome is unaffected by the preference

- **WHEN** the reader changes the font size or line spacing
- **THEN** the citation header, actions, and match/navigation controls render unchanged

#### Scenario: Existing highlight and focus behavior is preserved

- **WHEN** a passage URL carrying a query is shown and the reader changes the reading preference
- **THEN** the existing query highlighting, entry scroll/focus, and match navigation continue to work unchanged

### Requirement: A Listen control reads the rendered full-text passage aloud

On the passage page for a source whose `displayMode` is `full-text`, the page
SHALL offer a "Listen" control that reads the rendered passage text aloud using
the browser's built-in speech-synthesis capability, with no external service,
no network request, and no data leaving the device. The control SHALL play and
pause playback; the playing/paused state SHALL be announced accessibly; and
playback SHALL stop when the page is left (unmount or navigation). Listen SHALL
read only the passage text the page renders for a `full-text` source — never
protected text and never hidden or non-rendered content. When the browser's
speech-synthesis capability is unavailable, the page SHALL NOT present a working
Listen control (the affordance is absent or clearly disabled) and SHALL NOT
error. Listen SHALL NOT alter the existing query highlighting, entry
scroll/focus, or match navigation. A source whose `displayMode` is not
`full-text` SHALL NOT offer Listen.

#### Scenario: A full-text passage page offers Listen

- **WHEN** the passage page is opened for a `full-text` source
- **THEN** a Listen control is present and reads the rendered passage text aloud

#### Scenario: A non-full-text passage page offers no Listen

- **WHEN** the passage page is opened for a source whose `displayMode` is not `full-text`
- **THEN** no Listen control is present, and no passage text is read

#### Scenario: Play and pause with an announced state

- **WHEN** the reader activates Listen and then pauses it
- **THEN** playback starts, then pauses, and the playing/paused state is announced to assistive technology

#### Scenario: Playback stops when leaving the page

- **WHEN** the reader navigates away from (or unmounts) the passage page while it is speaking
- **THEN** playback stops

#### Scenario: Only rendered full-text passage content is read

- **WHEN** Listen is activated on a `full-text` passage page
- **THEN** only the passage text rendered for that full-text source is spoken — no protected text and no hidden or non-rendered content

#### Scenario: Unavailable speech synthesis degrades gracefully

- **WHEN** the browser does not provide speech synthesis
- **THEN** no working Listen control is shown (absent or clearly disabled), nothing is spoken, and no error is surfaced to the reader

#### Scenario: No external service or network is used

- **WHEN** Listen is used
- **THEN** no network request is made and no data leaves the device

#### Scenario: Match navigation is not disrupted

- **WHEN** a passage URL carrying a query with multiple matches is shown and Listen is used
- **THEN** the existing match navigation and its focus/scroll behavior remain available and unchanged
