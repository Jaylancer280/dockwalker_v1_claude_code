import { Resend } from 'resend';
import * as Sentry from '@sentry/nextjs';

let resendClient: Resend | null | undefined;
let warnedMissingKey = false;

function getClient(): Resend | null {
  if (resendClient !== undefined) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // In production, a missing key is a deployment bug — surface it once via
    // Sentry + console so a broken-email deploy is visible within minutes
    // instead of silently no-oping forever.
    if (!warnedMissingKey && process.env.NODE_ENV === 'production') {
      warnedMissingKey = true;
      console.warn('[email] RESEND_API_KEY not set — email delivery disabled');
      Sentry.captureMessage('RESEND_API_KEY not set in production', 'warning');
    }
    resendClient = null;
    return null;
  }
  resendClient = new Resend(key);
  return resendClient;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    // Gmail / Yahoo / Outlook all recognise the RFC 2369 List-Unsubscribe
    // header and surface an Unsubscribe link next to the sender name in the
    // inbox. Pointing at /settings is the minimum-viable option — the user
    // has to log in to actually flip email_enabled=false. A future
    // enhancement can add a signed-token one-click endpoint + the
    // `List-Unsubscribe-Post: List-Unsubscribe=One-Click` header required
    // by Gmail's bulk-sender policy (>5k emails/day).
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.dockwalker.io';
    await client.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'DockWalker <noreply@dockwalker.io>',
      headers: {
        'List-Unsubscribe': `<${siteUrl}/settings>`,
      },
      ...params,
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { source: 'email-dispatch' },
      // Subject is safe to log — recipient address is not (PII).
      extra: { subject: params.subject },
    });
    throw err;
  }
}
