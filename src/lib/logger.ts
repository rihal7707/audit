import 'server-only';
import pino from 'pino';

const isTest = process.env.NODE_ENV === 'test';

export const logger = pino({
  level: isTest ? 'silent' : process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'apiKey',
      'GEMINI_API_KEY',
      'ADMIN_PASSWORD',
      'ADMIN_PASSWORD_HASH',
      'ADMIN_SESSION_SECRET',
      'DATABASE_AUTH_TOKEN',
      'CRON_SECRET',
      'RESEND_API_KEY',
      'TURNSTILE_SECRET_KEY',
      'password',
      'token',
      'publicToken',
      'authorization',
      'cookie',
      'contactName',
      'contactEmail',
      'contactPhone',
      'email',
      'phone',
      '*.contactEmail',
      '*.contactPhone',
      '*.contactName',
      '*.password',
      '*.apiKey',
    ],
    censor: '[REDACTED]',
  },
  base: {
    service: 'amarketing-audit',
  },
});

export function createRequestLogger(requestId: string, context?: Record<string, unknown>) {
  return logger.child({ requestId, ...context });
}

