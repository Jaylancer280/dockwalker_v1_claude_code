/**
 * D-2 null-safety stress test — verifies that the three daywork
 * handlers in apply_projection raise an exception (rather than
 * silently producing orphan FKs) when the daywork referenced by an
 * event no longer exists.
 *
 * Pre-fix behaviour: SELECT INTO returned no rows, v_filled and
 * v_available stayed NULL, `if v_filled >= v_available` evaluated to
 * NULL → coerced to false in the IF, handler proceeded and inserted
 * an applications row + active_engagement row referencing a non-
 * existent daywork_id. Orphan FK in a referentially-clean table.
 *
 * Post-fix behaviour: each handler explicitly checks
 * `if v_available is null then raise exception`. The append_event
 * RPC propagates the exception back to the caller.
 *
 * Targets:
 *   - DAYWORK.ACCEPTED              (line 367 in 00121, fixed in 00123)
 *   - DAYWORK.INVITATION_ACCEPTED   (line 392 in 00121, fixed in 00123)
 *   - DAYWORK.POSITIONS_UPDATED     (line 349 in 00121, fixed in 00123)
 *
 * Each scenario fires the event with a payload referencing a fresh
 * random UUID that does not match any daywork. We assert that the
 * call returns an error containing the expected message. No fixture
 * setup needed (we want the daywork to be missing) and no cleanup
 * (events table is append-only — leaving the failed-event records as
 * audit data).
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
  // Audit P1-T2 (2026-04-30): D-2 deliberately fires events with random
  // non-existent UUIDs to test the NULL guards in apply_projection. No
  // projection rows are written (the handlers raise before INSERT/UPDATE).
  // The events themselves DO get written to the events table — they are
  // append-only and intentionally retained as audit data. There are no
  // mutable rows to clean up, so no try/finally cleanup pattern needed.
  const { url, key } = loadEnv();
  const sb = createClient(url, key);
  console.log(`▶ D-2 null-safety stress test against ${url}\n`);

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

  const ghostDayworkId = randomUUID();
  const ghostInvitationId = randomUUID();
  const ghostCrewId = randomUUID();

  console.log('DAYWORK.ACCEPTED with non-existent daywork:');
  {
    const { error } = await sb.rpc('append_event', {
      p_event_type: 'DAYWORK.ACCEPTED',
      p_aggregate_id: `${ghostCrewId}:${ghostDayworkId}`,
      p_aggregate_type: 'application',
      p_role_context: 'employer',
      p_payload: {},
      p_person_id: anyPerson.id,
    });
    const msg = error?.message ?? '';
    record(
      'raises exception (was: silent orphan-FK creation)',
      !!error && /no longer exists/i.test(msg) && /DAYWORK\.ACCEPTED/.test(msg),
      msg || 'no error returned',
    );
  }

  console.log('\nDAYWORK.INVITATION_ACCEPTED with non-existent daywork:');
  {
    const { error } = await sb.rpc('append_event', {
      p_event_type: 'DAYWORK.INVITATION_ACCEPTED',
      p_aggregate_id: ghostInvitationId,
      p_aggregate_type: 'invitation',
      p_role_context: 'crew',
      p_payload: {
        invitation_id: ghostInvitationId,
        daywork_id: ghostDayworkId,
        crew_person_id: ghostCrewId,
        employer_person_id: anyPerson.id,
        start_date: '2099-01-01',
        end_date: '2099-01-02',
      },
      p_person_id: anyPerson.id,
    });
    const msg = error?.message ?? '';
    record(
      'raises exception (was: silent orphan-FK creation)',
      !!error && /no longer exists/i.test(msg) && /DAYWORK\.INVITATION_ACCEPTED/.test(msg),
      msg || 'no error returned',
    );
  }

  console.log('\nDAYWORK.POSITIONS_UPDATED with non-existent daywork:');
  {
    const { error } = await sb.rpc('append_event', {
      p_event_type: 'DAYWORK.POSITIONS_UPDATED',
      p_aggregate_id: ghostDayworkId,
      p_aggregate_type: 'daywork',
      p_role_context: 'employer',
      p_payload: {
        daywork_id: ghostDayworkId,
        positions_available: 2,
      },
      p_person_id: anyPerson.id,
    });
    const msg = error?.message ?? '';
    record(
      'raises exception (was: silent no-op)',
      !!error && /no longer exists/i.test(msg) && /DAYWORK\.POSITIONS_UPDATED/.test(msg),
      msg || 'no error returned',
    );
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  if (passed !== results.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
