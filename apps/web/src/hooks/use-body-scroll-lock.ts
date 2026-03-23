import { useEffect } from 'react';

let lockCount = 0;

export function useBodyScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;
    lockCount++;
    document.body.style.overflow = 'hidden';
    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.body.style.overflow = '';
      }
    };
  }, [isOpen]);
}
