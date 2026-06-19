/**
 * Cert matching with bundle awareness.
 *
 * Real-world maritime training is sometimes sold as a single bundled
 * certificate covering multiple individual STCW competencies. Examples:
 *   - AEC 1+2 (single MCA cert) covers AEC 1 and AEC 2 individually
 *   - STCW 95 / STCW 2010 covers PST, FPFF, EFA, PSSR, Medical First Aid
 *
 * Without bundle awareness, a candidate holding the bundle cannot
 * apply to a job requiring the components separately — direct UUID
 * intersection fails. This module expands the candidate's holdings in
 * BOTH directions before matching:
 *
 *   1. bundle → components: holding AEC 1+2 covers AEC 1 and AEC 2.
 *   2. components → bundle: holding AEC 1 AND AEC 2 (every component)
 *      covers the AEC 1+2 bundle. The check is strict — partial
 *      coverage does not match. Holding 4 of 5 STCW 95 components
 *      stays blocked; only the complete set flips the bundle on.
 *
 * Both AEC 1+2 and STCW 95 are administratively equivalent to their
 * components in MCA's eyes (same audited courses, just packaged
 * differently), so symmetric matching is correct for v1's two bundles.
 * If a future bundle is genuinely more rigorous than the sum of its
 * parts (e.g. an examination on top of the components), introduce a
 * per-bundle directionality flag at that time.
 */

export type BundleMap = Record<string, string[]>;

export interface MatchResult {
  /** True if every required cert is satisfied (directly or via a bundle). */
  ok: boolean;
  /** Cert ids in `required` that the candidate cannot satisfy. */
  missing: string[];
  /** For each satisfied requirement covered indirectly by a bundle, maps
   *  the required cert id → the candidate's bundle cert id that covers
   *  it. Used by the UI to render `AEC 1 ✓ (via your AEC 1+2)`. Direct
   *  matches are not present here. */
  satisfiedVia: Record<string, string>;
}

/**
 * Build a Set of every cert id the candidate "covers" — their direct
 * holdings plus any cert reachable via either bundle direction:
 *   1. bundle → components: holding a bundle covers all of its components
 *   2. components → bundle: holding every component of a bundle covers
 *      the bundle itself (all-or-nothing — partial coverage does not match)
 */
export function expandCertCoverage(candidate: string[], bundles: BundleMap): Set<string> {
  const covered = new Set(candidate);

  // Direction 1: bundle → components. Holding a bundle implicitly grants
  // the individual components it covers.
  for (const certId of candidate) {
    const components = bundles[certId];
    if (components) {
      for (const c of components) covered.add(c);
    }
  }

  // Direction 2: components → bundle. If the candidate holds every
  // component of a bundle, they implicitly hold the bundle itself.
  // `length > 0` guards against an empty/malformed bundle row, which
  // would otherwise satisfy via `[].every() === true` and let zero-cert
  // holders match. `every` enforces all-or-nothing — single or partial
  // component holdings stay blocked.
  for (const [bundleId, components] of Object.entries(bundles)) {
    if (components.length > 0 && components.every((c) => covered.has(c))) {
      covered.add(bundleId);
    }
  }

  return covered;
}

/**
 * Determine whether a candidate's certifications satisfy the postings's
 * required certifications, treating bundles as covering their components.
 *
 * @param candidate cert ids the candidate holds (from `profiles.certification_ids`)
 * @param required cert ids the posting demands (from `dayworks.required_certification_ids` or equivalent)
 * @param bundles map from bundle_cert_id → component_cert_id[]
 */
export function meetsRequirements(
  candidate: string[],
  required: string[],
  bundles: BundleMap,
): MatchResult {
  const candidateSet = new Set(candidate);
  const covered = expandCertCoverage(candidate, bundles);

  const missing: string[] = [];
  const satisfiedVia: Record<string, string> = {};

  for (const req of required) {
    if (candidateSet.has(req)) continue; // direct match — no bundle attribution
    if (covered.has(req)) {
      // covered via a bundle — find which one for UI attribution
      for (const certId of candidate) {
        if (bundles[certId]?.includes(req)) {
          satisfiedVia[req] = certId;
          break;
        }
      }
      continue;
    }
    missing.push(req);
  }

  return { ok: missing.length === 0, missing, satisfiedVia };
}

/**
 * Expand a single cert filter id into the set of cert ids that should
 * match jobs filterable by it. Used by the discover feed: when a
 * candidate filters by their bundle (e.g. "show me jobs requiring AEC
 * 1+2 or its components"), we expand to bundle + components so the
 * filter does not over-narrow.
 *
 * Returns `[certId]` when the cert is not a bundle.
 */
export function expandCertForFilter(certId: string, bundles: BundleMap): string[] {
  const components = bundles[certId];
  if (components && components.length > 0) return [certId, ...components];
  return [certId];
}
