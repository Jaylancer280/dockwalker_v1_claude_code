/**
 * Stress test for migrations 00128 + 00129 (and RLS regression coverage).
 *
 * Exercises the live remote DB end-to-end via append_event (the same path
 * the routes use). Validates:
 *
 *   00128 — pending-vessel relaxation
 *     A1. REFERENCE.REQUESTED on source='pending' vessel succeeds.
 *     A2. NDA vessels still rejected.
 *     A3. hidden_at vessels still rejected.
 *
 *   00129 — currently-onboard experiences
 *     B1. REFERENCE.REQUESTED on is_current=true experience succeeds.
 *     B2. snapshot_end_date is null when experience.end_date is null.
 *     B3. EXPERIENCE.UPDATED with end_date null→date + is_current true→false
 *         succeeds (closing transition) on a currently-onboard experience
 *         that has active references.
 *     B4. After the closing transition, the references' snapshot_end_date is
 *         auto-updated to the new end_date.
 *     B5. EXPERIENCE.UPDATED with vessel_id change still rejected (locked).
 *     B6. EXPERIENCE.UPDATED with role_id change still rejected (locked).
 *     B7. EXPERIENCE.UPDATED with start_date change still rejected (locked).
 *     B8. After closing, EXPERIENCE.UPDATED with end_date date→date is
 *         rejected (one-time only).
 *     B9. After closing, EXPERIENCE.UPDATED with end_date date→null is
 *         rejected.
 *
 *   RLS — references + reference_contacts (authenticated callers)
 *     C1. Stranger cannot SELECT another user's references.
 *     C2. Requester CAN SELECT their own outbound references.
 *     C3. Referee (after accept) CAN SELECT their inbound references.
 *     C4. Stranger cannot SELECT reference_contacts they're not party to.
 *     C5. Employer CAN SELECT their own contact requests.
 *     C6. Referee CAN SELECT contact requests targeted at them via the
 *         reference link.
 *
 * Run: `npx tsx scripts/stress-test-references-currently-onboard.ts`
 *
 * Service role + remote URL come from apps/web/.env.production.local.
 * Anon key fetched from apps/web/.env.local — both env files reference
 * the same project ref (only URL differs because .env.local can point
 * at local Docker, but we use the remote URL exclusively here).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
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

function loadEnv(): { url: string; serviceKey: string; anonKey: string } {
  const prod = parseEnv(resolve(process.cwd(), 'apps/web/.env.production.local'));
  const url = prod.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = prod.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing URL or service role key in apps/web/.env.production.local');
  }

  // Anon key is project-specific; fetch live from Supabase CLI rather than
  // reading from .env.local which may point at a local Docker project.
  const projectRef = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  if (!projectRef) {
    throw new Error(`Cannot extract project ref from URL: ${url}`);
  }
  const cliOut = execSync(`npx supabase projects api-keys --project-ref ${projectRef}`, {
    encoding: 'utf8',
  });
  const anonKey = cliOut
    .split(/\r?\n/)
    .find((l) => /^\s*anon\s*\|/.test(l))
    ?.split('|')[1]
    ?.trim();
  if (!anonKey) {
    throw new Error('Could not parse anon key from `supabase projects api-keys` output');
  }
  return { url, serviceKey, anonKey };
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

interface TestUser {
  id: string;
  email: string;
  password: string;
}

async function createTestUser(sb: Sb, label: string): Promise<TestUser> {
  const email = `__stress_co_${label}_${randomUUID()}@stresstest.invalid`;
  const password = randomUUID();
  // @ts-expect-error supabase-js admin types lag
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data?.user) throw new Error(`Failed to create user ${label}: ${error?.message}`);
  return { id: data.user.id, email, password };
}

async function fire(
  sb: Sb,
  eventType: string,
  aggregateId: string,
  aggregateType: string,
  payload: Record<string, unknown>,
  personId: string,
): Promise<{ id?: string; error?: string }> {
  const { data, error } = await sb.rpc('append_event', {
    p_event_type: eventType,
    p_aggregate_id: aggregateId,
    p_aggregate_type: aggregateType,
    p_role_context: 'crew',
    p_payload: payload,
    p_person_id: personId,
    p_idempotency_key: null,
  });
  return { id: data as string | undefined, error: error?.message };
}

async function makeUserClient(url: string, anonKey: string, user: TestUser): Promise<Sb> {
  const sb = createClient(url, anonKey);
  const { error } = await sb.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw new Error(`Sign-in failed for ${user.email}: ${error.message}`);
  return sb;
}

interface Fixtures {
  requester: TestUser;
  referee: TestUser;
  employer: TestUser;
  stranger: TestUser;
  curatedVesselId: string;
  pendingVesselId: string;
  ndaVesselId: string;
  hiddenVesselId: string;
  currentExpId: string; // is_current=true, end_date=null, on curated vessel
  pendingExpId: string; // on pending vessel
  ndaExpId: string;
  hiddenExpId: string;
  bandId: string;
  roleId: string;
}

async function makeFixtures(sb: Sb): Promise<Fixtures> {
  const requester = await createTestUser(sb, 'requester');
  const referee = await createTestUser(sb, 'referee');
  const employer = await createTestUser(sb, 'employer');
  const stranger = await createTestUser(sb, 'stranger');

  await sb.from('persons').insert([
    { id: requester.id, identity_type: 'crew', current_hat: 'crew' },
    { id: referee.id, identity_type: 'crew', current_hat: 'crew' },
    { id: employer.id, identity_type: 'crew', current_hat: 'employer' },
    { id: stranger.id, identity_type: 'crew', current_hat: 'crew' },
  ]);
  await sb.from('profiles').insert([
    { person_id: requester.id, display_name: 'Stress Requester CO', identity_type: 'crew' },
    { person_id: referee.id, display_name: 'Stress Referee CO', identity_type: 'crew' },
    { person_id: employer.id, display_name: 'Stress Employer CO', identity_type: 'crew' },
    { person_id: stranger.id, display_name: 'Stress Stranger CO', identity_type: 'crew' },
  ]);

  const { data: anyBand } = await sb.from('vessel_size_bands').select('id').limit(1).maybeSingle();
  const { data: anyRole } = await sb.from('yacht_roles').select('id').limit(1).maybeSingle();
  if (!anyBand || !anyRole) throw new Error('Missing seed data (vessel_size_bands / yacht_roles)');

  const baseImo = 4_000_000 + Math.floor(Math.random() * 1_000_000);

  const curatedVesselId = randomUUID();
  await sb.from('vessels').insert({
    id: curatedVesselId,
    owner_person_id: requester.id,
    imo_number: String(baseImo),
    name: '__stress_co_curated__',
    vessel_type: 'motor',
    size_band_id: anyBand.id,
    loa_meters: 65,
    nda_flag: false,
    source: 'curated',
  });

  const pendingVesselId = randomUUID();
  await sb.from('vessels').insert({
    id: pendingVesselId,
    owner_person_id: requester.id,
    imo_number: String(baseImo + 1),
    name: '__stress_co_pending__',
    vessel_type: 'motor',
    size_band_id: anyBand.id,
    loa_meters: 65,
    nda_flag: false,
    source: 'pending',
  });

  const ndaVesselId = randomUUID();
  await sb.from('vessels').insert({
    id: ndaVesselId,
    owner_person_id: requester.id,
    imo_number: String(baseImo + 2),
    name: '__stress_co_nda__',
    vessel_type: 'motor',
    size_band_id: anyBand.id,
    loa_meters: 65,
    nda_flag: true,
    source: 'curated',
  });

  const hiddenVesselId = randomUUID();
  await sb.from('vessels').insert({
    id: hiddenVesselId,
    owner_person_id: requester.id,
    imo_number: String(baseImo + 3),
    name: '__stress_co_hidden__',
    vessel_type: 'motor',
    size_band_id: anyBand.id,
    loa_meters: 65,
    nda_flag: false,
    source: 'curated',
    hidden_at: new Date().toISOString(),
  });

  // Currently-onboard experience on the curated vessel.
  const currentExpId = randomUUID();
  await sb.from('crew_experiences').insert({
    id: currentExpId,
    person_id: requester.id,
    vessel_id: curatedVesselId,
    role_id: anyRole.id,
    start_date: '2024-01-01',
    end_date: null,
    is_current: true,
    vessel_operation: 'private',
  });

  // Completed experience on the pending vessel — for 00128 source check.
  // (Cannot be currently-onboard because the user already has a current one.)
  const pendingExpId = randomUUID();
  await sb.from('crew_experiences').insert({
    id: pendingExpId,
    person_id: requester.id,
    vessel_id: pendingVesselId,
    role_id: anyRole.id,
    start_date: '2022-01-01',
    end_date: '2022-12-31',
    is_current: false,
    vessel_operation: 'private',
  });

  const ndaExpId = randomUUID();
  await sb.from('crew_experiences').insert({
    id: ndaExpId,
    person_id: requester.id,
    vessel_id: ndaVesselId,
    role_id: anyRole.id,
    start_date: '2021-01-01',
    end_date: '2021-12-31',
    is_current: false,
    vessel_operation: 'private',
  });

  const hiddenExpId = randomUUID();
  await sb.from('crew_experiences').insert({
    id: hiddenExpId,
    person_id: requester.id,
    vessel_id: hiddenVesselId,
    role_id: anyRole.id,
    start_date: '2020-01-01',
    end_date: '2020-12-31',
    is_current: false,
    vessel_operation: 'private',
  });

  return {
    requester,
    referee,
    employer,
    stranger,
    curatedVesselId,
    pendingVesselId,
    ndaVesselId,
    hiddenVesselId,
    currentExpId,
    pendingExpId,
    ndaExpId,
    hiddenExpId,
    bandId: anyBand.id as string,
    roleId: anyRole.id as string,
  };
}

async function cleanup(sb: Sb, fx: Fixtures): Promise<void> {
  const allIds = [fx.requester.id, fx.referee.id, fx.employer.id, fx.stranger.id];
  await sb.from('active_engagements').delete().in('crew_person_id', allIds);
  await sb.from('active_engagements').delete().in('employer_person_id', allIds);
  await sb.from('reference_contacts').delete().in('employer_person_id', allIds);
  await sb.from('references').delete().in('requester_person_id', allIds);
  await sb.from('references').delete().in('referee_person_id', allIds);
  await sb.from('crew_experiences').delete().in('person_id', allIds);
  await sb
    .from('vessels')
    .delete()
    .in('id', [fx.curatedVesselId, fx.pendingVesselId, fx.ndaVesselId, fx.hiddenVesselId]);
  await sb.from('subscriptions').delete().in('person_id', allIds);
  await sb.from('profiles').delete().in('person_id', allIds);
  await sb.from('persons').delete().in('id', allIds);
  for (const id of allIds) {
    // @ts-expect-error supabase-js admin types lag
    await sb.auth.admin.deleteUser(id);
  }
}

async function main(): Promise<void> {
  const { url, serviceKey, anonKey } = loadEnv();
  const sb = createClient(url, serviceKey);
  console.log(`▶ Currently-onboard + pending-vessel + RLS stress test against ${url}\n`);

  const fx = await makeFixtures(sb);

  try {
    // ──────────────────────────────────────────────────────────────────
    // A — 00128 pending-vessel relaxation
    // ──────────────────────────────────────────────────────────────────
    console.log('A. 00128 — pending-vessel relaxation:');

    const refOnPendingId = randomUUID();
    {
      const r = await fire(
        sb,
        'REFERENCE.REQUESTED',
        refOnPendingId,
        'reference',
        {
          id: refOnPendingId,
          experience_id: fx.pendingExpId,
          vessel_id: fx.pendingVesselId,
          requester_role_at_time: 'Bosun',
          claimed_referee_role: 'Captain',
          claimed_referee_name: 'Capt Pending',
          claimed_referee_email: null,
          token: randomUUID(),
          snapshot_vessel_imo: '8000001',
          snapshot_vessel_name: '__stress_co_pending__',
          snapshot_start_date: '2022-01-01',
          snapshot_end_date: '2022-12-31',
        },
        fx.requester.id,
      );
      record('A1: REFERENCE.REQUESTED on source=pending vessel succeeds', !r.error, r.error);
    }
    {
      const r = await fire(
        sb,
        'REFERENCE.REQUESTED',
        randomUUID(),
        'reference',
        {
          id: randomUUID(),
          experience_id: fx.ndaExpId,
          vessel_id: fx.ndaVesselId,
          requester_role_at_time: 'Bosun',
          claimed_referee_role: 'Captain',
          claimed_referee_name: 'Capt NDA',
          claimed_referee_email: null,
          token: randomUUID(),
          snapshot_vessel_imo: '8000002',
          snapshot_vessel_name: '__stress_co_nda__',
          snapshot_start_date: '2021-01-01',
          snapshot_end_date: '2021-12-31',
        },
        fx.requester.id,
      );
      record(
        'A2: REFERENCE.REQUESTED on NDA vessel rejected',
        !!r.error && /NDA/i.test(r.error),
        r.error ?? '(unexpectedly succeeded)',
      );
    }
    {
      const r = await fire(
        sb,
        'REFERENCE.REQUESTED',
        randomUUID(),
        'reference',
        {
          id: randomUUID(),
          experience_id: fx.hiddenExpId,
          vessel_id: fx.hiddenVesselId,
          requester_role_at_time: 'Bosun',
          claimed_referee_role: 'Captain',
          claimed_referee_name: 'Capt Hidden',
          claimed_referee_email: null,
          token: randomUUID(),
          snapshot_vessel_imo: '8000003',
          snapshot_vessel_name: '__stress_co_hidden__',
          snapshot_start_date: '2020-01-01',
          snapshot_end_date: '2020-12-31',
        },
        fx.requester.id,
      );
      record(
        'A3: REFERENCE.REQUESTED on hidden vessel rejected',
        !!r.error && /hidden/i.test(r.error),
        r.error ?? '(unexpectedly succeeded)',
      );
    }

    // ──────────────────────────────────────────────────────────────────
    // B — 00129 currently-onboard
    // ──────────────────────────────────────────────────────────────────
    console.log('\nB. 00129 — currently-onboard experiences:');

    const refOnCurrentId = randomUUID();
    {
      const r = await fire(
        sb,
        'REFERENCE.REQUESTED',
        refOnCurrentId,
        'reference',
        {
          id: refOnCurrentId,
          experience_id: fx.currentExpId,
          vessel_id: fx.curatedVesselId,
          requester_role_at_time: 'Bosun',
          claimed_referee_role: 'Captain',
          claimed_referee_name: 'Capt Current',
          claimed_referee_email: null,
          token: randomUUID(),
          snapshot_vessel_imo: '8000000',
          snapshot_vessel_name: '__stress_co_curated__',
          snapshot_start_date: '2024-01-01',
          // Intentionally omit snapshot_end_date so it lands as null.
        },
        fx.requester.id,
      );
      record('B1: REFERENCE.REQUESTED on is_current=true succeeds', !r.error, r.error);
    }
    {
      const { data: row } = await sb
        .from('references')
        .select('snapshot_end_date, status')
        .eq('id', refOnCurrentId)
        .maybeSingle();
      record(
        'B2: snapshot_end_date is null when experience.end_date is null',
        row !== null && (row as { snapshot_end_date: unknown }).snapshot_end_date === null,
        `snapshot_end_date=${(row as { snapshot_end_date?: unknown } | null)?.snapshot_end_date}`,
      );
    }

    // Accept the reference so we can verify B4 against an accepted snapshot
    // too (covers both pending and accepted statuses on the auto-update).
    await fire(sb, 'REFERENCE.ACCEPTED', refOnCurrentId, 'reference', {}, fx.referee.id);

    // B5/B6/B7 — vessel/role/start_date locks (must be tested BEFORE the
    // closing transition because afterwards the experience is no longer
    // currently-onboard and locks change semantics).
    {
      const altVesselId = randomUUID();
      await sb.from('vessels').insert({
        id: altVesselId,
        owner_person_id: fx.requester.id,
        imo_number: String(8_999_900 + Math.floor(Math.random() * 100)),
        name: '__stress_co_alt__',
        vessel_type: 'motor',
        size_band_id: fx.bandId,
        loa_meters: 70,
        nda_flag: false,
        source: 'curated',
      });
      const r = await fire(
        sb,
        'EXPERIENCE.UPDATED',
        fx.currentExpId,
        'experience',
        { vessel_id: altVesselId },
        fx.requester.id,
      );
      record(
        'B5: vessel_id change rejected with active refs',
        !!r.error && /vessel|locked/i.test(r.error),
        r.error ?? '(unexpectedly succeeded)',
      );
      await sb.from('vessels').delete().eq('id', altVesselId);
    }
    {
      const { data: otherRole } = await sb
        .from('yacht_roles')
        .select('id')
        .neq('id', fx.roleId)
        .limit(1)
        .maybeSingle();
      const otherRoleId = (otherRole as { id: string } | null)?.id;
      if (!otherRoleId) {
        record('B6: role_id change rejected with active refs', false, 'no second role available');
      } else {
        const r = await fire(
          sb,
          'EXPERIENCE.UPDATED',
          fx.currentExpId,
          'experience',
          { role_id: otherRoleId },
          fx.requester.id,
        );
        record(
          'B6: role_id change rejected with active refs',
          !!r.error && /role|locked/i.test(r.error),
          r.error ?? '(unexpectedly succeeded)',
        );
      }
    }
    {
      const r = await fire(
        sb,
        'EXPERIENCE.UPDATED',
        fx.currentExpId,
        'experience',
        { start_date: '2023-12-01' },
        fx.requester.id,
      );
      record(
        'B7: start_date change rejected with active refs',
        !!r.error && /start_date|locked/i.test(r.error),
        r.error ?? '(unexpectedly succeeded)',
      );
    }

    // B3 — the closing transition itself: end_date null→date AND
    // is_current true→false on a currently-onboard experience.
    {
      const r = await fire(
        sb,
        'EXPERIENCE.UPDATED',
        fx.currentExpId,
        'experience',
        { end_date: '2025-04-30', is_current: false },
        fx.requester.id,
      );
      record(
        'B3: closing transition (end_date null→date + is_current true→false) succeeds',
        !r.error,
        r.error,
      );
    }

    // B4 — references' snapshot_end_date is auto-updated.
    {
      const { data: row } = await sb
        .from('references')
        .select('snapshot_end_date, status')
        .eq('id', refOnCurrentId)
        .maybeSingle();
      const sed = (row as { snapshot_end_date?: string } | null)?.snapshot_end_date;
      record(
        'B4: references.snapshot_end_date auto-updated to new end_date',
        sed === '2025-04-30',
        `snapshot_end_date=${sed}`,
      );
    }

    // B8 — after closing, end_date date→date is rejected.
    {
      const r = await fire(
        sb,
        'EXPERIENCE.UPDATED',
        fx.currentExpId,
        'experience',
        { end_date: '2025-05-01' },
        fx.requester.id,
      );
      record(
        'B8: post-close end_date date→date rejected (one-time only)',
        !!r.error && /end_date|locked/i.test(r.error),
        r.error ?? '(unexpectedly succeeded)',
      );
    }

    // B9 — after closing, end_date date→null is rejected.
    {
      const r = await fire(
        sb,
        'EXPERIENCE.UPDATED',
        fx.currentExpId,
        'experience',
        { end_date: null },
        fx.requester.id,
      );
      record(
        'B9: post-close end_date date→null rejected',
        !!r.error && /end_date|locked/i.test(r.error),
        r.error ?? '(unexpectedly succeeded)',
      );
    }

    // ──────────────────────────────────────────────────────────────────
    // C — RLS on references + reference_contacts
    // ──────────────────────────────────────────────────────────────────
    console.log('\nC. RLS — authenticated SELECT visibility:');

    const requesterClient = await makeUserClient(url, anonKey, fx.requester);
    const refereeClient = await makeUserClient(url, anonKey, fx.referee);
    const employerClient = await makeUserClient(url, anonKey, fx.employer);
    const strangerClient = await makeUserClient(url, anonKey, fx.stranger);

    // C1 — Stranger cannot SELECT another user's references.
    {
      const { data, error } = await strangerClient
        .from('references')
        .select('id')
        .eq('id', refOnCurrentId);
      // RLS filters silently — empty array, no error.
      record(
        'C1: stranger SELECT on references returns 0 rows (RLS filter)',
        !error && Array.isArray(data) && data.length === 0,
        error?.message ?? `rows=${data?.length}`,
      );
    }
    // C2 — Requester CAN SELECT their own outbound references.
    {
      const { data, error } = await requesterClient
        .from('references')
        .select('id')
        .eq('id', refOnCurrentId);
      record(
        'C2: requester sees their own outbound reference',
        !error && Array.isArray(data) && data.length === 1,
        error?.message ?? `rows=${data?.length}`,
      );
    }
    // C3 — Referee CAN SELECT their inbound (accepted) reference.
    {
      const { data, error } = await refereeClient
        .from('references')
        .select('id')
        .eq('id', refOnCurrentId);
      record(
        'C3: referee sees their inbound reference',
        !error && Array.isArray(data) && data.length === 1,
        error?.message ?? `rows=${data?.length}`,
      );
    }

    // Set up a contact-request for C4–C6 testing. Employer asks the
    // referee for a chat about the (now-accepted) reference. The
    // contact route normally enforces the budget gate; for RLS testing
    // we just need a row in the table, fired via append_event.
    const contactId = randomUUID();
    {
      await fire(
        sb,
        'REFERENCE.CONTACT_REQUESTED',
        contactId,
        'reference_contact',
        {
          id: contactId,
          reference_id: refOnCurrentId,
          question: 'Can we chat about this candidate?',
        },
        fx.employer.id,
      );
    }

    // C4 — Stranger cannot SELECT contact requests they're not party to.
    {
      const { data, error } = await strangerClient
        .from('reference_contacts')
        .select('id')
        .eq('id', contactId);
      record(
        'C4: stranger SELECT on reference_contacts returns 0 rows',
        !error && Array.isArray(data) && data.length === 0,
        error?.message ?? `rows=${data?.length}`,
      );
    }
    // C5 — Employer CAN SELECT their own contact requests.
    {
      const { data, error } = await employerClient
        .from('reference_contacts')
        .select('id')
        .eq('id', contactId);
      record(
        'C5: employer sees their own contact request',
        !error && Array.isArray(data) && data.length === 1,
        error?.message ?? `rows=${data?.length}`,
      );
    }
    // C6 — Referee CAN SELECT contact requests targeting them via the
    // reference link (RLS subselect through references.referee_person_id).
    {
      const { data, error } = await refereeClient
        .from('reference_contacts')
        .select('id')
        .eq('id', contactId);
      record(
        'C6: referee sees contact request through reference link',
        !error && Array.isArray(data) && data.length === 1,
        error?.message ?? `rows=${data?.length}`,
      );
    }

    // ──────────────────────────────────────────────────────────────────
    // Summary
    // ──────────────────────────────────────────────────────────────────
    const passed = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${passed}/${results.length} passed, ${failed} failed.`);
    if (failed > 0) {
      console.log('\nFailures:');
      for (const r of results.filter((x) => !x.ok)) {
        console.log(`  - ${r.name}: ${r.detail}`);
      }
      process.exitCode = 1;
    }
  } finally {
    await cleanup(sb, fx);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
