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

<!-- CODEGRAPH_START -->
## CodeGraph

This project is configured to use [CodeGraph](https://codegraph.ru) for graph-backed codebase context.
When you need to understand relationships, call paths, or impacts, use:

```
codegraph explore "<your question>"
```

The CodeGraph MCP server is registered in the project config. Run `codegraph init` in this directory
if the project has not been indexed yet.
<!-- CODEGRAPH_END -->

<!-- JEV_TIER_ROUTING_START -->
## Tier routing

Before planning, call the `tier_classifier` tool once with the task description.

- If it returns `confidence` >= 0.6, use its `tier` (trivial | minor | major) as your planning depth.
- If `confidence` < 0.6, or the tool is unavailable, use your own judgment and default to `major`.
- The classifier is optional: it uses real Jev when a credential is available (Jev is free on OpenCode) and a local heuristic otherwise. Never block or fail a turn because the tool is unavailable.
<!-- JEV_TIER_ROUTING_END -->
