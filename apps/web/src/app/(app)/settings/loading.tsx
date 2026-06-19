export default function SettingsLoading() {
  return (
    <main className="flex flex-col gap-4 px-4 pb-nav pt-4">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 animate-pulse rounded bg-[var(--surface)]" />
        <div className="h-6 w-24 animate-pulse rounded bg-[var(--surface)]" />
      </div>

      {/* Section card skeletons */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <div className="h-4 w-28 animate-pulse rounded bg-[var(--surface)]" />
          <div className="h-3 w-full animate-pulse rounded bg-[var(--surface)]" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--surface)]" />
        </div>
      ))}
    </main>
  );
}
