'use client';

import { useToast } from '@/hooks/use-toast';

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-[60] flex -translate-x-1/2 flex-col gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          onClick={() => dismiss(toast.id)}
          className={`animate-in fade-in slide-in-from-bottom-2 rounded-lg px-4 py-3 text-sm shadow-lg ${
            toast.variant === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-destructive text-destructive-foreground'
          }`}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
