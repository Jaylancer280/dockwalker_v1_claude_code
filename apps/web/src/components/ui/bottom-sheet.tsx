'use client';

import { type ReactNode, useEffect, useRef } from 'react';
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

  const sheetRef = useRef<HTMLDivElement>(null);

  // Hold the latest onClose in a ref so the effect below can read it
  // without listing onClose as a dependency. Parents commonly pass an
  // inline `() => setX(false)` arrow that gets a fresh reference every
  // render — if onClose was a real dep, the effect would re-run on
  // every parent render (e.g. the messages page polls context every
  // 5s), `sheetRef.current?.focus()` would steal focus from any input
  // the user was typing in, and the user'd lose ~3 chars of typing
  // each cycle. Same problem broke scroll-wheel time pickers — the
  // sheet kept yanking focus away from the column.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current();
    }
    document.addEventListener('keydown', handleKeyDown);
    sheetRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={sheetRef}
      tabIndex={-1}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 outline-none md:left-[var(--content-inset-left)]"
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
