# Progress Tracker

- [x] Core audit product (sections 1-21) – tests passing
- [x] .env.example & .env.local generation script
- [x] Model auto-selection utility
- [x] Phase 1: ROI Calculator (`src/lib/roi/calculator.ts`, `types.ts`, `format.ts`, `narrative.ts`, country defaults) – tests passing
- [x] Phase 2: ROI Persistence & API (`audit_roi` migration `0001_add_audit_roi.sql`, `GET/PUT /api/reports/[token]/roi`, prefill, rate limit, cascade delete) – tests passing
- [x] Phase 3: ROI Simulator UI (`src/components/roi/*`, shared `src/lib/report/section-config.ts`, ReportView section 6, extended intent dialog)
- [x] Phase 4: Sample ROI (`Willow Creek Orthodontics` simulated values evaluated by shared calculator)
- [x] Phase 5: Assistant Backend (`assistant_conversations`, `assistant_messages`, `assistant_analytics` migration `0002_add_assistant_tables.sql`, prompt, compact context builder, figure check, rate limit, cap + admin reset) – tests passing
- [x] Phase 6: Assistant Side Panel UI (docked at >=1280px, drawer 1024-1279px, bottom sheet <1024px, `react-markdown` sanitized renderer, ROI flush before send)
- [x] Phase 7: Sample Assistant (`src/lib/sample/willow-creek-assistant.ts` offline 7+ topics synced to sample ROI) – tests passing
- [x] Phase 8: Landing Page + Sample Report + Nav (shared section config, ROI & Assistant preview sections, nav anchors, FAQs, metadata)
- [x] Phase 9: Print, Privacy & Admin (verbatim Q&A print opt-in, privacy/terms updates, real-only Admin ROI & Assistant analytics + detail tabs)
- [x] Phase 10: Typecheck, ESLint (0 errors), Vitest (10 files, 88 passed vs 71 baseline), Next build, Playwright `tests/e2e/roi-assistant.spec.ts` (1440px/390px + screenshots in `./verification/`), and live Gemini assistant verification on completed audit #1 (`HTTP 200`)
- [x] Phase 11: Production Vercel + Hosted Turso Deployment — migrated 14 tables (`db:migrate:prod`), `tsc`/`lint`/Vitest (`11` files, `94` passed)/empty-env `next build`, deployed live at `https://amarketing-audit.vercel.app` (`dpl_CaqMDafqgtiAGZdnfDTUiMasS1bN`), verified `/api/health` and all 16 checks of `scripts/prod-smoke.mjs` passing end-to-end
- [ ] Admin UI display of selected model & VIDEO_API_KEY fallback note
- [ ] Tier 2 premium add-ons (animated walkthrough)
- [ ] Tier 3 AI video generation (VIDEO_MODEL handling)
