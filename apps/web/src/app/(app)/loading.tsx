import { LoadingSpinner } from '@/components/loading-spinner';

export default function AppLoading() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background">
      <LoadingSpinner size="lg" />
    </main>
  );
}
