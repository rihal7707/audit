# AMARKETING – Free AI Business Audit Platform

A full-stack, evidence-based AI Business Audit SaaS platform built for **Amarketing Advertising**.  
It attracts business prospects with a free, no-obligation AI audit, inspects up to five public pages of their website safely, detects deterministic operational signals, generates a structured and grounded report with Google Gemini, and manages the resulting sales pipeline inside an authenticated agency console.

---

## Architecture & Tech Stack

- **Frontend:** Next.js 16 (App Router, TypeScript strict mode), Tailwind CSS, Radix UI primitives, Lucide icons, Recharts, React Hook Form + Zod.
- **Backend:** Next.js Route Handlers with `import "server-only"` isolation on all secret, database, crawler, and Gemini modules.
- **Database:** Drizzle ORM + `@libsql/client` (SQLite/libSQL locally via `file:./data/amarketing.db`; hosted Turso/libSQL in production). Repository pattern in `src/lib/db/repositories/*`.
- **AI:** Official `@google/genai` SDK (`gemini-3.8-flash` default, optional `GEMINI_FALLBACK_MODEL` on 429/503), structured JSON schema (`z.toJSONSchema`), Zod validation, and deterministic citation grounding.
- **Security:** Strict SSRF URL guard + DNS-pinned `undici` fetcher, DB-backed rate limits, HMAC IP hashing, PII scrubbing before AI calls, `jose` HS256 `__Host-amk_admin` sessions, CSRF/Origin validation, CSP & security headers, and formula-safe CSV export.

---

## Project Structure

```text
audit-platform/
├── drizzle/                        # Committed Drizzle SQL migrations
├── docs/
│   └── DEMO_SCRIPT.md              # 5-minute agency walkthrough script
├── scripts/
│   └── verify-gemini.ts            # Minimal live Gemini API check (`npm run verify:gemini`)
├── styles/
│   └── tokens.css                  # Design tokens (navy, neutrals, emerald accent)
├── src/
│   ├── app/                        # Public pages, API route handlers, Admin portal
│   ├── components/                 # Reusable UI primitives, wizard, report, admin UI
│   └── lib/
│       ├── ai/                     # System prompt, industry playbooks, schema, grounding, Gemini client
│       ├── config/                 # Brand, service catalogue, industries, restricted countries
│       ├── db/                     # Drizzle client, schema, migrator, repositories/*
│       ├── extraction/             # Cheerio extractor, deterministic signals, crawler
│       ├── leads/                  # Deterministic 100-point lead scoring engine
│       ├── notifications/          # Optional Resend email & webhook alerts
│       ├── pipeline/               # 9-stage persisted audit state machine
│       ├── reports/                # Strict allow-listed public report DTO serializer
│       ├── sample/                 # Fictional Willow Creek Orthodontics sample dataset
│       ├── security/               # URL SSRF guard, pinned safe-fetch, rate limits, PII scrub, admin auth
│       └── validation/             # Shared Zod wizard submission schema
├── tests/                          # Vitest unit, security, extraction, grounding & API tests
├── .env.example                    # Complete documented environment template
└── package.json
```

---

## Quick Start (Local Development)

> Cross-platform scripts work on Windows PowerShell, macOS, and Linux.

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
Copy `.env.example` to `.env.local` and adjust values as needed:
- **Public site + Sample Report (`/sample-report`)**: Works immediately with zero configuration.
- **Database**: Defaults to `DATABASE_URL=file:./data/amarketing.db` (directory created automatically).
- **Live AI Audits**: Set `GEMINI_API_KEY`.
- **Admin Console (`/admin`)**: Set `ADMIN_PASSWORD` (at least 12 characters in production) and `ADMIN_SESSION_SECRET` (at least 32 characters).

### 3. Run database migrations
```bash
npm run db:migrate
```

### 4. Start the development server
```bash
npm run dev
```
Open `http://localhost:3000`.

---

## Adding & Verifying Your Gemini API Key

1. Generate a Gemini API key in Google AI Studio or Google Cloud.
2. Add it to `.env.local` (never commit `.env.local` or expose it via `NEXT_PUBLIC_*`):
   ```env
   GEMINI_API_KEY=your_api_key_here
   GEMINI_MODEL=gemini-3.8-flash
   GEMINI_FALLBACK_MODEL=
   GEMINI_PAID_TIER=false
   ```
3. Run the verification check (makes one minimal JSON test call):
   ```bash
   npm run verify:gemini
   ```

### Important: Enabling Billing & Regional Availability (`GEMINI_PAID_TIER`)
- Under Google’s Gemini API terms, unpaid quota permits product-improvement/human review and restricts availability for users in the **EEA, Switzerland, and the United Kingdom**.
- When `GEMINI_PAID_TIER=false`, the platform automatically blocks submissions from EEA/Switzerland/UK in both the wizard and `POST /api/audits`.
- **Before launching commercially:** Enable Cloud Billing on your Google Cloud project (with a monthly budget cap and billing alerts), verify Google’s current Gemini API Terms of Service, and set:
  ```env
  GEMINI_PAID_TIER=true
  ```

---

## Accessing the Sample Report & Admin Dashboard

- **Sample Audit Report:** Visit `/sample-report` (or click **View Sample Audit Report** on `/`). Uses the fictional **Willow Creek Orthodontics** dataset in `src/lib/sample/willow-creek.ts` and is never written to the database.
- **Admin Portal:** Visit `/admin/login` and sign in with `ADMIN_PASSWORD` (or configure `ADMIN_PASSWORD_HASH` using `scrypt:<saltHex>:<derivedHex>` or `sha256:<hex>`).
  - View 6 KPI cards, the ever-reached conversion funnel, and attention queues at `/admin/dashboard`.
  - Search, filter, update pipeline stages, override priorities, add notes, retry/regenerate/release/revoke reports, and export formula-safe CSVs at `/admin/audits`.

