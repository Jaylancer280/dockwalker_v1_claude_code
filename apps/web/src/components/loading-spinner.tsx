import { Loader2 } from 'lucide-react';

const SIZES = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
} as const;

export function LoadingSpinner({
  size = 'md',
  text,
}: {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8">
      <Loader2 className={`${SIZES[size]} animate-spin text-muted-foreground`} />
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}
