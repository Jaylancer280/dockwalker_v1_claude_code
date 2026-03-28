/**
 * Role → epaulette mapping for visual rank insignia.
 * Maps canonical role names to department symbols and seniority stripes.
 */

interface EpauletteData {
  departments: string[];
  stripes: number;
}

const ROLE_EPAULETTE_MAP: Record<string, EpauletteData> = {
  // Bridge
  Captain: { departments: ['bridge'], stripes: 4 },
  'First Officer': { departments: ['bridge'], stripes: 3 },
  'Second Officer': { departments: ['bridge'], stripes: 2 },
  // Deck
  Bosun: { departments: ['deck'], stripes: 2 },
  'Lead Deckhand': { departments: ['deck'], stripes: 1 },
  Deckhand: { departments: ['deck'], stripes: 1 },
  Mate: { departments: ['deck'], stripes: 1 },
  'Day Worker (General)': { departments: ['deck'], stripes: 1 },
  // Engineering
  'Chief Engineer': { departments: ['engineering'], stripes: 4 },
  'Second Engineer': { departments: ['engineering'], stripes: 3 },
  'Third Engineer': { departments: ['engineering'], stripes: 2 },
  ETO: { departments: ['engineering'], stripes: 3 },
  // Interior
  'Chief Stewardess': { departments: ['interior'], stripes: 3 },
  'Second Stewardess': { departments: ['interior'], stripes: 2 },
  'Third Stewardess': { departments: ['interior'], stripes: 1 },
  Stewardess: { departments: ['interior'], stripes: 1 },
  Purser: { departments: ['interior'], stripes: 3 },
  // Galley
  'Head Chef': { departments: ['galley'], stripes: 3 },
  'Sous Chef': { departments: ['galley'], stripes: 2 },
  'Crew Chef': { departments: ['galley'], stripes: 1 },
  // Hybrid
  'Deck/Engineer': { departments: ['deck', 'engineering'], stripes: 1 },
  'Deck/Stew': { departments: ['deck', 'interior'], stripes: 1 },
  'Cook/Stew': { departments: ['galley', 'interior'], stripes: 1 },
};

/** Color for a single department */
export function getDepartmentColor(dept: string): 'gold' | 'silver' {
  if (['deck', 'bridge', 'engineering'].includes(dept)) return 'gold';
  return 'silver';
}

/** Parse compound department string into individual departments */
function parseDepartments(department: string): string[] {
  if (department.includes('_')) return department.split('_');
  return [department];
}

export interface EpauletteInfo {
  departments: string[];
  stripes: number;
}

/**
 * Look up epaulette data for a role name.
 * Falls back to parsing the department string if provided.
 * Returns null for unknown roles without a department.
 */
export function getEpaulette(roleName: string, department?: string): EpauletteInfo | null {
  const mapped = ROLE_EPAULETTE_MAP[roleName];
  if (mapped) return mapped;

  // Fallback: unknown role but department provided
  if (department) {
    return { departments: parseDepartments(department), stripes: 1 };
  }

  return null;
}
