/**
 * Display labels for certification category and subcategory keys used by the
 * CertificationPicker. Keys match the canonical values in `certifications.category`
 * and `certifications.subcategory`.
 */

const CATEGORY_LABELS: Record<string, string> = {
  basic: 'Basic',
  deck_bridge: 'Deck / Bridge',
  engineering: 'Engineering',
  interior: 'Interior',
  galley: 'Galley',
  watersports: 'Watersports & Diving',
  helideck: 'Helideck',
  other: 'Other',
};

const SUBCATEGORY_LABELS: Record<string, string> = {
  // deck_bridge
  master_skipper: 'Master / Skipper CoCs',
  specialised_deck: 'Specialised Deck',
  deck_modules: 'Deck Modules & Oral Preps',
  rya_powerboat_nav: 'RYA Powerboat & Nav',
  // engineering
  core: 'Core',
  eto: 'ETO',
  eng_modules: 'Modules & Short Courses',
  // interior
  guest_core: 'G.U.E.S.T CoCs',
  guest_modules: 'G.U.E.S.T Modules',
  wine_spirits: 'Wine & Spirits',
  specialised_interior: 'Specialised Interior',
};

function humanise(key: string): string {
  return key
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

export function certCategoryLabel(key: string | null | undefined): string {
  if (!key) return 'Other';
  return CATEGORY_LABELS[key] ?? humanise(key);
}

export function certSubcategoryLabel(key: string | null | undefined): string {
  if (!key) return '';
  return SUBCATEGORY_LABELS[key] ?? humanise(key);
}
