export default function DiscoverLoading() {
  return (
    <main className="flex flex-col gap-4 px-4 pb-nav pt-4">
      {/* Toggle skeleton */}
      <div className="mx-auto h-9 w-56 animate-pulse rounded-full bg-[var(--card)]" />

      {/* Card skeletons */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--surface)]" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-4 w-32 animate-pulse rounded bg-[var(--surface)]" />
              <div className="h-3 w-24 animate-pulse rounded bg-[var(--surface)]" />
            </div>
          </div>
          <div className="h-3 w-full animate-pulse rounded bg-[var(--surface)]" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--surface)]" />
          <div className="flex gap-2">
            <div className="h-6 w-16 animate-pulse rounded-full bg-[var(--surface)]" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-[var(--surface)]" />
          </div>
        </div>
      ))}
    </main>
  );
}
