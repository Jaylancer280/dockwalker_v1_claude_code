import { NextResponse } from 'next/server';
import { createClient as createServerClient, createServiceClient } from '@/lib/supabase/server';
import { resolveHistoricalVesselNames } from '@/lib/vessels/historical-names';
import { getCvHandleAnonLimit, getCvHandleAuthLimit } from '@/lib/rate-limit';

/**
 * GET /api/cv/[handle]
 *
 * Public-ish QR-landing endpoint. Returns the crew member's full
 * CV-shaped profile keyed by `profiles.cv_handle` (8-char alphanumeric).
 *
 * Auth model: caller may be unauthenticated. We use the service-role
 * client for the DB reads so RLS doesn't filter unrelated rows. Caller
 * identity is read off the cookie session for rate-limit segmentation
 * only — no per-row authorisation.
 *
 * Rate limits (spec §5):
 *   - 20/hour per IP for unauthenticated callers
 *   - 100/hour per IP for authenticated callers
 *
 * Tombstone semantics (spec §5 state 4): when the underlying crew is
 * deactivated or scrubbed, we return 200 with `{ tombstone: true }`
 * rather than a 404 — the page renders a graceful handoff instead of
 * a "page not found" wall.
 *
 * NDA mask (spec §8): per-experience `cv_show_full_vessel` toggle
 * governs the response. When false (or missing — privacy-safe
 * backstop), we replace `vessel_name` with `'NDA Vessel'` and null
 * `vessel_imo`. References inherit the toggle from their bound
 * experience.
 *
 * Stale flag (spec §11): `stale = profiles.updated_at > cv_generated_at + 30d`.
 * The page renders a soft banner when true.
 *
 * Sea-time totals (spec §3): only included when
 * `profiles.cv_include_sea_time = true` (default false / privacy default).
 */

const HANDLE_RE = /^[A-Za-z0-9]{8}$/;
const STALE_DAYS = 30;

interface ExperienceRow {
  id: string;
  vessel_id: string | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  vessel_operation: string | null;
  flag_state: string | null;
  contract_type: string | null;
  contract_details: string | null;
  description: string | null;
  sea_time_days: number | null;
  sea_time_nautical_miles: number | null;
  cv_show_full_vessel: boolean | null;
  vessels: {
    id: string;
    imo_number: string | null;
    name: string | null;
    vessel_type: string | null;
    nda_flag: boolean | null;
  } | null;
  yacht_roles: { id: string; name: string; department: string } | null;
}

interface ReferenceRow {
  id: string;
  experience_id: string | null;
  vessel_id: string | null;
  claimed_referee_name: string;
  claimed_referee_role: string;
  comment: string | null;
  comment_updated_at: string | null;
  consented_at: string | null;
  snapshot_vessel_imo: string | null;
  snapshot_vessel_name: string | null;
  snapshot_start_date: string | null;
  snapshot_end_date: string | null;
  include_on_cv: boolean | null;
}

