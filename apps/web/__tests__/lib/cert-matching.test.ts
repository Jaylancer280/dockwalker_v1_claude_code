import { describe, it, expect } from 'vitest';
import {
  meetsRequirements,
  expandCertCoverage,
  expandCertForFilter,
  type BundleMap,
} from '@dockwalker/shared';

const AEC_BUNDLE = 'aec-bundle';
const AEC_1 = 'aec-1';
const AEC_2 = 'aec-2';
const STCW_BUNDLE = 'stcw-bundle';
const STCW_PST = 'stcw-pst';
const STCW_FPFF = 'stcw-fpff';
const STCW_EFA = 'stcw-efa';
const PWB2 = 'pwb-2';

const bundles: BundleMap = {
  [AEC_BUNDLE]: [AEC_1, AEC_2],
  [STCW_BUNDLE]: [STCW_PST, STCW_FPFF, STCW_EFA],
};

describe('meetsRequirements', () => {
  it('direct match — candidate holds the required cert', () => {
    const r = meetsRequirements([PWB2], [PWB2], bundles);
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.satisfiedVia).toEqual({});
  });

  it('bundle covers component — candidate has AEC 1+2, posting requires AEC 1', () => {
    const r = meetsRequirements([AEC_BUNDLE], [AEC_1], bundles);
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.satisfiedVia).toEqual({ [AEC_1]: AEC_BUNDLE });
  });

  it('bundle covers multiple components — AEC 1+2 satisfies both AEC 1 and AEC 2', () => {
    const r = meetsRequirements([AEC_BUNDLE], [AEC_1, AEC_2], bundles);
    expect(r.ok).toBe(true);
    expect(r.satisfiedVia).toEqual({ [AEC_1]: AEC_BUNDLE, [AEC_2]: AEC_BUNDLE });
  });

  it('symmetric direction — every component held auto-satisfies the bundle', () => {
    // AEC 1 + AEC 2 separately is administratively equivalent to AEC 1+2
    // in MCA's eyes. Holding the full component set must satisfy a
    // requirement for the bundle.
    const r = meetsRequirements([AEC_1, AEC_2], [AEC_BUNDLE], bundles);
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('partial component coverage does NOT satisfy the bundle', () => {
    // Holding AEC 1 alone must not flip AEC 1+2 on. The fix is strict —
    // every component required, no exceptions.
    const r = meetsRequirements([AEC_1], [AEC_BUNDLE], bundles);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual([AEC_BUNDLE]);
  });

  it('STCW 95: every component held satisfies the bundle (direction 2, full set)', () => {
    const r = meetsRequirements([STCW_PST, STCW_FPFF, STCW_EFA], [STCW_BUNDLE], bundles);
    expect(r.ok).toBe(true);
  });

  it('STCW 95: missing one component leaves the bundle unmet (direction 2, partial)', () => {
    const r = meetsRequirements([STCW_PST, STCW_FPFF], [STCW_BUNDLE], bundles);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual([STCW_BUNDLE]);
  });

  it('STCW 95: holding the bundle satisfies all components individually (direction 1)', () => {
    // The adverse / mirror of the symmetric case. A candidate with the
    // STCW 95 cert must satisfy a posting that lists all the
    // sub-components individually — every one resolved via the bundle,
    // every one attributed to STCW_BUNDLE in satisfiedVia.
    const r = meetsRequirements(
      [STCW_BUNDLE],
      [STCW_PST, STCW_FPFF, STCW_EFA],
      bundles,
    );
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.satisfiedVia).toEqual({
      [STCW_PST]: STCW_BUNDLE,
      [STCW_FPFF]: STCW_BUNDLE,
      [STCW_EFA]: STCW_BUNDLE,
    });
  });

  it('STCW 95: bundle ↔ components round-trip (both directions, same outcome)', () => {
    // Two candidates, two postings, mirrored. Both must pass.
    const fromBundle = meetsRequirements(
      [STCW_BUNDLE],
      [STCW_PST, STCW_FPFF, STCW_EFA],
      bundles,
    );
    const fromComponents = meetsRequirements(
      [STCW_PST, STCW_FPFF, STCW_EFA],
      [STCW_BUNDLE],
      bundles,
    );
    expect(fromBundle.ok).toBe(true);
    expect(fromComponents.ok).toBe(true);
  });

  it('empty bundle row guard — zero-component bundle is never auto-satisfied', () => {
    // Defensive: if a bundle row is malformed/empty, [].every() is true
    // in JS — without the length>0 guard, a candidate with no certs
    // would falsely satisfy the empty bundle. Verify the guard works.
    const malformed: BundleMap = { 'empty-bundle': [] };
    const r = meetsRequirements([], ['empty-bundle'], malformed);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['empty-bundle']);
  });

  it('mixed — direct match + bundle expansion', () => {
    const r = meetsRequirements([PWB2, STCW_BUNDLE], [PWB2, STCW_PST, STCW_EFA], bundles);
    expect(r.ok).toBe(true);
    expect(r.satisfiedVia).toEqual({
      [STCW_PST]: STCW_BUNDLE,
      [STCW_EFA]: STCW_BUNDLE,
    });
  });

  it('legitimate miss — required cert is neither held nor covered', () => {
    const r = meetsRequirements([AEC_BUNDLE], [STCW_PST], bundles);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual([STCW_PST]);
  });

  it('empty required → always passes', () => {
    const r = meetsRequirements([], [], bundles);
    expect(r.ok).toBe(true);
  });

  it('empty bundles map — falls back to plain intersection', () => {
    const r = meetsRequirements([AEC_1], [AEC_1, AEC_2], {});
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual([AEC_2]);
  });

  it('direct match takes precedence over bundle attribution', () => {
    // Candidate holds AEC 1 directly AND the bundle. Required = AEC 1.
    // satisfiedVia should be empty (direct match, no attribution needed).
    const r = meetsRequirements([AEC_1, AEC_BUNDLE], [AEC_1], bundles);
    expect(r.ok).toBe(true);
    expect(r.satisfiedVia).toEqual({});
  });
});

