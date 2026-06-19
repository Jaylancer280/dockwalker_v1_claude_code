import { ToastWrapper } from '@/components/toast-wrapper';

export default function RefLayout({ children }: { children: React.ReactNode }) {
  return <ToastWrapper>{children}</ToastWrapper>;
}
