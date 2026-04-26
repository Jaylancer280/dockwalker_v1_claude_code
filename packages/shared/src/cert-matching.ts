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
 * intersection fails. This module expands a candidate's bundles into
 * their covered components before matching.
 *
 * v1 direction: bundle → components only. A candidate holding a bundle
 * satisfies any required component. A candidate holding only the
 * components separately does NOT automatically satisfy a required
 * bundle (strict). Symmetric expansion may be added later.
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
 * holdings plus the components of any bundle they hold.
 */
export function expandCertCoverage(candidate: string[], bundles: BundleMap): Set<string> {
  const covered = new Set(candidate);
  for (const certId of candidate) {
    const components = bundles[certId];
    if (components) {
      for (const c of components) covered.add(c);
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
