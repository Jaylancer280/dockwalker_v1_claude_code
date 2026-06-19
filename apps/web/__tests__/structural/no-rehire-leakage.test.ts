import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Audit P1-M3 (2026-04-30) — structural assertion that private rating
 * intelligence (would_rehire, would_work_on_vessel_again, pay_accuracy,
 * cert_verification) NEVER appears in API response shapes.
 *
 * The mission doc forbids surfacing reputation-style metrics to users.
 * The rate API accepts these as INPUTS (employer/crew rate each other),
 * but no GET endpoint should ever return them in a response payload.
 *
 * This test reads every route.ts under apps/web/src/app/api/ and asserts
 * the forbidden field names don't appear in JSON return values. The
 * route's allowed to RECEIVE them (req.body), USE them in DB writes,
 * and PASS them to appendEvent payloads — but the response body shape
 * must not include them.
 *
 * Heuristic: scans for `would_rehire`, `would_work_on_vessel_again`,
 * `pay_accuracy`, `cert_verification` appearing anywhere in route files
 * that doesn't match a clear input/payload context. Files in the
 * allow-list below are exempt because they legitimately handle these
 * fields as inputs. If a new route legitimately needs to write these
 * fields, add it to the allow-list with a justification comment.
 */

const FORBIDDEN_FIELDS = [
  'would_rehire',
  'would_work_on_vessel_again',
  'pay_accuracy',
  'cert_verification',
] as const;

/**
 * Routes that legitimately handle these fields. Each entry needs a
 * justification comment. The audit (P1-M3) is specifically about
 * preventing leakage OUTSIDE the rater's own scope — routes that
 * return the data scoped to `rater_person_id = auth.uid()` are
 * legitimate (user editing their own previously-submitted rating).
 */
const ALLOWED_INPUT_ROUTES = new Set([
  // Rate API accepts these as INPUTS in the request body and writes
  // them via appendEvent → engagement_ratings. Never returns them.
  'apps/web/src/app/api/engagements/[id]/rate/route.ts',

  // Messages context returns the caller's OWN previously-submitted
  // rating (filtered by `rater_person_id = user.id`) to populate the
  // rating form for editing. Cannot leak across users — verified by
  // the .eq('rater_person_id', user.id) clause in the SELECT.
  'apps/web/src/app/api/messages/[engagementId]/context/route.ts',
]);

const API_ROOT = join(process.cwd(), 'src', 'app', 'api');

function* walkRoutes(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walkRoutes(full);
    } else if (entry === 'route.ts' || entry === 'route.tsx') {
      yield full;
    }
  }
}

function relativePath(absolute: string): string {
  // Normalise to forward-slash repo-relative path so the allow-list keys match
  // on every platform (Windows uses backslashes natively).
  const repoRoot = process.cwd().replace(/\\/g, '/');
  const cwdNormalized = repoRoot.endsWith('/apps/web') ? repoRoot.slice(0, -'/apps/web'.length) : repoRoot;
  return absolute.replace(/\\/g, '/').replace(`${cwdNormalized}/`, '');
}

describe('structural: no rating-intelligence leakage in API responses', () => {
  it('FORBIDDEN_FIELDS appear in no route.ts file outside the allow-list', () => {
    const violations: { file: string; field: string; lines: number[] }[] = [];

    for (const file of walkRoutes(API_ROOT)) {
      const rel = relativePath(file);
      if (ALLOWED_INPUT_ROUTES.has(rel)) continue;

      const source = readFileSync(file, 'utf-8');
      const lines = source.split('\n');

      for (const field of FORBIDDEN_FIELDS) {
        const matchedLines: number[] = [];
        lines.forEach((line, idx) => {
          if (line.includes(field)) {
            matchedLines.push(idx + 1);
          }
        });
        if (matchedLines.length > 0) {
          violations.push({ file: rel, field, lines: matchedLines });
        }
      }
    }

    if (violations.length > 0) {
      const message = violations
        .map((v) => `  ${v.file}:${v.lines.join(',')} — references "${v.field}"`)
        .join('\n');
      throw new Error(
        `Rating intelligence leak (audit P1-M3): the following routes reference forbidden fields ` +
          `outside the allow-list. These fields are private intelligence and must not appear in ` +
          `response payloads.\n${message}\n\n` +
          `If a route legitimately needs to RECEIVE these fields as input, add it to ` +
          `ALLOWED_INPUT_ROUTES with a justification comment.`,
      );
    }

    expect(violations).toEqual([]);
  });

  it('ALLOWED_INPUT_ROUTES contains the known legitimate handlers', () => {
    // These two routes are the only places that legitimately handle
    // private rating fields. If the allow-list grows, each addition
    // needs a justification comment.
    expect(ALLOWED_INPUT_ROUTES.has('apps/web/src/app/api/engagements/[id]/rate/route.ts')).toBe(
      true,
    );
    expect(
      ALLOWED_INPUT_ROUTES.has(
        'apps/web/src/app/api/messages/[engagementId]/context/route.ts',
      ),
    ).toBe(true);
  });

  it('messages/context route filters ratings by rater_person_id = auth.uid()', () => {
    // The route is allow-listed because of this self-scoping. Verify
    // the scoping clause is present — if a future refactor removes it,
    // this test catches the leak directly.
    const routeFile = readFileSync(
      join(API_ROOT, 'messages', '[engagementId]', 'context', 'route.ts'),
      'utf-8',
    );
    // Look for `.eq('rater_person_id', user.id)` near the rating SELECT.
    expect(routeFile).toMatch(/\.eq\(\s*['"]rater_person_id['"]\s*,\s*user\.id\s*\)/);
  });
});
