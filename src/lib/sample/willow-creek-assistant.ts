// src/lib/sample/willow-creek-assistant.ts
// Deterministic offline assistant for Willow Creek Orthodontics (no Gemini, no network, no DB).
// Computes admin time & ROI numbers dynamically from the shared ROI calculator.

import { calculateRoi } from '@/lib/roi/calculator';
import { formatCurrency, formatHours, formatMonths, formatPct } from '@/lib/roi/format';
import type { Currency, RoiInputs, RoiScenario, ScenarioKey } from '@/lib/roi/types';
import type { AssistantResponsePayload } from '@/lib/ai/assistant-types';
import { WILLOW_CREEK_SAMPLE_ROI_INPUTS, WILLOW_CREEK_SAMPLE_SCENARIOS } from './willow-creek';

export interface SampleAssistantContext {
  currency: Currency;
  roiInputs: RoiInputs;
  scenarios: Record<ScenarioKey, RoiScenario>;
  selectedScenario: ScenarioKey;
  lastTopic?: string;
}

export interface SampleAssistantReply {
  topic: string;
  payload: AssistantResponsePayload;
}

const SUPPORTED_TOPICS_LIST = [
  'Biggest automation opportunity',
  'Administrative time reclaimable (from your ROI inputs)',
  'How an AI receptionist works',
  'Missed-call SMS follow-ups',
  'What to implement first',
  'Explaining the ROI calculation & assumptions',
  'The first 30 days of the roadmap',
  'Human handoff and privacy guardrails',
];

function detectTopic(query: string, lastTopic?: string): string {
  const q = query.toLowerCase().trim();
  if (/^(tell me more|more details|expand|continue|elaborate|why\??|how\??)$/.test(q) && lastTopic) {
    return `${lastTopic}:more`;
  }
  if (/biggest|top\s*opportunit|main\s*bottleneck|highest|priorit/.test(q)) return 'biggest-opportunity';
  if (/admin|time|hours|reclaim|save.*hour|capacity/.test(q)) return 'admin-time';
  if (/receptionist|voice|after.?hours|phone\s*agent/.test(q)) return 'ai-receptionist';
  if (/missed.?call|text.?back|follow.?up|callback|sms/.test(q)) return 'missed-calls';
  if (/first\s*30|30\s*days|month\s*one|roadmap/.test(q)) return 'first-30-days';
  if (/implement\s*first|start\s*with|where\s*to\s*start|what\s*to\s*do\s*first|quick\s*win/.test(q)) return 'implement-first';
  if (/roi|calculat|formula|assumption|payback|basis|dollar|\$/.test(q)) return 'explain-roi';
  if (/handoff|guardrail|safe|privacy|patient|clinical|human/.test(q)) return 'human-handoff';
  return 'unsupported';
}

