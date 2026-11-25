import { type NextRequest } from 'next/server';
import {
  findAuditByPublicToken,
  listAuditPages,
} from '@/lib/db/repositories/audits.repo';
import { PIPELINE_STAGES_METADATA } from '@/lib/pipeline/run-audit';
import { apiError, apiSuccess, createRequestId } from '@/lib/http/api-helpers';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const requestId = createRequestId();
  const { token } = await context.params;

  const audit = await findAuditByPublicToken(token);
  if (!audit) {
    return apiError('Audit not found.', 404, requestId);
  }

  const pages = await listAuditPages(audit.id);
  const nowMs = Date.now();
  const createdMs = new Date(audit.createdAt).getTime();
  const elapsedSeconds = Number.isNaN(createdMs)
    ? 0
    : Math.max(0, Math.floor((nowMs - createdMs) / 1000));

  const isFailed = audit.auditStatus === 'FAILED';
  const isWaitingQuota = audit.auditStatus === 'WAITING_FOR_QUOTA';
  const isPendingReview = audit.auditStatus === 'PENDING_REVIEW';
  const isCompleted =
    audit.auditStatus === 'COMPLETED' || audit.auditStatus === 'COMPLETED_LIMITED';
  const isQueued = audit.auditStatus === 'QUEUED';

  const stages = PIPELINE_STAGES_METADATA.map((stage) => {
    let state: 'pending' | 'active' | 'done' | 'skipped' | 'failed' = 'pending';

    if (isCompleted || isPendingReview) {
      if (
        (audit.crawlCoverage === 'NONE' || audit.crawlCoverage === 'LIMITED') &&
        stage.index === 3 &&
        pages.length === 0
      ) {
        state = 'skipped';
      } else {
        state = 'done';
      }
    } else if (isFailed) {
      if (stage.index < audit.currentStageIndex) state = 'done';
      else if (stage.index === audit.currentStageIndex) state = 'failed';
      else state = 'pending';
    } else if (isWaitingQuota) {
      if (stage.index < 6) state = 'done';
      else if (stage.index === 6) state = 'active';
      else state = 'pending';
    } else if (audit.currentStageIndex > 0) {
      if (stage.index < audit.currentStageIndex) state = 'done';
      else if (stage.index === audit.currentStageIndex) state = 'active';
      else state = 'pending';
    }

    return {
      index: stage.index,
      key: stage.key,
      label: stage.label,
      state,
    };
  });

  const retriable =
    (isFailed || isWaitingQuota) && audit.retryCount < 5;

  const canOpenReport =
    (isCompleted || Boolean(audit.reportJson)) &&
    audit.releaseStatus !== 'PENDING_REVIEW' &&
    audit.releaseStatus !== 'REVOKED';

  return apiSuccess(
    {
      publicToken: audit.publicToken,
      businessName: audit.businessName,
      website: audit.website,
      auditStatus: audit.auditStatus,
      releaseStatus: audit.releaseStatus,
      crawlCoverage: audit.crawlCoverage,
      currentStageIndex: audit.currentStageIndex,
      currentStageLabel: audit.currentStageLabel,
      pagesCount: pages.length,
      pagesOkCount: pages.filter((p) => p.extractionStatus === 'OK').length,
      elapsedSeconds,
      isQueued,
      isWaitingQuota,
      isPendingReview,
      isCompleted,
      isFailed,
      retriable,
      lastError: audit.lastError,
      reportUrl: canOpenReport ? `/report/${audit.publicToken}` : null,
      stages,
    },
    200,
    requestId,
  );
}

