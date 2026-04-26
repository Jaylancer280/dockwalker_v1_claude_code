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

  it('strict direction — components do NOT auto-satisfy a required bundle', () => {
    const r = meetsRequirements([AEC_1, AEC_2], [AEC_BUNDLE], bundles);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual([AEC_BUNDLE]);
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
