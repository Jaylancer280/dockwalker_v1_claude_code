import { describe, it, expect } from 'vitest';
import {
  groupCertsByCategoryAndSubcategory,
  certCategoryLabel,
  certSubcategoryLabel,
  type CertInput,
} from '@dockwalker/shared';

function makeCert(
  id: string,
  name: string,
  category: string,
  subcategory: string | null,
  sortOrder: number,
): CertInput {
  return { id, name, category, subcategory, sort_order: sortOrder };
}

describe('groupCertsByCategoryAndSubcategory', () => {
  it('returns flat groups for categories without subcategories', () => {
    const certs: CertInput[] = [
      makeCert('b1', 'STCW 95', 'basic', null, 1),
      makeCert('b2', 'ENG1 Medical', 'basic', null, 2),
      makeCert('g1', 'Ship Cook', 'galley', null, 16),
    ];
    const groups = groupCertsByCategoryAndSubcategory(certs);
    expect(groups).toHaveLength(2);

    const basic = groups.find((g) => g.category === 'basic')!;
    expect(basic.subcategories).toEqual([]);
    expect(basic.items).toEqual([
      { id: 'b1', label: 'STCW 95' },
      { id: 'b2', label: 'ENG1 Medical' },
    ]);

    const galley = groups.find((g) => g.category === 'galley')!;
    expect(galley.subcategories).toEqual([]);
    expect(galley.items).toEqual([{ id: 'g1', label: 'Ship Cook' }]);
  });

  it('nests subcategories for drill-down categories', () => {
    const certs: CertInput[] = [
      makeCert('d1', 'RYA Day Skipper', 'deck_bridge', 'master_skipper', 4),
      makeCert('d2', 'RYA Powerboat L2', 'deck_bridge', 'rya_powerboat_nav', 3),
      makeCert('d3', 'MCA TRB', 'deck_bridge', 'deck_modules', 1),
      makeCert('d4', 'MCA Master <200gt', 'deck_bridge', 'master_skipper', 14),
    ];
    const groups = groupCertsByCategoryAndSubcategory(certs);
    expect(groups).toHaveLength(1);

    const deck = groups[0];
    expect(deck.category).toBe('deck_bridge');
    expect(deck.items).toEqual([]);

    // Subcategories ordered by SUBCATEGORY_ORDER: master_skipper, deck_modules, rya_powerboat_nav
    const subNames = deck.subcategories.map((s) => s.subcategory);
    expect(subNames).toEqual(['master_skipper', 'deck_modules', 'rya_powerboat_nav']);

    const masterSkipper = deck.subcategories.find((s) => s.subcategory === 'master_skipper')!;
    // Items sorted by sort_order within subcategory
    expect(masterSkipper.items).toEqual([
      { id: 'd1', label: 'RYA Day Skipper' },
      { id: 'd4', label: 'MCA Master <200gt' },
    ]);
  });

  it('orders categories by CATEGORY_ORDER (basic before deck_bridge before others)', () => {
    const certs: CertInput[] = [
      makeCert('o1', 'Washdown', 'other', null, 1),
      makeCert('h1', 'HLO', 'helideck', null, 3),
      makeCert('b1', 'STCW 95', 'basic', null, 1),
      makeCert('d1', 'RYA Day Skipper', 'deck_bridge', 'master_skipper', 4),
    ];
    const groups = groupCertsByCategoryAndSubcategory(certs);
    expect(groups.map((g) => g.category)).toEqual([
      'basic',
      'deck_bridge',
      'helideck',
      'other',
    ]);
  });

  it('falls back to category "other" when input category is missing', () => {
    const certs: CertInput[] = [
      { id: 'x1', name: 'Unknown cert', sort_order: 1 } as CertInput,
    ];
    const groups = groupCertsByCategoryAndSubcategory(certs);
    expect(groups[0].category).toBe('other');
    expect(groups[0].items).toEqual([{ id: 'x1', label: 'Unknown cert' }]);
  });

  it('sorts items by sort_order, then by name as tiebreaker', () => {
    const certs: CertInput[] = [
      makeCert('a', 'Zebra cert', 'basic', null, 5),
      makeCert('b', 'Alpha cert', 'basic', null, 5),
      makeCert('c', 'Beta cert', 'basic', null, 1),
    ];
    const groups = groupCertsByCategoryAndSubcategory(certs);
    expect(groups[0].items.map((i) => i.label)).toEqual([
      'Beta cert',
      'Alpha cert',
      'Zebra cert',
    ]);
  });
});

describe('cert labels', () => {
  it('returns human-readable category labels', () => {
    expect(certCategoryLabel('basic')).toBe('Basic');
    expect(certCategoryLabel('deck_bridge')).toBe('Deck / Bridge');
    expect(certCategoryLabel('watersports')).toBe('Watersports & Diving');
  });

  it('humanises unknown category keys', () => {
    expect(certCategoryLabel('brand_new')).toBe('Brand New');
  });

  it('falls back to "Other" for null/undefined', () => {
    expect(certCategoryLabel(null)).toBe('Other');
    expect(certCategoryLabel(undefined)).toBe('Other');
  });

  it('returns subcategory labels', () => {
    expect(certSubcategoryLabel('master_skipper')).toBe('Master / Skipper CoCs');
    expect(certSubcategoryLabel('eng_modules')).toBe('Modules & Short Courses');
    expect(certSubcategoryLabel('wine_spirits')).toBe('Wine & Spirits');
  });

  it('returns empty string for null/undefined subcategory', () => {
    expect(certSubcategoryLabel(null)).toBe('');
    expect(certSubcategoryLabel(undefined)).toBe('');
  });
});
