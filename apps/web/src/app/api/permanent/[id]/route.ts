import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/permanent/[id]
 *
 * Returns posting details for the apply page (Phase 5b). Includes
 * optional invitation context when the caller is the invited crew on
 * a pending PERMANENT.INVITED row — drives the apply-after-invite
 * banner ("Captain James invited you to apply for ...").
 *
 * Returns the same shape regardless of whether `?from_invitation=` is
 * present; `invitation` is null when no valid invitation is found,
 * which the page treats as "no banner, regular apply form".
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: postingId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase, serviceClient } = guard.value;

  try {
    const { data: posting, error } = await supabase
      .from('permanent_postings')
      .select(
        `
        id, status, employer_person_id, role_id, vessel_id, port_id,
        start_date, salary_min, salary_max, salary_currency, salary_period,
        live_aboard, contract_type, contract_details, description,
        required_certification_ids, required_languages,
        notes, positions_available,
        yacht_roles(id, name, department),
        vessels(id, name, vessel_type, nda_flag),
        ports(id, name, cities(name, regions(name)))
      `,
      )
      .eq('id', postingId)
      .single();

    if (error || !posting) {
      return NextResponse.json({ error: 'Posting not found' }, { status: 404 });
    }

    // Optional invitation context. Read via service role so a permitted
    // caller (the invited crew) sees their invitation regardless of RLS.
    // Validation: the invitation must be on this posting AND addressed
    // to this user AND in 'pending' status. Anything else returns null —
    // the page hides the banner and the apply still works.
    const url = new URL(request.url);
    const fromInvitation = url.searchParams.get('from_invitation');
    let invitation: { id: string; message: string | null; captain_name: string | null } | null =
      null;
    if (fromInvitation) {
      const { data: inv } = await serviceClient
        .from('permanent_invitations')
        .select('id, message, status, permanent_posting_id, crew_person_id, invited_by_person_id')
        .eq('id', fromInvitation)
        .maybeSingle();
      if (
        inv &&
        inv.status === 'pending' &&
        inv.permanent_posting_id === postingId &&
        inv.crew_person_id === user.id
      ) {
        let captainName: string | null = null;
        if (inv.invited_by_person_id) {
          const { data: captain } = await serviceClient
            .from('profiles')
            .select('display_name')
            .eq('person_id', inv.invited_by_person_id)
            .single();
          captainName = (captain?.display_name as string | null) ?? null;
        }
        invitation = {
          id: inv.id,
          message: (inv.message as string | null) ?? null,
          captain_name: captainName,
        };
      }
    }

    return NextResponse.json({ posting, invitation });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
