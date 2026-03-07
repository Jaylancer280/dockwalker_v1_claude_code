import { Loader2 } from 'lucide-react';

export default function AppLoading() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </main>
  );
}
