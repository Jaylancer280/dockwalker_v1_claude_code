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
