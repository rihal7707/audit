import { AuditReportSchema, type AuditReport } from '@/lib/ai/report-schema';
import { calculateAllScenarios } from '@/lib/roi/calculator';
import type { RoiInputs, RoiOutputs, RoiScenario, ScenarioKey } from '@/lib/roi/types';

/**
 * Fictional sample audit report for Willow Creek Orthodontics.
 * Validated by AuditReportSchema so it renders through the exact production report components.
 * Never persisted to the database or mixed into live lead counts.
 */
const rawSampleReport: AuditReport = {
  meta: {
    reportVersion: '1.0',
    promptVersion: '2026.11.v1',
    model: 'Illustrative Sample Dataset',
    generatedAt: '2026-11-18T09:30:00.000Z',
    coverage: 'COMPLETE',
  },
  businessOverview: {
    businessName: 'Willow Creek Orthodontics',
    website: 'https://willowcreekortho.example',
    industry: 'Orthodontics',
    summary:
      'Willow Creek Orthodontics is a fictional two-location orthodontic practice offering clear aligners, ceramic braces, and teen orthodontic assessments. This illustrative sample demonstrates how Amarketing transforms public website observations and operational inputs into a structured, non-generic AI and automation roadmap.',
    servicesIdentified: [
      'Invisalign & Clear Aligners',
      'Teen & Adult Braces',
      'Free New-Patient Smile Assessments',
      'Flexible Monthly Payment Plans',
    ],
    auditCoverage:
      'Illustrative sample coverage across 5 simulated public pages (Home, Treatments, Teen Orthodontics, New Patients, Contact & Locations).',
  },
  executiveSummary: {
    summary:
      'Willow Creek Orthodontics presents strong treatment clarity and patient trust signals on its simulated public pages, but relies on manual callback workflows for phone enquiries and web contact forms. Introducing an instant missed-call follow-up, a website enquiry assistant, and CRM-connected consultation booking can reduce enquiry drop-off without adding reception workload.',
    positiveObservations: [
      'Clear treatment pathways separating adult aligners and teen braces with dedicated consultation calls to action.',
      'Visible location hours and multi-channel phone and form options make initial discovery approachable for families.',
      'Patient review highlights and transparent payment-plan messaging support prospective patient confidence.',
    ],
    mainImprovementAreas: [
      'After-hours and busy-period phone calls wait for manual voicemail callbacks, risking missed new-patient consultations.',
      'Website enquiry forms request general details without structured pre-qualification or direct calendar slot selection.',
      'Manual entry between inbox enquiries, spreadsheets, and scheduling software slows multi-step follow-up consistency.',
    ],
  },
  auditSections: [
    {
      category: 'Digital Presence & Messaging',
      status: 'STRONG_SIGNALS',
      summary:
        'Public service explanations and patient-facing calls to action are clear, with opportunities to tighten pre-consultation FAQs.',
      findings: [
        {
          title: 'Clear new-patient consultation positioning across primary pages',
          observation:
            'The simulated homepage and treatment pages prominently highlight complimentary initial smile assessments and clear treatment categories.',
          evidence: 'Book Your Free Smile Assessment — Adult Aligners, Teen Braces & Flexible Payment Plans',
          evidenceRef: 'P1',
          sourceUrl: 'https://willowcreekortho.example/',
          evidenceType: 'VERIFIED_OBSERVATION',
          businessImpact:
            'Strong top-of-funnel clarity helps visitors quickly understand the first step, increasing the value of capturing their enquiry immediately.',
          recommendation:
            'Pair the primary consultation CTA with an interactive assistant that answers common insurance, payment-plan, and timeline questions on the spot.',
          priority: 'MEDIUM',
          confidence: 'HIGH',
          serviceTag: 'website-enquiry-assistant',
        },
        {
          title: 'Treatment FAQ depth could reduce repetitive reception calls',
          observation:
            'Prospective patients frequently ask about consultation duration, referral requirements, and payment plans before booking.',
          evidence: 'Frequently asked questions about aligner timelines and financing are spread across separate pages.',
          evidenceRef: 'P2',
          sourceUrl: 'https://willowcreekortho.example/treatments',
          evidenceType: 'AI_HYPOTHESIS',
          businessImpact:
            'Visitors who cannot locate a quick answer often call reception for basic logistical questions or leave without submitting an enquiry.',
          recommendation:
            'Deploy a structured FAQ and support assistant trained strictly on approved practice information, escalating personalised questions to coordinators.',
          priority: 'MEDIUM',
          confidence: 'MEDIUM',
          serviceTag: 'customer-support-knowledge',
        },
      ],
    },
    {
      category: 'Lead Capture & Conversion',
      status: 'OPPORTUNITIES_IDENTIFIED',
      summary:
        'Visitors can submit a general contact form or phone the clinic, but self-serve slot selection and instant qualification were not observed.',
      findings: [
        {
          title: 'Enquiry form relies on asynchronous callback without instant slot booking',
          observation:
            'The simulated contact page captures name, email, and message via a static enquiry form rather than connecting directly to consultation availability.',
          evidence: 'Request a Callback — Our treatment coordinator will call you within 1 to 2 business days.',
          evidenceRef: 'P5',
          sourceUrl: 'https://willowcreekortho.example/contact',
          evidenceType: 'VERIFIED_OBSERVATION',
          businessImpact:
            'Waiting 1–2 business days for a callback lowers consultation attendance when prospective patients are comparing multiple local clinics.',
          recommendation:
            'Connect enquiry submission directly to automated appointment scheduling and instant SMS/email confirmation with pre-visit reminders.',
          priority: 'HIGH',
          confidence: 'HIGH',
          serviceTag: 'appointment-booking-automation',
        },
        {
          title: 'Prospective patients cannot ask quick pre-booking questions via live website assistant',
          observation:
            'An interactive website enquiry widget was not observed on the inspected sample pages.',
          evidence: 'Not observed on the inspected sample pages during simulated crawl.',
          evidenceRef: 'chat_widget_present',
          sourceUrl: null,
          evidenceType: 'AI_HYPOTHESIS',
          businessImpact:
            'Evening and weekend browsers often prefer quick answers on parking, clinic locations, or referral rules before sharing phone numbers.',
          recommendation:
            'Add a focused Website Enquiry & Qualification Assistant that collects preferred clinic, patient age group, and contact preference for fast follow-up.',
          priority: 'HIGH',
          confidence: 'MEDIUM',
          serviceTag: 'website-enquiry-assistant',
        },
      ],
    },
    {
      category: 'Customer Experience & Enquiry Handling',
      status: 'NEEDS_ATTENTION',
      summary:
        'Customer-reported missed calls during clinic hours and manual follow-ups represent the highest-leverage operational improvement.',
      findings: [
        {
          title: 'Missed phone calls during busy chairside windows require automated recovery',
          observation:
            'Practice feedback indicates front-desk staff regularly miss inbound calls during morning and after-school rush periods.',
          evidence:
            'Customer reported missed phone calls and slow customer follow-ups as top operational challenges.',
          evidenceRef: 'questionnaire',
          sourceUrl: null,
          evidenceType: 'CUSTOMER_PROVIDED',
          businessImpact:
            'High-intent new-patient callers rarely leave voicemails and often call the next clinic on their list if they do not receive a timely response.',
          recommendation:
            'Implement an AI Receptionist & Voice Agent with automated missed-call SMS follow-up to capture caller intent and offer immediate booking links.',
          priority: 'HIGH',
          confidence: 'HIGH',
          serviceTag: 'ai-receptionist-voice',
        },
      ],
    },
    {
      category: 'Operations, CRM & Follow-Up',
      status: 'OPPORTUNITIES_IDENTIFIED',
      summary:
        'Manual copy-paste between email inbox, call logs, and spreadsheets leaves follow-ups inconsistent.',
      findings: [
        {
          title: 'Disconnected enquiry channels slow follow-up tracking and weekly visibility',
          observation:
            'Enquiries arriving by phone, web form, and email are currently tracked manually without unified CRM automation.',
          evidence:
            'Customer indicated manual administrative work and multiple disconnected tools across front-desk workflows.',
          evidenceRef: 'questionnaire',
          sourceUrl: null,
          evidenceType: 'CUSTOMER_PROVIDED',
          businessImpact:
            'Without unified CRM tagging and reminders, undecided consultation enquiries can slip through the cracks after an initial quote.',
          recommendation:
            'Centralise web and call enquiries into a structured CRM pipeline with automated 24-hour, 3-day, and 7-day follow-up nudges and weekly KPI summaries.',
          priority: 'HIGH',
          confidence: 'HIGH',
          serviceTag: 'lead-qualification-crm',
        },
      ],
    },
  ],
  automationOpportunities: [
    {
      title: 'Instant Missed-Call Recovery & Voice Reception',
      problem:
        'Front-desk coordinators cannot always answer concurrent phone calls during peak patient check-in windows or after hours.',
      proposedSolution:
        'Deploy an AI voice receptionist and instant SMS callback trigger that greets callers, captures consultation intent, and texts a self-serve booking link.',
      howItWorks: [
        'Inbound call rings reception first; unanswered or after-hours calls route cleanly to the AI receptionist.',
        'Assistant captures caller name, preferred clinic location, and whether the enquiry is for adult aligners or teen braces.',
        'Caller receives an immediate confirmation text with a consultation link, and the coordinator sees a structured summary.',
      ],
      businessBenefit:
        'Prevents high-intent callers from moving on to competing clinics while keeping staff focused on patients in the clinic.',
      priority: 'HIGH',
      implementationComplexity: 'MEDIUM',
      successMetric: 'Time from missed call to first automated patient response (target: under 60 seconds).',
      serviceTag: 'ai-receptionist-voice',
    },
    {
      title: 'CRM Lead Capture & Automated Consultation Follow-Up',
      problem:
        'Website form enquiries are copied manually from email into spreadsheets, creating inconsistent follow-up timing.',
      proposedSolution:
        'Connect website enquiry forms directly to the CRM with automated lead tagging, instant email/SMS acknowledgement, and coordinator task reminders.',
      howItWorks: [
        'Website form submission triggers webhook validation and creates a tagged lead record in the CRM.',
        'Prospect receives an immediate personalised confirmation with clinic directions and direct booking options.',
        'If unbooked after 48 hours, an automated check-in sequence nudges the prospect or assigns a coordinator call task.',
      ],
      businessBenefit:
        'Eliminates manual spreadsheet entry and creates consistent follow-up across every enquiry channel.',
      priority: 'HIGH',
      implementationComplexity: 'LOW',
      successMetric: 'Percentage of web enquiries logged in CRM with an automated first touch within 5 minutes.',
      serviceTag: 'lead-qualification-crm',
    },
    {
      title: 'Pre-Visit Reminder & No-Show Recovery Workflow',
      problem:
        'Manual reminder calls consume staff hours and occasional no-shows leave chair time unused.',
      proposedSolution:
        'Automate multi-step SMS/email appointment reminders with one-tap confirmation or rescheduling links.',
      howItWorks: [
        'Booked consultations trigger confirmation plus 48-hour and morning-of reminders.',
        'Patients confirm or request a new slot without needing a front-desk phone call.',
        'Cancelled slots automatically notify waitlisted prospects.',
      ],
      businessBenefit:
        'Protects clinician calendar utilisation and reduces repetitive confirmation calls.',
      priority: 'MEDIUM',
      implementationComplexity: 'LOW',
      successMetric: 'Confirmed attendance rate on initial smile assessments and coordinator hours saved weekly.',
      serviceTag: 'appointment-booking-automation',
    },
    {
      title: 'Weekly Practice Enquiry & Conversion Digest',
      problem:
        'Leadership lacks quick visibility into weekly call volume, web form conversion, and unanswered enquiries.',
      proposedSolution:
        'Generate an automated Monday morning operations summary consolidating enquiry sources, response speed, and booked assessments.',
      howItWorks: [
        'Pull aggregated counts from CRM stages, call logs, and booking confirmations.',
        'Format a concise weekly summary highlighting bottlenecks and follow-up tasks.',
      ],
      businessBenefit:
        'Replaces manual end-of-week spreadsheet compilation with clear operational visibility.',
      priority: 'LOW',
      implementationComplexity: 'LOW',
      successMetric: 'Automated weekly delivery with zero manual spreadsheet assembly.',
      serviceTag: 'reporting-ops-automation',
    },
  ],
  aiAgentRecommendations: [
    {
      name: 'After-Hours & Overflow AI Receptionist',
      purpose:
        'Handles overflow and after-hours calls politely, answers non-clinical logistics questions, and captures consultation requests.',
      workflow: [
        'Inbound call overflow or after-hours trigger',
        'Greets caller & identifies location/service interest',
        'Answers hours, parking & payment-plan FAQs',
        'Sends booking link via SMS & logs summary',
        'Human coordinator handoff for complex requests',
      ],
      expectedBenefit:
        'Ensures every caller receives an immediate, helpful experience without adding evening staffing.',
      serviceTag: 'ai-receptionist-voice',
    },
    {
      name: 'Website Smile Assessment Concierge',
      purpose:
        'Guides website visitors from treatment pages to a qualified consultation request using approved practice FAQs.',
      workflow: [
        'Visitor clicks consultation or FAQ prompt',
        'Collects teen/adult category & preferred location',
        'Shares approved financing & visit prep info',
        'Offers direct calendar slot or callback request',
        'Coordinator CRM handoff with intake notes',
      ],
      expectedBenefit:
        'Converts passive website browsers into structured, high-context consultation bookings.',
      serviceTag: 'website-enquiry-assistant',
    },
    {
      name: 'Treatment Coordinator Follow-Up Assistant',
      purpose:
        'Drafts personalised post-enquiry check-ins and organises daily callback priorities inside the CRM.',
      workflow: [
        'New enquiry or unbooked assessment trigger',
        'Checks CRM status & prior touchpoints',
        'Prepares personalised SMS/email draft',
        'Human coordinator approves or triggers automated cadence',
      ],
      expectedBenefit:
        'Keeps follow-ups timely and personal while eliminating manual inbox triage.',
      serviceTag: 'lead-qualification-crm',
    },
  ],
  businessRoadmap: {
    first30Days: [
      'Connect website enquiry forms to a unified CRM pipeline with instant acknowledgement messages.',
      'Enable missed-call SMS text-back so unanswered calls receive an immediate helpful reply.',
      'Launch a structured FAQ and consultation pre-qualification widget on primary treatment pages.',
    ],
    days31To60: [
      'Roll out automated consultation scheduling links and 48-hour / day-of appointment reminders.',
      'Configure AI receptionist overflow handling for peak clinic call windows.',
      'Establish automated follow-up sequences for prospects who enquire but do not book immediately.',
    ],
    days61To90: [
      'Activate automated weekly enquiry-to-consultation conversion reporting for practice leadership.',
      'Add post-visit patient feedback and review-invitation workflows.',
      'Review conversation transcripts and refine AI assistant phrasing with front-desk coordinators.',
    ],
  },
  assumptions: [
    'This report is an illustrative sample for a fictional practice (Willow Creek Orthodontics) to demonstrate report depth and evidence labelling.',
    'All automation workflows assume final confirmation and clinical or sensitive patient records remain inside approved practice systems.',
    'Suggested workflows include human coordinator handoff for unusual requests, rescheduling exceptions, and complex enquiries.',
  ],
  limitations: [
    'Illustrative sample only — no real clinic website was crawled and no live patient or call metrics were measured.',
    'Exact CRM and practice-management software integration paths require a brief technical discovery check during consultation.',
    'This audit does not evaluate clinical workflows, regulatory compliance, or paid advertising spend performance.',
  ],
  recommendedNextSteps: [
    'Review the top three high-priority opportunities with your front-desk lead to confirm which bottleneck feels most urgent.',
    'Book a 20-minute strategy call with Amarketing to walk through a live demonstration tailored to your own business website.',
    'Start with a focused 30-day pilot (such as missed-call recovery and CRM enquiry routing) before expanding into additional workflows.',
  ],
  closingMessage:
    'Even small improvements in enquiry response speed and follow-up consistency compound quickly across a busy practice. When you are ready, our team can run a personalised audit on your real website and help you map out a practical, low-disruption first pilot.',
};

