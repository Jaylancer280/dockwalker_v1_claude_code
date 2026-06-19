export default function BillingLoading() {
  return (
    <main className="flex flex-col gap-4 px-4 pb-nav pt-4">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 animate-pulse rounded bg-[var(--surface)]" />
        <div className="h-6 w-20 animate-pulse rounded bg-[var(--surface)]" />
      </div>

      {/* Plan cards skeleton — stacked on mobile, side by side on desktop */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
          >
            <div className="h-5 w-20 animate-pulse rounded bg-[var(--surface)]" />
            <div className="h-8 w-28 animate-pulse rounded bg-[var(--surface)]" />
            <div className="flex flex-col gap-2 pt-2">
              <div className="h-3 w-full animate-pulse rounded bg-[var(--surface)]" />
              <div className="h-3 w-full animate-pulse rounded bg-[var(--surface)]" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--surface)]" />
            </div>
            <div className="mt-2 h-10 w-full animate-pulse rounded-lg bg-[var(--surface)]" />
          </div>
        ))}
      </div>
    </main>
  );
}
