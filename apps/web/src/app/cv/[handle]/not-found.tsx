import Link from 'next/link';

export const metadata = {
  title: 'CV not found — DockWalker',
};

export default function CvNotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-6 text-center">
      <div className="flex max-w-md flex-col items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">CV not found</h1>
        <p className="text-sm text-muted-foreground">
          This CV link is no longer valid. The owner may have regenerated it, or the link was
          mistyped.
        </p>
        <div className="mt-2 flex gap-3">
          <Link
            href="/"
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            DockWalker home
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-full border border-border px-5 py-2 text-sm font-medium hover:bg-muted"
          >
            Sign up
          </Link>
        </div>
      </div>
    </main>
  );
}