export const WILLOW_CREEK_SAMPLE_REPORT: AuditReport = AuditReportSchema.parse(rawSampleReport);

export const WILLOW_CREEK_SAMPLE_CHALLENGES: string[] = [
  'Missed phone calls',
  'Slow customer follow-ups',
  'Manual administrative work',
];

export const WILLOW_CREEK_SAMPLE_ROI_INPUTS: RoiInputs = {
  currency: 'USD',
  monthlyAdminTasks: 500,
  minutesPerAdminTask: 8,
  hourlyCost: 25,
  monthlyFollowUps: 200,
  minutesPerFollowUp: 6,
  monthlyMissedCalls: 60,
  conversionRatePct: 20,
  grossProfitPerCustomer: 400,
};

export const WILLOW_CREEK_SAMPLE_SCENARIOS: Record<ScenarioKey, RoiScenario> = {
  conservative: {
    key: 'conservative',
    label: 'Conservative',
    adminAutomationPct: 25,
    missedCallRecoverPct: 20,
    followUpAutomationPct: 25,
  },
  moderate: {
    key: 'moderate',
    label: 'Moderate',
    adminAutomationPct: 60,
    missedCallRecoverPct: 50,
    followUpAutomationPct: 50,
  },
  optimistic: {
    key: 'optimistic',
    label: 'Optimistic',
    adminAutomationPct: 75,
    missedCallRecoverPct: 60,
    followUpAutomationPct: 75,
  },
};

export function getWillowCreekSampleRoiOutputs(
  inputs: RoiInputs = WILLOW_CREEK_SAMPLE_ROI_INPUTS,
  scenarios: Record<ScenarioKey, RoiScenario> = WILLOW_CREEK_SAMPLE_SCENARIOS,
): Record<ScenarioKey, RoiOutputs> {
  return calculateAllScenarios(inputs, scenarios);
}

