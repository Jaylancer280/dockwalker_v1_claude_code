export default function MyJobsLoading() {
  return (
    <main className="flex flex-col gap-4 px-4 pb-nav pt-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-24 animate-pulse rounded bg-[var(--surface)]" />
        <div className="h-9 w-28 animate-pulse rounded-lg bg-[var(--card)]" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-4 border-b border-[var(--border)] pb-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 w-16 animate-pulse rounded bg-[var(--surface)]" />
        ))}
      </div>

      {/* Job card skeletons */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 animate-pulse rounded bg-[var(--surface)]" />
            <div className="h-5 w-14 animate-pulse rounded-full bg-[var(--surface)]" />
          </div>
          <div className="h-3 w-48 animate-pulse rounded bg-[var(--surface)]" />
          <div className="h-3 w-36 animate-pulse rounded bg-[var(--surface)]" />
        </div>
      ))}
    </main>
  );
}
