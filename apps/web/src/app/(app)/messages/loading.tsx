export default function MessagesLoading() {
  return (
    <main className="flex flex-col gap-3 px-4 pb-nav pt-4">
      <div className="h-6 w-28 animate-pulse rounded bg-[var(--surface)]" />

      {/* Conversation skeletons */}
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
        >
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[var(--surface)]" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-4 w-36 animate-pulse rounded bg-[var(--surface)]" />
            <div className="h-3 w-48 animate-pulse rounded bg-[var(--surface)]" />
          </div>
          <div className="h-3 w-10 animate-pulse rounded bg-[var(--surface)]" />
        </div>
      ))}
    </main>
  );
}
