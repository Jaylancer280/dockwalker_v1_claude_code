'use client';

import { useEffect, useState, useCallback } from 'react';

interface PushToastData {
  title: string;
  body: string;
  url?: string;
}

/**
 * Listens for 'dw:push-foreground' custom events and shows a
 * slide-down banner. Auto-dismisses after 5 seconds. Tappable
 * to navigate to the notification's deep link URL.
 */
export function PushToast() {
  const [toast, setToast] = useState<PushToastData | null>(null);
  const [visible, setVisible] = useState(false);

  const dismiss = useCallback(() => {
    setVisible(false);
    // Wait for slide-out animation before clearing
    setTimeout(() => setToast(null), 300);
  }, []);

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<PushToastData>).detail;
      if (!detail) return;
      setToast(detail);
      setVisible(true);
    }

    window.addEventListener('dw:push-foreground', handler);
    return () => window.removeEventListener('dw:push-foreground', handler);
  }, []);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(dismiss, 5000);
    return () => clearTimeout(timer);
  }, [visible, dismiss]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="push-toast"
      onClick={() => {
        if (toast.url) {
          window.location.href = toast.url;
        }
        dismiss();
      }}
      className={`fixed left-2 right-2 top-2 z-[9999] cursor-pointer rounded-xl bg-slate-900 px-4 py-3 shadow-lg transition-transform duration-300 safe-top ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <p className="text-sm font-semibold text-white">{toast.title}</p>
      <p className="text-sm text-slate-300">{toast.body}</p>
    </div>
  );
}