function rateLimitHeaders(remaining: number, reset: number): Record<string, string> {
  return {
    'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
    'X-RateLimit-Remaining': String(remaining),
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  if (!HANDLE_RE.test(handle)) {
    return NextResponse.json({ error: 'Invalid handle' }, { status: 400 });
  }

  // Identify caller for rate-limit segmentation (auth vs anon). The session
  // cookie attaches automatically; we don't fail if it's absent.
  let authedUserId: string | null = null;
  try {
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getUser();
    authedUserId = data.user?.id ?? null;
  } catch {
    // Cookie / cookies() is unavailable in some test contexts — treat as anon.
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  const limiter = authedUserId ? getCvHandleAuthLimit() : getCvHandleAnonLimit();
  if (limiter) {
    const key = authedUserId ? `auth:${authedUserId}` : `ip:${ip}`;
    const { success, remaining, reset } = await limiter.limit(key);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitHeaders(remaining, reset) },
      );
    }
  }

  try {
    const serviceClient = await createServiceClient();

    // 1. Find the profile by handle. Service role bypasses RLS — fine, the
    //    response is built from CV-publishable columns only.
    const { data: profile, error: profileErr } = await serviceClient
      .from('profiles')
      .select(
        `
        person_id, display_name, deck_name, identity_type, bio, avatar_url,
        cv_handle, cv_handle_updated_at, cv_include_sea_time, cv_generated_at,
        permanent_availability, notice_period_days, currently_employed,
        primary_role_id, certification_ids, vessel_size_exposure_ids,
        location_port_id, location_city_id,
        nationality_ids, entry_right_ids, languages,
        smoker, visible_tattoos, updated_at,
        yacht_roles!profiles_primary_role_id_fkey(id, name, department),
        ports(id, name, cities(name, regions(name))),
        location_cities:cities!profiles_location_city_id_fkey(id, name, regions(name))
      `,
      )
      .eq('cv_handle', handle)
      .maybeSingle();

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }
    if (!profile) {
      return NextResponse.json({ error: 'CV not found' }, { status: 404 });
    }

    // 2. Tombstone check. A deactivated person hasn't been scrubbed yet but
    //    has explicitly turned off their account; a scrubbed person has had
    //    PII wiped (current_hat=null after 00108).
    const { data: person } = await serviceClient
      .from('persons')
      .select('id, current_hat, deactivated_at, blocked_at')
      .eq('id', profile.person_id)
      .single();

    if (!person || person.deactivated_at || person.blocked_at || person.current_hat === null) {
      return NextResponse.json({ tombstone: true });
    }

    // 3. Fetch experiences + vessels + roles. The service-role client lets
    //    us read all crew_experiences regardless of ownership; we resolve
    //    period-correct names and apply the NDA mask in user-space below.
    const { data: experiencesRaw } = await serviceClient
      .from('crew_experiences')
      .select(
        `
        id, vessel_id, start_date, end_date, is_current,
        vessel_operation, flag_state, contract_type, contract_details, description,
        sea_time_days, sea_time_nautical_miles, cv_show_full_vessel,
        vessels(id, imo_number, name, vessel_type, nda_flag),
        yacht_roles(id, name, department)
      `,
      )
      .eq('person_id', profile.person_id)
      .order('start_date', { ascending: false });

    const experienceRows = (experiencesRaw ?? []) as unknown as ExperienceRow[];

    const historicalNames = await resolveHistoricalVesselNames(
      serviceClient,
      experienceRows
        .filter((e) => e.vessel_id)
        .map((e) => ({ vessel_id: e.vessel_id as string, start_date: e.start_date })),
    );

    const experiences = experienceRows.map((e) => {
      const vessel = e.vessels;
      // NDA mask: respects per-experience toggle. Default-mask when toggle
      // is null (privacy-safe backstop per spec §8). When the vessel is
      // NOT NDA, the toggle has no effect — we always show the name.
      const ndaMasked = vessel?.nda_flag === true && e.cv_show_full_vessel !== true;
      const historicalName = e.vessel_id
        ? historicalNames.get(`${e.vessel_id}|${e.start_date}`)
        : undefined;
      const renderedName = ndaMasked ? 'NDA Vessel' : (historicalName ?? vessel?.name ?? null);
      const renderedImo = ndaMasked ? null : (vessel?.imo_number ?? null);
      return {
        id: e.id,
        vessel_name: renderedName,
        vessel_imo: renderedImo,
        vessel_type: ndaMasked ? null : (vessel?.vessel_type ?? null),
        nda_masked: ndaMasked,
        role: e.yacht_roles
          ? {
              id: e.yacht_roles.id,
              name: e.yacht_roles.name,
              department: e.yacht_roles.department,
            }
          : null,
        start_date: e.start_date,
        end_date: e.end_date,
        is_current: e.is_current,
        vessel_operation: e.vessel_operation,
        flag_state: ndaMasked ? null : e.flag_state,
        contract_type: e.contract_type,
        contract_details: e.contract_details,
        description: e.description,
      };
    });

    // 4. Fetch opted-in accepted references. Each reference is bound to an
    //    experience — we inherit that experience's NDA mask when present.
    const { data: referencesRaw } = await serviceClient
      .from('references')
      .select(
        `
        id, experience_id, vessel_id,
        claimed_referee_name, claimed_referee_role, comment, comment_updated_at,
        consented_at, snapshot_vessel_imo, snapshot_vessel_name,
        snapshot_start_date, snapshot_end_date, include_on_cv
      `,
      )
      .eq('requester_person_id', profile.person_id)
      .eq('status', 'accepted')
      .eq('include_on_cv', true)
      .order('consented_at', { ascending: false });

    const referenceRows = (referencesRaw ?? []) as unknown as ReferenceRow[];

    // Build a quick lookup: experience_id → cv_show_full_vessel + nda_flag
    const experienceMaskById = new Map<string, { ndaMasked: boolean }>();
    for (const e of experienceRows) {
      const ndaMasked = e.vessels?.nda_flag === true && e.cv_show_full_vessel !== true;
      experienceMaskById.set(e.id, { ndaMasked });
    }

    const references = referenceRows.map((r) => {
      const expMask = r.experience_id ? experienceMaskById.get(r.experience_id) : undefined;
      // If the underlying experience is gone (FK was nulled by EXPERIENCE.REMOVED
      // soft-revoke per migration 00126), the snapshot fields are all we have
      // to render — privacy-safe backstop is to mask.
      const ndaMasked = expMask ? expMask.ndaMasked : true;
      return {
        id: r.id,
        claimed_referee_name: r.claimed_referee_name,
        claimed_referee_role: r.claimed_referee_role,
        comment: r.comment,
        consented_at: r.consented_at,
        snapshot_vessel_name: ndaMasked ? 'NDA Vessel' : r.snapshot_vessel_name,
        snapshot_vessel_imo: ndaMasked ? null : r.snapshot_vessel_imo,
        snapshot_start_date: r.snapshot_start_date,
        snapshot_end_date: r.snapshot_end_date,
        nda_masked: ndaMasked,
      };
    });

    // 5. Sea time totals (only when opted in)
    let seaTime: { days: number; nautical_miles: number } | null = null;
    if (profile.cv_include_sea_time === true) {
      const days = experienceRows.reduce((sum, e) => sum + (e.sea_time_days ?? 0), 0);
      const miles = experienceRows.reduce((sum, e) => sum + (e.sea_time_nautical_miles ?? 0), 0);
      seaTime = { days, nautical_miles: miles };
    }

    // 6. Lookups: certifications + nationalities + entry_rights. These are
    //    canonical reference data with simple ID arrays on the profile —
    //    cheaper to batch-resolve here than to roundtrip per cert/nation.
    const certIds = (profile.certification_ids as string[] | null) ?? [];
    const natIds = (profile.nationality_ids as string[] | null) ?? [];
    const erIds = (profile.entry_right_ids as string[] | null) ?? [];

    const [certsRes, natsRes, ersRes] = await Promise.all([
      certIds.length
        ? serviceClient
            .from('certifications')
            .select('id, name, category, subcategory')
            .in('id', certIds)
        : Promise.resolve({ data: [] }),
      natIds.length
        ? serviceClient
            .from('nationalities')
            .select('id, name, country_code, flag_emoji')
            .in('id', natIds)
        : Promise.resolve({ data: [] }),
      erIds.length
        ? serviceClient.from('entry_rights').select('id, name, category').in('id', erIds)
        : Promise.resolve({ data: [] }),
    ]);

    // 7. Stale flag — true when the profile was meaningfully updated AFTER
    //    the CV was generated. STALE_DAYS grace period prevents the banner
    //    from flashing for routine touches near the same instant.
    let stale = false;
    if (profile.cv_generated_at && profile.updated_at) {
      const generated = new Date(profile.cv_generated_at as string).getTime();
      const updated = new Date(profile.updated_at as string).getTime();
      stale = updated - generated > STALE_DAYS * 24 * 60 * 60 * 1000;
    }

    return NextResponse.json({
      tombstone: false,
      stale,
      cv_generated_at: profile.cv_generated_at,
      person_id: profile.person_id,
      display_name: profile.display_name,
      deck_name: profile.deck_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      primary_role: profile.yacht_roles ?? null,
      permanent_availability: profile.permanent_availability,
      notice_period_days: profile.notice_period_days,
      currently_employed: profile.currently_employed === true,
      smoker: profile.smoker,
      visible_tattoos: profile.visible_tattoos,
      languages: (profile.languages as string[] | null) ?? [],
      location_port: profile.ports ?? null,
      location_city: profile.location_cities ?? null,
      nationalities: (natsRes.data ?? []) as unknown[],
      entry_rights: (ersRes.data ?? []) as unknown[],
      certifications: (certsRes.data ?? []) as unknown[],
      experiences,
      references,
      sea_time: seaTime,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
