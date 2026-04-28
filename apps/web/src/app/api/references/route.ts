import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent, appendEvents } from '@dockwalker/db';
import { resolveHistoricalVesselNames } from '@/lib/vessels/historical-names';
import {
  checkVesselReferenceGate,
  getSubscriptionPlan,
  refsCapForPlan,
  refIdemKey,
  normalizeEmailOrName,
  type VesselGateRow,
} from '@/lib/references/helpers';
import { notifyOnEvent } from '@/lib/push-triggers';

/**
 * POST /api/references
 * Crew creates a consent invitation for a referee.
 *
 *   - Verifies the experience belongs to the caller.
 *   - Vessel-state gate: NDA / hidden vessels are rejected.
 *   - Per-experience cap by subscription tier (Free=1, Crew Pro=3).
 *   - Snapshots vessel IMO + period-correct vessel name + dates onto the row.
 *     For currently-onboard experiences (is_current=true, end_date=null) the
 *     snapshot_end_date stays null until the experience is later closed; the
 *     EXPERIENCE.UPDATED projection auto-updates snapshots in that one-time
 *     null→date transition (see 00129).
 *   - Generates an opaque token; returns the share-link URL.
 *   - B-6: opportunistic in-app notification to a matched DockWalker person
 *     (only when `claimedRefereeEmail` matches an existing account).
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase, serviceClient } = guard.value;
    if (person.identity_type !== 'crew') {
      return NextResponse.json({ error: 'References are crew-only' }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      experienceId?: string;
      claimedRefereeRole?: string;
      claimedRefereeName?: string;
      claimedRefereeEmail?: string | null;
    };
    const experienceId = body.experienceId?.trim();
    const claimedRefereeRole = body.claimedRefereeRole?.trim();
    const claimedRefereeName = body.claimedRefereeName?.trim();
    const claimedRefereeEmail = body.claimedRefereeEmail?.trim() || null;

    if (!experienceId) {
      return NextResponse.json({ error: 'experienceId is required' }, { status: 400 });
    }
    if (!claimedRefereeRole) {
      return NextResponse.json({ error: 'claimedRefereeRole is required' }, { status: 400 });
    }
    if (!claimedRefereeName || claimedRefereeName.length < 2 || claimedRefereeName.length > 80) {
      return NextResponse.json(
        { error: 'claimedRefereeName must be 2-80 characters' },
        { status: 400 },
      );
    }
    if (claimedRefereeEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(claimedRefereeEmail)) {
      return NextResponse.json({ error: 'claimedRefereeEmail is invalid' }, { status: 400 });
    }

    // Verify the experience belongs to the caller and read its details.
    const { data: experience } = await supabase
      .from('crew_experiences')
      .select('id, person_id, vessel_id, role_id, start_date, end_date, is_current')
      .eq('id', experienceId)
      .eq('person_id', user.id)
      .maybeSingle();
    if (!experience) {
      return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
    }

    // Vessel-state gate.
    const { data: vessel } = await serviceClient
      .from('vessels')
      .select('id, name, imo_number, nda_flag, source, hidden_at')
      .eq('id', experience.vessel_id)
      .maybeSingle<VesselGateRow>();
    const gate = checkVesselReferenceGate(vessel);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    // Caller's role on the experience (free-text not stored on crew_experiences;
    // we use the role's name from yacht_roles for `requester_role_at_time`).
    const { data: roleRow } = await serviceClient
      .from('yacht_roles')
      .select('name')
      .eq('id', experience.role_id)
      .maybeSingle();
    const requesterRoleAtTime = (roleRow?.name as string | undefined) ?? 'Crew';

    // Auto-supersede: if there's already a pending invitation for this same
    // referee on this same experience, revoke it atomically before creating
    // the new one. Common workflow: user sends invite, notices a typo or
    // wants to change vessel/role/email, resubmits — we treat the new
    // submission as the canonical invitation and retire the previous one.
    // Match by email (preferred) or by normalized name when no email was
    // captured.
    const newKey = normalizeEmailOrName(claimedRefereeEmail, claimedRefereeName);
    const { data: existingPending } = await serviceClient
      .from('references')
      .select('id, claimed_referee_email, claimed_referee_name')
      .eq('experience_id', experienceId)
      .eq('requester_person_id', user.id)
      .eq('status', 'pending');
    const supersedeId =
      (existingPending ?? []).find(
        (row) =>
          normalizeEmailOrName(
            row.claimed_referee_email as string | null,
            row.claimed_referee_name as string,
          ) === newKey,
      )?.id ?? null;

    // Per-experience cap pre-check — exclude the row we're about to supersede.
    const plan = await getSubscriptionPlan(serviceClient, user.id);
    const cap = refsCapForPlan(plan);
    let capQuery = serviceClient
      .from('references')
      .select('id', { count: 'exact', head: true })
      .eq('experience_id', experienceId)
      .in('status', ['pending', 'accepted']);
    if (supersedeId) capQuery = capQuery.neq('id', supersedeId);
    const { count: activeCount } = await capQuery;
    if ((activeCount ?? 0) >= cap) {
      return NextResponse.json(
        {
          error:
            plan === 'crew_pro'
              ? `Per-experience cap of ${cap} reached`
              : `Per-experience cap of ${cap} reached on Free plan — upgrade to Crew Pro for up to ${refsCapForPlan('crew_pro')}`,
          gate: {
            reason: plan === 'crew_pro' ? 'experience_cap' : 'crew_pro_required',
            current: activeCount,
            limit: cap,
            upgrade_path: '/billing',
          },
        },
        { status: 402 },
      );
    }

    // Vessel name resolution — period-correct historical name with fallback.
    const histMap = await resolveHistoricalVesselNames(serviceClient, [
      { vessel_id: experience.vessel_id, start_date: experience.start_date as string },
    ]);
    const histKey = `${experience.vessel_id}|${experience.start_date}`;
    const snapshotVesselName = histMap.get(histKey) ?? (vessel as VesselGateRow).name;

    const refId = randomUUID();
    const token = randomUUID();

    if (supersedeId) {
      await appendEvents(serviceClient, [
        {
          eventType: 'REFERENCE.REVOKED_BY_REQUESTER',
          aggregateId: supersedeId,
          aggregateType: 'reference',
          roleContext: 'crew',
          payload: {},
          personId: user.id,
        },
        {
          eventType: 'REFERENCE.REQUESTED',
          aggregateId: refId,
          aggregateType: 'reference',
          roleContext: 'crew',
          payload: {
            id: refId,
            experience_id: experienceId,
            vessel_id: experience.vessel_id as string,
            requester_role_at_time: requesterRoleAtTime,
            claimed_referee_role: claimedRefereeRole,
            claimed_referee_name: claimedRefereeName,
            claimed_referee_email: claimedRefereeEmail,
            token,
            snapshot_vessel_imo: (vessel as VesselGateRow).imo_number,
            snapshot_vessel_name: snapshotVesselName,
            snapshot_start_date: experience.start_date as string,
            snapshot_end_date: (experience.end_date as string | null) ?? null,
          },
          personId: user.id,
          idempotencyKey: refIdemKey.request(refId),
        },
      ]);
    } else {
      await appendEvent(serviceClient, {
        eventType: 'REFERENCE.REQUESTED',
        aggregateId: refId,
        aggregateType: 'reference',
        roleContext: 'crew',
        payload: {
          id: refId,
          experience_id: experienceId,
          vessel_id: experience.vessel_id as string,
          requester_role_at_time: requesterRoleAtTime,
          claimed_referee_role: claimedRefereeRole,
          claimed_referee_name: claimedRefereeName,
          claimed_referee_email: claimedRefereeEmail,
          token,
          snapshot_vessel_imo: (vessel as VesselGateRow).imo_number,
          snapshot_vessel_name: snapshotVesselName,
          snapshot_start_date: experience.start_date as string,
          snapshot_end_date: (experience.end_date as string | null) ?? null,
        },
        personId: user.id,
        idempotencyKey: refIdemKey.request(refId),
      });
    }

    // B-6: opportunistic in-app notification when claimed_referee_email
    // matches an existing DockWalker person. Email courier is NOT used —
    // out-of-band sharing remains the privacy-preserving primitive.
    if (claimedRefereeEmail) {
      try {
        const { data: matchedPersonId } = await serviceClient.rpc('find_person_id_by_email', {
          p_email: claimedRefereeEmail.toLowerCase(),
        });
        if (matchedPersonId && matchedPersonId !== user.id) {
          notifyOnEvent(
            serviceClient,
            'REFERENCE.REQUESTED',
            {
              reference_id: refId,
              recipient_person_id: matchedPersonId,
              snapshot_vessel_name: snapshotVesselName,
              token,
            },
            user.id,
          );
        }
      } catch {
        // Lookup failure must not block the route response.
      }
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.dockwalker.io';
    return NextResponse.json({ id: refId, token, link: `${siteUrl}/ref/${token}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
