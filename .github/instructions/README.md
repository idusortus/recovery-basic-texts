# .github/instructions/

Drop `*.instructions.md` files here for language- or path-specific guidance.

Each file should:

- start with YAML frontmatter
- include an `applyTo` glob (e.g. `**/*.ts`) OR a `description` for on-demand loading
- be terse — instructions burn context every time they load

Stack-specific instructions are generated during `npx cli-five init` (the instructions step).
Re-run `npx cli-five init` to regenerate, or create them manually.

Reference: https://code.visualstudio.com/docs/copilot/copilot-customization
