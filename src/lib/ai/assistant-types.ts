// src/lib/ai/assistant-types.ts
// Shared types & suggested question chips (safe for client and server components)

export interface SuggestedChip {
  id: string;
  label: string;
  question: string;
}

export const SUGGESTED_ASSISTANT_CHIPS: readonly SuggestedChip[] = [
  {
    id: 'biggest-opportunity',
    label: 'Biggest opportunity',
    question: 'What is our biggest automation opportunity from this audit?',
  },
  {
    id: 'admin-time',
    label: 'Reclaimable admin time',
    question: 'How much administrative time could we reclaim based on the ROI simulator?',
  },
  {
    id: 'ai-receptionist',
    label: 'How AI receptionist works',
    question: 'How would an AI receptionist work for our business without losing a human touch?',
  },
  {
    id: 'missed-calls',
    label: 'Missed-call follow-ups',
    question: 'How do automated missed-call follow-ups work?',
  },
  {
    id: 'implement-first',
    label: 'What to do first',
    question: 'What should we implement first for the cleanest operational win?',
  },
  {
    id: 'explain-roi',
    label: 'Explain the ROI numbers',
    question: 'Explain the ROI calculation, formulas, and assumptions in plain language.',
  },
  {
    id: 'first-30-days',
    label: 'First 30 days',
    question: 'What does the first 30 days of the roadmap look like?',
  },
  {
    id: 'human-handoff',
    label: 'Human handoff & guardrails',
    question: 'How do human handoffs and privacy guardrails work with these automations?',
  },
];

export interface AssistantCta {
  show: boolean;
  label: string;
  type: 'CONSULTATION' | 'PILOT' | 'BOOKING';
}

export interface AssistantResponsePayload {
  answer: string;
  relatedFindingIds: string[];
  relatedOpportunityIds: string[];
  suggestedFollowUpQuestions: string[];
  cta: AssistantCta;
}

export interface AssistantFindingRef {
  id: string;
  title: string;
  priority: string;
  sectionCategory: string;
  cardId: string;
}

export interface AssistantOpportunityRef {
  id: string;
  title: string;
  priority: string;
  serviceTag: string;
}

export interface AssistantMessageDto {
  id: string;
  role: 'user' | 'assistant';
  message: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  redacted?: boolean;
  relatedFindingIds?: string[];
  relatedOpportunityIds?: string[];
  suggestedFollowUpQuestions?: string[];
  cta?: AssistantCta;
}

export interface AssistantHistoryDto {
  enabled: boolean;
  configured: boolean;
  unavailableReason?: string;
  conversationId: number | null;
  conversationToken: string | null;
  remainingMessages: number;
  maxMessages: number;
  maxMessageChars: number;
  messages: AssistantMessageDto[];
  findingsLookup: Record<string, AssistantFindingRef>;
  opportunitiesLookup: Record<string, AssistantOpportunityRef>;
}
