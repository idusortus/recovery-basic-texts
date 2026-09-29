# Architectural Decisions

> One entry per locked-in choice. Reverse chronological. Concise — not an ADR template.

## Format

    ## YYYY-MM-DD — <decision title>
    **Context:** Why we needed to decide.
    **Choice:** What we chose.
    **Trade-offs:** What we gave up.
    **Revisit:** Trigger that would re-open this decision (or "never").

---

## 2026-09-29 — Bootstrap the agentic coding stack (OpenCode target)
**Context:** The repo had Copilot artifacts and AGENTS.md but no OpenCode agent team, CodeGraph index, or OpenSpec workflow. Needed a consistent agent-ready setup.
**Choice:** Target OpenCode (running under OpenCode), cli-five agent team pinned to the authenticated `opencode-go` provider, CodeGraph MCP + `.codegraph/` index, and OpenSpec with `--tools opencode` surfaces. Per-session memory (`STATE.md`, `agent-diary.md`, `histories/`) is gitignored; config/surfaces are tracked.
**Trade-offs:** Chose OpenCode over the repo's pre-existing Copilot artifacts (those were preserved, not removed, so both coexist). Agents use `opencode-go` models rather than a provider-agnostic default.
**Revisit:** If the team standardizes on Copilot instead of OpenCode, or a different provider is mandated.
