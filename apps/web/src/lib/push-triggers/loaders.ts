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
