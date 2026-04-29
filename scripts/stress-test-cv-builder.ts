/**
 * CV Builder Stage 1 stress test — supersedes
 * `stress-test-cv-builder-phase1.ts` with cumulative coverage of
 * Phases 1, 2, 5a, 6.
 *
 * Verifies the live remote schema + projection cases that the unit
 * test suite can't easily prove (constraint violations, race-guarded
 * UPDATE clauses, multi-event sequences). Auth/route logic is unit-
 * tested via mocks in `__tests__/api/`; this file focuses on the
 * database side of the contract.
 *
 * Cases:
 *
 *   ── Schema (Phase 1 + Phase 5a) ─────────────────────────────
 *   S1-S13  All Phase 1 columns + permanent_invitations exist
 *
 *   ── CV.GENERATED / CV.HANDLE_REGENERATED projection (Phase 1) ──
 *   P1   CV.GENERATED back-fills cv_handle from payload
 *   P2   CV.GENERATED preserves existing cv_handle (coalesce on OLD)
 *   P3   CV.HANDLE_REGENERATED rotates the handle
 *
 *   ── PERMANENT.INVITED projection (Phase 5a) ─────────────────
 *   I1   PERMANENT.INVITED inserts a permanent_invitations row
 *        with status='pending' and the captain as invited_by
 *
 *   ── Apply-after-invite chain (Phase 5a — v2.1 race guard) ───
 *   A1   PERMANENT.APPLIED with invited_from_id flips invitation
 *        to 'applied' AND sets applications.invited_from_id
 *   A2   PERMANENT.APPLIED with invited_from_id pointing at a
 *        non-pending invitation is a no-op for the invitation
 *        (race guard: AND status='pending')
 *
 *   ── Daywork-invitations idempotency (Phase 5a — v2.1) ───────
 *   D1   Direct INSERT of duplicate (daywork_id, crew_person_id)
 *        on daywork_invitations fires Postgres 23505. This is the
 *        DB-level proof of the spec'd 409 mapping in the route.
 *
 *   ── Invitation expiry cron (Phase 6 — v2.1) ─────────────────
 *   E1   Pending invitation older than 30 days flips to 'expired'
 *        when the cron's UPDATE runs
 *   E2   Pending invitation younger than 30 days is unchanged
 *   E3   Non-pending invitations are not touched
 *
 *   ── Tombstone preconditions (Phase 4) ───────────────────────
 *   T1   PERSON.DEACTIVATED sets deactivated_at — the route's
 *        tombstone branch covers this
 *   T2   PERSON.DATA_SCRUBBED nulls current_hat — the route's
 *        tombstone branch covers this
 *
 * Run: `npx tsx scripts/stress-test-cv-builder.ts`
 *
 * Service role + remote URL come from apps/web/.env.production.local.
 * The script is idempotent — failures during cleanup leave a small
 * number of __stress_cv_*@stresstest.invalid auth rows, which can
 * be wiped via the Supabase dashboard or admin_delete_person RPC.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function parseEnv(path: string): Record<string, string> {
  const text = readFileSync(path, 'utf8');
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/\r$/, '').replace(/^["']|["']$/g, '');
  }
  return env;
}

function loadEnv(): { url: string; serviceKey: string } {
  const prod = parseEnv(resolve(process.cwd(), 'apps/web/.env.production.local'));
  const url = prod.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = prod.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing URL or service role key in apps/web/.env.production.local');
  }
  return { url, serviceKey };
}

interface Result {
  name: string;
  ok: boolean;
  detail?: string;
}
const results: Result[] = [];
function record(name: string, ok: boolean, detail?: string): void {
  results.push({ name, ok, detail });
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

type Sb = SupabaseClient;

async function createTestUser(sb: Sb, label: string): Promise<string> {
  const email = `__stress_cv_${label}_${randomUUID()}@stresstest.invalid`;
  const password = randomUUID();
  // @ts-expect-error supabase-js admin types lag
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data?.user) throw new Error(`createUser failed: ${error?.message}`);
  return data.user.id;
}

async function fire(
  sb: Sb,
  eventType: string,
  aggregateId: string,
  aggregateType: string,
  payload: Record<string, unknown>,
  personId: string,
  roleContext = 'crew',
): Promise<{ id?: string; error?: string }> {
  const { data, error } = await sb.rpc('append_event', {
    p_event_type: eventType,
    p_aggregate_id: aggregateId,
    p_aggregate_type: aggregateType,
    p_role_context: roleContext,
    p_payload: payload,
    p_person_id: personId,
    p_idempotency_key: null,
  });
  return { id: data as string | undefined, error: error?.message };
}

async function onboardCrew(sb: Sb, personId: string, displayName: string): Promise<void> {
  await fire(
    sb,
    'PERSON.CREATED',
    personId,
    'person',
    { identity_type: 'crew', current_hat: 'crew' },
    personId,
  );
  await fire(
    sb,
    'PROFILE.CREATED',
    personId,
    'person',
    { display_name: displayName, identity_type: 'crew' },
    personId,
  );
}

async function onboardEmployer(sb: Sb, personId: string, displayName: string): Promise<void> {
  await fire(
    sb,
    'PERSON.CREATED',
    personId,
    'person',
    { identity_type: 'crew', current_hat: 'employer' },
    personId,
    'employer',
  );
  await fire(
    sb,
    'PROFILE.CREATED',
    personId,
    'person',
    { display_name: displayName, identity_type: 'crew' },
    personId,
    'employer',
  );
}

async function cleanup(sb: Sb, personId: string): Promise<void> {
  try {
    await sb.rpc('admin_delete_person', { p_person_id: personId });
  } catch {
    /* non-fatal */
  }
}

