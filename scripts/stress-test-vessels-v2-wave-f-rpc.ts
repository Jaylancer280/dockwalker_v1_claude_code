/**
 * Vessels V2 Wave F (RPC half) stress test — verifies that
 * `get_vessel_public` and `get_vessels_public_batch` filter pending +
 * hidden rows from non-owners.
 *
 * Service role acts as a non-owner non-engaged caller (auth.uid() = null
 * inside the SECURITY DEFINER function), so hidden + pending sentinel
 * rows should be filtered. The owner-reveal + engagement-reveal OR
 * branches are verified by code inspection (their structure mirrors
 * 00083's NDA reveal which existing tests already exercise).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(): { url: string; key: string } {
  const path = resolve(process.cwd(), 'apps/web/.env.production.local');
  const text = readFileSync(path, 'utf8');
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/\r$/, '').replace(/^["']|["']$/g, '');
  }
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(`Missing env vars in ${path}`);
  }
  return { url: env.NEXT_PUBLIC_SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY };
}

interface Result {
  name: string;
  ok: boolean;
  detail?: string;
}
const results: Result[] = [];
function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  const { url, key } = loadEnv();
  const sb = createClient(url, key);
  console.log(`▶ Vessels V2 Wave F (RPC) stress test against ${url}\n`);

  // Pick three sentinel IMOs that don't collide with seed data.
  const baseImo = 8000000 + Math.floor(Math.random() * 1000000);
  const imoCurated = String(baseImo);
  const imoPending = String(baseImo + 1);
  const imoHidden = String(baseImo + 2);

  // Need a size band id and a person id (any will do — service role
  // doesn't match owner_person_id since auth.uid() is null).
  const { data: sizeBand } = await sb
    .from('vessel_size_bands')
    .select('id')
    .limit(1)
    .single();
  const { data: anyPerson } = await sb.from('persons').select('id').limit(1).single();
  if (!sizeBand || !anyPerson) {
    throw new Error('Could not load size_band / person for fixture setup');
  }

  // Insert three vessels: curated, pending, hidden (curated + hidden_at).
  const { data: vCurated, error: e1 } = await sb
    .from('vessels')
    .insert({
      imo_number: imoCurated,
      name: '__stress_curated',
      vessel_type: 'motor',
      size_band_id: sizeBand.id,
      loa_meters: 50,
      source: 'curated',
      owner_person_id: anyPerson.id,
    })
    .select('id')
    .single();
  if (e1 || !vCurated) throw new Error(`curated insert failed: ${e1?.message}`);

  const { data: vPending, error: e2 } = await sb
    .from('vessels')
    .insert({
      imo_number: imoPending,
      name: '__stress_pending',
      vessel_type: 'motor',
      size_band_id: sizeBand.id,
      loa_meters: 50,
      source: 'pending',
      owner_person_id: anyPerson.id,
    })
    .select('id')
    .single();
  if (e2 || !vPending) throw new Error(`pending insert failed: ${e2?.message}`);

  const { data: vHidden, error: e3 } = await sb
    .from('vessels')
    .insert({
      imo_number: imoHidden,
      name: '__stress_hidden',
      vessel_type: 'motor',
      size_band_id: sizeBand.id,
      loa_meters: 50,
      source: 'curated',
      hidden_at: new Date().toISOString(),
      owner_person_id: anyPerson.id,
    })
    .select('id')
    .single();
  if (e3 || !vHidden) throw new Error(`hidden insert failed: ${e3?.message}`);

  console.log('Single-vessel get_vessel_public (service role = non-owner, non-engaged):');
  {
    const { data } = await sb.rpc('get_vessel_public', { p_vessel_id: vCurated.id });
    record('curated vessel returns one row', (data ?? []).length === 1);
  }
  {
    const { data } = await sb.rpc('get_vessel_public', { p_vessel_id: vPending.id });
    record('pending vessel returns zero rows', (data ?? []).length === 0);
  }
  {
    const { data } = await sb.rpc('get_vessel_public', { p_vessel_id: vHidden.id });
    record('hidden vessel returns zero rows', (data ?? []).length === 0);
  }

  console.log('\nBatch get_vessels_public_batch:');
  {
    const ids = [vCurated.id, vPending.id, vHidden.id];
    const { data } = await sb.rpc('get_vessels_public_batch', { p_vessel_ids: ids });
    const returnedIds = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
    record(
      'batch with [curated, pending, hidden] returns only the curated row',
      returnedIds.length === 1 && returnedIds[0] === vCurated.id,
      `returned ${returnedIds.length} ids: ${returnedIds.join(',') || '(none)'}`,
    );
  }
  {
    const { data } = await sb.rpc('get_vessels_public_batch', {
      p_vessel_ids: [vPending.id],
    });
    record('batch with only pending vessel returns empty', (data ?? []).length === 0);
  }
  {
    const { data } = await sb.rpc('get_vessels_public_batch', {
      p_vessel_ids: [vHidden.id],
    });
    record('batch with only hidden vessel returns empty', (data ?? []).length === 0);
  }

  // Cleanup.
  await sb.from('vessels').delete().in('id', [vCurated.id, vPending.id, vHidden.id]);

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  if (passed !== results.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
