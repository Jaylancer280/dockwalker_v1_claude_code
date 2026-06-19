import type { SupabaseClient } from '@supabase/supabase-js';

export async function getJobNumber(sc: SupabaseClient, dayworkId: string): Promise<string> {
  const { data } = await sc.from('dayworks').select('job_number').eq('id', dayworkId).single();
  return data?.job_number ? `DW-${String(data.job_number).padStart(5, '0')}` : 'a daywork';
}

export async function getDisplayName(sc: SupabaseClient, personId: string): Promise<string> {
  const { data } = await sc
    .from('profiles')
    .select('display_name')
    .eq('person_id', personId)
    .single();
  return data?.display_name ?? 'Someone';
}

export async function getEngagementParties(
  sc: SupabaseClient,
  engagementId: string,
): Promise<{
  crew_person_id: string;
  employer_person_id: string;
  daywork_id: string;
  permanent_posting_id: string | null;
} | null> {
  const { data } = await sc
    .from('active_engagements')
    .select('crew_person_id, employer_person_id, daywork_id, permanent_posting_id')
    .eq('id', engagementId)
    .single();
  return data;
}

export async function getPermanentPostingInfo(
  sc: SupabaseClient,
  postingId: string,
): Promise<{ employer_person_id: string; role_name: string; job_number: string } | null> {
  const { data } = await sc
    .from('permanent_postings')
    .select('employer_person_id, job_number, yacht_roles(name)')
    .eq('id', postingId)
    .single();
  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roleName = (data as any).yacht_roles?.name ?? 'Permanent role';
  return {
    employer_person_id: data.employer_person_id,
    role_name: roleName,
    job_number: `PM-${String(data.job_number).padStart(5, '0')}`,
  };
}

export async function getDayworkPoster(
  sc: SupabaseClient,
  dayworkId: string,
): Promise<string | null> {
  const { data } = await sc
    .from('dayworks')
    .select('poster_person_id')
    .eq('id', dayworkId)
    .single();
  return data?.poster_person_id ?? null;
}

export async function hasPushTokens(sc: SupabaseClient, personId: string): Promise<boolean> {
  const { count } = await sc
    .from('device_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('person_id', personId);
  return (count ?? 0) > 0;
}

export async function getRecipientEmail(
  sc: SupabaseClient,
  personId: string,
): Promise<string | null> {
  const { data } = await sc.auth.admin.getUserById(personId);
  return data?.user?.email ?? null;
}

// ─── Extended context loaders (email rich subjects + body copy) ─────────────

export interface DayworkContext {
  roleName: string;
  vesselName: string;
  vesselType: 'motor' | 'sail';
  startDate: string;
  jobNumber: string;
}

export async function getDayworkContext(
  sc: SupabaseClient,
  dayworkId: string,
): Promise<DayworkContext | null> {
  const { data } = await sc
    .from('dayworks')
    .select('job_number, start_date, yacht_roles(name), vessels(name, vessel_type)')
    .eq('id', dayworkId)
    .single();
  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return {
    roleName: d.yacht_roles?.name ?? 'Daywork',
    vesselName: d.vessels?.name ?? 'Vessel',
    vesselType: (d.vessels?.vessel_type ?? 'motor') as 'motor' | 'sail',
    startDate: d.start_date as string,
    jobNumber: d.job_number ? `DW-${String(d.job_number).padStart(5, '0')}` : 'DW',
  };
}

export interface PermanentPostingContext {
  roleName: string;
  vesselName: string;
  vesselType: 'motor' | 'sail';
  jobNumber: string;
  employerPersonId: string;
}

export async function getPermanentPostingContext(
  sc: SupabaseClient,
  postingId: string,
): Promise<PermanentPostingContext | null> {
  const { data } = await sc
    .from('permanent_postings')
    .select('employer_person_id, job_number, yacht_roles(name), vessels(name, vessel_type)')
    .eq('id', postingId)
    .single();
  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return {
    roleName: d.yacht_roles?.name ?? 'Permanent role',
    vesselName: d.vessels?.name ?? 'Vessel',
    vesselType: (d.vessels?.vessel_type ?? 'motor') as 'motor' | 'sail',
    jobNumber: d.job_number ? `PM-${String(d.job_number).padStart(5, '0')}` : 'PM',
    employerPersonId: d.employer_person_id as string,
  };
}

export interface ApplicantProfileSummary {
  displayName: string;
  experienceBracketLabel: string | null;
  cityLabel: string | null;
}

export async function getApplicantProfileSummary(
  sc: SupabaseClient,
  personId: string,
): Promise<ApplicantProfileSummary> {
  const { data } = await sc
    .from('profiles')
    .select(
      'display_name, experience_brackets(label), location_cities:cities!profiles_location_city_id_fkey(name)',
    )
    .eq('person_id', personId)
    .single();
  if (!data) return { displayName: 'Someone', experienceBracketLabel: null, cityLabel: null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return {
    displayName: d.display_name ?? 'Someone',
    experienceBracketLabel: d.experience_brackets?.label ?? null,
    cityLabel: d.location_cities?.name ?? null,
  };
}

/**
 * For MESSAGE.SENT emails — resolves the role name of the engagement so the
 * subject can say "New message about Deckhand" instead of just "New message".
 */
export async function getEngagementRoleName(
  sc: SupabaseClient,
  engagementId: string,
): Promise<string | null> {
  const { data: eng } = await sc
    .from('active_engagements')
    .select('daywork_id, permanent_posting_id')
    .eq('id', engagementId)
    .single();
  if (!eng) return null;
  if (eng.daywork_id) {
    const { data } = await sc
      .from('dayworks')
      .select('yacht_roles(name)')
      .eq('id', eng.daywork_id)
      .single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any)?.yacht_roles?.name ?? null;
  }
  if (eng.permanent_posting_id) {
    const { data } = await sc
      .from('permanent_postings')
      .select('yacht_roles(name)')
      .eq('id', eng.permanent_posting_id)
      .single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any)?.yacht_roles?.name ?? null;
  }
  return null;
}

/**
 * For PERMANENT.PLACEMENT_CONFIRMED emails — the event payload does not carry
 * the engagement id, so resolve it via the posting.
 */
export async function getActiveEngagementIdByPermanentPosting(
  sc: SupabaseClient,
  postingId: string,
): Promise<string | null> {
  const { data } = await sc
    .from('active_engagements')
    .select('id')
    .eq('permanent_posting_id', postingId)
    .eq('status', 'active')
    .maybeSingle();
  return data?.id ?? null;
}
