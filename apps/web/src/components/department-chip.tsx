import Image from 'next/image';
import { getDepartmentImageSrc } from '@/lib/department-image';

interface DepartmentChipProps {
  department: string | null | undefined;
  seed: string;
  size?: 'sm' | 'md';
}

export function DepartmentChip({ department, seed, size = 'md' }: DepartmentChipProps) {
  const src = getDepartmentImageSrc(department, seed);

  return (
    <div
      className={`${size === 'sm' ? 'h-12 w-12' : 'h-16 w-16'} shrink-0 overflow-hidden rounded-[10px] border border-[var(--border)]`}
    >
      <Image
        src={src}
        alt=""
        width={128}
        height={128}
        className="h-full w-full object-cover dark:saturate-[0.85] dark:brightness-[0.7]"
      />
    </div>
  );
}
