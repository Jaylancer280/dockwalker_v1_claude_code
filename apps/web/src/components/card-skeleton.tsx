import { Skeleton } from '@/components/ui/skeleton';

export function CardSkeleton() {
  return (
    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4">
      {/* Role name */}
      <Skeleton className="mb-3 h-5 w-3/5" />
      {/* Vessel */}
      <Skeleton className="mb-2 h-4 w-2/5" />
      {/* Date range */}
      <Skeleton className="mb-2 h-4 w-1/2" />
      {/* Location */}
      <Skeleton className="mb-3 h-4 w-2/5" />
      {/* Rate */}
      <Skeleton className="h-4 w-1/4" />
    </div>
  );
}