describe('expandCertCoverage', () => {
  it('returns direct certs only when no bundles match', () => {
    const set = expandCertCoverage([PWB2], bundles);
    expect(Array.from(set).sort()).toEqual([PWB2]);
  });

  it('expands bundle into components', () => {
    const set = expandCertCoverage([AEC_BUNDLE], bundles);
    expect(Array.from(set).sort()).toEqual([AEC_1, AEC_2, AEC_BUNDLE].sort());
  });

  it('symmetric: holding every component adds the bundle id to coverage', () => {
    const set = expandCertCoverage([AEC_1, AEC_2], bundles);
    expect(set.has(AEC_BUNDLE)).toBe(true);
    expect(Array.from(set).sort()).toEqual([AEC_1, AEC_2, AEC_BUNDLE].sort());
  });

  it('symmetric: partial component holding does NOT add the bundle id', () => {
    const set = expandCertCoverage([AEC_1], bundles);
    expect(set.has(AEC_BUNDLE)).toBe(false);
  });

  it('symmetric: STCW 95 requires all components, none-or-some does not match', () => {
    expect(expandCertCoverage([STCW_PST, STCW_FPFF], bundles).has(STCW_BUNDLE)).toBe(false);
    expect(
      expandCertCoverage([STCW_PST, STCW_FPFF, STCW_EFA], bundles).has(STCW_BUNDLE),
    ).toBe(true);
  });

  it('empty bundle is never auto-derived (length>0 guard)', () => {
    const malformed: BundleMap = { 'empty-bundle': [] };
    const set = expandCertCoverage([], malformed);
    expect(set.has('empty-bundle')).toBe(false);
  });

  it('candidate holding bundle + every component is idempotent (no duplication)', () => {
    const set = expandCertCoverage([AEC_BUNDLE, AEC_1, AEC_2], bundles);
    expect(Array.from(set).sort()).toEqual([AEC_1, AEC_2, AEC_BUNDLE].sort());
  });
});

describe('expandCertForFilter', () => {
  it('non-bundle cert returns single id', () => {
    expect(expandCertForFilter(PWB2, bundles)).toEqual([PWB2]);
  });

  it('bundle cert returns bundle + components', () => {
    expect(expandCertForFilter(AEC_BUNDLE, bundles).sort()).toEqual(
      [AEC_BUNDLE, AEC_1, AEC_2].sort(),
    );
  });
});
