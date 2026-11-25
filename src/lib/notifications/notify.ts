import 'server-only';
import { getEnv, isEmailConfigured } from '@/lib/env';
import { brandConfig } from '@/lib/config/brand';
import { logger } from '@/lib/logger';

export interface NotificationPayload {
  event: 'NEW_AUDIT' | 'HOT_LEAD' | 'CUSTOMER_INTENT' | 'REPORT_READY';
  auditId: number;
  businessName: string;
  industry: string;
  publicToken?: string;
  intentType?: string;
  customerEmail?: string;
}

async function postWebhook(message: string): Promise<void> {
  const env = getEnv();
  if (!env.NOTIFY_WEBHOOK_URL) return;
  try {
    await fetch(env.NOTIFY_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message, content: message }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    logger.warn({ err }, 'Webhook notification failed (non-blocking)');
  }
}

async function sendResendEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const env = getEnv();
  if (!isEmailConfigured()) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to: [params.to],
        subject: params.subject,
        text: params.text,
      }),
      signal: AbortSignal.timeout(6000),
    });
  } catch (err) {
    logger.warn({ err }, 'Email notification failed (non-blocking)');
  }
}

export async function sendNonBlockingNotification(payload: NotificationPayload): Promise<void> {
  const env = getEnv();
  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  const adminUrl = `${baseUrl}/admin/audits/${payload.auditId}`;

  if (payload.event === 'REPORT_READY' && payload.customerEmail && payload.publicToken) {
    const reportUrl = `${baseUrl}/report/${payload.publicToken}`;
    await sendResendEmail({
      to: payload.customerEmail,
      subject: `Your Free AI Business Audit for ${payload.businessName} is ready`,
      text: [
        `Hello,`,
        ``,
        `Your personalised Free AI Business Audit for ${payload.businessName} from ${brandConfig.legalEntityName} is now ready to view and print:`,
        reportUrl,
        ``,
        `No obligation — review your findings, automation opportunities, and roadmap whenever it suits you.`,
        ``,
        `Best regards,`,
        `${brandConfig.legalEntityName}`,
      ].join('\n'),
    });
    return;
  }

  // Internal agency notifications contain NO customer contact details (business name, industry, admin link only)
  const label =
    payload.event === 'HOT_LEAD'
      ? 'HOT lead classified'
      : payload.event === 'CUSTOMER_INTENT'
        ? `Customer requested ${payload.intentType ?? 'follow-up'}`
        : 'New free AI audit submitted';

  const internalText = `${label}: ${payload.businessName} (${payload.industry}). Review in admin: ${adminUrl}`;

  const tasks: Promise<void>[] = [postWebhook(internalText)];
  if (env.BUSINESS_CONTACT_EMAIL && isEmailConfigured()) {
    tasks.push(
      sendResendEmail({
        to: env.BUSINESS_CONTACT_EMAIL,
        subject: `[Amarketing Audit] ${label} — ${payload.businessName}`,
        text: internalText,
      }),
    );
  }

  await Promise.allSettled(tasks);
}

