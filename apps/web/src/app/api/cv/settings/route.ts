import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { CV_BUILDER_ENABLED, CV_BUILDER_LOCKED_PAYLOAD } from '@/lib/cv/feature-flag';

/**
 * PATCH /api/cv/settings
 *
 * Single endpoint that toggles the three CV-display preferences. These are
 * per-row UI preferences — not domain state, no projection cascades, no
 * temporal semantics — so they're persisted via direct UPDATE rather than
 * the event ledger. They do live on event-sourced projection tables
 * (`profiles`, `references`, `crew_experiences`), but the write is
 * isolated to the new column added in 00131 and is owner-scoped at the
 * route layer.
 *
 * Body shape — exactly one of:
 *   { cvIncludeSeaTime: boolean }
 *     → updates `profiles.cv_include_sea_time` for the caller.
 *   { referenceId: string, includeOnCv: boolean }
 *     → updates `references.include_on_cv` if the caller is requester.
 *   { experienceId: string, cvShowFullVessel: boolean }
 *     → updates `crew_experiences.cv_show_full_vessel` if caller owns it.
 *
 * Crew-hat only. 403 for employer/agent. 404 if the targeted row isn't
 * owned by the caller (avoids leaking row existence).
 */
export async function PATCH(request: Request) {
  if (!CV_BUILDER_ENABLED) {
    return NextResponse.json(CV_BUILDER_LOCKED_PAYLOAD, { status: 503 });
  }

  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, serviceClient } = guard.value;

  if (person.current_hat !== 'crew') {
    return NextResponse.json({ error: 'Crew hat required' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    if (typeof body.cvIncludeSeaTime === 'boolean') {
      const { error } = await serviceClient
        .from('profiles')
        .update({ cv_include_sea_time: body.cvIncludeSeaTime })
        .eq('person_id', user.id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (typeof body.referenceId === 'string' && typeof body.includeOnCv === 'boolean') {
      // Owner check via WHERE clause: caller must be the requester. If the
      // row doesn't match (wrong owner / missing reference / non-accepted),
      // the UPDATE affects 0 rows — we report 404 without leaking why.
      const { data, error } = await serviceClient
        .from('references')
        .update({ include_on_cv: body.includeOnCv })
        .eq('id', body.referenceId)
        .eq('requester_person_id', user.id)
        .eq('status', 'accepted')
        .select('id');
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!data || data.length === 0) {
        return NextResponse.json(
          { error: 'Reference not found or not eligible (must be accepted and owned by you)' },
          { status: 404 },
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (typeof body.experienceId === 'string' && typeof body.cvShowFullVessel === 'boolean') {
      const { data, error } = await serviceClient
        .from('crew_experiences')
        .update({ cv_show_full_vessel: body.cvShowFullVessel })
        .eq('id', body.experienceId)
        .eq('person_id', user.id)
        .select('id');
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!data || data.length === 0) {
        return NextResponse.json(
          { error: 'Experience not found or not owned by you' },
          { status: 404 },
        );
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      {
        error:
          'Body must include exactly one of: { cvIncludeSeaTime }, { referenceId, includeOnCv }, or { experienceId, cvShowFullVessel }.',
      },
      { status: 400 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
