'use client';

import { Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ShareJobButtonProps {
  jobNumber: string;
  roleName: string;
  location: string;
  rate: string;
}

export function ShareJobButton({ jobNumber, roleName, location, rate }: ShareJobButtonProps) {
  const { showSuccess } = useToast();

  async function handleShare() {
    const url = `https://www.dockwalker.io/jobs/${jobNumber}`;
    const text = `${roleName} needed in ${location}${rate ? ` — ${rate}` : ''}. Apply on DockWalker.`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `${roleName} — DockWalker`, text, url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      showSuccess('Link copied');
    } catch {
      // Clipboard API not available
    }
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-[var(--surface)]"
    >
      <Share2 className="h-3.5 w-3.5" />
      Share
    </button>
  );
}
