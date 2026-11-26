# Production Deployment Audit (`DEPLOY_AUDIT.md`)

- **Files scanned:** All source, API route, script, and config files across `src/`, `scripts/`, and root config (`160+` files audited via full read + `Select-String` scans).

## Hazards Found & Fixed

| # | Hazard | File(s) Fixed | Fix Applied |
| --- | --- | --- | --- |
| 1 | `file:` SQLite default crashes on read-only Vercel serverless storage | `src/lib/db/index.ts`, `src/app/api/audits/route.ts`, `src/app/api/audits/precheck/route.ts`, `src/app/api/health/route.ts` | Added `DatabaseNotConfiguredError` (`DATABASE_NOT_CONFIGURED`) returned cleanly as HTTP 503 with requestId; cold-start remote schema bootstrap on libSQL. |
| 2 | `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` marketplace aliases ignored & build env coupling | `src/lib/env.ts`, `drizzle.config.ts` | Added lazy memoized `getEnv()` (safe during `NEXT_PHASE === "phase-production-build"`), Turso alias fallback, `TRUST_PROXY` Vercel default (`true`), `VIDEO_STORAGE` Vercel guard, and `SMOKE_TEST_SECRET`. |
| 3 | Hardcoded `localhost:3000` / build-inlined `NEXT_PUBLIC_APP_URL` fallback | `src/lib/config/app-url.ts`, `src/lib/config/brand.ts`, `src/app/layout.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts` | Added server-safe `getAppUrl()` falling back through `VERCEL_PROJECT_PRODUCTION_URL` and `VERCEL_URL`. |
| 4 | Preview/forwarded host CSRF Origin mismatch | `src/lib/security/admin-auth.ts` | Updated `verifyAdminCsrf` to allow request's own host (`x-forwarded-host` when `TRUST_PROXY` else `host`), `getAppUrl()`, and Vercel deployment URLs while enforcing `X-Admin-Csrf: 1`. |
| 5 | Stage-6 Gemini & Assistant `504 DEADLINE_EXCEEDED` failed instead of falling back | `src/lib/ai/gemini-client.ts`, `src/lib/ai/assistant-client.ts`, `src/lib/ai/select-model.ts`, `src/lib/pipeline/run-audit.ts` | Set timeouts to `38_000` ms (report) and `32_000` ms (assistant), added `500`/`502`/`503`/`504`/`429`/`404` fallback to `GEMINI_FALLBACK_MODEL` + quota error mapping, cached `selectGeminiModel()`, and emitted `KEY_NOT_CONFIGURED`. |
| 6 | Missing `runtime = 'nodejs'` declarations & cron GET support | `src/app/api/**/route.ts`, `vercel.json` | Declared `export const runtime = 'nodejs'` on all 23 API route handlers, added `GET` handler alongside `POST` on `/api/internal/jobs/resume`, and added `vercel.json` daily cron. |
| 7 | Serverless `after()` interruption left non-terminal audits stalled | `src/app/api/audits/[token]/status/route.ts`, `src/lib/db/repositories/audits.repo.ts` | Added lock-guarded self-healing (`hasActiveProcessingLock` check + >90s heartbeat threshold -> `after(runAuditPipeline)`). |
| 8 | Missing `schemaOk` table check, `?detail=1` diagnostics & Admin checklist | `src/app/api/health/route.ts`, `src/app/admin/dashboard/page.tsx`, `src/components/admin/admin-dashboard-client.tsx` | Added 13-table schema check, boolean config flags, secret-gated `?detail=1`, and Admin Runtime Health Checklist. |
| 9 | Missing production scripts, smoke suite & ignore rules | `package.json`, `.gitignore`, `.vercelignore`, `.env.vercel.example`, `scripts/env-check.mjs`, `scripts/migrate-prod.mjs`, `scripts/vercel-env-sync.mjs`, `scripts/prod-smoke.mjs` | Added `env:check`, `db:migrate:prod`, `deploy:env`, `prod-smoke.mjs`, `engines.node`, `.vercelignore`, and sanitized git history. |

## Verification & Deploy History
- **Local Verification (`typecheck`, `lint`, `vitest`, empty-env `next build`, `bundle-safety.test.ts`):** `tsc --noEmit` 0 errors; `eslint .` 0 errors (1 pre-existing warning); `vitest run` 11 files, 94 passed (up from 89 baseline); empty-env `next build` succeeded (`22/22` static pages); local `scripts/prod-smoke.mjs` passed all checks (`COMPLETED` audit + assistant `200` + delete `404`).
- **Live Vercel Deploy (`https://amarketing-audit.vercel.app`):** *Stopped before `vercel deploy --prod` per Section B because `.env.vercel` / hosted Turso `DATABASE_URL` (`libsql://...`) & `DATABASE_AUTH_TOKEN` must be supplied by the user.*
