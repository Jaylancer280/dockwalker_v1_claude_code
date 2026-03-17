'use client';

import { ToastProvider } from '@/hooks/use-toast';
import { ToastContainer } from '@/components/toast-container';

export function ToastWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <ToastContainer />
    </ToastProvider>
  );
}