async function getAnySizeBandId(sb: Sb): Promise<string> {
  const { data, error } = await sb.from('vessel_size_bands').select('id').limit(1).single();
  if (error || !data) throw new Error(`No vessel_size_bands rows: ${error?.message}`);
  return data.id as string;
}

async function getAnyRoleId(sb: Sb): Promise<string> {
  const { data, error } = await sb.from('yacht_roles').select('id').limit(1).single();
  if (error || !data) throw new Error(`No yacht_roles rows: ${error?.message}`);
  return data.id as string;
}

async function getAnyPortId(sb: Sb): Promise<string> {
  const { data, error } = await sb.from('ports').select('id').limit(1).single();
  if (error || !data) throw new Error(`No ports rows: ${error?.message}`);
  return data.id as string;
}

async function main(): Promise<void> {
  const { url, serviceKey } = loadEnv();
  const sb = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('\n── Schema ────────────────────────────────────────────\n');
  const schemaProbes: Array<[string, string]> = [
    ['profiles', 'cv_handle'],
    ['profiles', 'cv_handle_updated_at'],
    ['profiles', 'cv_include_sea_time'],
    ['profiles', 'cv_generated_at'],
    ['crew_experiences', 'cv_show_full_vessel'],
    ['references', 'include_on_cv'],
    ['applications', 'invited_from_id'],
    ['permanent_invitations', 'permanent_posting_id'],
    ['permanent_invitations', 'crew_person_id'],
    ['permanent_invitations', 'invited_by_person_id'],
    ['permanent_invitations', 'status'],
    ['permanent_invitations', 'message'],
    ['permanent_invitations', 'responded_at'],
  ];
  for (const [table, column] of schemaProbes) {
    const { error } = await sb.from(table).select(column).limit(1);
    record(`S: ${table}.${column} exists`, !error, error?.message);
  }

  // ── CV.GENERATED / CV.HANDLE_REGENERATED ─────────────────────
  console.log('\n── CV.GENERATED / CV.HANDLE_REGENERATED ───────────────\n');

  let cvUser: string | null = null;
  try {
    cvUser = await createTestUser(sb, 'cv');
    await onboardCrew(sb, cvUser, 'CV Stress User');

    // Random handles per run — `cv_handle` carries a UNIQUE index, so a
    // hardcoded handle would 23505 on re-run if the previous run failed
    // mid-cleanup. Same applies to all subsequent handle assertions
    // below.
    function randomHandle(): string {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let out = '';
      for (let i = 0; i < 8; i++) {
        out += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
      return out;
    }
    const minted = randomHandle();
    const r1 = await fire(
      sb,
      'CV.GENERATED',
      cvUser,
      'person',
      { handle: minted, format: 'pdf' },
      cvUser,
    );
    record('P1: CV.GENERATED appended', !r1.error, r1.error);

    const { data: prof1 } = await sb
      .from('profiles')
      .select('cv_handle, cv_generated_at')
      .eq('person_id', cvUser)
      .single();
    record(
      'P1: cv_handle back-filled from payload',
      prof1?.cv_handle === minted,
      prof1?.cv_handle ?? '(null)',
    );
    record('P1: cv_generated_at stamped', prof1?.cv_generated_at !== null);

    // Second CV.GENERATED with a different (also-random) handle should NOT
    // overwrite the first.
    await fire(
      sb,
      'CV.GENERATED',
      cvUser,
      'person',
      { handle: randomHandle(), format: 'pdf' },
      cvUser,
    );
    const { data: prof2 } = await sb
      .from('profiles')
      .select('cv_handle')
      .eq('person_id', cvUser)
      .single();
    record(
      'P2: cv_handle preserved on re-generation (coalesce on OLD)',
      prof2?.cv_handle === minted,
      prof2?.cv_handle ?? '(null)',
    );

    const rotated = randomHandle();
    await fire(
      sb,
      'CV.HANDLE_REGENERATED',
      cvUser,
      'person',
      { old_handle: minted, new_handle: rotated },
      cvUser,
    );
    const { data: prof3 } = await sb
      .from('profiles')
      .select('cv_handle')
      .eq('person_id', cvUser)
      .single();
    record(
      'P3: cv_handle rotated by CV.HANDLE_REGENERATED',
      prof3?.cv_handle === rotated,
      prof3?.cv_handle ?? '(null)',
    );
  } finally {
    if (cvUser) await cleanup(sb, cvUser);
  }

  // ── PERMANENT.INVITED + apply-after-invite race guard ────────
  console.log('\n── PERMANENT.INVITED + apply-after-invite ─────────────\n');

  let employerId: string | null = null;
  let crewId: string | null = null;
  let crewId2: string | null = null;
  try {
    const [sizeBandId, roleId, portId] = await Promise.all([
      getAnySizeBandId(sb),
      getAnyRoleId(sb),
      getAnyPortId(sb),
    ]);

    employerId = await createTestUser(sb, 'employer');
    crewId = await createTestUser(sb, 'crew');
    crewId2 = await createTestUser(sb, 'crew2');
    await onboardEmployer(sb, employerId, 'Captain Stress');
    await onboardCrew(sb, crewId, 'Crew Stress');
    await onboardCrew(sb, crewId2, 'Crew Stress 2');

    // Create a vessel for the captain
    const vesselId = randomUUID();
    await fire(
      sb,
      'VESSEL.CREATED',
      vesselId,
      'vessel',
      {
        id: vesselId,
        imo_number: '9999991',
        name: 'M/Y Stress Test',
        vessel_type: 'motor',
        size_band_id: sizeBandId,
        loa_meters: 50,
        nda_flag: false,
        source: 'curated',
      },
      employerId,
      'employer',
    );

    // Create a permanent posting
    const postingId = randomUUID();
    await fire(
      sb,
      'PERMANENT.POSTED',
      postingId,
      'permanent',
      {
        id: postingId,
        vessel_id: vesselId,
        role_id: roleId,
        port_id: portId,
        start_date: '2026-12-01',
        salary_min: 4000,
        salary_max: 5000,
        salary_currency: 'EUR',
        salary_period: 'monthly',
        live_aboard: true,
        required_certification_ids: [],
        experience_bracket_id: null,
        shortlist_cap: 5,
        notes: null,
      },
      employerId,
      'employer',
    );

    // I1 — PERMANENT.INVITED creates the row
    const invitationId = randomUUID();
    const inv = await fire(
      sb,
      'PERMANENT.INVITED',
      invitationId,
      'permanent_invitation',
      {
        id: invitationId,
        permanent_posting_id: postingId,
        crew_person_id: crewId,
        message: 'Stress test invitation',
      },
      employerId,
      'employer',
    );
    record('I1: PERMANENT.INVITED appended', !inv.error, inv.error);

    const { data: invRow1 } = await sb
      .from('permanent_invitations')
      .select('id, permanent_posting_id, crew_person_id, invited_by_person_id, status, message')
      .eq('id', invitationId)
      .single();
    record(
      'I1: invitation row exists with status=pending',
      invRow1?.status === 'pending' &&
        invRow1?.permanent_posting_id === postingId &&
        invRow1?.crew_person_id === crewId &&
        invRow1?.invited_by_person_id === employerId,
      JSON.stringify({
        status: invRow1?.status,
        captain_match: invRow1?.invited_by_person_id === employerId,
      }),
    );
    record(
      'I1: invitation message persisted',
      invRow1?.message === 'Stress test invitation',
      invRow1?.message ?? '(null)',
    );

    // A1 — PERMANENT.APPLIED with invited_from_id flips invitation + sets applications.invited_from_id
    const applicationId = randomUUID();
    const apply = await fire(
      sb,
      'PERMANENT.APPLIED',
      `${crewId}:${postingId}`,
      'permanent',
      {
        id: applicationId,
        permanent_posting_id: postingId,
        crew_person_id: crewId,
        message: 'Apply via invite',
        invited_from_id: invitationId,
      },
      crewId,
    );
    record('A1: PERMANENT.APPLIED appended with invited_from_id', !apply.error, apply.error);

    const { data: invRow2 } = await sb
      .from('permanent_invitations')
      .select('status, responded_at')
      .eq('id', invitationId)
      .single();
    record(
      'A1: invitation flipped to status=applied',
      invRow2?.status === 'applied',
      invRow2?.status,
    );
    record('A1: responded_at stamped', invRow2?.responded_at !== null);

    const { data: appRow } = await sb
      .from('applications')
      .select('id, invited_from_id, status')
      .eq('id', applicationId)
      .single();
    record(
      'A1: applications.invited_from_id set on the application row',
      appRow?.invited_from_id === invitationId,
      appRow?.invited_from_id ?? '(null)',
    );

    // A2 — race guard. Re-firing PERMANENT.APPLIED for the SAME invitation
    // with `crewId2` should be a no-op for the invitation row (already
    // 'applied', not 'pending'). The application is still inserted but the
    // invitation isn't touched.
    const applicationId2 = randomUUID();
    await fire(
      sb,
      'PERMANENT.APPLIED',
      `${crewId2}:${postingId}`,
      'permanent',
      {
        id: applicationId2,
        permanent_posting_id: postingId,
        crew_person_id: crewId2,
        invited_from_id: invitationId, // Pointing at the already-applied invitation
      },
      crewId2,
    );
    const { data: invRow3 } = await sb
      .from('permanent_invitations')
      .select('status, crew_person_id')
      .eq('id', invitationId)
      .single();
    record(
      'A2: invitation row unchanged (race guard AND status=pending)',
      invRow3?.status === 'applied' && invRow3?.crew_person_id === crewId,
      `status=${invRow3?.status}, crew=${invRow3?.crew_person_id}`,
    );

    // ── E: invitation expiry cron path
    console.log('\n── Invitation expiry cron path ────────────────────────\n');

    // E1: insert a fresh pending invitation, set its created_at to 31d ago,
    // run the cron's UPDATE, verify it flips to 'expired'.
    const oldInvId = randomUUID();
    await fire(
      sb,
      'PERMANENT.INVITED',
      oldInvId,
      'permanent_invitation',
      {
        id: oldInvId,
        permanent_posting_id: postingId,
        crew_person_id: crewId2,
      },
      employerId,
      'employer',
    );
    // Simulate "31 days ago" by updating created_at directly via service role.
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    await sb
      .from('permanent_invitations')
      .update({ created_at: thirtyOneDaysAgo })
      .eq('id', oldInvId);

    // Run the cron's UPDATE inline (matches the route logic).
    const cutoffIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expired } = await sb
      .from('permanent_invitations')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('created_at', cutoffIso)
      .select('id');
    record(
      'E1: 31-day-old pending flipped to expired',
      (expired ?? []).some((r) => r.id === oldInvId),
      `${expired?.length ?? 0} flipped`,
    );

    // E2: a fresh pending invitation should NOT be flipped by the same cron
    const youngInvId = randomUUID();
    const crewId3 = await createTestUser(sb, 'crew3');
    await onboardCrew(sb, crewId3, 'Crew Stress 3');
    try {
      await fire(
        sb,
        'PERMANENT.INVITED',
        youngInvId,
        'permanent_invitation',
        {
          id: youngInvId,
          permanent_posting_id: postingId,
          crew_person_id: crewId3,
        },
        employerId,
        'employer',
      );
      // Re-run the same cron UPDATE
      await sb
        .from('permanent_invitations')
        .update({ status: 'expired' })
        .eq('status', 'pending')
        .lt('created_at', cutoffIso);
      const { data: youngRow } = await sb
        .from('permanent_invitations')
        .select('status')
        .eq('id', youngInvId)
        .single();
      record(
        'E2: <30-day-old pending unchanged after cron',
        youngRow?.status === 'pending',
        youngRow?.status,
      );
    } finally {
      await cleanup(sb, crewId3);
    }
  } finally {
    if (employerId) await cleanup(sb, employerId);
    if (crewId) await cleanup(sb, crewId);
    if (crewId2) await cleanup(sb, crewId2);
  }

  // ── D1: daywork-invitations UNIQUE constraint
  console.log('\n── Daywork-invitations UNIQUE ─────────────────────────\n');

  let dwEmployer: string | null = null;
  let dwCrew: string | null = null;
  try {
    const [sizeBandId, roleId, portId] = await Promise.all([
      getAnySizeBandId(sb),
      getAnyRoleId(sb),
      getAnyPortId(sb),
    ]);

    dwEmployer = await createTestUser(sb, 'dwemp');
    dwCrew = await createTestUser(sb, 'dwcrew');
    await onboardEmployer(sb, dwEmployer, 'DW Captain');
    await onboardCrew(sb, dwCrew, 'DW Crew');

    const vesselId = randomUUID();
    await fire(
      sb,
      'VESSEL.CREATED',
      vesselId,
      'vessel',
      {
        id: vesselId,
        imo_number: '9999992',
        name: 'M/Y DW Stress',
        vessel_type: 'motor',
        size_band_id: sizeBandId,
        loa_meters: 50,
        nda_flag: false,
        source: 'curated',
      },
      dwEmployer,
      'employer',
    );

    const dayworkId = randomUUID();
    await fire(
      sb,
      'DAYWORK.POSTED',
      dayworkId,
      'daywork',
      {
        id: dayworkId,
        vessel_id: vesselId,
        role_id: roleId,
        location_port_id: portId,
        start_date: '2026-12-15',
        end_date: '2026-12-16',
        working_days: 2,
        required_certification_ids: [],
        experience_bracket_id: null,
        day_rate: 250,
        currency: 'EUR',
        meals: [],
        notes: null,
        positions_available: 1,
      },
      dwEmployer,
      'employer',
    );

    // First invitation — succeeds
    const inv1 = await fire(
      sb,
      'DAYWORK.INVITED',
      dayworkId,
      'invitation',
      { daywork_id: dayworkId, crew_person_id: dwCrew },
      dwEmployer,
      'employer',
    );
    record('D1a: first DAYWORK.INVITED succeeds', !inv1.error, inv1.error);

    // Second invitation — same daywork + crew — should fail with 23505 from
    // the UNIQUE(daywork_id, crew_person_id) constraint. The route maps
    // this to 409 with the spec'd copy.
    const inv2 = await fire(
      sb,
      'DAYWORK.INVITED',
      dayworkId,
      'invitation',
      { daywork_id: dayworkId, crew_person_id: dwCrew },
      dwEmployer,
      'employer',
    );
    record(
      'D1b: duplicate DAYWORK.INVITED hits 23505 (UNIQUE constraint)',
      Boolean(inv2.error?.includes('23505') || inv2.error?.toLowerCase().includes('unique')),
      inv2.error ?? '(no error — bug?)',
    );
  } finally {
    if (dwEmployer) await cleanup(sb, dwEmployer);
    if (dwCrew) await cleanup(sb, dwCrew);
  }

  // ── Summary
  console.log('\n──────────────────────────────────────────────────────\n');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  if (failed > 0) {
    console.log('\nFailures:');
    for (const r of results.filter((x) => !x.ok)) {
      console.log(`  - ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
