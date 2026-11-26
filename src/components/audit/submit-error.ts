// src/components/audit/submit-error.ts
export interface ClassifiedSubmitError {
  message: string;
  fieldErrors?: Record<string, string>;
}

export function classifyAuditSubmitResponse(params: {
  status: number;
  headerRequestId?: string | null;
  rawText: string;
}): ClassifiedSubmitError {
  let json: Record<string, unknown> | null = null;
  if (params.rawText) {
    try {
      json = JSON.parse(params.rawText) as Record<string, unknown>;
    } catch {
      json = null;
    }
  }

  const reqId =
    typeof json?.requestId === 'string' ? json.requestId : params.headerRequestId || null;
  const serverMsg = typeof json?.error === 'string' ? json.error : null;
  const code = typeof json?.code === 'string' ? json.code : null;

  if (json?.fieldErrors && typeof json.fieldErrors === 'object') {
    return {
      message: serverMsg || 'Please review the highlighted fields before submitting.',
      fieldErrors: json.fieldErrors as Record<string, string>,
    };
  }

  if (!json) {
    return {
      message: `Server error while submitting your audit (HTTP ${params.status}, non-JSON response). Please check server logs and retry.`,
    };
  }

  if (code === 'DATABASE_NOT_CONFIGURED' || code === 'KEY_NOT_CONFIGURED') {
    return {
      message: `${serverMsg || code}${reqId ? ` (${code}, Request ID: ${reqId})` : ` (${code})`}`,
    };
  }

  if (params.status >= 500) {
    return {
      message: `${serverMsg || 'Server error while preparing your audit.'}${reqId ? ` (Request ID: ${reqId})` : ` (HTTP ${params.status})`}`,
    };
  }

  return {
    message: `${serverMsg || `Could not submit your audit (HTTP ${params.status}).`}${reqId ? ` (Request ID: ${reqId})` : ''}`,
  };
}
