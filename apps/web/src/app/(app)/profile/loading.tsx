export default function ProfileLoading() {
  return (
    <main className="flex flex-col gap-4 px-4 pb-nav pt-4">
      {/* Avatar + name skeleton */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 animate-pulse rounded-full bg-[var(--card)]" />
        <div className="flex flex-col gap-2">
          <div className="h-5 w-40 animate-pulse rounded bg-[var(--surface)]" />
          <div className="h-3 w-28 animate-pulse rounded bg-[var(--surface)]" />
        </div>
      </div>

      {/* Section skeletons */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface)]" />
          <div className="h-3 w-full animate-pulse rounded bg-[var(--surface)]" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--surface)]" />
        </div>
      ))}
    </main>
  );
}
