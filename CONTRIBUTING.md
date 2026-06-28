# Contributing to basictexts

Thank you for your interest in contributing. This project exists to serve people in recovery — your time and care matter.

---

## Ways to contribute

### Add or improve a corpus source
Adding a new searchable source is the highest-impact contribution. The entire process is data-driven — no application code changes are required.

**Before you start:** Read [corpus/CORPUS-GUIDE.md](corpus/CORPUS-GUIDE.md) fully. It covers copyright evaluation, acquisition, cleaning, structuring, and validation. The copyright step is not optional — we do not ingest text without a documented legal basis.

**Steps:**
1. Evaluate copyright and document the basis in `CORPUS-GUIDE.md` under the source's section
2. Acquire and clean the raw text; save to `corpus/raw/<source-id>.<ext>`
3. Write a structuring script in `corpus/scripts/structure-<source-id>.js`
4. Output the structured JSON to `corpus/sources/<source-id>.json`
5. Add a registry entry to `corpus/sources.json`
6. Run `node corpus/scripts/validate.js` — must pass with zero errors
7. Run `pnpm run build:index` — verify passages appear correctly in the app
8. Open a PR titled `corpus: add [Source Name]`

### Fix a corpus error
If you find a passage with incorrect text, wrong page reference, or a broken ID, open a PR against the relevant `corpus/sources/<source-id>.json` file. Include the source you verified against (page number, edition).

### Report a bug or missing feature
Open a GitHub Issue. For bugs, include: what you searched for, what you expected, what you got, and your browser/device. For features, check the [PRD](docs/plans/basic-texts-PRD.md) §9 (Non-Goals) first — some things are explicitly out of scope for v1.

### Accessibility improvements
Contrast, keyboard navigation, screen-reader announcements for search results, and reduced-motion compliance are all important. The Lighthouse a11y target is ≥ 95.

---

## Development setup

```bash
pnpm install
pnpm run build:index   # generates static/index/* from corpus files
pnpm run dev           # http://localhost:5173
```

```bash
pnpm run check         # TypeScript + Svelte type check
pnpm run lint          # ESLint
node corpus/scripts/validate.js  # corpus schema validation
pnpm run build         # full production build (runs build:index + vite build)
```

See [QUICKSTART.md](QUICKSTART.md) for the full local setup guide.

---

## Code conventions

- **TypeScript throughout.** All new code should be typed. The types in `src/lib/types.ts` are load-bearing — don't widen them without discussion.
- **`displayMode` is a copyright gate.** Every code path that renders or copies passage text must branch on `displayMode`. `concordance-only` and `snippet` sources must never be rendered or copied in full.
- **No v2 features in v1.** The scope boundaries in [PRD §9](docs/plans/basic-texts-PRD.md) are intentional. If you want to propose a v2 feature, open an Issue to discuss before building it.
- **Prefer simple over clever.** This is a small, focused tool. Abstractions should earn their presence.
- **Accessible by default.** Minimum WCAG AA contrast, visible keyboard focus, and meaningful aria labels.

---

## Corpus ID stability

Once a source is published and its passage IDs are live, those IDs are **frozen forever**. Deep links must never break. Do not renumber or restructure passage IDs in a published source — only append new passages with new IDs at the end.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
