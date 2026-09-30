# search-analytics Specification

## Purpose

Defines anonymous, offline-queued search logging — used to guide future corpus
and feature work — and requires that the collected logs are never exposed on a
public, unauthenticated surface. The first requirement below records logging
behavior the app already implements; this change does not alter logging, and the
second requirement is the new exposure contract it introduces.

## Requirements

### Requirement: Anonymous submitted searches are logged without PII

The system SHALL record each submitted search as an anonymous record of the
query, the result count, the active source filter, and a timestamp, and SHALL
store no IP address, user agent, cookie, or identifier. Records SHALL be queued
locally while offline and flushed when connectivity returns, and a logging
failure SHALL NOT affect the search experience.

#### Scenario: A submitted search is recorded

- **WHEN** a user submits a non-empty search
- **THEN** a record of the query, result count, source filter, and timestamp is queued

#### Scenario: Offline submissions are queued

- **WHEN** a search is submitted while the client is offline
- **THEN** the record is retained locally and flushed when connectivity returns

#### Scenario: Logging failure does not affect search

- **WHEN** queuing or flushing the log fails
- **THEN** the search results are unaffected

#### Scenario: No PII is stored

- **WHEN** a log record is written
- **THEN** it contains no IP address, user agent, cookie, or identifier

### Requirement: The collected search logs are not exposed on any public surface

No public, unauthenticated route or endpoint SHALL return the collected search
logs or their aggregates. The `/stats` page and the `/api/stats` endpoint SHALL
NOT serve logged query data; any maintainer access to the logs SHALL be
out-of-band (not served by the app) and, where server-mediated, protected by a
secret that is not discoverable from the client.

#### Scenario: The stats page no longer serves data

- **WHEN** a visitor requests `/stats`
- **THEN** no logged query data is rendered

#### Scenario: The stats endpoint is not public

- **WHEN** `/api/stats` is requested
- **THEN** no search-log payload is returned

#### Scenario: Logging still operates

- **WHEN** a search is submitted after the public surface is removed
- **THEN** the anonymous log record is still collected

#### Scenario: No route exposes the logs

- **WHEN** the app's public routes are inspected
- **THEN** none returns the collected search logs or their aggregates
