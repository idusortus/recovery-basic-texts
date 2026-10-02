# Tasks

## 1. Withhold the support section

- [x] 1.1 In `src/routes/about/+page.svelte`, add `const SHOW_SUPPORT = false;`
      to the component script with a short comment naming this change and the
      `about-page` spec, then wrap the `<!-- Support (reserved) -->` comment and
      the `<section aria-labelledby="support"> ... </section>` block together in
      `{#if SHOW_SUPPORT} ... {/if}` (include the comment inside the guard so the
      restore is a single token flip). Leave the section's ids, classes, and copy
      byte-identical. Verify `pnpm run check` and `pnpm run lint` both pass.
- [x] 1.2 Add a focused Playwright assertion (for example
      `e2e/about-support-hidden.spec.ts`) that `/about` shows no "Support this
      project" heading and exposes no link to `ko-fi.com` or GitHub Sponsors,
      while the "What this is" and "Send feedback" sections still render. Verify
      with `pnpm run test:e2e`.

## 2. Verification

- [x] 2.1 Start `pnpm run dev`, open `/about`, and confirm by eye that the
      support heading, support copy, Ko-fi button, and GitHub Sponsors
      placeholder are gone and every other section renders as before. (manual,
      browser)
      — WAIVED by the user 2026-10-02: confirmed acceptable; the programmatic
      absence assertions in `e2e/about-support-hidden.spec.ts` cover the same
      visual outcome.
- [x] 2.2 Confirm the section is still present and guarded in the source (not
      deleted) and that no other route or component references `#support`, the
      Ko-fi link, or the Sponsors placeholder. Verify with
      `grep -rn "support\|ko-fi\|sponsor" src e2e` and review each hit.
- [x] 2.3 Run the repo checks `pnpm run check`, `pnpm run lint`, and
      `pnpm run test:e2e`; all pass.
