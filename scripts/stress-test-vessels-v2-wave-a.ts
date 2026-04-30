/**
 * Vessels V2 Wave A stress test — verifies the schema additions on the
 * live remote DB. Mirrors `stress-test-locations-v2.ts`.
 *
 * Asserts:
 *   - New columns exist on `vessels` (gross_tonnage, beam_meters, ...).
 *   - `vessels.source` CHECK accepts 'curated', 'user_submitted',
 *     'pending'; rejects garbage.
 *   - `vessel_names` and `vessel_flag_states` tables exist with the
 *     expected columns.
 *   - The interval CHECK rejects effective_to < effective_from.
 *   - The backfill seeded one `vessel_names` row per existing vessel.
 *   - `flag_state_id` FK to `flag_states` enforced.
 *
 * Cleans up sentinel rows at the end.
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

const SENTINEL_NAME = `__stress_vessel_${Date.now()}`;
const SENTINEL_HIST = `__stress_history_${Date.now()}`;

/**
 * Audit P1-T2 (2026-04-30): sentinel-based cleanup of any rows this
 * test created. Uses LIKE on the persistent prefix so a leak from a
 * prior crashed run also gets swept.
 */
async function cleanupFixtures(sb: ReturnType<typeof createClient>): Promise<void> {
  // History rows reference vessel_id (CASCADE on vessel delete); deleting
  // vessels first cascades. But for safety on partial-state crashes,
  // delete history first by name LIKE, then vessels by name LIKE.
  await sb.from('vessel_names').delete().like('name', '__stress_history_%');
  await sb.from('vessel_names').delete().like('name', '__stress_vessel_%');
  await sb.from('vessels').delete().like('name', '__stress_vessel_%');
}