export function getWillowCreekSampleReply(
  question: string,
  ctx: Partial<SampleAssistantContext> = {},
): SampleAssistantReply {
  const currency = ctx.currency ?? 'USD';
  const inputs = ctx.roiInputs ?? WILLOW_CREEK_SAMPLE_ROI_INPUTS;
  const scenarios = ctx.scenarios ?? WILLOW_CREEK_SAMPLE_SCENARIOS;
  const selectedKey = ctx.selectedScenario ?? 'moderate';
  const scenario = scenarios[selectedKey];
  const outputs = calculateRoi(inputs, scenario);

  const topic = detectTopic(question, ctx.lastTopic);
  const baseTopic = topic.replace(':more', '');
  const isMore = topic.endsWith(':more');

  switch (baseTopic) {
    case 'biggest-opportunity':
      return {
        topic: baseTopic,
        payload: {
          answer: isMore
            ? 'In practice, the highest leverage comes from pairing missed-call SMS text-back with an embedded Smile Assessment scheduling link. That eliminates the 1–2 business day callback wait observed on the sample contact page without hiring extra evening reception staff.'
            : 'For **Willow Creek Orthodontics** (simulated audit), the biggest opportunity is **Instant Missed-Call Recovery & Voice Reception** paired with removing the static 1–2 business day callback form.\n\n- Front-desk coordinators miss inbound calls during peak clinic windows and after hours.\n- Every unanswered caller receives an automated response within 60 seconds with a self-serve booking link and clean summary logged for staff.',
          relatedFindingIds: ['F3', 'F5'],
          relatedOpportunityIds: ['O1'],
          suggestedFollowUpQuestions: [
            'How do automated missed-call follow-ups work?',
            'How much administrative time could we reclaim?',
          ],
          cta: { show: false, label: '', type: 'CONSULTATION' },
        },
      };

    case 'admin-time': {
      const adminManual = outputs.adminManualHoursMonthly !== null ? formatHours(outputs.adminManualHoursMonthly) : 'N/A';
      const adminRecl = outputs.adminHoursReclaimedMonthly !== null ? formatHours(outputs.adminHoursReclaimedMonthly) : 'N/A';
      const fuRecl = outputs.followUpHoursReclaimedMonthly !== null ? formatHours(outputs.followUpHoursReclaimedMonthly) : '0.00';
      const totalRecl = outputs.totalHoursReclaimedMonthly !== null ? formatHours(outputs.totalHoursReclaimedMonthly) : 'N/A';
      const capMo = outputs.capacityValueMonthly !== null ? formatCurrency(outputs.capacityValueMonthly, currency) : 'not set (enter hourly cost)';
      const capYr = outputs.capacityValueAnnual !== null ? formatCurrency(outputs.capacityValueAnnual, currency) : 'not set';

      return {
        topic: baseTopic,
        payload: {
          answer: isMore
            ? `Breaking down the live **${scenario.label}** simulator values: admin tasks account for **${adminRecl} hrs/month** reclaimed (${scenario.adminAutomationPct}% of ${adminManual} hrs manual) and follow-ups add **${fuRecl} hrs/month** (${scenario.followUpAutomationPct}% automation). This reflects staff time freed for patient care rather than cash payroll cuts.`
            : `Based directly on the current ROI simulator (**${scenario.label}** scenario):\n\n- **Manual admin workload:** ${adminManual} hours/month (${inputs.monthlyAdminTasks ?? 0} tasks × ${inputs.minutesPerAdminTask ?? 0} min ÷ 60)\n- **Admin hours reclaimed:** **${adminRecl} hours/month** (${scenario.adminAutomationPct}% automation)\n- **Follow-up hours reclaimed:** **${fuRecl} hours/month**\n- **Total staff time freed:** **${totalRecl} hours/month**, representing **${capMo}/month** (**${capYr}/year**) in illustrative team capacity (not cash savings).`,
          relatedFindingIds: ['F6'],
          relatedOpportunityIds: ['O2', 'O3'],
          suggestedFollowUpQuestions: [
            'Explain the ROI calculation and assumptions',
            'What should we implement first?',
          ],
          cta: { show: false, label: '', type: 'CONSULTATION' },
        },
      };
    }

    case 'ai-receptionist':
      return {
        topic: baseTopic,
        payload: {
          answer: isMore
            ? 'For complex orthodontic questions, insurance edge cases, or distressed patients, the AI Receptionist immediately logs a structured summary and flags a human coordinator for callback — never giving clinical advice.'
            : 'The **After-Hours & Overflow AI Receptionist** only steps in when front-desk lines are busy or closed:\n\n- Greets callers naturally and identifies clinic location and teen vs adult aligner interest.\n- Answers approved non-clinical FAQs (hours, parking, flexible payment-plan overview).\n- Texts a direct smile assessment link and passes a structured intake note to your coordinators.',
          relatedFindingIds: ['F5'],
          relatedOpportunityIds: ['O1'],
          suggestedFollowUpQuestions: [
            'How do human handoffs work safely?',
            'What does the first 30 days look like?',
          ],
          cta: { show: false, label: '', type: 'CONSULTATION' },
        },
      };

    case 'missed-calls': {
      const missed = inputs.monthlyMissedCalls ?? 0;
      const rec = outputs.recoveredEnquiriesMonthly !== null ? Math.round(outputs.recoveredEnquiriesMonthly) : 0;
      const cust = outputs.potentialCustomersMonthly !== null ? outputs.potentialCustomersMonthly.toFixed(1).replace(/\.0$/, '') : 'N/A';
      return {
        topic: baseTopic,
        payload: {
          answer: isMore
            ? 'When a caller declines to wait or calls after hours, the SMS trigger sends an immediate friendly reply within seconds and routes unbooked prospects into a gentle 24-hour / 3-day / 7-day coordinator follow-up sequence.'
            : `Automated **missed-call follow-up** prevents high-intent callers from dialling another local clinic:\n\n- Unanswered calls trigger an instant SMS text-back within **60 seconds** with booking options.\n- In your current simulator state (${missed} missed calls/month at **${scenario.missedCallRecoverPct}% recovery**), that represents **${rec} recovered enquiries/month** (${cust} potential new patients/month).`,
          relatedFindingIds: ['F3', 'F5'],
          relatedOpportunityIds: ['O1', 'O2'],
          suggestedFollowUpQuestions: [
            'What is our biggest automation opportunity?',
            'Explain the ROI calculation and assumptions',
          ],
          cta: { show: true, label: 'Request Sample Pilot Preview', type: 'PILOT' },
        },
      };
    }

    case 'implement-first':
      return {
        topic: baseTopic,
        payload: {
          answer: isMore
            ? 'Starting with CRM routing and missed-call text-back keeps clinical workflows completely untouched while giving coordinators immediate relief from manual spreadsheet copying.'
            : 'Implement in three low-disruption steps:\n\n1. **CRM Lead Capture & Automated Consultation Follow-Up** (Low complexity) — connect static web enquiry forms into one CRM pipeline.\n2. **Missed-Call SMS Text-Back** — capture callers who ring during busy chairside windows.\n3. **Pre-Visit Reminder Automation** — cut manual confirmation calls and protect chair utilisation.',
          relatedFindingIds: ['F3', 'F6'],
          relatedOpportunityIds: ['O2', 'O1', 'O3'],
          suggestedFollowUpQuestions: [
            'What does the first 30 days look like?',
            'How much administrative time could we reclaim?',
          ],
          cta: { show: true, label: 'Discuss Priority Rollout', type: 'CONSULTATION' },
        },
      };

    case 'explain-roi': {
      const capYr = outputs.capacityValueAnnual !== null ? formatCurrency(outputs.capacityValueAnnual, currency) : 'N/A';
      const gpYr = outputs.grossProfitOpportunityAnnual !== null ? formatCurrency(outputs.grossProfitOpportunityAnnual, currency) : 'N/A';
      const roiA = outputs.roiPctBasisA !== null ? formatPct(outputs.roiPctBasisA) : 'implementation cost not provided';
      const paybackA = outputs.paybackMonthsBasisA !== null ? formatMonths(outputs.paybackMonthsBasisA) : 'requires positive implementation cost';
      return {
        topic: baseTopic,
        payload: {
          answer: isMore
            ? 'Every scenario percentage (Conservative / Moderate / Optimistic) is an **editable starting point**, not an industry benchmark. Entering your own implementation cost reveals Year-1 Net Benefit and Payback on both Basis A and Basis B side by side.'
            : `The simulator evaluates **two separate ROI bases** deterministically in code (no AI guesswork):\n\n- **Basis A (Profit-Opportunity Only):** Annual gross profit from recovered missed calls (**${gpYr}/yr**) minus running & setup costs. Current ROI: **${roiA}** (${paybackA}).\n- **Basis B (Including Staff Capacity):** Combines gross profit opportunity with reclaimed team capacity (**${capYr}/yr**). Note: staff capacity is time freed for other work, **never** guaranteed cash or payroll savings.`,
          relatedFindingIds: ['F5', 'F6'],
          relatedOpportunityIds: ['O1', 'O2'],
          suggestedFollowUpQuestions: [
            'How much administrative time could we reclaim?',
            'What should we implement first?',
          ],
          cta: { show: false, label: '', type: 'CONSULTATION' },
        },
      };
    }

    case 'first-30-days':
      return {
        topic: baseTopic,
        payload: {
          answer: isMore
            ? 'Weeks 3–4 focus on launching the FAQ pre-qualification widget across primary treatment pages and reviewing initial enquiry-to-consultation logs with your front-desk lead.'
            : 'Under the sample **First 30 Days** plan:\n\n- Connect website enquiry forms directly to a unified CRM pipeline with instant acknowledgements.\n- Enable missed-call SMS text-back so unanswered clinic calls receive an immediate reply.\n- Launch a structured FAQ and smile assessment concierge widget using approved practice info.',
          relatedFindingIds: ['F1', 'F2', 'F3'],
          relatedOpportunityIds: ['O2', 'O1'],
          suggestedFollowUpQuestions: [
            'What should we implement first?',
            'How would an AI receptionist work?',
          ],
          cta: { show: false, label: '', type: 'CONSULTATION' },
        },
      };

    case 'human-handoff':
      return {
        topic: baseTopic,
        payload: {
          answer: isMore
            ? 'Patient health records and clinical scheduling exceptions always remain inside your practice-management system with human coordinator sign-off.'
            : 'Every automated workflow in this report includes strict **human-handoff guardrails**:\n\n- Assistants answer only non-clinical logistics (locations, hours, general financing options).\n- Complex, clinical, or rescheduling requests route immediately to a front-desk coordinator with full intake notes.\n- No clinical diagnoses or compliance claims are ever generated.',
          relatedFindingIds: ['F2'],
          relatedOpportunityIds: ['O1', 'O2'],
          suggestedFollowUpQuestions: ['What does the first 30 days look like?'],
          cta: { show: false, label: '', type: 'CONSULTATION' },
        },
      };

    default:
      return {
        topic: 'unsupported',
        payload: {
          answer: `**DEMO ASSISTANT – SAMPLE BUSINESS AND SIMULATED RESPONSES.**\n\nThis offline demo assistant covers Willow Creek Orthodontics across these topics:\n\n${SUPPORTED_TOPICS_LIST.map((t) => `- ${t}`).join('\n')}\n\nPick any suggested chip below or ask about one of these topics.`,
          relatedFindingIds: [],
          relatedOpportunityIds: [],
          suggestedFollowUpQuestions: [
            'What is our biggest automation opportunity?',
            'How much administrative time could we reclaim?',
            'Explain the ROI calculation',
          ],
          cta: { show: false, label: '', type: 'CONSULTATION' },
        },
      };
  }
}
