import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthAmbientBackground } from '@/components/auth-ambient-background';

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4">
      <AuthAmbientBackground />
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Compass className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/dashboard">
          <Button>Back to dashboard</Button>
        </Link>
      </div>
    </main>
  );
}
