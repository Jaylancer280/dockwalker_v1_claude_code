import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

interface PublicVesselRow {
  id: string;
  name: string;
  vessel_type: string;
  size_band_label: string | null;
  nda_flag: boolean;
}

/**
 * GET /api/permanent/applications
 * Returns the authenticated crew member's permanent applications
 * with joined posting details.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase } = guard.value;

    if (person.current_hat !== 'crew') {
      return NextResponse.json({ error: 'Only crew can view applications' }, { status: 403 });
    }

    const { data: applications, error } = await supabase
      .from('applications')
      .select(
        `
        id, permanent_posting_id, status, message, rejection_reason, created_at,
        permanent_postings(
          id, job_number, start_date, salary_min, salary_max, salary_currency, salary_period,
          live_aboard, shortlist_cap, notes, status, vessel_id, employer_person_id,
          required_certification_ids,
          yacht_roles(id, name, department),
          ports(id, name, cities(name, regions(name))),
          experience_brackets(label)
        )
      `,
      )
      .eq('crew_person_id', user.id)
      .not('permanent_posting_id', 'is', null)
      .in('status', ['applied', 'shortlisted', 'selected', 'not_selected', 'rejected'])
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (applications ?? []) as any[];

    // Hydrate vessel data
    const vesselIds = [
      ...new Set(rows.map((r) => r.permanent_postings?.vessel_id).filter(Boolean) as string[]),
    ];
    const vesselEntries: Array<[string, PublicVesselRow | null]> = await Promise.all(
      vesselIds.map(async (vesselId): Promise<[string, PublicVesselRow | null]> => {
        const { data, error: vErr } = await supabase.rpc('get_vessel_public', {
          p_vessel_id: vesselId,
        });
        if (vErr) return [vesselId, null];
        const vessel = Array.isArray(data) ? data[0] : data;
        return vessel ? [vesselId, vessel as PublicVesselRow] : [vesselId, null];
      }),
    );
    const vesselMap = new Map<string, PublicVesselRow | null>(vesselEntries);

    // Resolve poster display names
    const posterIds = [
      ...new Set(
        rows.map((r) => r.permanent_postings?.employer_person_id).filter(Boolean) as string[],
      ),
    ];
    const posterNameMap = new Map<string, string>();
    if (posterIds.length > 0) {
      const { data: posterProfiles } = await supabase
        .from('profiles')
        .select('person_id, display_name')
        .in('person_id', posterIds);
      for (const p of posterProfiles ?? []) {
        posterNameMap.set(p.person_id, p.display_name);
      }
    }

    // Resolve cert names
    const allCertIds = [
      ...new Set(
        rows.flatMap((r) => (r.permanent_postings?.required_certification_ids as string[]) ?? []),
      ),
    ];
    const certNameMap = new Map<string, string>();
    if (allCertIds.length > 0) {
      const { data: certs } = await supabase
        .from('certifications')
        .select('id, name')
        .in('id', allCertIds);
      for (const c of certs ?? []) {
        certNameMap.set(c.id, c.name);
      }
    }

    const hydrated = rows.map((app) => {
      const pp = app.permanent_postings;
      const vessel = pp?.vessel_id ? vesselMap.get(pp.vessel_id) : null;
      const posterId = pp?.employer_person_id ?? null;
      const certIds = (pp?.required_certification_ids as string[]) ?? [];

      return {
        id: app.id,
        permanent_posting_id: app.permanent_posting_id,
        status: app.status,
        message: app.message,
        rejection_reason: app.rejection_reason,
        applied_at: app.created_at,
        type: 'permanent' as const,
        posting: pp
          ? {
              job_number: pp.job_number,
              start_date: pp.start_date,
              salary_min: pp.salary_min,
              salary_max: pp.salary_max,
              salary_currency: pp.salary_currency,
              salary_period: pp.salary_period,
              live_aboard: pp.live_aboard,
              shortlist_cap: pp.shortlist_cap,
              notes: pp.notes,
              posting_status: pp.status,
              poster_person_id: posterId,
              poster_name: posterId ? (posterNameMap.get(posterId) ?? null) : null,
              role_name: pp.yacht_roles?.name ?? null,
              role_department: pp.yacht_roles?.department ?? null,
              port_name: pp.ports?.name ?? null,
              city_name: pp.ports?.cities?.name ?? null,
              region_name: pp.ports?.cities?.regions?.name ?? null,
              experience_label: pp.experience_brackets?.label ?? null,
              vessel_name: vessel?.nda_flag ? 'NDA Vessel' : (vessel?.name ?? null),
              vessel_type: vessel?.vessel_type ?? null,
              vessel_size_label: vessel?.size_band_label ?? null,
              cert_names: certIds.map((id) => certNameMap.get(id) ?? id),
            }
          : null,
      };
    });

    return NextResponse.json({ applications: hydrated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
