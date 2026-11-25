import * as React from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Lightbulb,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BadgeBaseProps {
  children: React.ReactNode;
  className?: string;
}

function Pill({ children, className }: BadgeBaseProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-tight',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: 'HIGH' | 'MEDIUM' | 'LOW' | string }) {
  if (priority === 'HIGH') {
    return (
      <Pill className="bg-red-50 text-red-700 border border-red-200/80">
        HIGH PRIORITY
      </Pill>
    );
  }
  if (priority === 'MEDIUM') {
    return (
      <Pill className="bg-amber-50 text-amber-800 border border-amber-200/80">
        MEDIUM PRIORITY
      </Pill>
    );
  }
  return (
    <Pill className="bg-slate-100 text-slate-700 border border-slate-200">
      LOW PRIORITY
    </Pill>
  );
}

export function EvidenceTypeBadge({
  type,
}: {
  type: 'VERIFIED_OBSERVATION' | 'CUSTOMER_PROVIDED' | 'AI_HYPOTHESIS' | string;
}) {
  if (type === 'VERIFIED_OBSERVATION') {
    return (
      <Pill className="bg-emerald-50 text-emerald-800 border border-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
        <span>Verified observation</span>
      </Pill>
    );
  }
  if (type === 'CUSTOMER_PROVIDED') {
    return (
      <Pill className="bg-blue-50 text-blue-800 border border-blue-200">
        <User className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
        <span>Customer-provided</span>
      </Pill>
    );
  }
  return (
    <Pill className="bg-violet-50 text-violet-800 border border-violet-200">
      <Lightbulb className="h-3.5 w-3.5 text-violet-600" aria-hidden="true" />
      <span>AI hypothesis</span>
    </Pill>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: 'HIGH' | 'MEDIUM' | 'LOW' | string }) {
  return (
    <Pill className="bg-subtle text-muted border border-border">
      Confidence: {confidence}
    </Pill>
  );
}

export function SectionStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'STRONG_SIGNALS':
      return (
        <Pill className="bg-emerald-50 text-emerald-800 border border-emerald-200">
          <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          <span>Strong public signals</span>
        </Pill>
      );
    case 'NEEDS_ATTENTION':
      return (
        <Pill className="bg-red-50 text-red-700 border border-red-200">
          <AlertTriangle className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
          <span>Needs attention</span>
        </Pill>
      );
    case 'INSUFFICIENT_INFORMATION':
      return (
        <Pill className="bg-slate-100 text-slate-700 border border-slate-200">
          <span>Insufficient information</span>
        </Pill>
      );
    default:
      return (
        <Pill className="bg-amber-50 text-amber-800 border border-amber-200">
          <span>Opportunities identified</span>
        </Pill>
      );
  }
}

export function LeadPriorityBadge({ priority }: { priority: 'HOT' | 'WARM' | 'NURTURE' | string }) {
  if (priority === 'HOT') {
    return <Pill className="bg-red-50 text-red-700 border border-red-200">HOT</Pill>;
  }
  if (priority === 'WARM') {
    return <Pill className="bg-amber-50 text-amber-800 border border-amber-200">WARM</Pill>;
  }
  return <Pill className="bg-slate-100 text-slate-700 border border-slate-200">NURTURE</Pill>;
}

export function AuditStatusBadge({ status }: { status: string }) {
  if (status === 'COMPLETED') {
    return <Pill className="bg-emerald-50 text-emerald-800 border border-emerald-200">Completed</Pill>;
  }
  if (status === 'COMPLETED_LIMITED') {
    return <Pill className="bg-amber-50 text-amber-800 border border-amber-200">Limited coverage</Pill>;
  }
  if (status === 'PENDING_REVIEW') {
    return <Pill className="bg-blue-50 text-blue-800 border border-blue-200">Pending review</Pill>;
  }
  if (status === 'WAITING_FOR_QUOTA') {
    return <Pill className="bg-amber-50 text-amber-800 border border-amber-200">Waiting for quota</Pill>;
  }
  if (status === 'FAILED') {
    return <Pill className="bg-red-50 text-red-700 border border-red-200">Failed</Pill>;
  }
  if (status === 'QUEUED') {
    return <Pill className="bg-slate-100 text-slate-700 border border-slate-200">Queued</Pill>;
  }
  return (
    <Pill className="bg-blue-50 text-blue-800 border border-blue-200">
      {status.replace(/_/g, ' ').toLowerCase()}
    </Pill>
  );
}

export function PipelineStageBadge({ stage }: { stage: string }) {
  const labels: Record<string, string> = {
    NEW: 'New',
    ANALYSIS_IN_PROGRESS: 'Analysing',
    REPORT_GENERATED: 'Report generated',
    QUALIFIED: 'Qualified',
    CONSULTATION_BOOKED: 'Consultation booked',
    PILOT_DISCUSSION: 'Pilot discussion',
    PROPOSAL_SENT: 'Proposal sent',
    CONVERTED: 'Converted',
    NOT_INTERESTED: 'Not interested',
  };

  const styles: Record<string, string> = {
    CONVERTED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    QUALIFIED: 'bg-blue-50 text-blue-800 border-blue-200',
    CONSULTATION_BOOKED: 'bg-teal-50 text-teal-800 border-teal-200',
    PILOT_DISCUSSION: 'bg-violet-50 text-violet-800 border-violet-200',
    PROPOSAL_SENT: 'bg-amber-50 text-amber-800 border-amber-200',
    NOT_INTERESTED: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <Pill className={cn('border', styles[stage] || 'bg-subtle text-ink border-border')}>
      {labels[stage] || stage}
    </Pill>
  );
}

