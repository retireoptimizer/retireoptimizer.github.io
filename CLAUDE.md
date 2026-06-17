# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Output only modified or requested code block. Do not provide line by line explanations, setup guides, introductory, concluding remarks, or markdown commentary unless explicitly asked. Adopt an ultra-concise, high-density communication style. 


## Commands

```bash
pnpm dev          # Dev server (localhost:5173) with HMR
pnpm build        # tsc -b && vite build
pnpm lint         # ESLint (flat config)
pnpm test         # Vitest unit tests (jsdom)
pnpm test:e2e     # Playwright E2E (requires dev server running)
pnpm preview      # Preview production build
```

Run a single unit test file: `pnpm vitest run src/engine/__golden__/plans.ts`

E2E tests require a running dev server. Playwright is configured for a single Chrome worker with a 60s timeout against `localhost:5173`.

## Architecture Overview

FireOpt is a retirement planning app. All financial computation runs in a **Web Worker** (via Comlink) to keep the UI responsive during optimization. The main thread just renders charts and forms.

### Data Flow

1. User inputs → **Zod schemas** (`src/schemas/plan.ts`) → validated `Plan` object
2. `Plan` stored in **Zustand** (`usePlanStore`) with `localStorage` persistence
3. On any plan change, `useProjection()` hook runs `projectPlan()` synchronously (fast, ~1–5ms)
4. Optimization (`optimizer.ts`) runs in **Web Worker** via `workerClient.ts` (singleton, HMR-aware)
5. What-if overrides from `useWhatIfStore` are merged ephemerally — not persisted

### Engine (`src/engine/`)

The core financial computation layer. Key modules:

- **`projection.ts`** — Year-by-year cash-flow simulation. Central function used everywhere.
- **`optimizer.ts`** — Multi-phase coordinate descent (coarse → fine grid → Nelder-Mead) over withdrawal splits and Roth conversion amounts. Evaluates 1,000–5,000 projections per run.
- **`withdrawal.ts`** + **`blendPolicy.ts`** — Withdrawal ordering: 5 presets (`taxfirst`, `rothfirst`, `tradfirst`, `proportional`, `bracketfill`) plus custom age-window blend policies.
- **`conversion.ts`** — Roth conversion modes: off, manual, auto-window, bracket-fill.
- **`tax.ts`** / **`stateTax.ts`** — Federal bracket calculation, LTCG stacking, IL-specific exemptions.
- **`socialSecurity.ts`** / **`ssActuarial.ts`** — PIA, claiming age, provisional income (50%/85% SS taxability rules).
- **`irmaa.ts`** — Medicare IRMAA surcharges with MAGI lookback.
- **`aca.ts`** — ACA marketplace premium + APTC subsidy based on FPL.
- **`rmd.ts`** — Required Minimum Distributions (always honored before blend policy).
- **`worker.ts`** / **`workerClient.ts`** — Comlink-wrapped Web Worker API. The client is a singleton that auto-disposes on Vite HMR.

Test subdirectories under `src/engine/`:
- `__golden__/` — 7 archetypal plan regression fixtures with numeric thresholds
- `__fuzz__/` — Property-based tests (fast-check)
- `__invariants__/` — Conservation assertions (money in = money out)

### State Management (`src/store/`)

- **`usePlanStore`** — Persisted to `localStorage` (`fireopt-plan-v1`). Has 5 migration versions for schema evolution. All plan mutations go through here.
- **`useWhatIfStore`** — Ephemeral overrides (retirement age, return rate, inflation, spending multiplier). Drives the What-If Bar sliders. Never persisted.

### Schema (`src/schemas/plan.ts`)

All plan data is Zod-validated. Key types: `Person`, `Portfolio`, `Assumptions`, `IncomeStream`, `ExpenseStream`, `BlendPolicy`, `ConversionParams`, `Goal`. When adding new plan fields, extend the schema here and bump the store migration version.

### UI Structure

Pages in `src/pages/` map to routes in `src/App.tsx`:
- `/personal` (default) → PersonalDetails
- `/cash-flow` → CashFlow
- `/portfolio` → Portfolio
- `/strategy` → Strategy (renders in UI as **"Set Goals"**)
- `/projections`, `/taxes`, `/montecarlo`, `/dashboard`

Charts are in `src/components/charts/` using Chart.js + react-chartjs-2. Global Chart.js plugins are registered in `components/charts/setup.ts`.

The **Strategy page** (`/strategy`) has two independent bracket-fill controls:
1. Withdrawal-ordering preset toggle (which account to draw from)
2. Roth conversion mode toggle (how to size conversions)

These are separate features; don't conflate them.

## Key Conventions

- **Number formatting**: Always use `lib/format.ts` utilities (`fmtM`, `fmtK`, `fmtFull`, etc.). Never use raw `.toFixed()` — it produces NaN/Infinity rendering bugs.
- **Financial precision**: Use `Decimal.js` for money calculations to avoid floating-point errors.
- **Adding plan fields**: Schema first (`plan.ts`) → engine logic → store mutation → UI → migration version bump.
- **Web Worker calls**: Import `getEngineWorker()` from `workerClient.ts`. Never instantiate the worker directly.
- **TypeScript**: Strict mode with `noUnusedLocals` and `noUnusedParameters` enforced.
