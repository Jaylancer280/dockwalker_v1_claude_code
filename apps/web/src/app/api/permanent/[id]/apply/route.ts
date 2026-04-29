import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';
import { meetsRequirements, type BundleMap } from '@dockwalker/shared';
import { randomUUID } from 'crypto';

/**
 * POST /api/permanent/:id/apply
 * Crew applies to a permanent posting. Cert hard-gate: if crew is missing
 * required certs, the application is blocked with a 403 and a
 * PERMANENT.APPLICATION_BLOCKED intelligence event is recorded.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: postingId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  if (person.current_hat !== 'crew') {
    return NextResponse.json(
      { error: 'Only crew can apply to permanent positions' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const message =
      body.message && typeof body.message === 'string' ? body.message.slice(0, 250) : undefined;
    const fromInvitationIdRaw = body.fromInvitationId;
    const fromInvitationId =
      typeof fromInvitationIdRaw === 'string' && fromInvitationIdRaw.length > 0
        ? fromInvitationIdRaw
        : null;

    // Fetch posting
    const { data: posting } = await supabase
      .from('permanent_postings')
      .select('id, status, required_certification_ids, employer_person_id')
      .eq('id', postingId)
      .single();

    if (!posting) {
      return NextResponse.json({ error: 'Posting not found' }, { status: 404 });
    }

    if (!['active', 'in_negotiation'].includes(posting.status)) {
      return NextResponse.json(
        { error: 'This posting is no longer accepting applications' },
        { status: 400 },
      );
    }

    if (posting.employer_person_id === user.id) {
      return NextResponse.json({ error: 'Cannot apply to your own posting' }, { status: 400 });
    }

    // Cert hard-gate (bundle-aware: a candidate holding AEC 1+2 satisfies
    // separate AEC 1 and AEC 2 requirements; same for STCW 2010 → its
    // five components).
    const requiredCerts = (posting.required_certification_ids as string[]) ?? [];
    if (requiredCerts.length > 0) {
      const [{ data: profile }, { data: bundlesRows }] = await Promise.all([
        supabase.from('profiles').select('certification_ids').eq('person_id', user.id).single(),
        supabase.from('certification_components').select('bundle_cert_id, component_cert_id'),
      ]);

      const bundles: BundleMap = {};
      for (const row of (bundlesRows as { bundle_cert_id: string; component_cert_id: string }[]) ??
        []) {
        if (!bundles[row.bundle_cert_id]) bundles[row.bundle_cert_id] = [];
        bundles[row.bundle_cert_id].push(row.component_cert_id);
      }

      const crewCerts = (profile?.certification_ids as string[]) ?? [];
      const matchResult = meetsRequirements(crewCerts, requiredCerts, bundles);
      const missingIds = matchResult.missing;

      if (missingIds.length > 0) {
        // Resolve missing cert names
        const { data: certData } = await supabase
          .from('certifications')
          .select('id, name')
          .in('id', missingIds);

        // Record intelligence event
        await appendEvent(serviceClient, {
          eventType: 'PERMANENT.APPLICATION_BLOCKED',
          aggregateId: `${user.id}:${postingId}`,
          aggregateType: 'permanent',
          roleContext: 'crew',
          payload: {
            crew_person_id: user.id,
            permanent_posting_id: postingId,
            missing_certification_ids: missingIds,
          },
          personId: user.id,
        });

        return NextResponse.json(
          {
            error: 'Missing required certifications',
            missing_certs: (certData ?? []).map((c) => ({ id: c.id, name: c.name })),
          },
          { status: 403 },
        );
      }
    }

    // Duplicate check
    const { data: existingApp } = await supabase
      .from('applications')
      .select('id, status')
      .eq('crew_person_id', user.id)
      .eq('permanent_posting_id', postingId)
      .maybeSingle();

    if (existingApp) {
      return NextResponse.json(
        { error: `You have already applied (status: ${existingApp.status})` },
        { status: 409 },
      );
    }

    // Apply-after-invite (spec v2.1 §6): when the apply is arriving via
    // the PERMANENT.INVITED deep link (?from_invitation=<id>), the client
    // passes the invitation id through as `fromInvitationId`. Server-side
    // validation: invitation exists, is in 'pending' status, and is
    // addressed to *this* crew on *this* posting. If any check fails,
    // we don't error out — we just drop the link and proceed as a normal
    // apply. This makes the apply flow forgiving when the invitation has
    // expired or been revoked between the deep-link click and the submit.
    let validatedFromInvitationId: string | null = null;
    if (fromInvitationId) {
      const { data: inv } = await serviceClient
        .from('permanent_invitations')
        .select('id, permanent_posting_id, crew_person_id, status')
        .eq('id', fromInvitationId)
        .maybeSingle();
      if (
        inv &&
        inv.status === 'pending' &&
        inv.permanent_posting_id === postingId &&
        inv.crew_person_id === user.id
      ) {
        validatedFromInvitationId = fromInvitationId;
      }
    }

    // Create application
    const applicationId = randomUUID();

    await appendEvent(serviceClient, {
      eventType: 'PERMANENT.APPLIED',
      aggregateId: `${user.id}:${postingId}`,
      aggregateType: 'permanent',
      roleContext: 'crew',
      payload: {
        id: applicationId,
        permanent_posting_id: postingId,
        crew_person_id: user.id,
        ...(message ? { message } : {}),
        ...(validatedFromInvitationId ? { invited_from_id: validatedFromInvitationId } : {}),
      },
      personId: user.id,
    });

    notifyOnEvent(
      serviceClient,
      'PERMANENT.APPLIED',
      { permanent_posting_id: postingId, crew_person_id: user.id },
      user.id,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to apply';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
