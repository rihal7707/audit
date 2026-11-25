export interface IndustryOption {
  value: string;
  label: string;
  isPriority: boolean;
}

export const INDUSTRIES: readonly IndustryOption[] = [
  { value: 'Dental', label: 'Dental', isPriority: true },
  { value: 'Orthodontics', label: 'Orthodontics', isPriority: true },
  { value: 'Healthcare', label: 'Healthcare', isPriority: true },
  { value: 'Wellness', label: 'Wellness', isPriority: true },
  { value: 'Professional Services', label: 'Professional Services', isPriority: true },
  { value: 'Real Estate', label: 'Real Estate', isPriority: true },
  { value: 'E-commerce', label: 'E-commerce', isPriority: false },
  { value: 'Education', label: 'Education', isPriority: true },
  { value: 'Financial Services', label: 'Financial Services', isPriority: true },
  { value: 'Marketing Agency', label: 'Marketing Agency', isPriority: false },
  { value: 'Other', label: 'Other', isPriority: false },
] as const;

export const INDUSTRY_VALUES = INDUSTRIES.map((i) => i.value) as [string, ...string[]];

export const PRIORITY_INDUSTRIES = new Set<string>(
  INDUSTRIES.filter((i) => i.isPriority).map((i) => i.value),
);

export const CHALLENGE_OPTIONS = [
  'Managing customer enquiries',
  'Missed phone calls',
  'Slow customer follow-ups',
  'Appointment management',
  'Manual administrative work',
  'Lead generation',
  'Customer support',
  'CRM management',
  'Marketing and content',
  'Reporting and documentation',
  'Multiple disconnected tools',
  'Other',
] as const;

export const CORE_OFFERING_CHALLENGES = new Set<string>([
  'Managing customer enquiries',
  'Missed phone calls',
  'Slow customer follow-ups',
  'Appointment management',
  'Manual administrative work',
  'CRM management',
]);

export const GOAL_OPTIONS = [
  'Generate more leads',
  'Improve enquiry conversion',
  'Reduce repetitive manual work',
  'Improve customer experience',
  'Automate appointments and bookings',
  'Improve sales follow-ups',
  'Reduce operational costs',
  'Scale the business',
] as const;

export const BUSINESS_SIZE_OPTIONS = [
  'Solo / 1 person',
  '2–5 team members',
  '6–15 team members',
  '16–50 team members',
  '51–200 team members',
  '200+ team members',
] as const;

export const VOLUME_RANGE_OPTIONS = [
  'Under 25 / month',
  '25–100 / month',
  '100–300 / month',
  '300–1,000 / month',
  '1,000+ / month',
  'Not sure',
] as const;

export const TIMEFRAME_OPTIONS = [
  'As soon as possible',
  'Within 1–3 months',
  'Within 3–6 months',
  'Just exploring',
  'Not sure',
] as const;

