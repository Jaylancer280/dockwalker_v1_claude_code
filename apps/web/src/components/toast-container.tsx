'use client';

import { useToast } from '@/hooks/use-toast';

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed z-70 flex flex-col gap-2"
      style={{
        bottom: 'calc(var(--nav-height, 4rem) + env(safe-area-inset-bottom, 0px) + 0.5rem)',
        left: 'calc(var(--content-inset-left) + (100vw - var(--content-inset-left)) / 2)',
        transform: 'translateX(-50%)',
      }}
    >
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
