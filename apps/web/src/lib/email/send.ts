import { Resend } from 'resend';

let resendClient: Resend | null | undefined;

function getClient(): Resend | null {
  if (resendClient !== undefined) return resendClient;
  const key = process.env.RESEND_API_KEY;
  resendClient = key ? new Resend(key) : null;
  return resendClient;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const client = getClient();
  if (!client) return;
  await client.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'DockWalker <noreply@dockwalker.com>',
    ...params,
  });
}
