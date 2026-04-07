import { decryptPhone } from './crypto';

/**
 * Send a WhatsApp message via Twilio REST API.
 * Uses raw fetch — no twilio npm package.
 * Returns true on success, false on failure or missing config.
 */
export async function sendWhatsApp(
  phoneEncrypted: Buffer,
  templateName: string,
  variables: string[],
  buttonUrl: string,
): Promise<boolean> {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_WHATSAPP_FROM;

  if (!twilioSid || !twilioAuth || !twilioFrom) return false;

  let phone: string;
  try {
    phone = decryptPhone(phoneEncrypted);
  } catch {
    return false;
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
  const authHeader = `Basic ${Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64')}`;

  // Build content variables JSON for Twilio content template API
  const contentVariables: Record<string, string> = {};
  variables.forEach((v, i) => {
    contentVariables[String(i + 1)] = v;
  });
  // Add button URL variable
  if (buttonUrl) {
    contentVariables[String(variables.length + 1)] = buttonUrl;
  }

  try {
    const res = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: `whatsapp:${phone}`,
        From: twilioFrom,
        // Use template-based messaging via ContentSid when templates are approved
        // For now, fall back to body text with template name as prefix
        Body: `[${templateName}] ${variables.join(' | ')}${buttonUrl ? ` → ${buttonUrl}` : ''}`,
      }).toString(),
    });
    return res.ok;
  } catch {
    return false;
  }
}
