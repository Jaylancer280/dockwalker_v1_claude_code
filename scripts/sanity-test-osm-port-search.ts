/**
 * Live-picker UI sanity pass — Locations V1 follow-up #C4 in `tasks/todo.md`.
 *
 * Samples 20 random non-curated (`source='osm'`) ports, runs each name
 * through `search_locations`, and asserts:
 *   1. The port itself appears in results.
 *   2. Its `parent_name` (city) is populated.
 *   3. Its `country_code` is populated.
 *
 * This catches the silent-failure mode where the picker shows a marina
 * with no surrounding context — typically a stale city FK, a city
 * row missing a region, or a region missing `country_code`.
 *
 * Run: `npx tsx scripts/sanity-test-osm-port-search.ts`
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

const SAMPLE_SIZE = 20;

interface SearchHit {
  id: string;
  kind: string;
  name: string;
  parent_id: string | null;
  parent_name: string | null;
  country_code: string | null;
  score: number;
}

interface PortRow {
  id: string;
  name: string;
  city_id: string | null;
}

async function main() {
  const { url, key } = loadEnv();
  const sb = createClient(url, key);

  console.log(`▶ OSM port search sanity pass (${SAMPLE_SIZE} samples)\n`);

  // Pull a population of non-curated ports, then sample client-side.
  // The marina-import migration 00104 stamped imported rows as
  // `source='curated'` (everything before 00113 had source NOT NULL with
  // default 'curated'). The original task spec said "non-curated" ports —
  // by which we now mean "ports outside the original 55 launch hubs".
  // Easiest definition: ports with `osm_id IS NOT NULL`.
  const { data: pool, error: poolErr } = await sb
    .from('ports')
    .select('id, name, city_id, osm_id')
    .not('osm_id', 'is', null)
    .is('hidden_at', null)
    .limit(2000);
  if (poolErr) {
    console.error(`Failed to pull ports: ${poolErr.message}`);
    process.exit(1);
  }
  if (!pool || pool.length === 0) {
    console.error('No OSM-imported ports found in DB.');
    process.exit(1);
  }
  console.log(`  pool size: ${pool.length} ports with osm_id set`);


  // Shuffle + take first N (Fisher-Yates).
  const shuffled = [...(pool as PortRow[])];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const sample = shuffled.slice(0, SAMPLE_SIZE);

  let passed = 0;
  let failed = 0;
  const failures: Array<{ port: PortRow; reason: string }> = [];

  for (const port of sample) {
    // Use a query length ≥2 derived from the name; trim quoting.
    const q = port.name.length >= 2 ? port.name : `${port.name}  `;
    const { data: hits, error } = await sb.rpc('search_locations', { q });

    if (error) {
      failures.push({ port, reason: `RPC error: ${error.message}` });
      failed++;
      continue;
    }

    const portHits = (hits ?? []).filter(
      (h: SearchHit) => h.id === port.id && h.kind === 'port',
    );

    if (portHits.length === 0) {
      failures.push({
        port,
        reason: `port not in fuzzy-search results for q='${q}' (got ${(hits ?? []).length} hits)`,
      });
      failed++;
      continue;
    }

    const hit = portHits[0] as SearchHit;
    if (!hit.parent_name) {
      failures.push({
        port,
        reason: `no parent_name (city) on result — port.city_id=${port.city_id ?? 'null'}`,
      });
      failed++;
      continue;
    }
    if (!hit.country_code) {
      failures.push({
        port,
        reason: `no country_code on result — parent_name=${hit.parent_name}`,
      });
      failed++;
      continue;
    }

    passed++;
    console.log(
      `  [PASS] ${port.name} → ${hit.parent_name}, ${hit.country_code} (score ${hit.score.toFixed(2)})`,
    );
  }

  console.log(`\n▶ ${passed}/${SAMPLE_SIZE} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  - ${f.port.name} (${f.port.id}): ${f.reason}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Sanity test crashed:', err);
  process.exit(1);
});
