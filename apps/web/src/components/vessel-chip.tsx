export function VesselChip({
  vesselType,
  size = 'md',
}: {
  vesselType: 'motor' | 'sail';
  size?: 'sm' | 'md';
}) {
  const abbr = vesselType === 'sail' ? 'SY' : 'MY';
  const dim = size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-[38px] w-[38px] text-[13px]';
  return (
    <div
      className={`${dim} flex items-center justify-center rounded-[10px] border font-mono font-bold`}
      style={{
        background: 'var(--c-icon-bg)',
        borderColor: 'var(--c-icon-border)',
        color: 'var(--c-icon-color)',
      }}
    >
      {abbr}
    </div>
  );
}
