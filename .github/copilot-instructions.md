# Basictexts repository instructions

This repository implements the MVP for basictexts.org, as described in [docs/plans/basic-texts-PRD.md](docs/plans/basic-texts-PRD.md).

## Primary source of truth
- Treat the PRD as the authoritative product definition for this project.
- If a proposed change conflicts with the PRD, pause and clarify before implementing it.

## Product goals
- Build a free, open-source, mobile-first PWA for searching AA literature.
- Support keyword and phrase search across multiple sources with surrounding context.
- Keep the experience readable, calm, and accessible.
- Prefer link-forward behavior that drives users to official or free sources.

## Implementation guidance
- Use SvelteKit and TypeScript for the application layer.
- Use Cloudflare Pages, D1, and Workers for hosting and search infrastructure.
- Use the source registry and corpus data files as the foundation of the search experience.
- Treat corpus files under the repository as the source of truth; database content is derived from them.
- Respect the source display mode at every rendering point:
  - `full-text` can render full passages.
  - `concordance-only` must never render full text; it should show a safe excerpt or KWIC-style preview and link outward.
  - `snippet` should use a short excerpt and external link.
- Keep the search worker thin and focused on query execution, result shaping, and logging.
- Prefer simple, maintainable code over speculative abstractions.
- Preserve shareability through deep-linkable search and passage URLs.
- Support offline-friendly behavior and progressive enhancement for PWA use.

## Scope boundaries for MVP
Do not add features that are explicitly out of scope for v1, including:
- user accounts or authentication
- bookmarks, highlights, or personal notes
- non-AA fellowship literature
- push notifications
- community features
- native mobile apps

## Quality expectations
- Write clear TypeScript types for registry data, corpus records, and API responses.
- Favor accessible UI patterns, strong contrast, and keyboard support.
- Keep the text and search experience as the main focus; avoid decorative UI that distracts from the content.
- When adding or changing data sources, prefer registry-based configuration over hard-coded logic.
