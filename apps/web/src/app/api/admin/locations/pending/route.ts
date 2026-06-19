import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

export interface PendingCity {
  id: string;
  name: string;
  region_id: string;
  region_name: string | null;
  country_code: string | null;
  created_at: string;
  submitted_by: string | null;
  submitter_name: string | null;
  notes: string | null;
}

export interface PendingPort {
  id: string;
  name: string;
  city_id: string;
  city_name: string | null;
  region_id: string | null;
  region_name: string | null;
  country_code: string | null;
  created_at: string;
  submitted_by: string | null;
  submitter_name: string | null;
}

interface CityRow {
  id: string;
  name: string;
  region_id: string;
  created_at: string;
  submitted_by: string | null;
  regions: { id: string; name: string; country_code: string | null } | null;
}

interface PortRow {
  id: string;
  name: string;
  city_id: string;
  created_at: string;
  submitted_by: string | null;
  cities: {
    id: string;
    name: string;
    region_id: string;
    regions: { id: string; name: string; country_code: string | null } | null;
  } | null;
}

/**
 * GET /api/admin/locations/pending
 *
 * Returns every `source='pending'` city and port that hasn't been
 * hidden, with their full parent chain (city → region for cities,
 * port → city → region for ports) and the submitter's display name.
 * Backs the `/admin/locations/pending` queue page.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;

  try {
    const [{ data: cityRows, error: cityError }, { data: portRows, error: portError }] =
      await Promise.all([
        serviceClient
          .from('cities')
          .select(
            'id, name, region_id, created_at, submitted_by, regions:region_id(id, name, country_code)',
          )
          .eq('source', 'pending')
          .is('hidden_at', null)
          .order('created_at', { ascending: false }),
        serviceClient
          .from('ports')
          .select(
            'id, name, city_id, created_at, submitted_by, cities:city_id(id, name, region_id, regions:region_id(id, name, country_code))',
          )
          .eq('source', 'pending')
          .is('hidden_at', null)
          .order('created_at', { ascending: false }),
      ]);

    if (cityError) {
      return NextResponse.json({ error: cityError.message }, { status: 500 });
    }
    if (portError) {
      return NextResponse.json({ error: portError.message }, { status: 500 });
    }

    // Batch-resolve submitter display names so the page doesn't have to
    // chase one query per row.
    const cities = (cityRows ?? []) as unknown as CityRow[];
    const ports = (portRows ?? []) as unknown as PortRow[];
    const submitterIds = new Set<string>();
    for (const c of cities) {
      if (c.submitted_by) submitterIds.add(c.submitted_by);
    }
    for (const p of ports) {
      if (p.submitted_by) submitterIds.add(p.submitted_by);
    }

    const nameById = new Map<string, string>();
    if (submitterIds.size > 0) {
      const { data: profiles } = await serviceClient
        .from('profiles')
        .select('person_id, display_name')
        .in('person_id', Array.from(submitterIds));
      for (const p of profiles ?? []) {
        const personId = (p as { person_id?: string }).person_id;
        const displayName = (p as { display_name?: string | null }).display_name;
        if (personId && displayName) {
          nameById.set(personId, displayName);
        }
      }
    }

    const cityResults: PendingCity[] = cities.map((c) => ({
      id: c.id,
      name: c.name,
      region_id: c.region_id,
      region_name: c.regions?.name ?? null,
      country_code: c.regions?.country_code ?? null,
      created_at: c.created_at,
      submitted_by: c.submitted_by,
      submitter_name: c.submitted_by ? (nameById.get(c.submitted_by) ?? null) : null,
      notes: null,
    }));

    const portResults: PendingPort[] = ports.map((p) => ({
      id: p.id,
      name: p.name,
      city_id: p.city_id,
      city_name: p.cities?.name ?? null,
      region_id: p.cities?.region_id ?? null,
      region_name: p.cities?.regions?.name ?? null,
      country_code: p.cities?.regions?.country_code ?? null,
      created_at: p.created_at,
      submitted_by: p.submitted_by,
      submitter_name: p.submitted_by ? (nameById.get(p.submitted_by) ?? null) : null,
    }));

    return NextResponse.json({ cities: cityResults, ports: portResults });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pending locations lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
