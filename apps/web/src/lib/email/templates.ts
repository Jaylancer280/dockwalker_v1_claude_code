/**
 * Email templates — transactional only.
 *
 * Design notes:
 * - Header bg matches the web app's dark-theme background (`#111a24`) so the
 *   white logo reads cleanly; body panel is white for inbox readability.
 * - Accent/CTA uses `#2d7de0` (app's light-theme accent) rather than the old
 *   teal, so the visual matches the in-app primary color.
 * - Preview text lives in a hidden preheader span before the first visible
 *   node — Gmail / Apple Mail / Outlook show it in the inbox list alongside
 *   the subject. Always provide one; otherwise clients preview raw HTML.
 * - Subjects surface role + vessel + key date where possible so the inbox
 *   alone tells the user what it's about.
 */

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.dockwalker.io';
}

function logoUrl(): string {
  return `${siteUrl()}/images/brand/dw_logo_white.png`;
}

export function formatVesselName(name: string, type: 'motor' | 'sail'): string {
  return `${type === 'sail' ? 'S/Y' : 'M/Y'} ${name}`;
}

export function formatEmailDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function previewSpan(text: string): string {
  // Hidden-in-body, shown-in-inbox-preview pattern.
  return `<span style="display:none !important;max-height:0;overflow:hidden;visibility:hidden;mso-hide:all;color:transparent;opacity:0;">${text}</span>`;
}

