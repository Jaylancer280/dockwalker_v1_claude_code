import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

const REASON_CATEGORIES = [
  'harassment',
  'fraud',
  'inappropriate_content',
  'safety_concern',
  'spam',
  'impersonation',
  'duplicate_account',
  'other',
] as const;

const OPEN_REPORT_CAP = 5;

/**
 * POST /api/reports
 * Submit a report about another user. Body:
 *   { reported_person_id, engagement_id?, reason_category, reason_text }
 *
 * Enforces:
 *   - self-report prevention (DB CHECK also enforces, belt-and-braces)
 *   - max 5 open reports per reporter
 *   - reason_category ∈ the defined enum
 *   - reason_text between 1 and 1000 chars
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { serviceClient, person, supabase } = guard.value;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const reportedPersonId =
    body && typeof body === 'object' && 'reported_person_id' in body
      ? (body as { reported_person_id: unknown }).reported_person_id
      : null;
  const engagementId =
    body && typeof body === 'object' && 'engagement_id' in body
      ? (body as { engagement_id: unknown }).engagement_id
      : null;
  const reasonCategory =
    body && typeof body === 'object' && 'reason_category' in body
      ? (body as { reason_category: unknown }).reason_category
      : null;
  const reasonText =
    body && typeof body === 'object' && 'reason_text' in body
      ? (body as { reason_text: unknown }).reason_text
      : null;

  if (typeof reportedPersonId !== 'string' || reportedPersonId.length === 0) {
    return NextResponse.json({ error: 'reported_person_id is required' }, { status: 400 });
  }
  if (reportedPersonId === person.id) {
    return NextResponse.json({ error: 'You cannot report your own account' }, { status: 400 });
  }
  if (
    typeof reasonCategory !== 'string' ||
    !(REASON_CATEGORIES as readonly string[]).includes(reasonCategory)
  ) {
    return NextResponse.json({ error: 'Invalid reason_category' }, { status: 400 });
  }
  if (typeof reasonText !== 'string' || reasonText.trim().length === 0) {
    return NextResponse.json({ error: 'reason_text is required' }, { status: 400 });
  }
  if (reasonText.length > 1000) {
    return NextResponse.json(
      { error: 'reason_text must be 1000 characters or fewer' },
      { status: 400 },
    );
  }
  if (engagementId != null && typeof engagementId !== 'string') {
    return NextResponse.json({ error: 'engagement_id must be a string' }, { status: 400 });
  }

  // Cap enforcement: at most OPEN_REPORT_CAP open reports per reporter.
  const { count: openCount } = await serviceClient
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('reporter_person_id', person.id)
    .eq('status', 'open');

  if ((openCount ?? 0) >= OPEN_REPORT_CAP) {
    return NextResponse.json(
      {
        error: `You have reached the limit of ${OPEN_REPORT_CAP} open reports. Wait for review to proceed before filing another.`,
      },
      { status: 429 },
    );
  }

  // Use the RLS-gated client so reporter_person_id is enforced by the policy.
  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_person_id: person.id,
      reported_person_id: reportedPersonId,
      engagement_id: engagementId ?? null,
      reason_category: reasonCategory,
      reason_text: reasonText.trim(),
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ report_id: data.id }, { status: 201 });
}

/**
 * GET /api/reports
 * List the caller's own submitted reports (most recent first).
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { supabase, person } = guard.value;

  const { data, error } = await supabase
    .from('reports')
    .select('id, reported_person_id, engagement_id, reason_category, status, created_at')
    .eq('reporter_person_id', person.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reports: data ?? [] });
}
