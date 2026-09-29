# Skills

VS Code Copilot loads skills from **two** directories:

| Location | Purpose |
|----------|---------|
| `.agents/skills/<name>/SKILL.md` | Default for `npx skills add -a github-copilot` (CLI-installed) |
| `.github/skills/<name>/SKILL.md` | Hand-crafted or project-specific skills |

Both are first-class. The `skills` CLI writes to `.agents/skills/` for `github-copilot`.
Either directory works — Copilot discovers both.

The `description` field IS the discovery surface — without trigger phrases in it, no agent
will ever load the skill.

## Discover & install community skills

    npx skills find <term>
    npx skills add <repo> -a github-copilot

Sources: https://skills.sh, https://github.com/anthropics/skills, https://github.com/github/awesome-copilot
