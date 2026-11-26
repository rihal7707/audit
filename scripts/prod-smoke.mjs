// scripts/prod-smoke.mjs
// End-to-end production smoke test against a live URL (node >=20 fetch, never logs secrets).
import fs from 'node:fs';
import path from 'node:path';

const rawBase = process.argv[2] || process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const BASE = rawBase.replace(/\/+$/, '');

function loadEnvFile(file) {
  const p = path.resolve(process.cwd(), file);
  const map = {};
  if (!fs.existsSync(p)) return map;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    map[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return map;
}

const vercelEnv = loadEnvFile('.env.vercel');
const localEnv = loadEnvFile('.env.local');
const getVar = (k) => process.env[k] || vercelEnv[k] || localEnv[k] || '';

const smokeSecret = getVar('SMOKE_TEST_SECRET');
const bypassSecret = getVar('VERCEL_AUTOMATION_BYPASS_SECRET');
const adminPassword = getVar('ADMIN_PASSWORD');

const baseHeaders = {};
if (bypassSecret) baseHeaders['x-vercel-protection-bypass'] = bypassSecret;

let failedCount = 0;
function logCheck(name, ok, status, detail = '') {
  if (!ok) failedCount += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} [${status}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(urlPath, opts = {}) {
  return fetch(`${BASE}${urlPath}`, {
    ...opts,
    headers: { ...baseHeaders, ...(opts.headers || {}) },
  });
}

async function main() {
  const home = await req('/');
  const homeText = await home.text();
  logCheck('GET /', home.status === 200 && homeText.includes('AMARKETING'), home.status);
  logCheck('Security headers on /', Boolean(home.headers.get('x-content-type-options')), home.status);

  const sample = await req('/sample-report');
  const sampleText = await sample.text();
  logCheck(
    'GET /sample-report',
    sample.status === 200 &&
      sampleText.includes('Calculate Your Automation Potential') &&
      sampleText.includes('Ask Your AI Consultant'),
    sample.status,
  );

  for (const p of ['/privacy', '/how-we-inspect']) {
    const r = await req(p);
    logCheck(`GET ${p}`, r.status === 200, r.status);
  }

  const healthRes = await req('/api/health');
  const health = await healthRes.json().catch(() => ({}));
  logCheck('GET /api/health', healthRes.status === 200 && health.dbReachable && health.schemaOk, healthRes.status, `gemini=${Boolean(health.geminiConfigured)}`);
  if (healthRes.status !== 200) process.exit(1);

  const pre = await req('/api/audits/precheck', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://amarketingadvertising.com/' }),
  });
  const preJson = await pre.json().catch(() => ({}));
  logCheck('POST /api/audits/precheck', pre.status === 200 && Boolean(preJson.normalizedUrl), pre.status, `urlStatus=${preJson.urlStatus || 'n/a'}`);

  const submitHeaders = { 'content-type': 'application/json', Origin: BASE };
  if (smokeSecret) submitHeaders['x-smoke-test'] = smokeSecret;
  const submit = await req('/api/audits', {
    method: 'POST',
    headers: submitHeaders,
    body: JSON.stringify({
      website: 'https://developer.mozilla.org/en-US/',
      businessName: 'Smoke Dental Studio',
      industry: 'Dental',
      country: 'US',
      businessDescription: 'Dental practice verifying live onboarding and enquiry triage workflows.',
      challenges: ['Missed phone calls'],
      goals: ['Automate appointments and bookings'],
      contactName: 'Smoke Verification',
      contactEmail: 'smoke-test@example.invalid',
      consent: true,
      processingNoticeAck: true,
      marketingConsent: false,
      websiteConfirmHp: '',
      formStartedAt: Date.now() - 5000,
      allowCrossDomainRedirect: true,
    }),
  });
  const subJson = await submit.json().catch(() => ({}));
  const token = subJson.token;
  logCheck('POST /api/audits', submit.ok && Boolean(token), submit.status);
  if (!token) process.exit(1);

  let finalStatus = null;
  const deadline = Date.now() + 8 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const stRes = await req(`/api/audits/${token}/status`);
    const st = await stRes.json().catch(() => ({}));
    console.log(`  poll status=${st.auditStatus} stage=${st.currentStageIndex}/9`);
    if (st.isCompleted || st.isFailed || st.isWaitingQuota || st.isPendingReview) {
      finalStatus = st;
      break;
    }
  }

  if (!health.geminiConfigured && finalStatus?.lastError?.includes('KEY_NOT_CONFIGURED')) {
    console.log('AI STAGE NOT VERIFIED (no key)');
  } else {
    logCheck('Audit completion', Boolean(finalStatus?.isCompleted), 200, String(finalStatus?.auditStatus || 'timeout'));
  }

  if (finalStatus?.isCompleted) {
    const repPage = await req(`/report/${token}`);
    const noindex = (repPage.headers.get('x-robots-tag') || '').includes('noindex');
    logCheck('GET /report/[token] + noindex', repPage.status === 200 && noindex, repPage.status);

    const repApi = await req(`/api/reports/${token}`);
    const repText = await repApi.text();
    const safeDto = repApi.status === 200 && !repText.includes('smoke-test@example.invalid') && !repText.includes('leadScore');
    logCheck('GET /api/reports/[token] safe DTO', safeDto, repApi.status);

    const roiGet = await req(`/api/reports/${token}/roi`);
    const roiState = await roiGet.json().catch(() => null);
    const roiPut = roiState
      ? await req(`/api/reports/${token}/roi`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            currency: roiState.currency,
            selectedScenario: roiState.selectedScenario,
            inputs: { ...roiState.inputs, monthlyAdminTasks: 300 },
            scenarios: roiState.scenarios,
          }),
        })
      : null;
    logCheck('GET/PUT /api/reports/[token]/roi', roiGet.status === 200 && roiPut?.status === 200, roiPut?.status || roiGet.status);

    const asstHist = await req(`/api/reports/${token}/assistant`);
    logCheck('GET /api/reports/[token]/assistant', asstHist.status === 200, asstHist.status);
    if (health.geminiConfigured) {
      const asstPost = await req(`/api/reports/${token}/assistant`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'What is our top automation opportunity?' }),
      });
      logCheck('POST /api/reports/[token]/assistant', asstPost.status === 200 || asstPost.status === 429 || asstPost.status === 503, asstPost.status);
    }
  }

  if (adminPassword) {
    const login = await req('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Origin: BASE },
      body: JSON.stringify({ password: adminPassword }),
    });
    const setCookie = login.headers.get('set-cookie') || '';
    const cookiePair = setCookie.split(';')[0] || '';
    const me = await req('/api/admin/me', { headers: { cookie: cookiePair } });
    const meJson = await me.json().catch(() => ({}));
    const list = await req('/api/admin/audits', { headers: { cookie: cookiePair } });
    logCheck('Admin login + /api/admin/me + /api/admin/audits', login.status === 200 && Boolean(meJson.authenticated) && list.status === 200, list.status);
  }

  const del = await req(`/api/reports/${token}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ confirm: true }),
  });
  const afterDel = await req(`/api/reports/${token}`);
  logCheck('DELETE /api/reports/[token] -> 404', del.status === 200 && afterDel.status === 404, afterDel.status);

  if (failedCount > 0) process.exit(1);
}

main().catch((e) => {
  console.error('Smoke test failed:', e?.message || e);
  process.exit(1);
});
