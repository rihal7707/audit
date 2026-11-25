const PLAYBOOKS: Record<string, string[]> = {
  Dental: [
    'After-hours missed-call capture and automated SMS/WhatsApp follow-up for new patient enquiries.',
    'Pre-consultation FAQ automation for insurance, payment plans, opening hours, and appointment preparation.',
    'Recall, hygiene re-booking, and no-show reduction workflows connected to practice management/CRM.',
  ],
  Orthodontics: [
    'Speed-to-lead qualification for Invisalign/aligner and braces consultation enquiries.',
    'Guided pre-assessment intake before consultation booking (patient age bracket, preferred clinic location, timeframe).',
    'Automated missed-call text-back and multi-touch consultation reminder sequences.',
  ],
  Healthcare: [
    'Non-clinical enquiry triage routing visitors to booking, locations, hours, or administrative team handoff.',
    'Reducing front-desk phone load through automated FAQ handling for parking, referrals, and hours.',
    'Structured referral and appointment follow-up tracking without exposing sensitive clinical data.',
  ],
  Wellness: [
    'Instant booking assistance for consultations, intro packages, and class/session scheduling.',
    'Automated post-enquiry nurture for prospects comparing memberships or treatment packages.',
    'Review request and re-booking workflows for returning clients.',
  ],
  'Professional Services': [
    'Automated consultation qualification (scope, budget tier, urgency) prior to partner calendar booking.',
    'Enquiry routing and CRM logging from web forms, email, and phone into structured deal stages.',
    'Client onboarding checklist automation and weekly pipeline summary reporting.',
  ],
  'Real Estate': [
    'Immediate speed-to-lead response on property, valuation, and rental enquiries after hours.',
    'Buyer/seller/landlord qualification assistant feeding structured records straight into CRM.',
    'Automated inspection reminders and seller follow-up reporting.',
  ],
  'E-commerce': [
    'Order-status, shipping, and returns FAQ automation reducing repetitive support tickets.',
    'Pre-purchase product guidance and quote capture for wholesale or high-ticket enquiries.',
    'Post-purchase review and replenishment lifecycle automation.',
  ],
  Education: [
    'Prospective student / parent enquiry handling for course dates, fees, and campus visits.',
    'Automated tour/admissions call booking and multi-step enrolment reminder workflows.',
    'Internal knowledge assistant for admissions staff answering policy and curriculum questions.',
  ],
  'Financial Services': [
    'Structured pre-qualification intake before advisor discovery calls (never giving regulated advice).',
    'Document-checklist reminders and meeting preparation workflows ahead of consultations.',
    'Centralised enquiry tracking across web forms, phone calls, and referral partners.',
  ],
  'Marketing Agency': [
    'Lead qualification and discovery call scheduling for inbound retainers and audits.',
    'Automated client onboarding, brief collection, and recurring weekly performance reporting.',
    'Internal SOP and proposal knowledge assistant for account managers.',
  ],
  Other: [
    'Instant enquiry capture and qualification across website forms, messaging, and missed phone calls.',
    'CRM pipeline integration eliminating manual copy-paste between inbox, spreadsheets, and calendars.',
    'Automated appointment reminders, follow-up sequences, and management reporting.',
  ],
};

export function getIndustryPlaybook(industry: string): string[] {
  return PLAYBOOKS[industry] ?? PLAYBOOKS.Other!;
}

