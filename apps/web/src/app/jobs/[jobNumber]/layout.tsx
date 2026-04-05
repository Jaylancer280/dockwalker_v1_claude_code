import Link from 'next/link';

export default function JobLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="border-b border-border px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          DockWalker
        </Link>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
        DockWalker — Superyacht hiring, simplified
      </footer>
    </div>
  );
}
