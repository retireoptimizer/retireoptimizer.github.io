# FireOpt

Web app replacing a retirement planning spreadsheet. Deterministic year-by-year projection engine + Monte Carlo + Roth conversion optimizer, with Supabase auth and Cloud Run / Vercel hosting.

**Full architecture plan** (schemas, engine signatures, component tree, 7-phase roadmap):
`/Users/shailendra.parikh/.claude/plans/users-shailendra-parikh-downloads-retir-nifty-backus.md`

## Repo layout

```
backend/   FastAPI + Python 3.12 (uv)
frontend/  Vite + React 19 + TypeScript (pnpm 11, Node 22)
supabase/  Migrations (forward-only, Supabase CLI)
.github/   ci.yml + deploy.yml
```

## Backend

```bash
cd backend
uv sync --all-extras          # install deps
uv run uvicorn fireopt.main:app --reload  # dev server on :8000
uv run pytest                 # tests (exit 5 = no tests collected, OK)
uv run ruff check .           # lint
uv run mypy src               # type check
```

Source layout: `src/fireopt/` (hatchling `src` layout).

Key modules (being built in Phase 1):
- `engine/constants.py` — 2025 MFJ tax brackets, ULT RMD table, std deductions
- `engine/tax.py` — federal ordinary, LTCG, NIIT, medicare surtax, state tax
- `engine/rmd.py` — uniform lifetime factor, required minimum distribution
- `engine/ss.py` — Social Security annual benefit, survivor, taxable portion
- `engine/streams.py` — income/expense stream amounts by year
- `engine/conversion.py` — planned Roth conversion (4 modes)
- `engine/withdrawal.py` — withdraw-to-cover logic across buckets
- `engine/inflation.py` — inflation adjustment helpers
- `engine/projection.py` — orchestrator: run_projection → list[YearRow]
- `schemas/` — all Pydantic v2 models (PlanInput, YearRow, ProjectionResult, etc.)
- `api/v1/` — FastAPI routers (projection, optimizer, monte-carlo)
- `auth/` — Supabase JWT verification
- `cache/` — cachetools LRU for projection results

Exception hierarchy in `exceptions.py`:
- `FireOptError` → `ValidationError (422)`, `PlanInfeasibleError (409)`, `OptimizerFailedError (500)`, `AuthError (401)`, `NotFoundError (404)`, `RateLimitError (429)`

Config via `config.py` (Pydantic Settings, reads `.env.local`).

## Frontend

```bash
cd frontend
pnpm install       # requires Node 22+
pnpm dev           # dev server on :5173 (proxies /api and /healthz → :8000)
pnpm tsc --noEmit  # type check
pnpm build         # production build
```

Path alias: `@/` → `./src/`

Key directories:
- `src/pages/` — route-level components
- `src/components/` — shared UI components
- `src/stores/` — Zustand stores
- `src/lib/api.ts` — axios client (`baseURL: VITE_API_BASE_URL ?? '/api/v1'`)

**UI design skill**: Use the `/frontend-design` skill when building or iterating on UI. It handles component design, layout, Tailwind styling, and shadcn/ui integration.

## Database

Migrations live in `supabase/migrations/` — forward-only, never edit applied files.

```bash
supabase db push --include-all   # push migrations to remote
supabase migration new <name>    # create new migration
```

## CI

GitHub Actions runs on every push/PR:
- **backend**: `uv sync` → ruff → mypy → pytest
- **frontend**: `pnpm install` → tsc → vite build

pytest exit code 5 (no tests collected) is treated as success: `|| [ $? -eq 5 ]`

## Deploy (main branch only)

- **Backend**: Docker → GCR → Cloud Run (min=1, max=5, 1vCPU/1GiB)
- **Frontend**: `vercel deploy --prod`
- **DB**: `supabase db push --include-all`

Required GitHub Secrets: `GCP_SA_KEY`, `VERCEL_TOKEN`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `CORS_ORIGINS`

## Dev environment files

- `backend/.env.local` (not committed) — copy from `backend/.env.example`
- `frontend/.env.local` (not committed) — copy from `frontend/.env.example`

## Conventions

- Imports: stdlib → third-party → local, separated by blank lines (ruff I001 enforced)
- Line length: 100 (ruff)
- No comments unless the WHY is non-obvious
- Tests go in `backend/tests/unit/` or `backend/tests/integration/`; parity fixtures in `backend/tests/fixtures/parity/`
- mypy strict=false; use `# type: ignore[arg-type]` only for known FastAPI signature mismatches