---

## Deployment & Operations Notes

### Deploy to Vercel

1. **Provision Turso (hosted libSQL)** — create a free database at Turso or via the Vercel Marketplace (`tursocloud/database`) and obtain `DATABASE_URL` (`libsql://...`) and `DATABASE_AUTH_TOKEN`.
2. **Create `.env.vercel`** from `.env.vercel.example` (never commit `.env.vercel`) and set `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `GEMINI_API_KEY`, and any optional integrations.
3. **Run in exact order:**
   ```bash
   vercel login
   npm run env:check       # Validates .env.vercel & generates ADMIN_PASSWORD/ADMIN_SESSION_SECRET/CRON_SECRET/SMOKE_TEST_SECRET if empty
   npm run deploy:env      # Syncs allow-listed env vars to Vercel via stdin (add --preview for Preview)
   npm run db:migrate:prod # Applies Drizzle SQL migrations cleanly against hosted Turso DB
   vercel deploy --prod --yes
   ```
4. **Environment variables:**
   | Variable | Required | Notes |
   | --- | --- | --- |
   | `DATABASE_URL` / `TURSO_DATABASE_URL` | Yes | Hosted `libsql://...` URL (`file:` rejected on Vercel) |
   | `DATABASE_AUTH_TOKEN` / `TURSO_AUTH_TOKEN` | Yes | Turso database auth token |
   | `GEMINI_API_KEY` | Yes | Google AI Studio / Cloud API key |
   | `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | Optional | Defaults to `gemini-3.8-flash` + fallback |
   | `GEMINI_PAID_TIER` | Optional | Set `true` once Cloud Billing is enabled (unlocks EEA/UK/CH) |
   | `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | Yes | `>= 12` chars password, `>= 32` chars secret |
   | `CRON_SECRET` | Yes | Authorizes `/api/internal/jobs/resume` (`GET`/`POST`) and `/api/health?detail=1` |
   | `NEXT_PUBLIC_APP_URL` | Optional | Set to production domain & rebuild (`next build` inlines `NEXT_PUBLIC_*`) |
   | `TRUST_PROXY` | Auto | Defaults to `true` on Vercel |
   | `SMOKE_TEST_SECRET` | Temp | Enables automated `x-smoke-test` check; **remove from Vercel after launch** |
5. **Plan limits & cron:** Routes execute on `nodejs` (`maxDuration = 60`, `engines.node >=20 <27`). `vercel.json` runs `/api/internal/jobs/resume` daily (`0 3 * * *`), while `GET /api/audits/[token]/status` self-heals stale jobs (>90s heartbeat) via lock-guarded `after()`.

### Hosted Database (libSQL / Turso vs Persistent Disk)
- **Serverless (e.g. Vercel):** Local `file:./data/amarketing.db` is ephemeral on serverless hosts. Provision a hosted libSQL/Turso database and set `DATABASE_URL=libsql://...` and `DATABASE_AUTH_TOKEN=...`, then run `npm run db:migrate` during deploy.
- **Self-hosted / VPS / Docker:** Either hosted libSQL or a mounted persistent volume works with `file:./data/amarketing.db`.
- **PostgreSQL Migration Path:** All database queries live inside `src/lib/db/repositories/*`. To migrate to PostgreSQL, swap `drizzle-orm/libsql` + `sqliteTable` in `src/lib/db/schema.ts` and `src/lib/db/index.ts` for `drizzle-orm/node-postgres` + `pgTable` and regenerate migrations with `drizzle-kit`.

### Background Execution & Cron Resume
- `POST /api/audits` persists the record and returns immediately, then runs the pipeline inside Next.js `after()` (`maxDuration = 60`).
- On platforms where background tasks can be interrupted or when `WAITING_FOR_QUOTA` / daily cap occurs, schedule a cron job (every 5 minutes) calling:
  ```http
  POST https://your-domain.com/api/internal/jobs/resume
  Authorization: Bearer <CRON_SECRET>
  ```
  This resumes queued, quota-waiting, and stalled audits (no heartbeat for 5 minutes), purges audits older than `DATA_RETENTION_DAYS` (default 180), and clears expired crawl cache / rate-limit rows.

### Recommended Launch Settings
- Set `REPORT_RELEASE_MODE=review` for your first batch of live audits so an admin reviews generated reports before customers receive them, then switch to `auto` when ready.
- Set `TRUST_PROXY=true` only when deployed behind a trusted reverse proxy (Vercel, Cloudflare, nginx) so `x-forwarded-for` rate limiting cannot be spoofed.
- Enforce **HTTPS** in production (`__Host-amk_admin` cookie requires secure origins, and HSTS is emitted automatically when `NODE_ENV=production`).
- **Legal Notice:** The `/privacy` and `/terms` pages accurately describe how this software works today, but remain template drafts — have them reviewed by qualified legal counsel before commercial launch.

---

## Verification & Testing Commands

```bash
npm run typecheck    # TypeScript strict check
npm run lint         # ESLint checks
npm test             # Vitest security, crawler, grounding, lead score, API & bundle-safety tests
npm run build        # Production Next.js build
```

---

## Future Enhancements (Out of Scope for v1)

- Paid subscriptions, invoicing, and billing portals
- Multi-tenant white-label agency workspaces
- Headless-browser (Playwright/Puppeteer) rendering for JavaScript-only client SPAs
- Embedded real-time customer live chat
- Customer login accounts and multi-language UI translation

