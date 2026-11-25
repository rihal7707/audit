import {
  CORE_OFFERING_CHALLENGES,
  PRIORITY_INDUSTRIES,
} from '@/lib/config/industries';
import type { CrawlCoverage, LeadPriority } from '@/lib/db/schema';

export interface LeadScoringInput {
  industry: string;
  challenges: string[];
  goals: string[];
  manualProcesses?: string | null;
  contactRole?: string | null;
  timeframe?: string | null;
  consultRequestedAt?: string | null;
  pilotRequestedAt?: string | null;
  bookingClickedAt?: string | null;
  contactPhone?: string | null;
  marketingConsent?: boolean;
  crawlCoverage?: CrawlCoverage | null;
  enquiryVolume?: string | null;
  phoneVolume?: string | null;
  toolsUsed?: string | null;
}

export interface LeadFactorScore {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  reason: string;
}

export interface LeadQualificationResult {
  totalScore: number;
  priority: LeadPriority;
  classificationReason: string;
  breakdown: LeadFactorScore[];
}

const SENIOR_ROLE_REGEX =
  /\b(?:owner|founder|co-founder|ceo|chief executive|managing director|md|principal|partner|director|president)\b/i;
const MID_ROLE_REGEX = /\b(?:manager|head|operations|ops|marketing|lead|coordinator)\b/i;