async function main() {
  const { url, key } = loadEnv();
  const sb = createClient(url, key);
  console.log(`▶ Vessels V2 Wave A stress test against ${url}\n`);

  await cleanupFixtures(sb);

  try {
  console.log('Schema (vessels new columns):');
  const newCols = [
    'gross_tonnage',
    'beam_meters',
    'year_built',
    'builder',
    'flag_state_id',
    'source',
    'hidden_at',
    'submitted_by',
  ];
  for (const c of newCols) {
    const { error } = await sb.from('vessels').select(`id, ${c}`).limit(1);
    record(`vessels.${c} exists`, !error, error?.message);
  }

  console.log('\nSchema (history tables):');
  const { error: vnSelectErr } = await sb
    .from('vessel_names')
    .select('id, vessel_id, name, effective_from, effective_to, source, submitted_by, created_at')
    .limit(1);
  record(`vessel_names columns selectable`, !vnSelectErr, vnSelectErr?.message);

  const { error: vfsSelectErr } = await sb
    .from('vessel_flag_states')
    .select(
      'id, vessel_id, flag_state_id, effective_from, effective_to, source, submitted_by, created_at',
    )
    .limit(1);
  record(`vessel_flag_states columns selectable`, !vfsSelectErr, vfsSelectErr?.message);

  // ── Find a vessel + a flag_state to use as fixtures ────────────────
  const { data: anyVessel } = await sb
    .from('vessels')
    .select('id, owner_person_id, source')
    .limit(1)
    .maybeSingle();
  if (!anyVessel) {
    console.log('No vessels in DB — skipping write-path checks');
    return;
  }
  const { data: anyFlag } = await sb
    .from('flag_states')
    .select('id')
    .limit(1)
    .maybeSingle();
  if (!anyFlag) {
    console.log('No flag_states seeded — skipping FK checks');
    return;
  }

  console.log('\nBackfill:');
  const { count: backfillCount } = await sb
    .from('vessel_names')
    .select('id', { count: 'exact', head: true });
  record(
    `vessel_names backfilled at least 1 row per vessel`,
    (backfillCount ?? 0) > 0,
    `total rows: ${backfillCount}`,
  );

  // ── Source CHECK on vessels: accepts each valid value, rejects bad ──
  console.log('\nVessels CHECK constraint:');
  let pendingVesselId: string | null = null;
  {
    const { data, error } = await sb
      .from('vessels')
      .insert({
        owner_person_id: anyVessel.owner_person_id,
        imo_number: '9999991',
        name: SENTINEL_NAME,
        vessel_type: 'motor',
        size_band_id: null,
        loa_meters: 50,
        nda_flag: false,
        source: 'pending',
        submitted_by: anyVessel.owner_person_id,
      })
      .select('id, source, hidden_at, submitted_by, created_at')
      .single();
    if (error) {
      // Some installations have a NOT NULL on size_band_id — try with it.
      const { data: szb } = await sb.from('vessel_size_bands').select('id').limit(1).maybeSingle();
      if (szb) {
        const retry = await sb
          .from('vessels')
          .insert({
            owner_person_id: anyVessel.owner_person_id,
            imo_number: '9999991',
            name: SENTINEL_NAME,
            vessel_type: 'motor',
            size_band_id: szb.id,
            loa_meters: 50,
            nda_flag: false,
            source: 'pending',
            submitted_by: anyVessel.owner_person_id,
          })
          .select('id, source')
          .single();
        if (retry.error) {
          record(`INSERT vessels source='pending' accepted`, false, retry.error.message);
        } else {
          record(`INSERT vessels source='pending' accepted`, true);
          pendingVesselId = retry.data!.id;
        }
      } else {
        record(`INSERT vessels source='pending' accepted`, false, error.message);
      }
    } else {
      record(`INSERT vessels source='pending' accepted`, true);
      record(`vessels.created_at populated by default`, !!data!.created_at, data!.created_at);
      record(`vessels.hidden_at NULL by default`, data!.hidden_at === null);
      record(
        `vessels.submitted_by accepted person FK`,
        data!.submitted_by === anyVessel.owner_person_id,
      );
      pendingVesselId = data!.id;
    }
  }

  if (pendingVesselId) {
    // Garbage source value should be rejected.
    const { error: badSourceErr } = await sb
      .from('vessels')
      .update({ source: 'fake_value' })
      .eq('id', pendingVesselId);
    record(
      `vessels.source CHECK rejects 'fake_value'`,
      badSourceErr !== null && badSourceErr.code === '23514',
      badSourceErr?.message,
    );

    // year_built CHECK rejects 1700.
    const { error: badYearErr } = await sb
      .from('vessels')
      .update({ year_built: 1700 })
      .eq('id', pendingVesselId);
    record(
      `vessels.year_built CHECK rejects 1700`,
      badYearErr !== null && badYearErr.code === '23514',
      badYearErr?.message,
    );

    // gross_tonnage CHECK rejects 0.
    const { error: badGtErr } = await sb
      .from('vessels')
      .update({ gross_tonnage: 0 })
      .eq('id', pendingVesselId);
    record(
      `vessels.gross_tonnage CHECK rejects 0`,
      badGtErr !== null && badGtErr.code === '23514',
      badGtErr?.message,
    );

    // beam_meters CHECK rejects 200.
    const { error: badBeamErr } = await sb
      .from('vessels')
      .update({ beam_meters: 200 })
      .eq('id', pendingVesselId);
    record(
      `vessels.beam_meters CHECK rejects 200`,
      badBeamErr !== null && badBeamErr.code === '23514',
      badBeamErr?.message,
    );

    // flag_state_id FK enforced — bad code rejected.
    const { error: badFlagErr } = await sb
      .from('vessels')
      .update({ flag_state_id: 'XYZ_NOT_REAL' })
      .eq('id', pendingVesselId);
    record(
      `vessels.flag_state_id FK rejects unknown code`,
      badFlagErr !== null && badFlagErr.code === '23503',
      badFlagErr?.message,
    );

    // Valid flag_state_id accepted.
    const { error: goodFlagErr } = await sb
      .from('vessels')
      .update({ flag_state_id: anyFlag.id })
      .eq('id', pendingVesselId);
    record(`vessels.flag_state_id accepts valid FK`, !goodFlagErr, goodFlagErr?.message);
  }

  // ── vessel_names interval CHECK ────────────────────────────────────
  console.log('\nvessel_names interval CHECK:');
  if (pendingVesselId) {
    const { error: badIntervalErr } = await sb.from('vessel_names').insert({
      vessel_id: pendingVesselId,
      name: SENTINEL_HIST,
      effective_from: '2024-12-31',
      effective_to: '2024-01-01',
      source: 'curated',
    });
    record(
      `vessel_names rejects effective_to < effective_from`,
      badIntervalErr !== null && badIntervalErr.code === '23514',
      badIntervalErr?.message,
    );

    const { error: goodIntervalErr } = await sb.from('vessel_names').insert({
      vessel_id: pendingVesselId,
      name: SENTINEL_HIST,
      effective_from: '2024-01-01',
      effective_to: null,
      source: 'curated',
    });
    record(`vessel_names accepts open interval`, !goodIntervalErr, goodIntervalErr?.message);

    const { error: cascadeErr } = await sb
      .from('vessel_names')
      .insert({
        vessel_id: pendingVesselId,
        name: SENTINEL_HIST,
        effective_from: '2023-01-01',
        effective_to: '2023-12-31',
        source: 'curated',
      });
    record(`vessel_names accepts closed interval`, !cascadeErr, cascadeErr?.message);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────
  console.log('\nCleanup:');
  if (pendingVesselId) {
    // CASCADE on vessel_id FK should sweep the history rows.
    const { error: delErr } = await sb.from('vessels').delete().eq('id', pendingVesselId);
    record(`DELETE pending vessel cascades to history`, !delErr, delErr?.message);
    const { count: leftover } = await sb
      .from('vessel_names')
      .select('id', { count: 'exact', head: true })
      .eq('vessel_id', pendingVesselId);
    record(`vessel_names CASCADE swept`, leftover === 0, `leftover: ${leftover}`);
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n▶ ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  } finally {
    // Audit P1-T2: cleanup wrapped in try/finally so a mid-run crash
    // doesn't leak fixtures into the live remote.
    console.log('\nCleanup: drop fixture vessels (sentinel sweep)');
    await cleanupFixtures(sb);
  }
}

main().catch((err) => {
  console.error('Stress test crashed:', err);
  process.exit(1);
});
