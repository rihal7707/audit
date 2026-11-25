# 5-Minute Live Walkthrough Script — AMARKETING Free AI Business Audit

**Audience:** Amarketing Advertising Leadership / Agency Owner  
**Goal:** Demonstrate how the platform attracts prospects, performs genuine evidence-backed website analysis, delivers a consulting-grade free audit, and converts leads inside the internal agency pipeline.

---

## Minute 0:00 – 1:15 | Positioning & Landing Experience (`/`)
1. Open the homepage (`/`).
2. Point out the **"Calm Authority"** aesthetic: navy cover gradient, editorial serif headline (*"Discover Where AI Can Transform Your Business."*), clear no-obligation positioning, and the live **Illustrative Sample Preview** built from real report components.
3. Scroll briefly through:
   - **How It Works** (5 transparent steps)
   - **What Will Your Audit Include?** (deliverable table of contents)
   - **How We Inspect Your Website** transparency panel (named crawler user-agent, 5-page cap, `robots.txt` respect, zero script execution, zero form submissions).

---

## Minute 1:15 – 2:30 | The Illustrative Sample Report (`/sample-report`)
1. Click **Explore Sample Audit** (`/sample-report`) for **Willow Creek Orthodontics** (fictional practice).
2. Highlight why this builds immediate prospect trust:
   - Editorial cover with **Audit Coverage** status and **Pages Inspected**.
   - **Evidence Badges** clearly separating `Verified observation` (with quoted text and clickable source link), `Customer-provided`, and `AI hypothesis` — no fabricated metrics.
   - **Automation Opportunities** showing Problem -> Proposed Solution -> How It Works -> Success Metric.
   - **Recommended AI Agents** with visual Trigger -> Step -> **Human Handoff** workflow diagrams.
   - **Interactive Time & Effort Estimator** (local browser only, transparent formula).
   - **Next Steps CTA** (*Book a Free Strategy Call*, *Discuss My Audit*, *Request a Pilot*).
3. Open **Print / Save PDF** (`Ctrl+P` / Print button) briefly to show the clean A4 layout with expanded sections and printed URLs.

---

## Minute 2:30 – 3:45 | Live Audit Submission & Real-Time Pipeline (`/audit` -> `/audit/progress/[token]`)
*(Use a real public website you have permission to analyse, with `GEMINI_API_KEY` configured in `.env.local`.)*
1. Click **Get My Free AI Business Audit** (`/audit`).
2. Step 1: Enter the website URL (note instant URL normalisation + live reachability/robots precheck on blur), business name, industry, and country.
3. Step 2–3: Select operational challenges (e.g., *Missed phone calls*, *Slow customer follow-ups*), current tools, and goals.
4. Step 4: Point out the privacy callout (*contact details are never sent to Gemini*), separate required audit consent & AI processing notice, and separate optional marketing opt-in.
5. Step 5: Review summary and click **Generate My Free AI Business Audit**.
6. Watch `/audit/progress/[token]` step through the **9 real persisted stages** (Validating -> Checking accessibility -> Discovering pages -> Extracting -> Analysing -> Identifying AI opportunities -> Building report -> Saving -> Completed).
7. Click **View my report** to verify every `VERIFIED_OBSERVATION` badge links back to the real inspected page URL!

---

## Minute 3:45 – 5:00 | Internal Agency Operations (`/admin`)
1. Open `/admin/login` and sign in.
2. On `/admin/dashboard`:
   - Show the **6 live KPI cards** (Submissions, Reports Generated, Qualified, Consultations, Pilots, Converted Clients).
   - Show the **Ever-Reached Conversion Funnel** (counts audits that have ever reached each milestone stage, even after progressing further or branching to `NOT_INTERESTED`).
   - Point out **Needs Attention** (HOT leads without a follow-up date, overdue follow-ups, failed/queued items).
3. Open `/admin/audits` and filter/search, then click into the live audit just submitted (`/admin/audits/[id]`):
   - Show the **100-point deterministic Lead Score Breakdown** with per-factor reasons (`HOT`/`WARM`/`NURTURE`).
   - Open **Website Analysis** tab to show extracted pages, detected signals (forms, booking widgets, chat), and prompt-injection flagging.
   - Advance the **Pipeline Stage** (e.g. `QUALIFIED` or `CONSULTATION_BOOKED`), add an internal note, set a follow-up date, and demonstrate **Export CSV** (formula-injection safe).

