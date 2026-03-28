import { getEpaulette, getDepartmentColor } from '@dockwalker/shared';

const GOLD = '#D4AF37';
const SILVER = '#C0C0C0';

function colorHex(c: 'gold' | 'silver'): string {
  return c === 'gold' ? GOLD : SILVER;
}

/** Helm wheel — deck + bridge. Circle with 4 spokes from centre hub. */
function HelmIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="2" fill={color} />
      <circle cx="8" cy="8" r="6" fill="none" stroke={color} strokeWidth="1.8" />
      <line x1="8" y1="1.5" x2="8" y2="4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line
        x1="8"
        y1="12"
        x2="8"
        y2="14.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line x1="1.5" y1="8" x2="4" y2="8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line
        x1="12"
        y1="8"
        x2="14.5"
        y2="8"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Wrench — engineering. Open-ended spanner, thick stroke for clarity at 14px. */
function WrenchIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M14 4.5a4 4 0 0 0-3-3.8l.5 2.3-1.5 1.5-2.3-.5a4 4 0 0 0 3.8 5L5.2 15.2a1.5 1.5 0 0 1-2.1 0l-.3-.3a1.5 1.5 0 0 1 0-2.1L9 6.5a4 4 0 0 0 5-2z"
        fill={color}
      />
    </svg>
  );
}

/** Diamond — interior. Faceted gem silhouette. */
function DiamondIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 6l2-4h6l2 4-5 8.5L3 6z" fill={color} />
      <path d="M3 6h10" stroke={color} strokeWidth="0.5" opacity="0.5" />
      <path d="M8 2L6.5 6 8 14.5 9.5 6 8 2z" fill={color} opacity="0.3" />
    </svg>
  );
}

/** Chef hat — galley. Toque silhouette with puffy top. */
function ChefHatIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4.5 11V9.5C3 9.5 2 8.2 2 6.8 2 5 3.3 3.5 5 3.5c.5 0 1 .1 1.4.4C7 2.7 7.5 2.5 8 2.5s1 .2 1.6.4c.4-.3.9-.4 1.4-.4 1.7 0 3 1.5 3 3.3 0 1.4-1 2.7-2.5 2.7V11h-7z"
        fill={color}
      />
      <rect x="4.5" y="11.5" width="7" height="2" rx="0.5" fill={color} />
    </svg>
  );
}

function DeptIcon({ department, size }: { department: string; size: number }) {
  const color = colorHex(getDepartmentColor(department));
  switch (department) {
    case 'deck':
    case 'bridge':
      return <HelmIcon color={color} size={size} />;
    case 'engineering':
      return <WrenchIcon color={color} size={size} />;
    case 'interior':
      return <DiamondIcon color={color} size={size} />;
    case 'galley':
      return <ChefHatIcon color={color} size={size} />;
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

  const iconSize = size === 'sm' ? 14 : 16;
  const badgeH = size === 'sm' ? 24 : 28;
  const stripeH = size === 'sm' ? 12 : 14;
  const stripeW = size === 'sm' ? 2.5 : 3;
  const stripeColor = colorHex(
    info.departments.some((d) => getDepartmentColor(d) === 'gold') ? 'gold' : 'silver',
  );

  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-slate-900 px-1.5"
      style={{ height: badgeH }}
      title={roleName}
    >
      {info.departments.map((dept) => (
        <DeptIcon key={dept} department={dept} size={iconSize} />
      ))}
      {info.stripes > 0 && (
        <span className="flex items-center ml-0.5" style={{ gap: 1 }}>
          {Array.from({ length: info.stripes }, (_, i) => (
            <span
              key={i}
              className="rounded-full"
              style={{ width: stripeW, height: stripeH, backgroundColor: stripeColor }}
            />
          ))}
        </span>
      )}
    </span>
  );
}
