const DEPARTMENT_COUNTS: Record<string, number> = {
  deck: 7,
  interior: 6,
  galley: 3,
  engineering: 5,
};

const DEPARTMENT_MAP: Record<string, string> = {
  deck: 'deck',
  bridge: 'deck',
  interior: 'interior',
  galley: 'galley',
  engineering: 'engineering',
  deck_engineering: 'deck',
  deck_interior: 'deck',
  galley_interior: 'galley',
};

/** CSS gradient colors per department — replaces images for inline backgrounds */
const DEPARTMENT_COLORS: Record<string, string> = {
  deck: 'rgba(59,130,246,0.08)', // blue
  interior: 'rgba(168,85,247,0.08)', // purple
  galley: 'rgba(234,179,8,0.08)', // amber
  engineering: 'rgba(34,197,94,0.08)', // green
};

export function getDepartmentGradient(department: string | null | undefined): string {
  const mappedDept = department ? DEPARTMENT_MAP[department.toLowerCase()] : null;
  const color = mappedDept
    ? (DEPARTMENT_COLORS[mappedDept] ?? DEPARTMENT_COLORS.deck)
    : DEPARTMENT_COLORS.deck;
  return `linear-gradient(135deg, ${color} 0%, transparent 60%)`;
}

/** Simple deterministic hash of a string to a number */
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Returns the image path for a department, deterministically selected by seed */
export function getDepartmentImageSrc(department: string | null | undefined, seed: string): string {
  const mappedDept = department ? DEPARTMENT_MAP[department.toLowerCase()] : null;
  const count = mappedDept ? (DEPARTMENT_COUNTS[mappedDept] ?? 0) : 0;

  if (!mappedDept || count === 0) {
    return '/images/departments/deck_01.jpg';
  }

  const index = (hashSeed(seed) % count) + 1;
  return `/images/departments/${mappedDept}_${String(index).padStart(2, '0')}.jpg`;
}
