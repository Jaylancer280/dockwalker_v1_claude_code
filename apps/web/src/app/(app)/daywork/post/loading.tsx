export default function PostLoading() {
  return (
    <main className="flex flex-col gap-4 px-4 pb-nav pt-4">
      {/* Header skeleton */}
      <div className="h-7 w-32 animate-pulse rounded bg-[var(--card)]" />

      {/* Form field skeletons */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface)]" />
          <div className="h-9 w-full animate-pulse rounded-md bg-[var(--card)]" />
        </div>
      ))}

      {/* Button skeleton */}
      <div className="h-10 w-full animate-pulse rounded-md bg-[var(--card)]" />
    </main>
  );
}
