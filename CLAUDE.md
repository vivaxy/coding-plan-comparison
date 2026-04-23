# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

Two independent TypeScript packages in a single repo:

- **`cli/`** — npm package `coding-plan-comparison`. Node CLI that reads local files from installed AI coding tools (Claude Code, Codex, Cursor, Windsurf, Copilot, Gemini) and outputs a `UsageProfile` JSON. Entry: `cli/src/index.ts` → `cli/dist/index.js`.
- **`web/`** — Vite + vanilla TS + ECharts static site. Three hash-routed views (`#/compare`, `#/import`, `#/recommend`) in `web/src/views/`. Deployed to GitHub Pages via `.github/workflows/deploy.yml`.
- **`web/scripts/fetch-plans/`** — build-time helper. Scrapes vendor pricing pages and overwrites `web/src/data/plans.json`. Run manually via `npm run fetch-plans --prefix web -- --write`. See `web/scripts/fetch-plans/README.md`.

The two halves exchange data via JSON pasted into the Import view.

## Commands

```sh
# CLI (from cli/)
npm install
npm run build          # runs sync-schema.mjs, then tsc
npm run dev            # tsc --watch
node dist/index.js --help

# Web (from web/)
npm install
npm run dev            # vite dev server
npm run build          # tsc && vite build → web/dist/
npm run preview        # serve the built bundle

# Type-check only (either package)
./node_modules/.bin/tsc --noEmit
```

There are no tests or linter configs in the repo. Strictness is enforced by `tsconfig` (`strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`).

## Architecture

### Shared schema — source of truth is in `web/`

`web/src/lib/schema.ts` defines every shared type (`UsageProfile`, `ToolUsage`, `ToolMetrics`, `Plan`, etc.). `cli/src/schema.ts` is **auto-generated** from it by `cli/scripts/sync-schema.mjs`, which runs on the CLI's `prebuild` hook. The generator copies everything up to the `// ─── Plan catalog` marker — types below that marker are web-only (`Plan`, `PlanModel`, `PlanLimit`).

Implication: edit shared types in `web/src/lib/schema.ts` only. Running `npm run build` in `cli/` regenerates `cli/src/schema.ts`; do not hand-edit it.

### CLI adapter pattern

Each AI tool has an adapter in `cli/src/adapters/` implementing:

```ts
interface Adapter {
  readonly name: string    // matches Tool union in schema
  detect(): Promise<boolean>
  collect(range: DateRange): Promise<ToolUsage>
}
```

`cli/src/index.ts` runs all adapters, skips those whose `detect()` returns false, and aggregates results. Adapter verdicts (`rich`/`partial`/`minimal`/`manual`) reflect how much data is actually extractable from each tool's local storage (JSONL, sqlite, vscdb, or none).

### Web views

`web/src/main.ts` is a minimal hash router calling `renderCompare`, `renderImport`, or `renderRecommend`. Plan catalog lives in `web/src/data/plans.json`. Core logic:

- `web/src/lib/normalize.ts` — converts `ToolMetrics` and `PlanLimit`s to equivalent USD so usage and plan capacity are comparable.
- `web/src/lib/score.ts` — `scorePlan()` ranks plans price-first (lower monthly price wins) with small tie-breakers for capacity and model capability. `rankPlans()` also computes `coveragePct`/`overflowPct` for UI display.

### Deployment

`.github/workflows/deploy.yml` builds `web/` on push to `main` and publishes `web/dist/` to the `gh-pages` branch. Vite `base: '/coding-plan-comparison/'` matches the Pages subpath.

`.github/workflows/release-cli.yml` publishes `cli/` to npm on push to `main` (path filter: `cli/**`). Versioning is driven by Conventional Commits via `semantic-release`. Tag format: `cli-vX.Y.Z`. Uses npm Trusted Publishing (OIDC) — no `NPM_TOKEN` secret required.

## Conventions

- ESM throughout (`"type": "module"` in both packages). Intra-package imports use explicit `.js` extensions even from `.ts` files (required by NodeNext resolution in `cli/`).
- No runtime dependencies in `web/` other than `echarts`. Keep it that way — the site must run from `dist/` served statically.
- The CLI only reads local files; never introduce network calls.
