/**
 * End-to-end stress test against the live production deploy.
 *
 * Hits real HTTP endpoints on https://www.dockwalker.io to verify:
 *   1. Production is responsive (health check + landing page).
 *   2. Every CV-related route locked at the top of the handler returns
 *      503 with the spec'd Coming-Soon payload — proving the deployed
 *      code carries the feature flag set to `false`.
 *   3. The /cv/[handle] page renders the Coming-Soon screen.
 *   4. No public CV-related surface leaks profile data while locked.
 *
 * What this DOESN'T cover (scope-checked):
 *   - Authenticated routes (POST /api/daywork QR-hire, POST
 *     /api/permanent/[id]/apply with fromInvitationId) — these need
 *     real session cookies. Their lock branches are covered by unit
 *     tests + the schema/projection stress test.
 *   - DB-level schema + projection — covered by
 *     `scripts/stress-test-cv-builder.ts` against the same Supabase
 *     instance.
 *
 * Run: `npx tsx scripts/stress-test-e2e.ts`
 *
 * Override the target URL with `PROD_URL=https://staging.example.com`
 * for previews / staging. Defaults to production.
 */
const PROD_URL = process.env.PROD_URL ?? 'https://www.dockwalker.io';

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

async function probe(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: string; ok: boolean }> {
  const res = await fetch(`${PROD_URL}${path}`, {
    ...init,
    redirect: 'manual',
  });
  const body = await res.text();
  return { status: res.status, body, ok: res.ok };
}

async function main(): Promise<void> {
  console.log(`\n── E2E stress test against ${PROD_URL} ──\n`);

  console.log('── Production health ────────────────────────────────\n');

  const health = await probe('/api/health');
  record('Health endpoint returns 200', health.status === 200, `status=${health.status}`);

  const landing = await probe('/');
  record(
    'Landing page returns 200 (deploy is responsive)',
    landing.status === 200,
    `status=${landing.status}`,
  );

  console.log('\n── Locked CV routes return 503 + Coming-Soon ───────\n');

  // GET /api/cv/[handle] — locked at top, no auth required to hit the lock.
  const cvHandle = await probe('/api/cv/AbCd1234');
  record('GET /api/cv/[handle] returns 503', cvHandle.status === 503, `status=${cvHandle.status}`);
  try {
    const payload = JSON.parse(cvHandle.body);
    record(
      'GET /api/cv/[handle] payload contains "Coming Soon"',
      typeof payload.error === 'string' && /Coming Soon/i.test(payload.error),
      payload.error ?? '(missing error field)',
    );
  } catch {
    record('GET /api/cv/[handle] returns valid JSON', false, cvHandle.body.slice(0, 80));
  }

  // GET /api/cv/[handle] with an invalid format — lock fires before validation
  // so even a garbage handle still returns 503 (not 400).
  const cvBadHandle = await probe('/api/cv/not-a-valid-handle');
  record(
    'GET /api/cv/[invalid-handle] returns 503 (lock fires before format check)',
    cvBadHandle.status === 503,
    `status=${cvBadHandle.status}`,
  );

  // PATCH /api/cv/settings — locked at top.
  const cvSettings = await probe('/api/cv/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cvIncludeSeaTime: true }),
  });
  record(
    'PATCH /api/cv/settings returns 503',
    cvSettings.status === 503,
    `status=${cvSettings.status}`,
  );
  try {
    const payload = JSON.parse(cvSettings.body);
    record(
      'PATCH /api/cv/settings payload contains "Coming Soon"',
      typeof payload.error === 'string' && /Coming Soon/i.test(payload.error),
      payload.error ?? '(missing error field)',
    );
  } catch {
    record('PATCH /api/cv/settings returns valid JSON', false, cvSettings.body.slice(0, 80));
  }

  // POST /api/permanent/[id]/invite — locked at top.
  const permInvite = await probe('/api/permanent/00000000-0000-0000-0000-000000000000/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ crewPersonId: '00000000-0000-0000-0000-000000000000' }),
  });
  record(
    'POST /api/permanent/[id]/invite returns 503',
    permInvite.status === 503,
    `status=${permInvite.status}`,
  );

  // POST /api/cv/generate — Stage-1 stub, returns 503 with Coming-Soon
  // (locked since Phase 2 — predates the user-level lockdown but
  // produces the same visible behaviour to a caller).
  // Auth required, but the route's auth check returns 401 not 503; we
  // can't easily probe this one without a session. Skip.

  console.log('\n── /cv/[handle] page renders Coming-Soon ───────────\n');

  const cvPage = await probe('/cv/AbCd1234');
  // The page is a public route — middleware passes it through.
  record('GET /cv/[handle] page returns 200', cvPage.status === 200, `status=${cvPage.status}`);
  record(
    '/cv/[handle] page HTML contains "DockWalker CV — Coming Soon"',
    cvPage.body.includes('DockWalker CV — Coming Soon'),
    cvPage.body.includes('DockWalker CV — Coming Soon')
      ? 'lock screen rendered'
      : 'lock screen MISSING — possible regression',
  );
  // Belt-and-braces: confirm no profile data leaked into the HTML.
  // (The lock screen renders without a fetch, so no profile data
  // should appear.)
  record(
    '/cv/[handle] page does NOT contain "person_id" / "display_name" payload keys',
    !cvPage.body.includes('"person_id"') && !cvPage.body.includes('"display_name"'),
    'no profile data leaked',
  );

  console.log('\n── Non-CV regression spot-check ─────────────────────\n');

  // Pick a sample API route that's NOT CV-related — confirm production
  // generally still works. /api/health already covered above; the
  // landing page covers the public render. Add /api/auth/me which
  // returns 401 unauth (proves auth wiring still answers).
  const authMe = await probe('/api/auth/me');
  record(
    '/api/auth/me returns 401 unauth (auth wiring still alive)',
    authMe.status === 401,
    `status=${authMe.status}`,
  );

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
