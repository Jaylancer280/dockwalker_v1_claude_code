import { Skeleton } from '@/components/ui/skeleton';

export function ChatSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      {/* Left-aligned bubble */}
      <Skeleton className="h-10 w-3/5 self-start rounded-2xl" />
      {/* Right-aligned bubble */}
      <Skeleton className="h-10 w-2/5 self-end rounded-2xl" />
      {/* Left-aligned bubble */}
      <Skeleton className="h-14 w-1/2 self-start rounded-2xl" />
      {/* Right-aligned bubble */}
      <Skeleton className="h-10 w-3/5 self-end rounded-2xl" />
    </div>
  );
}
