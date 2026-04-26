/**
 * Vessels V2 Wave B stress test — fires each new event type through
 * `append_event` and verifies the projection writes the right rows.
 *
 * Asserts:
 *   - VESSEL.CREATED: seeds an open-ended `vessel_names` row + sets
 *     new `vessels.source` + `submitted_by`.
 *   - VESSEL.RENAMED: closes previous `vessel_names` row (effective_to
 *     = day before new effective_from), inserts open-ended new row,
 *     updates denormalised `vessels.name`.
 *   - VESSEL.REFLAGGED: same pattern for `vessel_flag_states`,
 *     updates denormalised `vessels.flag_state_id`.
 *   - VESSEL.METADATA_UPDATED: updates the four enrichment columns,
 *     honours explicit nulls separately from omitted fields.
 *
 * Cleans up the fixture vessel at the end (CASCADE wipes history).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
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
  console.log(`▶ Vessels V2 Wave B stress test against ${url}\n`);

  // Find an owner + a size band + a flag state to use as fixtures.
  const { data: anyPerson } = await sb
    .from('persons')
    .select('id')
    .is('deactivated_at', null)
    .limit(1)
    .maybeSingle();
  if (!anyPerson) {
    console.log('No persons in DB — aborting');
    process.exit(1);
  }
  const { data: anyBand } = await sb
    .from('vessel_size_bands')
    .select('id')
    .limit(1)
    .maybeSingle();
  const { data: flag1 } = await sb
    .from('flag_states')
    .select('id')
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();
  const { data: flag2 } = await sb
    .from('flag_states')
    .select('id')
    .order('sort_order', { ascending: true })
    .range(1, 1)
    .maybeSingle();
  if (!anyBand || !flag1 || !flag2) {
    console.log('Missing seed data (size band / flag states)');
    process.exit(1);
  }

  const vesselId = randomUUID();
  const SENTINEL = `__stress_v2b_${Date.now()}`;
  // Some seeded vessels reuse IMO `1234567`. Pick a random 7-digit IMO so
  // we don't collide with the (imo_number, owner_person_id) unique
  // constraint when `anyPerson` happens to own one of those rows.
  const STRESS_IMO = String(2000000 + Math.floor(Math.random() * 7000000));

  console.log('VESSEL.CREATED:');
  {
    const { error } = await sb.rpc('append_event', {
      p_event_type: 'VESSEL.CREATED',
      p_aggregate_id: vesselId,
      p_aggregate_type: 'vessel',
      p_role_context: 'employer',
      p_payload: {
        id: vesselId,
        imo_number: STRESS_IMO,
        name: SENTINEL,
        vessel_type: 'motor',
        size_band_id: anyBand.id,
        loa_meters: 50,
        nda_flag: false,
        source: 'user_submitted',
      },
      p_person_id: anyPerson.id,
    });
    record('append_event(VESSEL.CREATED) succeeded', !error, error?.message);

    const { data: vesselRow } = await sb
      .from('vessels')
      .select('id, name, source, submitted_by')
      .eq('id', vesselId)
      .maybeSingle();
    record('vessels row inserted', !!vesselRow);
    record('vessels.source = "user_submitted"', vesselRow?.source === 'user_submitted');
    record('vessels.submitted_by = caller', vesselRow?.submitted_by === anyPerson.id);

    const { data: nameRow } = await sb
      .from('vessel_names')
      .select('id, name, effective_from, effective_to, source')
      .eq('vessel_id', vesselId)
      .maybeSingle();
    record('vessel_names seed row inserted', !!nameRow);
    record('vessel_names seed name matches CREATED payload', nameRow?.name === SENTINEL);
    record('vessel_names seed effective_to is null (open)', nameRow?.effective_to === null);
  }

  console.log('\nVESSEL.RENAMED (different-day rename — normal case):');
  const renamed = `${SENTINEL}_renamed`;
  {
    // Pick an effective_from FAR in the future so the close interval is
    // unambiguous (effective_to = effective_from - 1 day). The seed row
    // from CREATED uses current_date, so 2030-01-01 is well past.
    const { error } = await sb.rpc('append_event', {
      p_event_type: 'VESSEL.RENAMED',
      p_aggregate_id: vesselId,
      p_aggregate_type: 'vessel',
      p_role_context: 'employer',
      p_payload: { name: renamed, effective_from: '2030-01-01' },
      p_person_id: anyPerson.id,
    });
    record('append_event(VESSEL.RENAMED) succeeded', !error, error?.message);

    const { data: rows } = await sb
      .from('vessel_names')
      .select('name, effective_from, effective_to')
      .eq('vessel_id', vesselId)
      .order('effective_from', { ascending: true });
    record('vessel_names now has 2 rows', rows?.length === 2, `count: ${rows?.length}`);
    if (rows?.length === 2) {
      record(
        'first row closed (effective_to = 2029-12-31, day before new effective_from)',
        rows[0].effective_to === '2029-12-31',
      );
      record('first row name unchanged', rows[0].name === SENTINEL);
      record('second row open (effective_to null)', rows[1].effective_to === null);
      record('second row name = renamed', rows[1].name === renamed);
    }

    const { data: vesselRow } = await sb
      .from('vessels')
      .select('name')
      .eq('id', vesselId)
      .maybeSingle();
    record('vessels.name updated to renamed', vesselRow?.name === renamed);
  }

  console.log('\nVESSEL.RENAMED (same-day rename — GREATEST clamp prevents underflow):');
  const renamedSameDay = `${SENTINEL}_sameday`;
  {
    // Now fire RENAMED again with effective_from = the open row's
    // effective_from. Without the GREATEST clamp this would violate
    // the interval CHECK (effective_to < effective_from). With the
    // clamp we get a zero-length interval (effective_to = effective_from).
    const { error } = await sb.rpc('append_event', {
      p_event_type: 'VESSEL.RENAMED',
      p_aggregate_id: vesselId,
      p_aggregate_type: 'vessel',
      p_role_context: 'employer',
      p_payload: { name: renamedSameDay, effective_from: '2030-01-01' },
      p_person_id: anyPerson.id,
    });
    record('same-day RENAMED succeeded (no CHECK violation)', !error, error?.message);

    const { data: rows } = await sb
      .from('vessel_names')
      .select('name, effective_from, effective_to')
      .eq('vessel_id', vesselId)
      .order('effective_from', { ascending: true })
      .order('created_at', { ascending: true });
    record('vessel_names now has 3 rows', rows?.length === 3, `count: ${rows?.length}`);
    if (rows?.length === 3) {
      // The previously-open row had effective_from=2030-01-01; clamped close
      // gives effective_to=2030-01-01 (zero-length), not 2029-12-31.
      const sameDayClosed = rows.find((r) => r.name === renamed);
      record(
        'GREATEST clamp produced zero-length interval (effective_to=2030-01-01)',
        sameDayClosed?.effective_to === '2030-01-01',
      );
    }
  }

  console.log('\nVESSEL.REFLAGGED:');
  {
    const { error: e1 } = await sb.rpc('append_event', {
      p_event_type: 'VESSEL.REFLAGGED',
      p_aggregate_id: vesselId,
      p_aggregate_type: 'vessel',
      p_role_context: 'employer',
      p_payload: { flag_state_id: flag1.id, effective_from: '2024-01-01' },
      p_person_id: anyPerson.id,
    });
    record('first REFLAGGED succeeded', !e1, e1?.message);

    const { error: e2 } = await sb.rpc('append_event', {
      p_event_type: 'VESSEL.REFLAGGED',
      p_aggregate_id: vesselId,
      p_aggregate_type: 'vessel',
      p_role_context: 'employer',
      p_payload: { flag_state_id: flag2.id, effective_from: '2026-01-01' },
      p_person_id: anyPerson.id,
    });
    record('second REFLAGGED succeeded', !e2, e2?.message);

    const { data: rows } = await sb
      .from('vessel_flag_states')
      .select('flag_state_id, effective_from, effective_to')
      .eq('vessel_id', vesselId)
      .order('effective_from', { ascending: true });
    record('vessel_flag_states has 2 rows', rows?.length === 2);
    if (rows?.length === 2) {
      record(
        'first row closed (effective_to = 2025-12-31)',
        rows[0].effective_to === '2025-12-31',
      );
      record('first row flag = flag1', rows[0].flag_state_id === flag1.id);
      record('second row open (effective_to null)', rows[1].effective_to === null);
      record('second row flag = flag2', rows[1].flag_state_id === flag2.id);
    }

    const { data: vesselRow } = await sb
      .from('vessels')
      .select('flag_state_id')
      .eq('id', vesselId)
      .maybeSingle();
    record('vessels.flag_state_id updated to flag2', vesselRow?.flag_state_id === flag2.id);
  }

  console.log('\nVESSEL.METADATA_UPDATED:');
  {
    const { error } = await sb.rpc('append_event', {
      p_event_type: 'VESSEL.METADATA_UPDATED',
      p_aggregate_id: vesselId,
      p_aggregate_type: 'vessel',
      p_role_context: 'employer',
      p_payload: {
        gross_tonnage: 250,
        beam_meters: 8.5,
        year_built: 2010,
        builder: 'Stress Yard',
      },
      p_person_id: anyPerson.id,
    });
    record('METADATA_UPDATED succeeded', !error, error?.message);

    const { data: row } = await sb
      .from('vessels')
      .select('gross_tonnage, beam_meters, year_built, builder')
      .eq('id', vesselId)
      .maybeSingle();
    record('gross_tonnage = 250', row?.gross_tonnage === 250);
    record('beam_meters = 8.5', Number(row?.beam_meters) === 8.5);
    record('year_built = 2010', row?.year_built === 2010);
    record('builder = "Stress Yard"', row?.builder === 'Stress Yard');

    // Now test omitted-field semantics: send a partial update and
    // verify the omitted fields stay as-is.
    const { error: partialErr } = await sb.rpc('append_event', {
      p_event_type: 'VESSEL.METADATA_UPDATED',
      p_aggregate_id: vesselId,
      p_aggregate_type: 'vessel',
      p_role_context: 'employer',
      p_payload: { year_built: 2015 },
      p_person_id: anyPerson.id,
    });
    record('partial METADATA_UPDATED succeeded', !partialErr, partialErr?.message);
    const { data: row2 } = await sb
      .from('vessels')
      .select('gross_tonnage, year_built, builder')
      .eq('id', vesselId)
      .maybeSingle();
    record('omitted gross_tonnage preserved (still 250)', row2?.gross_tonnage === 250);
    record('omitted builder preserved', row2?.builder === 'Stress Yard');
    record('year_built changed to 2015', row2?.year_built === 2015);

    // Explicit-null clears the value.
    const { error: nullErr } = await sb.rpc('append_event', {
      p_event_type: 'VESSEL.METADATA_UPDATED',
      p_aggregate_id: vesselId,
      p_aggregate_type: 'vessel',
      p_role_context: 'employer',
      p_payload: { builder: null },
      p_person_id: anyPerson.id,
    });
    record('null-value METADATA_UPDATED succeeded', !nullErr, nullErr?.message);
    const { data: row3 } = await sb
      .from('vessels')
      .select('builder')
      .eq('id', vesselId)
      .maybeSingle();
    record('explicit null cleared builder', row3?.builder === null);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────
  // The `events` table is append-only by design — we leave the test
  // events in the ledger as audit data; `aggregate_id` will dangle once
  // the vessel is deleted, which is fine.
  console.log('\nCleanup:');
  const { error: delErr } = await sb.from('vessels').delete().eq('id', vesselId);
  record('DELETE fixture vessel cascaded history', !delErr, delErr?.message);

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n▶ ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Stress test crashed:', err);
  process.exit(1);
});
