import { Skeleton } from '@/components/ui/skeleton';

function Row() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Avatar */}
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="flex-1">
        {/* Name */}
        <Skeleton className="mb-1.5 h-4 w-2/5" />
        {/* Last message preview */}
        <Skeleton className="h-3 w-3/5" />
      </div>
    </div>
  );
}

export function ConversationSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col divide-y divide-[var(--border)]">
      {Array.from({ length: count }, (_, i) => (
        <Row key={i} />
      ))}
    </div>
  );
}