function wrap(params: { content: string; previewText: string }): string {
  const url = siteUrl();
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  ${previewSpan(params.previewText)}
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
    <div style="background:#111a24;padding:20px 24px;">
      <img src="${logoUrl()}" alt="DockWalker" width="140" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:140px;"/>
    </div>
    <div style="padding:32px 28px;color:#1e293b;">
      ${params.content}
    </div>
    <div style="padding:20px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;color:#64748b;font-size:12px;line-height:1.6;">
      DockWalker &middot; Superyacht hiring<br>
      <a href="${url}/settings" style="color:#64748b;text-decoration:underline;">Manage notifications</a>
    </div>
  </div>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<div style="text-align:center;margin:28px 0 8px;">
    <a href="${href}" style="display:inline-block;background:#2d7de0;color:#ffffff;text-decoration:none;padding:13px 34px;border-radius:8px;font-size:15px;font-weight:600;">${label}</a>
  </div>`;
}

function paragraph(text: string, extraStyle = ''): string {
  return `<p style="color:#475569;font-size:15px;line-height:1.65;margin:0 0 14px;${extraStyle}">${text}</p>`;
}

function factList(items: string[]): string {
  const lis = items
    .map(
      (item) =>
        `<li style="color:#475569;font-size:15px;line-height:1.6;margin-bottom:6px;">${item}</li>`,
    )
    .join('');
  return `<ul style="margin:0 0 20px;padding-left:20px;">${lis}</ul>`;
}

// ─── Templates ──────────────────────────────────────────────────────────────

export function applicationAcceptedEmail(params: {
  crewName: string;
  roleName: string;
  vesselLabel: string;
  jobNumber: string;
  startDateFormatted: string;
  deepLink: string;
}): { subject: string; html: string } {
  const headline = `${params.roleName} aboard ${params.vesselLabel}`;
  return {
    subject: `You've been accepted — ${headline}`,
    html: wrap({
      previewText: `Chat is now open. Confirm the start time before you travel.`,
      content: `
        <h2 style="color:#111a24;font-size:20px;font-weight:600;margin:0 0 16px;">Great news, ${params.crewName} —</h2>
        ${paragraph(`You've been accepted for the <strong>${params.roleName}</strong> role aboard <strong>${params.vesselLabel}</strong> (${params.jobNumber}), starting <strong>${params.startDateFormatted}</strong>.`)}
        ${paragraph(`Your chat with the employer is now open. Confirm the start time and review the pre-arrival checklist before you travel.`)}
        ${ctaButton(params.deepLink, 'Open chat')}
      `,
    }),
  };
}

export function applicationReceivedEmail(params: {
  employerName: string;
  crewName: string;
  roleName: string;
  vesselLabel: string;
  jobNumber: string;
  experienceBracketLabel: string | null;
  cityLabel: string | null;
  deepLink: string;
}): { subject: string; html: string } {
  const facts: string[] = [];
  if (params.experienceBracketLabel) facts.push(`Experience: ${params.experienceBracketLabel}`);
  if (params.cityLabel) facts.push(`Based in: ${params.cityLabel}`);
  const previewFacts = facts.length > 0 ? facts.join(' · ') : 'Review their profile and decide.';
  return {
    subject: `New applicant for ${params.roleName} — ${params.crewName}`,
    html: wrap({
      previewText: previewFacts,
      content: `
        <h2 style="color:#111a24;font-size:20px;font-weight:600;margin:0 0 16px;">Hi ${params.employerName},</h2>
        ${paragraph(`<strong>${params.crewName}</strong> just applied for your <strong>${params.roleName}</strong> role aboard <strong>${params.vesselLabel}</strong> (${params.jobNumber}).`)}
        ${facts.length > 0 ? factList(facts) : ''}
        ${ctaButton(params.deepLink, 'Review applicant')}
      `,
    }),
  };
}

export function newMessageEmail(params: {
  recipientName: string;
  senderName: string;
  roleName: string | null;
  preview: string;
  deepLink: string;
}): { subject: string; html: string } {
  const about = params.roleName ? ` about ${params.roleName}` : '';
  return {
    subject: `New message from ${params.senderName}${about}`,
    html: wrap({
      previewText: params.preview || `${params.senderName} sent you a message.`,
      content: `
        <h2 style="color:#111a24;font-size:20px;font-weight:600;margin:0 0 16px;">Hi ${params.recipientName},</h2>
        ${paragraph(`<strong>${params.senderName}</strong> sent you a message${params.roleName ? ` about your <strong>${params.roleName}</strong> engagement` : ''}:`)}
        <div style="background:#f1f5f9;border-left:3px solid #2d7de0;border-radius:6px;padding:14px 18px;margin:0 0 20px;">
          <p style="color:#475569;font-size:15px;margin:0;font-style:italic;line-height:1.55;">&ldquo;${params.preview}&rdquo;</p>
        </div>
        ${ctaButton(params.deepLink, 'Reply in chat')}
      `,
    }),
  };
}

export function engagementStartingEmail(params: {
  recipientName: string;
  otherPartyName: string;
  roleName: string;
  vesselLabel: string | null;
  startDateFormatted: string;
  engagementId: string;
}): { subject: string; html: string } {
  const subjectTrailer = params.vesselLabel ? ` aboard ${params.vesselLabel}` : '';
  return {
    subject: `Tomorrow: ${params.roleName}${subjectTrailer}`,
    html: wrap({
      previewText: `Review the pre-arrival checklist and confirm the arrival time with ${params.otherPartyName}.`,
      content: `
        <h2 style="color:#111a24;font-size:20px;font-weight:600;margin:0 0 16px;">Hi ${params.recipientName},</h2>
        ${paragraph(`Your <strong>${params.roleName}</strong> engagement${params.vesselLabel ? ` aboard <strong>${params.vesselLabel}</strong>` : ''} with <strong>${params.otherPartyName}</strong> starts tomorrow, <strong>${params.startDateFormatted}</strong>.`)}
        ${paragraph('Before you go:', 'margin-bottom:6px;')}
        ${factList([
          'Review the pre-arrival checklist',
          `Confirm arrival time with ${params.otherPartyName}`,
          'Pack your certifications',
        ])}
        ${ctaButton(`${siteUrl()}/messages/${params.engagementId}`, 'Open chat')}
      `,
    }),
  };
}

export function permanentShortlistedEmail(params: {
  recipientName: string;
  roleName: string;
  jobNumber: string;
}): { subject: string; html: string } {
  // NDA-safe — vessel name deliberately NOT included at shortlist stage.
  return {
    subject: `You've been shortlisted — ${params.roleName} (${params.jobNumber})`,
    html: wrap({
      previewText: `Your application has moved to the next stage. No action needed right now.`,
      content: `
        <h2 style="color:#111a24;font-size:20px;font-weight:600;margin:0 0 16px;">Hi ${params.recipientName},</h2>
        ${paragraph(`You've been shortlisted for <strong>${params.roleName}</strong> (${params.jobNumber}). The employer is narrowing candidates and will contact successful applicants directly.`)}
        ${paragraph(`No action is needed from you right now — we'll email again if the status changes.`)}
        ${ctaButton(`${siteUrl()}/discover?tab=applied`, 'View your applications')}
      `,
    }),
  };
}

export function permanentSelectedEmail(params: {
  recipientName: string;
  roleName: string;
  vesselLabel: string;
  jobNumber: string;
  engagementId: string;
}): { subject: string; html: string } {
  return {
    subject: `You've been selected — ${params.roleName} aboard ${params.vesselLabel}`,
    html: wrap({
      previewText: `Direct chat is now open to discuss terms and next steps.`,
      content: `
        <h2 style="color:#111a24;font-size:20px;font-weight:600;margin:0 0 16px;">Congratulations, ${params.recipientName} —</h2>
        ${paragraph(`You've been selected for the <strong>${params.roleName}</strong> role aboard <strong>${params.vesselLabel}</strong> (${params.jobNumber}).`)}
        ${paragraph(`A direct conversation with the employer is now open. Discuss salary, start date, contract details, and any outstanding questions there.`)}
        ${ctaButton(`${siteUrl()}/messages/${params.engagementId}`, 'Open conversation')}
      `,
    }),
  };
}

export function permanentPlacementConfirmedEmail(params: {
  recipientName: string;
  roleName: string;
  vesselLabel: string;
  jobNumber: string;
  engagementId: string | null;
}): { subject: string; html: string } {
  const ctaHref = params.engagementId
    ? `${siteUrl()}/messages/${params.engagementId}`
    : `${siteUrl()}/messages`;
  return {
    subject: `Placement confirmed — ${params.roleName} aboard ${params.vesselLabel}`,
    html: wrap({
      previewText: `Your placement is locked in. The posting is now closed to other candidates.`,
      content: `
        <h2 style="color:#111a24;font-size:20px;font-weight:600;margin:0 0 16px;">Congratulations, ${params.recipientName} —</h2>
        ${paragraph(`Your placement as <strong>${params.roleName}</strong> aboard <strong>${params.vesselLabel}</strong> (${params.jobNumber}) has been confirmed by the employer.`)}
        ${paragraph(`The posting is now closed to other candidates. Any remaining logistics should happen in chat.`)}
        ${ctaButton(ctaHref, 'Open chat')}
      `,
    }),
  };
}

export function supportMessageEmail(params: {
  recipientName: string;
  preview: string;
  threadId: string;
  isNewThread: boolean;
}): { subject: string; html: string } {
  const ctaHref = `${siteUrl()}/support/${params.threadId}`;
  const subject = params.isNewThread
    ? 'Message from DockWalker support'
    : 'New reply from DockWalker support';
  return {
    subject,
    html: wrap({
      previewText: params.preview || 'You have a new support message.',
      content: `
        <h2 style="color:#111a24;font-size:20px;font-weight:600;margin:0 0 16px;">Hi ${params.recipientName},</h2>
        ${paragraph(params.isNewThread ? `DockWalker support has opened a thread with you:` : `DockWalker support sent you a reply:`)}
        <div style="background:#f1f5f9;border-left:3px solid #2d7de0;border-radius:6px;padding:14px 18px;margin:0 0 20px;">
          <p style="color:#475569;font-size:15px;margin:0;font-style:italic;line-height:1.55;">&ldquo;${params.preview}&rdquo;</p>
        </div>
        ${ctaButton(ctaHref, 'Open support thread')}
      `,
    }),
  };
}
