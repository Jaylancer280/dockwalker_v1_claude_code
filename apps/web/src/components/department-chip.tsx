import Image from 'next/image';

const DEPARTMENT_COUNTS: Record<string, number> = {
  deck: 7,
  interior: 6,
  galley: 3,
  engineering: 5,
};

// Map hybrid departments to primary pool
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

/** Simple deterministic hash of a string to a number */
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

interface DepartmentChipProps {
  department: string | null | undefined;
  seed: string;
  size?: 'sm' | 'md';
}

export function DepartmentChip({ department, seed, size = 'md' }: DepartmentChipProps) {
  const mappedDept = department ? DEPARTMENT_MAP[department.toLowerCase()] : null;
  const count = mappedDept ? (DEPARTMENT_COUNTS[mappedDept] ?? 0) : 0;

  if (!mappedDept || count === 0) {
    // Fallback: generic deck image
    return (
      <div
        className={`${size === 'sm' ? 'h-[44px] w-[44px]' : 'h-[56px] w-[56px]'} shrink-0 overflow-hidden rounded-[10px] border border-[var(--border)]`}
      >
        <Image
          src="/images/departments/deck_01.jpg"
          alt=""
          width={112}
          height={112}
          className="h-full w-full object-cover dark:saturate-[0.85] dark:brightness-[0.7]"
        />
      </div>
    );
  }

  const index = (hashSeed(seed) % count) + 1;
  const src = `/images/departments/${mappedDept}_${String(index).padStart(2, '0')}.jpg`;

  return (
    <div
      className={`${size === 'sm' ? 'h-[44px] w-[44px]' : 'h-[56px] w-[56px]'} shrink-0 overflow-hidden rounded-[10px] border border-[var(--border)]`}
    >
      <Image
        src={src}
        alt=""
        width={80}
        height={80}
        className="h-full w-full object-cover dark:saturate-[0.85] dark:brightness-[0.7]"
      />
    </div>
  );
}
