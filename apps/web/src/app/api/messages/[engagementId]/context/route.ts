import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/messages/:engagementId/context
 * Returns engagement metadata for the chat header.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;

    const { data: engagement } = await supabase
      .from('active_engagements')
      .select(
        `
      id, daywork_id, permanent_posting_id, reference_contact_id,
      crew_person_id, employer_person_id, start_date, end_date, status, outcome, crew_completion_status,
      cancelled_by, cancellation_reason_category, cancellation_reason_text,
      postponement_status, proposed_start_date, proposed_end_date, proposed_working_days,
      work_started_status, work_started_at, phase,
      dayworks(
        job_number, working_days, day_rate, currency, meals, notes, permanent_opportunity,
        yacht_roles(name),
        ports(name, cities(name)),
        vessels(name, vessel_type, loa_meters, imo_number, vessel_size_bands(label))
      ),
      permanent_postings(
        id, job_number, salary_min, salary_max, salary_currency, salary_period,
        live_aboard, shortlist_cap, notes, contract_type, status,
        yacht_roles(name),
        ports(name, cities(name)),
        vessels(name, vessel_type, loa_meters, imo_number, vessel_size_bands(label))
      )
    `,
      )
      .eq('id', engagementId)
      .single();

    if (!engagement) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (engagement.crew_person_id !== user.id && engagement.employer_person_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the other person's display name
    const otherId =
      engagement.crew_person_id === user.id
        ? engagement.employer_person_id
        : engagement.crew_person_id;

    const [{ data: otherProfile }, { data: myRating }, { data: daywork }, { data: checklist }] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('display_name, deck_name')
          .eq('person_id', otherId)
          .single(),
        supabase
          .from('engagement_ratings')
          .select(
            'id, rater_role, rating_context, notice_given, pay_accuracy, meals_accuracy, role_accuracy, working_days_accuracy, vessel_condition, would_work_on_vessel_again, permanent_opportunity_accuracy, skills_as_advertised, certifications_verified, punctuality, would_rehire, communication_accuracy, overall_match',
          )
          .eq('engagement_id', engagementId)
          .eq('rater_person_id', user.id)
          .maybeSingle(),
        engagement.cancelled_by === 'crew'
          ? supabase.from('dayworks').select('status').eq('id', engagement.daywork_id).single()
          : Promise.resolve({ data: null }),
        supabase
          .from('engagement_checklists')
          .select('items, acknowledged_item_ids')
          .eq('engagement_id', engagementId)
          .maybeSingle(),
      ]);

    // If crew cancelled, employer has responded once daywork is no longer in_progress
    const crewCancelResponded =
      engagement.cancelled_by === 'crew' && daywork?.status !== 'in_progress';

    // Reference-contact engagement enrichment (Phase 4 — chat-layout switching).
    // When `reference_contact_id` is set, the chat is tied to a reference
    // consent flow rather than a daywork or permanent posting. Hydrate the
    // underlying reference snapshot + status so the chat header can render
    // <ReferenceContactHeader> instead of the daywork/permanent header AND
    // surface the Fix A "reference withdrawn" banner if the underlying
    // reference is no longer accepted.
    let referenceContext: {
      reference_contact_id: string;
      reference_id: string;
      reference_status: string;
      revoke_reason: string | null;
      requester_display_name: string | null;
      snapshot_vessel_name: string;
      snapshot_vessel_imo: string;
      snapshot_start_date: string;
      snapshot_end_date: string | null;
      requester_role_at_time: string;
      claimed_referee_role: string;
      comment: string | null;
    } | null = null;
    if (engagement.reference_contact_id) {
      const { data: contactRow } = await supabase
        .from('reference_contacts')
        .select(
          `id, reference_id,
           references!reference_contacts_reference_id_fkey(
             status, revoke_reason, requester_person_id, vessel_id, snapshot_vessel_name,
             snapshot_vessel_imo, snapshot_start_date, snapshot_end_date,
             requester_role_at_time, claimed_referee_role, comment
           )`,
        )
        .eq('id', engagement.reference_contact_id)
        .maybeSingle();
      if (contactRow) {
        // PostgREST returns the embed as an array even with .single() on the
        // join target, so we normalise to the first row.
        const refsAny = (contactRow as { references: unknown }).references;
        const refList = Array.isArray(refsAny) ? refsAny : refsAny ? [refsAny] : [];
        const ref = refList[0] as Record<string, unknown> | null;
        if (ref) {
          const requesterPersonId = ref.requester_person_id as string;
          const vesselId = ref.vessel_id as string | null;
          const [{ data: requester }, { data: vesselNda }] = await Promise.all([
            supabase
              .from('profiles')
              .select('display_name')
              .eq('person_id', requesterPersonId)
              .maybeSingle(),
            vesselId
              ? supabase.from('vessels').select('nda_flag').eq('id', vesselId).maybeSingle()
              : Promise.resolve({ data: null }),
          ]);

          // 00130 NDA mask: when the caller is the employer side of this
          // reference-contact engagement AND the vessel is currently NDA
          // AND the caller has no separate active engagement on that
          // vessel with the crew member (= existing trust-boundary
          // precedent from get_vessel_public / 00083), redact the
          // snapshot vessel name and IMO. The referee always sees full
          // — they were physically aboard. If the underlying vessel was
          // deleted (vessel_id NULL), there's no NDA owner left to
          // protect; treat as non-NDA.
          let maskedName = ref.snapshot_vessel_name as string;
          let maskedImo = ref.snapshot_vessel_imo as string;
          const ndaFlag = (vesselNda as { nda_flag?: boolean } | null)?.nda_flag === true;
          const isCallerEmployer = engagement.employer_person_id === user.id;
          if (ndaFlag && isCallerEmployer && vesselId) {
            const crewPersonId = requesterPersonId;
            const employerPersonId = user.id;
            // Trust-boundary check: any active daywork or permanent
            // engagement for THIS employer + crew + vessel unmasks. We
            // use service-role-equivalent supabase here (caller is the
            // employer + we already know the engagement exists), with
            // explicit FK joins so a single round-trip resolves both.
            const [{ data: dwHit }, { data: ppHit }] = await Promise.all([
              supabase
                .from('active_engagements')
                .select('id, dayworks!inner(vessel_id)')
                .eq('crew_person_id', crewPersonId)
                .eq('employer_person_id', employerPersonId)
                .eq('status', 'active')
                .eq('dayworks.vessel_id', vesselId)
                .limit(1)
                .maybeSingle(),
              supabase
                .from('active_engagements')
                .select('id, permanent_postings!inner(vessel_id)')
                .eq('crew_person_id', crewPersonId)
                .eq('employer_person_id', employerPersonId)
                .eq('status', 'active')
                .eq('permanent_postings.vessel_id', vesselId)
                .limit(1)
                .maybeSingle(),
            ]);
            const engagedOnVessel = !!dwHit || !!ppHit;
            if (!engagedOnVessel) {
              maskedName = 'NDA Vessel';
              maskedImo = '';
            }
          }

          referenceContext = {
            reference_contact_id: engagement.reference_contact_id as string,
            reference_id: contactRow.reference_id as string,
            reference_status: ref.status as string,
            revoke_reason: (ref.revoke_reason as string | null) ?? null,
            requester_display_name: (requester?.display_name as string | undefined) ?? null,
            snapshot_vessel_name: maskedName,
            snapshot_vessel_imo: maskedImo,
            snapshot_start_date: ref.snapshot_start_date as string,
            snapshot_end_date: (ref.snapshot_end_date as string | null) ?? null,
            requester_role_at_time: ref.requester_role_at_time as string,
            claimed_referee_role: ref.claimed_referee_role as string,
            comment: (ref.comment as string | null) ?? null,
          };
        }
      }
    }

    return NextResponse.json({
      engagement: {
        ...engagement,
        type: engagement.reference_contact_id
          ? 'reference_contact'
          : engagement.permanent_posting_id
            ? 'permanent'
            : 'daywork',
        other_name: otherProfile?.deck_name || otherProfile?.display_name || 'Unknown',
        has_rated: !!myRating,
        my_rating: myRating ?? null,
        crew_cancel_responded: crewCancelResponded,
        checklist: checklist
          ? {
              items: checklist.items as Array<{ id: string; label: string; value: string }>,
              acknowledged_item_ids: (checklist.acknowledged_item_ids as string[]) ?? [],
            }
          : null,
        reference_context: referenceContext,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
