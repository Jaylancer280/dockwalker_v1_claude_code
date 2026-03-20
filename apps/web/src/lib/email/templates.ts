function wrap(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;">
    <div style="background:#0f172a;padding:24px;text-align:center;">
      <h1 style="color:#ffffff;font-size:20px;margin:0;">DockWalker</h1>
    </div>
    <div style="padding:32px 24px;">
      ${content}
    </div>
    <div style="padding:16px 24px;text-align:center;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;">
      DockWalker — Superyacht daywork hiring
    </div>
  </div>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<div style="text-align:center;margin:24px 0;">
    <a href="${href}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:600;">${label}</a>
  </div>`;
}

export function applicationAcceptedEmail(params: {
  crewName: string;
  jobTitle: string;
  startDate: string;
  deepLink: string;
}): { subject: string; html: string } {
  return {
    subject: `You've been accepted — ${params.jobTitle}`,
    html: wrap(`
      <p style="color:#1e293b;font-size:16px;margin:0 0 16px;">Great news, ${params.crewName}!</p>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 8px;">
        You've been accepted for <strong>${params.jobTitle}</strong> starting ${params.startDate}.
      </p>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Open the app to message your employer and prepare for the engagement.
      </p>
      ${ctaButton(params.deepLink, 'Open chat')}
    `),
  };
}

export function applicationReceivedEmail(params: {
  employerName: string;
  crewName: string;
  jobTitle: string;
  deepLink: string;
}): { subject: string; html: string } {
  return {
    subject: `New applicant for ${params.jobTitle}`,
    html: wrap(`
      <p style="color:#1e293b;font-size:16px;margin:0 0 16px;">Hi ${params.employerName},</p>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px;">
        <strong>${params.crewName}</strong> applied to your <strong>${params.jobTitle}</strong> posting. Review their profile and decide.
      </p>
      ${ctaButton(params.deepLink, 'Review applicant')}
    `),
  };
}

export function newMessageEmail(params: {
  recipientName: string;
  senderName: string;
  preview: string;
  deepLink: string;
}): { subject: string; html: string } {
  return {
    subject: `${params.senderName} sent you a message`,
    html: wrap(`
      <p style="color:#1e293b;font-size:16px;margin:0 0 16px;">Hi ${params.recipientName},</p>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 8px;">
        <strong>${params.senderName}</strong> sent you a message:
      </p>
      <div style="background:#f1f5f9;border-radius:6px;padding:12px 16px;margin:0 0 16px;">
        <p style="color:#475569;font-size:14px;margin:0;font-style:italic;">&ldquo;${params.preview}&rdquo;</p>
      </div>
      ${ctaButton(params.deepLink, 'Reply')}
    `),
  };
}

export function engagementStartingEmail(params: {
  recipientName: string;
  otherPartyName: string;
  roleName: string;
  startDate: string;
  engagementId: string;
}): { subject: string; html: string } {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.dockwalker.com';
  return {
    subject: 'Your engagement starts tomorrow',
    html: wrap(`
      <p style="color:#1e293b;font-size:16px;margin:0 0 16px;">Hi ${params.recipientName},</p>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 8px;">
        Your <strong>${params.roleName}</strong> engagement with <strong>${params.otherPartyName}</strong> starts tomorrow (${params.startDate}).
      </p>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Check the pre-arrival checklist and make sure everything is ready.
      </p>
      ${ctaButton(`${appUrl}/messages/${params.engagementId}`, 'Open chat')}
    `),
  };
}
