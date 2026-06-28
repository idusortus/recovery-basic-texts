# AGENTS

This repository is for the basictexts.org MVP.

## Working conventions
- Read [docs/plans/basic-texts-PRD.md](docs/plans/basic-texts-PRD.md) before making implementation decisions.
- Keep the MVP scope narrow and avoid adding v2 features.
- Prefer registry-driven data design over hard-coded source logic.
- Keep search and rendering behavior aligned with the source display mode.
- Preserve accessibility, readability, and calm visual design.

## Implementation priorities
1. Build the source registry and ingestion path first.
2. Implement the search experience around the corpus data.
3. Add PWA and offline support once the core search flow is working.
4. Keep the search worker lightweight and focused on search execution.

## Guardrails
- Do not add authentication, bookmarks, notes, or user accounts.
- Do not introduce non-AA literature or other fellowship content in v1.
- Do not render full text for protected or concordance-only sources.
- If a requirement is unclear, ask rather than guessing.
