import type { SupabaseClient } from '@supabase/supabase-js';

export interface CrewContextResult {
  markdown: string;
  certNames: string[];
  roleName: string;
}

interface ProfileJoins {
  display_name: string;
  bio: string | null;
  shore_experience: string | null;
  motivation: string | null;
  languages: string | null;
  available_to_start: string | null;
  primary_role_id: string | null;
  yacht_roles: unknown;
  certification_ids: string[] | null;
  experience_bracket_id: string | null;
  experience_brackets: unknown;
  vessel_size_exposure_ids: string[] | null;
  location_port_id: string | null;
  ports: unknown;
}

interface ExperienceRow {
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  vessel_operation: string | null;
  flag_state: string | null;
  contract_type: string | null;
  description: string | null;
  vessels: unknown;
  yacht_roles: unknown;
}

export async function buildCrewContext(
  personId: string,
  supabase: SupabaseClient,
): Promise<CrewContextResult> {
  // 1. Profile with joins
  const { data: rawProfile, error: profileError } = await supabase
    .from('profiles')
    .select(
      `
      display_name, bio, shore_experience, motivation, languages, available_to_start,
      primary_role_id, yacht_roles(name),
      certification_ids, experience_bracket_id, experience_brackets(label),
      vessel_size_exposure_ids,
      location_port_id, ports(name, city_id, cities(name, region_id, regions(name)))
    `,
    )
    .eq('person_id', personId)
    .single();

  if (profileError || !rawProfile) {
    return { markdown: '', certNames: [], roleName: '' };
  }

  const profile = rawProfile as unknown as ProfileJoins;

  // 2. Experiences, 3. Cert resolution, 4. Size band resolution — parallel
  const [expResult, certResult, sizeBandResult] = await Promise.all([
    supabase
      .from('crew_experiences')
      .select(
        `
        start_date, end_date, is_current, vessel_operation, flag_state,
        contract_type, description,
        vessels(name, vessel_type, loa_meters, vessel_size_bands(label)),
        yacht_roles(name)
      `,
      )
      .eq('person_id', personId)
      .order('start_date', { ascending: false }),

    supabase
      .from('certifications')
      .select('id, name, category')
      .in('id', profile.certification_ids ?? []),

    supabase
      .from('vessel_size_bands')
      .select('id, label')
      .in('id', profile.vessel_size_exposure_ids ?? []),
  ]);

  const experiences = (expResult.data ?? []) as unknown as ExperienceRow[];
  const certs = (certResult.data ?? []) as Array<{ id: string; name: string; category: string }>;
  const sizeBands = (sizeBandResult.data ?? []) as Array<{ id: string; label: string }>;

  // Extract structured data
  const roleObj = profile.yacht_roles as { name: string } | null;
  const roleName = roleObj?.name ?? '';
  const certNames = certs.map((c) => c.name);

  // Build markdown
  const lines: string[] = ['## Crew Profile'];

  const expBracket = (profile.experience_brackets as { label: string } | null)?.label;
  if (roleName)
    lines.push(`**Role:** ${roleName}${expBracket ? ` | **Experience:** ${expBracket}` : ''}`);

  const ports = profile.ports as {
    name: string;
    cities: { name: string; regions: { name: string } };
  } | null;
  if (ports) {
    lines.push(`**Location:** ${ports.name}, ${ports.cities.name}, ${ports.cities.regions.name}`);
  }

  if (profile.available_to_start) {
    lines.push(`**Available:** ${profile.available_to_start}`);
  }

  if (certNames.length > 0) {
    lines.push(`**Certifications:** ${certNames.join(', ')}`);
  }

  if (sizeBands.length > 0) {
    const labels = sizeBands.map((b) => b.label);
    lines.push(`**Vessel Size Exposure:** ${labels.join(', ')}`);
  }

  if (profile.bio) lines.push(`**Bio:** ${profile.bio}`);
  if (profile.shore_experience) lines.push(`**Shore Experience:** ${profile.shore_experience}`);
  if (profile.motivation) lines.push(`**Motivation:** ${profile.motivation}`);
  if (profile.languages) lines.push(`**Languages:** ${profile.languages}`);

  // Work history
  if (experiences.length > 0) {
    lines.push('');
    lines.push('## Work History');
    experiences.forEach((exp, i) => {
      const vessel = exp.vessels as {
        name: string;
        vessel_type: string;
        loa_meters: number | null;
        vessel_size_bands: { label: string } | null;
      } | null;
      const expRole = (exp.yacht_roles as { name: string } | null)?.name ?? 'Unknown role';
      const prefix = vessel?.vessel_type === 'sail' ? 'S/Y' : 'M/Y';
      const vesselName = vessel ? `${prefix} ${vessel.name}` : 'Unknown vessel';
      const size = vessel?.loa_meters
        ? `${vessel.loa_meters}m`
        : (vessel?.vessel_size_bands?.label ?? '');
      const operation = exp.vessel_operation ?? '';
      const vesselDesc = [size, operation].filter(Boolean).join(' ');

      const startDate = exp.start_date;
      const endDate = exp.is_current ? 'Present' : (exp.end_date ?? '');
      const datePart = endDate ? `${startDate} to ${endDate}` : startDate;

      lines.push(
        `${i + 1}. ${expRole} on ${vesselName}${vesselDesc ? ` (${vesselDesc})` : ''} — ${datePart}`,
      );

      const details: string[] = [];
      if (exp.flag_state) details.push(`Flag: ${exp.flag_state}`);
      if (exp.contract_type) details.push(`Contract: ${exp.contract_type}`);
      if (details.length > 0) lines.push(`   ${details.join(' | ')}`);
    });
  } else if (profile.shore_experience) {
    lines.push('');
    lines.push('[No work history recorded — shore experience shown above instead]');
  }

  return { markdown: lines.join('\n'), certNames, roleName };
}
