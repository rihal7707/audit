export interface AmarketingService {
  id: string;
  name: string;
  category: string;
  summary: string;
}

export const AMARKETING_SERVICES: readonly AmarketingService[] = [
  {
    id: 'ai-receptionist-voice',
    name: 'AI Receptionist & Voice Agent',
    category: 'Enquiry & Call Handling',
    summary:
      'Answers inbound calls and after-hours enquiries, captures caller intent, answers common questions, and routes urgent requests with human handoff.',
  },
  {
    id: 'website-enquiry-assistant',
    name: 'Website Enquiry & Qualification Assistant',
    category: 'Lead Capture',
    summary:
      'Conversational website assistant trained on approved business information to guide visitors, qualify enquiries, and collect structured intake details.',
  },
  {
    id: 'lead-qualification-crm',
    name: 'Lead Qualification & CRM Workflow Automation',
    category: 'CRM & Follow-Up',
    summary:
      'Connects web forms, call logs, and inbox enquiries directly to your CRM with automated tagging, routing, and timely multi-channel follow-ups.',
  },
  {
    id: 'appointment-booking-automation',
    name: 'Appointment Booking & Reminder Automation',
    category: 'Scheduling & Retention',
    summary:
      'Streamlines consultation scheduling, calendar syncing, pre-visit reminders, rescheduling flows, and missed-appointment re-engagement.',
  },
  {
    id: 'customer-support-knowledge',
    name: 'Customer Support & Internal Knowledge Assistant',
    category: 'Operations & Support',
    summary:
      'Reduces repetitive FAQ responses and equips staff with instant answers drawn from approved SOPs, service guides, and pricing documentation.',
  },
  {
    id: 'marketing-content-automation',
    name: 'Marketing & Lifecycle Follow-Up Automation',
    category: 'Marketing & Growth',
    summary:
      'Automates post-enquiry nurture sequences, review requests, and campaign reporting workflows connected to real enquiry outcomes.',
  },
  {
    id: 'reporting-ops-automation',
    name: 'Executive Reporting & Operations Automation',
    category: 'Reporting & Analytics',
    summary:
      'Consolidates enquiry volume, response speed, booking conversion, and operational tasks into automated weekly summaries.',
  },
] as const;

export const VALID_SERVICE_IDS = new Set<string>(AMARKETING_SERVICES.map((s) => s.id));

export function getServiceById(id: string): AmarketingService | undefined {
  return AMARKETING_SERVICES.find((s) => s.id === id);
}

