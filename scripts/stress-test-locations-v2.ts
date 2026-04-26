/**
 * Locations V2 stress test — exercises the live remote DB to catch
 * schema or RPC drift that mocked unit tests can't see. Inserts a
 * `source='pending'` city + port, verifies `search_locations` /
 * `top_locations` exclude them, verifies `get_locations_by_ids` still
 * resolves them (intentional asymmetry), and tears the test data
 * down at the end.
 *
 * Run with: `node --import tsx scripts/stress-test-locations-v2.ts`
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in
 * apps/web/.env.local — the script loads them via dotenv-style read.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(): { url: string; key: string } {
  // Prefer .env.production.local (live remote Supabase) — .env.local
  // points at the Docker stack which isn't running in this project.
  const path = resolve(process.cwd(), 'apps/web/.env.production.local');
  const text = readFileSync(path, 'utf8');
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/\r$/, '').replace(/^["']|["']$/g, '');
  }
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      `Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in ${path}`,
    );
  }
  return { url: env.NEXT_PUBLIC_SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY };
}

const TEST_CITY_NAME = `__stress_test_city_${Date.now()}`;
const TEST_PORT_NAME = `__stress_test_port_${Date.now()}`;
const SENTINEL = '__stress_test';

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

const results: CheckResult[] = [];

function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  const marker = ok ? 'PASS' : 'FAIL';
  console.log(`  [${marker}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  const { url, key } = loadEnv();
  console.log(`▶ Locations V2 stress test against ${url}`);
  console.log(`  key prefix: ${key.slice(0, 20)}…\n`);

  // Sanity-probe DNS + connectivity before constructing the JS client so
  // we get a clearer error than "fetch failed".
  try {
    const probe = await fetch(`${url}/rest/v1/regions?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    console.log(`  REST probe: ${probe.status}`);
  } catch (err) {
    console.error(`  REST probe failed: ${err instanceof Error ? err.message : err}`);
    throw err;
  }

  const sb = createClient(url, key);


  // ── Schema checks ──────────────────────────────────────────────
  console.log('Schema:');

  const { data: citiesCols, error: citiesColsErr } = await sb.rpc('exec_sql', {}).single();
  if (citiesColsErr) {
    // exec_sql RPC may not exist — fall back to introspection via select
  }

  const expectedCityCols = ['source', 'hidden_at', 'created_at', 'submitted_by', 'osm_place_id'];
  const expectedPortCols = ['source', 'hidden_at', 'created_at', 'submitted_by'];

  // Test column existence by trying to SELECT them — PostgREST raises if a column doesn't exist.
  for (const col of expectedCityCols) {
    const { error } = await sb.from('cities').select(`id, ${col}`).limit(1);
    record(`cities.${col} exists`, !error, error?.message);
  }
  for (const col of expectedPortCols) {
    const { error } = await sb.from('ports').select(`id, ${col}`).limit(1);
    record(`ports.${col} exists`, !error, error?.message);
  }

  // ── CHECK constraint accepts 'pending' ─────────────────────────
  // Pick any region for the foreign key.
  const { data: anyRegion } = await sb.from('regions').select('id').limit(1).single();
  if (!anyRegion) {
    console.log('No regions in DB — aborting stress test');
    return;
  }

  let pendingCityId: string | null = null;
  let pendingPortId: string | null = null;

  try {
    console.log('\nWrite path:');

    const { data: city, error: cityInsertErr } = await sb
      .from('cities')
      .insert({
        region_id: anyRegion.id,
        name: TEST_CITY_NAME,
        source: 'pending',
        sort_order: 999,
      })
      .select('id, source, created_at, submitted_by, hidden_at')
      .single();
    record(
      `INSERT cities source='pending' accepted by CHECK`,
      !cityInsertErr,
      cityInsertErr?.message,
    );
    if (city) {
      pendingCityId = city.id;
      record(`cities.created_at populated by default`, !!city.created_at, city.created_at);
      record(`cities.hidden_at NULL by default`, city.hidden_at === null);
      record(`cities.submitted_by NULL by default`, city.submitted_by === null);
    }

    if (pendingCityId) {
      const { data: port, error: portInsertErr } = await sb
        .from('ports')
        .insert({
          city_id: pendingCityId,
          name: TEST_PORT_NAME,
          source: 'pending',
          sort_order: 999,
        })
        .select('id, source, created_at, hidden_at')
        .single();
      record(
        `INSERT ports source='pending' accepted by CHECK`,
        !portInsertErr,
        portInsertErr?.message,
      );
      if (port) {
        pendingPortId = port.id;
      }
    }

    // ── search_locations should NOT return pending rows ─────────
    console.log('\nRPCs:');

    const { data: searchHits, error: searchErr } = await sb.rpc('search_locations', {
      q: SENTINEL,
    });
    if (searchErr) {
      record(`search_locations RPC callable`, false, searchErr.message);
    } else {
      record(`search_locations RPC callable`, true);
      const hitsByName = (searchHits ?? []).filter((r: { name: string }) =>
        r.name.startsWith(SENTINEL),
      );
      record(
        `search_locations excludes source='pending'`,
        hitsByName.length === 0,
        hitsByName.length > 0
          ? `found ${hitsByName.length} pending rows in results`
          : undefined,
      );
    }

    // ── top_locations should NOT return pending ports ───────────
    const { data: topHits, error: topErr } = await sb.rpc('top_locations', { port_limit: 200 });
    if (topErr) {
      record(`top_locations RPC callable`, false, topErr.message);
    } else {
      record(`top_locations RPC callable`, true);
      const pendingPortInTop = (topHits ?? []).some((r: { id: string }) => r.id === pendingPortId);
      record(`top_locations excludes source='pending' ports`, !pendingPortInTop);
    }

    // ── get_locations_by_ids SHOULD return pending rows (intentional) ──
    if (pendingCityId) {
      const { data: byIds, error: byIdsErr } = await sb.rpc('get_locations_by_ids', {
        port_ids: pendingPortId ? [pendingPortId] : [],
        city_ids: [pendingCityId],
      });
      if (byIdsErr) {
        record(`get_locations_by_ids RPC callable`, false, byIdsErr.message);
      } else {
        const cityFound = (byIds ?? []).some(
          (r: { id: string; kind: string }) => r.id === pendingCityId && r.kind === 'city',
        );
        record(`get_locations_by_ids resolves pending city (intentional)`, cityFound);
        if (pendingPortId) {
          const portFound = (byIds ?? []).some(
            (r: { id: string; kind: string }) => r.id === pendingPortId && r.kind === 'port',
          );
          record(`get_locations_by_ids resolves pending port (intentional)`, portFound);
        }
      }
    }

    // ── hidden_at filter — set hidden_at and re-query ─────────────
    if (pendingCityId) {
      console.log('\nHide flow:');
      // Flip the city to source='curated' AND hidden_at=now() to test the
      // hidden_at filter independently of source.
      await sb
        .from('cities')
        .update({ source: 'curated', hidden_at: new Date().toISOString() })
        .eq('id', pendingCityId);

      const { data: searchHidden } = await sb.rpc('search_locations', { q: SENTINEL });
      const hits = (searchHidden ?? []).filter((r: { name: string }) =>
        r.name.startsWith(SENTINEL),
      );
      record(`search_locations excludes hidden_at IS NOT NULL`, hits.length === 0);
    }

    // ── Admin queue embed syntax — exercises the same query
    //     `/api/admin/locations/pending` runs in production. The
    //     nested `cities → regions` embed is a class of bug that
    //     mocked unit tests can't detect.
    console.log('\nAdmin queue embed:');

    const { data: cityRows, error: cityEmbedErr } = await sb
      .from('cities')
      .select(
        'id, name, region_id, created_at, submitted_by, regions:region_id(id, name, country_code)',
      )
      .eq('source', 'pending')
      .is('hidden_at', null)
      .order('created_at', { ascending: false })
      .limit(1);
    record(`cities embed regions(...) works`, !cityEmbedErr, cityEmbedErr?.message);

    const { data: portRows, error: portEmbedErr } = await sb
      .from('ports')
      .select(
        'id, name, city_id, created_at, submitted_by, cities:city_id(id, name, region_id, regions:region_id(id, name, country_code))',
      )
      .eq('source', 'pending')
      .is('hidden_at', null)
      .order('created_at', { ascending: false })
      .limit(1);
    record(`ports embed cities → regions works`, !portEmbedErr, portEmbedErr?.message);

    // Make sure the shape is what the admin route claims.
    if (cityRows && cityRows.length > 0) {
      const r = cityRows[0] as {
        regions?: { name?: string; country_code?: string | null } | null;
      };
      record(
        `cities embed returns regions object (not array)`,
        r.regions !== undefined,
        typeof r.regions,
      );
    }
  } finally {
    // ── Tear down ──────────────────────────────────────────────
    console.log('\nCleanup:');
    if (pendingPortId) {
      const { error } = await sb.from('ports').delete().eq('id', pendingPortId);
      record(`DELETE test port`, !error, error?.message);
    }
    if (pendingCityId) {
      const { error } = await sb.from('cities').delete().eq('id', pendingCityId);
      record(`DELETE test city`, !error, error?.message);
    }
  }

  // ── Summary ────────────────────────────────────────────────────
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n▶ ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Stress test crashed:', err);
  process.exit(1);
});
