import { getEpaulette, getDepartmentColor } from '@/lib/epaulettes';

const GOLD = '#D4AF37';
const SILVER = '#C0C0C0';

function colorHex(c: 'gold' | 'silver'): string {
  return c === 'gold' ? GOLD : SILVER;
}

/** Anchor icon — deck + bridge */
function AnchorIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="8" cy="3.5" r="2" stroke={color} strokeWidth="1.5" fill="none" />
      <line x1="8" y1="5.5" x2="8" y2="14" stroke={color} strokeWidth="1.5" />
      <line x1="4" y1="10" x2="12" y2="10" stroke={color} strokeWidth="1.5" />
      <path
        d="M4 13 C4 11 8 9 8 14 C8 9 12 11 12 13"
        stroke={color}
        strokeWidth="1.2"
        fill="none"
      />
    </svg>
  );
}

/** Propeller icon — engineering */
function PropellerIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="8" cy="8" r="1.5" fill={color} />
      <path d="M8 6.5 C6 2 4 3 5.5 5.5" stroke={color} strokeWidth="1.3" fill="none" />
      <path d="M9.3 8.8 C12.5 10.5 13 8 10.5 7.5" stroke={color} strokeWidth="1.3" fill="none" />
      <path d="M6.7 8.8 C3.5 10.5 3 8 5.5 7.5" stroke={color} strokeWidth="1.3" fill="none" />
    </svg>
  );
}

/** Crescent moon icon — interior */
function CrescentIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M10 3 A5 5 0 1 0 10 13 A3.5 3.5 0 1 1 10 3Z" fill={color} />
    </svg>
  );
}

/** Knife icon — galley */
function KnifeIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 14 L8 2 L9 2 L6 10 L12 10"
        stroke={color}
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeptIcon({ department, size }: { department: string; size: number }) {
  const color = colorHex(getDepartmentColor(department));
  switch (department) {
    case 'deck':
    case 'bridge':
      return <AnchorIcon color={color} size={size} />;
    case 'engineering':
      return <PropellerIcon color={color} size={size} />;
    case 'interior':
      return <CrescentIcon color={color} size={size} />;
    case 'galley':
      return <KnifeIcon color={color} size={size} />;
    default:
      return null;
  }
}

interface EpauletteBadgeProps {
  roleName: string;
  department?: string;
  size?: 'sm' | 'md';
}

export function EpauletteBadge({ roleName, department, size = 'sm' }: EpauletteBadgeProps) {
  const info = getEpaulette(roleName, department);
  if (!info) return null;

  const iconSize = size === 'sm' ? 12 : 14;
  const h = size === 'sm' ? 'h-5' : 'h-6';
  const stripeH = size === 'sm' ? 'h-2.5' : 'h-3';
  const stripeW = size === 'sm' ? 'w-[2px]' : 'w-[2.5px]';
  // Use first gold department's color for stripes, fallback to gold
  const stripeColor = colorHex(
    info.departments.some((d) => getDepartmentColor(d) === 'gold') ? 'gold' : 'silver',
  );

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full bg-slate-900 px-1.5 ${h}`}
      title={roleName}
    >
      {info.departments.map((dept) => (
        <DeptIcon key={dept} department={dept} size={iconSize} />
      ))}
      <span className="flex items-center gap-px ml-0.5">
        {Array.from({ length: info.stripes }, (_, i) => (
          <span
            key={i}
            className={`${stripeH} ${stripeW} rounded-full`}
            style={{ backgroundColor: stripeColor }}
          />
        ))}
      </span>
    </span>
  );
}
