import { LoadingSpinner } from '@/components/loading-spinner';

export default function DockyLoading() {
  return (
    <main className="flex min-h-svh items-center justify-center pb-nav">
      <LoadingSpinner size="md" />
    </main>
  );
}
