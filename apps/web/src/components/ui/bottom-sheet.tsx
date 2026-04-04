'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useBodyScrollLock(open);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 md:left-[var(--content-inset-left)]"
      style={{ bottom: 'calc(var(--nav-height, 0px) + env(safe-area-inset-bottom))' }}
    >
      <div className="flex w-full max-w-lg animate-in slide-in-from-bottom flex-col rounded-t-2xl bg-background">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <h2 className="text-sm font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 pb-safe">{children}</div>
      </div>
    </div>
  );
}