export function qualifyLead(input: LeadScoringInput): LeadQualificationResult {
  const breakdown: LeadFactorScore[] = [];

  // 1. Clear business need (max 25)
  const challengeCount = input.challenges.length;
  let challengePts = 0;
  if (challengeCount >= 3) challengePts = 15;
  else if (challengeCount >= 1) challengePts = 10;

  const hasGoal = input.goals.length >= 1;
  const goalPts = hasGoal ? 5 : 0;

  const hasManualProcesses = Boolean(input.manualProcesses && input.manualProcesses.trim().length > 0);
  const manualPts = hasManualProcesses ? 5 : 0;

  const needScore = Math.min(25, challengePts + goalPts + manualPts);
  breakdown.push({
    key: 'business_need',
    label: 'Clear business need',
    score: needScore,
    maxScore: 25,
    reason: `${challengeCount} challenge(s) selected (${challengePts} pts), ${hasGoal ? 'goals specified (+5)' : 'no goals (+0)'}, ${hasManualProcesses ? 'manual workflows described (+5)' : 'manual workflows blank (+0)'}.`,
  });

  // 2. Relevance to Amarketing services (max 20)
  const isPriorityInd = PRIORITY_INDUSTRIES.has(input.industry);
  const industryPts = isPriorityInd ? 8 : input.industry === 'Other' ? 2 : 5;

  const overlappingChallenges = input.challenges.filter((c) => CORE_OFFERING_CHALLENGES.has(c));
  const overlapPts =
    overlappingChallenges.length >= 2 ? 12 : overlappingChallenges.length === 1 ? 6 : 0;

  const relevanceScore = Math.min(20, industryPts + overlapPts);
  breakdown.push({
    key: 'service_relevance',
    label: 'Relevance to Amarketing services',
    score: relevanceScore,
    maxScore: 20,
    reason: `Industry "${input.industry}" (${industryPts} pts); ${overlappingChallenges.length} core-offering challenge overlap(s) (${overlapPts} pts).`,
  });

  // 3. Decision-maker (max 15)
  const role = (input.contactRole ?? '').trim();
  let roleScore = 2;
  let roleReason = 'Role unspecified or non-leadership (+2 pts).';
  if (SENIOR_ROLE_REGEX.test(role)) {
    roleScore = 15;
    roleReason = `Senior decision-maker role "${role}" (+15 pts).`;
  } else if (MID_ROLE_REGEX.test(role)) {
    roleScore = 8;
    roleReason = `Management/operations role "${role}" (+8 pts).`;
  }
  breakdown.push({
    key: 'decision_maker',
    label: 'Decision-maker authority',
    score: roleScore,
    maxScore: 15,
    reason: roleReason,
  });

  // 4. Implementation timeframe (max 15)
  const tf = (input.timeframe ?? '').trim();
  let tfScore = 0;
  if (tf === 'As soon as possible') tfScore = 15;
  else if (tf === 'Within 1–3 months' || tf === 'Within 1-3 months') tfScore = 10;
  else if (tf === 'Within 3–6 months' || tf === 'Within 3-6 months') tfScore = 5;
  else if (tf === 'Just exploring' || tf === 'Not sure') tfScore = 2;
  breakdown.push({
    key: 'timeframe',
    label: 'Implementation timeframe',
    score: tfScore,
    maxScore: 15,
    reason: tf ? `Selected timeframe "${tf}" (${tfScore} pts).` : 'No timeframe selected (0 pts).',
  });

  // 5. Interest in discussing implementation (max 15)
  const requestedImpl = Boolean(input.consultRequestedAt || input.pilotRequestedAt);
  const clickedBooking = Boolean(input.bookingClickedAt);
  const hasPhoneOrMarketing = Boolean(
    (input.contactPhone && input.contactPhone.trim().length > 0) || input.marketingConsent,
  );

  let interestPts = 0;
  const interestReasons: string[] = [];
  if (requestedImpl) {
    interestPts += 15;
    interestReasons.push('consultation or pilot requested (+15)');
  } else if (clickedBooking) {
    interestPts += 8;
    interestReasons.push('booking link clicked (+8)');
  }
  if (hasPhoneOrMarketing) {
    interestPts += 5;
    interestReasons.push('phone or marketing consent provided (+5)');
  }
  const interestScore = Math.min(15, interestPts);
  breakdown.push({
    key: 'implementation_interest',
    label: 'Interest in discussing implementation',
    score: interestScore,
    maxScore: 15,
    reason:
      interestReasons.length > 0
        ? `${interestReasons.join(', ')} (capped at 15).`
        : 'No booking intent or phone/marketing opt-in yet (0 pts).',
  });

  // 6. Information sufficiency (max 10)
  const crawlPts =
    input.crawlCoverage === 'COMPLETE' || input.crawlCoverage === 'PARTIAL' ? 5 : 0;
  const hasVolumes = Boolean(
    (input.enquiryVolume && input.enquiryVolume !== 'Not sure') ||
      (input.phoneVolume && input.phoneVolume !== 'Not sure'),
  );
  const volumePts = hasVolumes ? 3 : 0;
  const hasTools = Boolean(input.toolsUsed && input.toolsUsed.trim().length > 0);
  const toolsPts = hasTools ? 2 : 0;
  const sufficiencyScore = Math.min(10, crawlPts + volumePts + toolsPts);
  breakdown.push({
    key: 'info_sufficiency',
    label: 'Information sufficiency',
    score: sufficiencyScore,
    maxScore: 10,
    reason: `Website crawl ${input.crawlCoverage ?? 'PENDING'} (${crawlPts} pts), volumes ${hasVolumes ? 'provided (+3)' : 'unknown (+0)'}, current tools ${hasTools ? 'provided (+2)' : 'blank (+0)'}.`,
  });

  const totalScore = breakdown.reduce((sum, item) => sum + item.score, 0);
  const priority: LeadPriority =
    totalScore >= 70 ? 'HOT' : totalScore >= 40 ? 'WARM' : 'NURTURE';

  const classificationReason =
    priority === 'HOT'
      ? `Score ${totalScore}/100 (>= 70): High fit and strong implementation readiness.`
      : priority === 'WARM'
        ? `Score ${totalScore}/100 (40–69): Solid automation relevance; nurture or schedule discovery.`
        : `Score ${totalScore}/100 (< 40): Exploratory or limited qualification signals.`;

  return {
    totalScore,
    priority,
    classificationReason,
    breakdown,
  };
}

