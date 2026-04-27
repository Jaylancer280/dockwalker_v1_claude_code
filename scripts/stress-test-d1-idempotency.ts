/**
 * D-1 idempotency stress test — verifies that the same event with the
 * same idempotency key, fired N times against the live remote DB,
 * produces exactly one event row and runs the projection exactly once.
 *
 * Pre-fix behaviour: each call would insert a new event row and run
 * the projection. For DAYWORK.ACCEPTED specifically, that means
 * positions_filled++ on every retry — over-filling a 1-position
 * daywork into the in_progress state with rejected sibling applicants.
 *
 * Post-fix behaviour: the partial unique index on (person_id,
 * idempotency_key) catches the second insert, the RPC catches the
 * unique_violation, looks up the original event id, and returns it
 * without invoking apply_projection. Subsequent identical calls all
 * return the same event id.
 *
 * Test setup:
 *   - Create a fixture daywork (positions_available = 1)
 *   - Fire DAYWORK.ACCEPTED 5 times concurrently with the same key
 *   - Assert: events table has exactly 1 row with that key
 *   - Assert: dayworks.positions_filled == 1 (not 5)
 *   - Assert: all 5 RPC calls returned the same event_id
 *
 * Then verify the negative case:
 *   - Same event fired without a key → second call would still run
 *     the projection (no dedup), positions_filled would go to 2.
 *   - This is the unprotected baseline routes still operate under,
 *     and it's the failure mode the index prevents when a key IS
 *     supplied.
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
  console.log(`▶ D-1 idempotency stress test against ${url}\n`);

  // Pick fixtures: any person, any vessel, any role, any port.
  const { data: poster } = await sb
    .from('persons')
    .select('id')
    .is('deactivated_at', null)
    .limit(1)
    .maybeSingle();
  if (!poster) {
    console.log('No persons in DB — aborting');
    process.exit(1);
  }
  const { data: vessel } = await sb.from('vessels').select('id').limit(1).maybeSingle();
  const { data: role } = await sb.from('yacht_roles').select('id').limit(1).maybeSingle();
  const { data: port } = await sb.from('ports').select('id').limit(1).maybeSingle();
  const { data: bracket } = await sb
    .from('experience_brackets')
    .select('id')
    .limit(1)
    .maybeSingle();
  if (!vessel || !role || !port || !bracket) {
    console.log('Missing canonical fixture (vessel/role/port/bracket) — aborting');
    process.exit(1);
  }

  // Create a fresh daywork for this test (fixture isolation).
  const dayworkId = randomUUID();
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const dayAfter = new Date(today.getTime() + 2 * 86_400_000);
  const startDate = tomorrow.toISOString().slice(0, 10);
  const endDate = dayAfter.toISOString().slice(0, 10);
  const crewId = randomUUID(); // never resolves to a real applicant — that's fine,
  // the projection's UPDATE on applications will no-op cleanly.

  console.log('Setup: insert fixture daywork (positions_available=1)');
  {
    const { error } = await sb.rpc('append_event', {
      p_event_type: 'DAYWORK.POSTED',
      p_aggregate_id: dayworkId,
      p_aggregate_type: 'daywork',
      p_role_context: 'employer',
      p_payload: {
        id: dayworkId,
        vessel_id: vessel.id,
        role_id: role.id,
        location_port_id: port.id,
        start_date: startDate,
        end_date: endDate,
        working_days: 2,
        required_certification_ids: [],
        experience_bracket_id: bracket.id,
        day_rate: 200,
        currency: 'EUR',
        meals: [],
        notes: '__d1_stress_fixture',
        positions_available: 1,
        permanent_opportunity: false,
        required_languages: [],
      },
      p_person_id: poster.id,
      p_idempotency_key: null,
    });
    if (error) {
      console.error('Fixture daywork creation failed:', error.message);
      process.exit(1);
    }
  }

  console.log('\nFire DAYWORK.ACCEPTED 5x concurrently with same idempotency key:');
  const idempKey = `D1.STRESS.ACCEPTED:${crewId}:${dayworkId}`;
  const calls = Array.from({ length: 5 }, () =>
    sb.rpc('append_event', {
      p_event_type: 'DAYWORK.ACCEPTED',
      p_aggregate_id: `${crewId}:${dayworkId}`,
      p_aggregate_type: 'application',
      p_role_context: 'employer',
      p_payload: {
        daywork_id: dayworkId,
        crew_person_id: crewId,
        employer_person_id: poster.id,
        start_date: startDate,
        end_date: endDate,
      },
      p_person_id: poster.id,
      p_idempotency_key: idempKey,
    }),
  );
  const settled = await Promise.all(calls);

  const errors = settled.filter((r) => r.error).map((r) => r.error?.message);
  record('all 5 RPC calls succeeded', errors.length === 0, errors.join('; '));

  const eventIds = settled.map((r) => r.data as string).filter(Boolean);
  const uniqueEventIds = new Set(eventIds);
  record(
    'all 5 calls returned the SAME event_id',
    uniqueEventIds.size === 1,
    `${uniqueEventIds.size} distinct event_ids: ${[...uniqueEventIds].join(', ')}`,
  );

  const { data: eventRows, count: eventCount } = await sb
    .from('events')
    .select('id', { count: 'exact' })
    .eq('person_id', poster.id)
    .eq('idempotency_key', idempKey);
  record(
    'events table has exactly 1 row for the idempotency key',
    eventCount === 1,
    `count=${eventCount}, rows=${(eventRows ?? []).length}`,
  );

  const { data: dayworkAfter } = await sb
    .from('dayworks')
    .select('positions_filled, positions_available, status')
    .eq('id', dayworkId)
    .single();
  record(
    'dayworks.positions_filled incremented by exactly 1 (was: 5)',
    dayworkAfter?.positions_filled === 1,
    `positions_filled=${dayworkAfter?.positions_filled}, status=${dayworkAfter?.status}`,
  );

  console.log('\nNegative control: fire same DAYWORK.ACCEPTED 3x WITHOUT a key:');
  console.log('  (deliberately doubles positions_filled — verifies dedup is what saves us)');
  const dayworkId2 = randomUUID();
  const crewId2 = randomUUID();
  await sb.rpc('append_event', {
    p_event_type: 'DAYWORK.POSTED',
    p_aggregate_id: dayworkId2,
    p_aggregate_type: 'daywork',
    p_role_context: 'employer',
    p_payload: {
      id: dayworkId2,
      vessel_id: vessel.id,
      role_id: role.id,
      location_port_id: port.id,
      start_date: startDate,
      end_date: endDate,
      working_days: 2,
      required_certification_ids: [],
      experience_bracket_id: bracket.id,
      day_rate: 200,
      currency: 'EUR',
      meals: [],
      notes: '__d1_stress_fixture_negative',
      positions_available: 5,
      permanent_opportunity: false,
      required_languages: [],
    },
    p_person_id: poster.id,
    p_idempotency_key: null,
  });
  const noKeyCalls = Array.from({ length: 3 }, () =>
    sb.rpc('append_event', {
      p_event_type: 'DAYWORK.ACCEPTED',
      p_aggregate_id: `${crewId2}:${dayworkId2}`,
      p_aggregate_type: 'application',
      p_role_context: 'employer',
      p_payload: {
        daywork_id: dayworkId2,
        crew_person_id: crewId2,
        employer_person_id: poster.id,
        start_date: startDate,
        end_date: endDate,
      },
      p_person_id: poster.id,
      p_idempotency_key: null,
    }),
  );
  const noKeySettled = await Promise.all(noKeyCalls);
  const noKeyEventIds = new Set(noKeySettled.map((r) => r.data as string).filter(Boolean));
  record(
    'without a key: 3 calls produced 3 distinct event_ids',
    noKeyEventIds.size === 3,
    `${noKeyEventIds.size} distinct event_ids`,
  );
  const { data: dayworkAfter2 } = await sb
    .from('dayworks')
    .select('positions_filled')
    .eq('id', dayworkId2)
    .single();
  record(
    'without a key: positions_filled incremented by 3 (the bug we are preventing)',
    dayworkAfter2?.positions_filled === 3,
    `positions_filled=${dayworkAfter2?.positions_filled}`,
  );

  console.log('\nCleanup: drop both fixture dayworks');
  await sb.from('dayworks').delete().in('id', [dayworkId, dayworkId2]);

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  if (passed !== results.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
