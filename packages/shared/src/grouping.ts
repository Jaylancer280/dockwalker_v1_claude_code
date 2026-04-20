export interface PillGroup {
  id: string;
  label: string;
  items: { id: string; label: string }[];
}

const DEPT_LABELS: Record<string, string> = {
  bridge: 'Bridge',
  deck: 'Deck',
  engineering: 'Engineering',
  galley: 'Galley',
  interior: 'Interior',
  safety: 'Safety',
  medical: 'Medical',
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Convert yacht_roles rows (id, name, department) into PillGroups. Hybrid departments split into parents. */
export function rolesToGroups(
  roles: { id: string; name: string; department?: string }[],
): PillGroup[] {
  const map = new Map<string, { id: string; label: string }[]>();
  for (const r of roles) {
    const dept = r.department || 'other';
    const parts = dept.includes('_') ? dept.split('_') : [dept];
    for (const p of parts) {
      const list = map.get(p) ?? [];
      list.push({ id: r.id, label: r.name });
      map.set(p, list);
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dept, items]) => ({
      id: dept,
      label: DEPT_LABELS[dept] ?? capitalize(dept),
      items,
    }));
}

/** Convert cities rows (id, name, region name) into PillGroups grouped by region. */
export function citiesToGroups(
  cities: { id: string; name: string; regions: { name: string } | null }[],
): PillGroup[] {
  const map = new Map<string, { id: string; label: string }[]>();
  for (const c of cities) {
    const region = c.regions?.name ?? 'Other';
    const list = map.get(region) ?? [];
    list.push({ id: c.id, label: c.name });
    map.set(region, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([region, items]) => ({
      id: region,
      label: region,
      items,
    }));
}

/** Convert certifications rows (id, name, category) into PillGroups grouped by category. */
export function certsToGroups(
  certs: { id: string; name: string; category?: string }[],
): PillGroup[] {
  const map = new Map<string, { id: string; label: string }[]>();
  for (const c of certs) {
    const cat = c.category || 'other';
    const list = map.get(cat) ?? [];
    list.push({ id: c.id, label: c.name });
    map.set(cat, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, items]) => ({
      id: cat,
      label: DEPT_LABELS[cat] ?? capitalize(cat),
      items,
    }));
}

// =====================================================================
// Qualifications V1 — category+subcategory grouping for CertificationPicker
// =====================================================================

export interface CertInput {
  id: string;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  sort_order?: number;
}

export interface CertCategoryGroup {
  category: string;
  /** When the category is flat, `items` carries every pill directly. */
  items: { id: string; label: string }[];
  /** When the category has subcategories, `subcategories` is populated and `items` is empty. */
  subcategories: {
    subcategory: string;
    items: { id: string; label: string }[];
  }[];
}

/**
 * Order of categories in the picker UX. Categories not listed here fall to the
 * end in insertion order.
 */
const CATEGORY_ORDER: string[] = [
  'basic',
  'deck_bridge',
  'engineering',
  'interior',
  'galley',
  'watersports',
  'helideck',
  'other',
];

/**
 * Order of subcategories within each drill-down category. Subcategories not
 * listed here fall to the end in insertion order.
 */
const SUBCATEGORY_ORDER: Record<string, string[]> = {
  deck_bridge: ['master_skipper', 'specialised_deck', 'deck_modules', 'rya_powerboat_nav'],
  engineering: ['core', 'eto', 'eng_modules'],
  interior: ['guest_core', 'guest_modules', 'wine_spirits', 'specialised_interior'],
};

function indexOrLast(arr: string[], value: string): number {
  const idx = arr.indexOf(value);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

/**
 * Group certifications by category, with optional subcategory nesting. Flat
 * categories have populated `items` and empty `subcategories`. Drill-down
 * categories (deck_bridge, engineering, interior) have empty `items` and
 * populated `subcategories`. Input pills are sorted by `sort_order` within
 * each bucket, falling back to name.
 */
export function groupCertsByCategoryAndSubcategory(certs: CertInput[]): CertCategoryGroup[] {
  const byCategory = new Map<string, CertInput[]>();
  for (const c of certs) {
    const cat = c.category || 'other';
    const list = byCategory.get(cat) ?? [];
    list.push(c);
    byCategory.set(cat, list);
  }

  const groups: CertCategoryGroup[] = [];
  const categories = Array.from(byCategory.keys()).sort(
    (a, b) => indexOrLast(CATEGORY_ORDER, a) - indexOrLast(CATEGORY_ORDER, b),
  );

  for (const cat of categories) {
    const entries = byCategory.get(cat)!;
    const subOrder = SUBCATEGORY_ORDER[cat];
    const hasSubcategories = Boolean(subOrder) && entries.some((c) => !!c.subcategory);

    if (!hasSubcategories) {
      const items = entries
        .slice()
        .sort(
          (a, b) =>
            (a.sort_order ?? Number.MAX_SAFE_INTEGER) -
              (b.sort_order ?? Number.MAX_SAFE_INTEGER) ||
            a.name.localeCompare(b.name),
        )
        .map((c) => ({ id: c.id, label: c.name }));
      groups.push({ category: cat, items, subcategories: [] });
      continue;
    }

    const bySubcategory = new Map<string, CertInput[]>();
    for (const c of entries) {
      const sub = c.subcategory || 'other';
      const list = bySubcategory.get(sub) ?? [];
      list.push(c);
      bySubcategory.set(sub, list);
    }
    const subs = Array.from(bySubcategory.keys()).sort(
      (a, b) => indexOrLast(subOrder!, a) - indexOrLast(subOrder!, b),
    );
    const subcategories = subs.map((sub) => ({
      subcategory: sub,
      items: bySubcategory
        .get(sub)!
        .slice()
        .sort(
          (a, b) =>
            (a.sort_order ?? Number.MAX_SAFE_INTEGER) -
              (b.sort_order ?? Number.MAX_SAFE_INTEGER) ||
            a.name.localeCompare(b.name),
        )
        .map((c) => ({ id: c.id, label: c.name })),
    }));
    groups.push({ category: cat, items: [], subcategories });
  }

  return groups;
}
