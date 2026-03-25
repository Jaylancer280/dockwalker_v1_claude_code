import { getEpaulette, getDepartmentColor } from '@/lib/epaulettes';

const GOLD = '#D4AF37';
const SILVER = '#C0C0C0';

function colorHex(c: 'gold' | 'silver'): string {
  return c === 'gold' ? GOLD : SILVER;
}

/** Anchor icon — deck + bridge. Filled silhouette for clarity at 12px. */
function AnchorIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 1.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-.75 5.4V13c-2.2-.3-3.75-1.7-4-3.5h1.5a.75.75 0 0 0 0-1.5H3.1A5.5 5.5 0 0 1 7.25 4.6v2.3zm1.5 0V4.6a5.5 5.5 0 0 1 4.15 3.4h-1.65a.75.75 0 0 0 0 1.5h1.5c-.25 1.8-1.8 3.2-4 3.5V6.9z"
        fill={color}
      />
    </svg>
  );
}

/** Gear/cog icon — engineering. 6-tooth cog, clear at 14px. */
function GearIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6.8 1.6l-.3 1.5c-.4.1-.7.3-1 .6L4 3.2l-1.2 2 1.1 1.1c-.1.4-.1.7 0 1.1L2.8 8.5l1.2 2 1.5-.5c.3.2.6.4 1 .6l.3 1.5h2.4l.3-1.5c.4-.1.7-.3 1-.6l1.5.5 1.2-2-1.1-1.1c.1-.4.1-.7 0-1.1l1.1-1.1-1.2-2-1.5.5c-.3-.2-.6-.4-1-.6l-.3-1.5H6.8z"
        fill={color}
      />
    </svg>
  );
}

/** Crescent moon icon — interior. Bold filled crescent. */
function CrescentIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9.5 2C6 2 3.5 4.5 3.5 8s2.5 6 6 6c1.5 0 2.8-.5 3.8-1.3C12 13.5 10.5 14 9 14 5.7 14 3 11.3 3 8s2.7-6 6-6c1.5 0 2.8.5 3.8 1.3C11.8 2.5 10.7 2 9.5 2z"
        fill={color}
      />
    </svg>
  );
}

/** Chef's knife icon — galley. Blade + handle silhouette, clear at 14px. */
function KnifeIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M13.5 2C10 2.5 5.5 5.5 4 8l-1.5 1.5c-.4.4-.4 1 0 1.4l2.6 2.6c.4.4 1 .4 1.4 0L8 12c2.5-1.5 5.5-6 6-9.5.1-.5-.3-.6-.5-.5zM5.8 12.2l-2-2L5 9l2 2-1.2 1.2z"
        fill={color}
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
      return <GearIcon color={color} size={size} />;
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

  const iconSize = size === 'sm' ? 14 : 16;
  const h = size === 'sm' ? 'h-6' : 'h-7';
  const stripeH = size === 'sm' ? 'h-3' : 'h-3.5';
  const stripeW = size === 'sm' ? 'w-[2.5px]' : 'w-[3px]';
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
