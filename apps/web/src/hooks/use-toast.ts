'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { createElement, type ReactNode } from 'react';

interface Toast {
  id: string;
  message: string;
  variant: 'error' | 'success';
}

interface ToastContextValue {
  toasts: Toast[];
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (message: string, variant: 'error' | 'success') => {
      const id = `toast-${++nextId}`;
      setToasts((prev) => {
        const updated = [...prev, { id, message, variant }];
        // Max 3 visible (FIFO)
        return updated.length > 3 ? updated.slice(-3) : updated;
      });
      const timer = setTimeout(() => dismiss(id), 5000);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const showError = useCallback((message: string) => addToast(message, 'error'), [addToast]);
  const showSuccess = useCallback((message: string) => addToast(message, 'success'), [addToast]);

  // Cleanup timers on unmount
  useEffect(() => {
    const current = timers.current;
    return () => {
      current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return createElement(
    ToastContext.Provider,
    { value: { toasts, showError, showSuccess, dismiss } },
    children,
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
