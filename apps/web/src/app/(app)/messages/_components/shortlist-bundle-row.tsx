'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { EpauletteBadge } from '@/components/epaulette-badge';

interface ShortlistBundleRowProps {
  postingId: string;
  roleName: string | null;
  vesselName: string | null;
  portName: string | null;
  childCount: number;
  hasUnread: boolean;
  unreadCount: number;
  lastActivity: string | null;
  prefersReducedMotion: boolean;
  children: ReactNode;
}

/**
 * Collapsible parent row that groups permanent shortlist-phase chats by
 * their posting. Always renders collapsed by default — even at count = 1,
 * so a poster with one shortlist chat still sees the posting context
 * surfacing in the inbox. Tap header to toggle; children navigate
 * normally.
 */
export function ShortlistBundleRow({
  roleName,
  vesselName,
  portName,
  childCount,
  hasUnread,
  unreadCount,
  lastActivity,
  prefersReducedMotion,
  children,
}: ShortlistBundleRowProps) {
  const [expanded, setExpanded] = useState(false);

  const labelRole = roleName ?? 'Permanent role';
  const labelVessel = vesselName ?? 'Vessel TBC';

  return (
    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--card)]">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 rounded-[14px] p-3 text-left hover:border-[var(--border-hi)]"
      >
        <div className="relative shrink-0">
          <EpauletteBadge roleName={labelRole} size="sm" />
          {hasUnread && (
            <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--accent)] ring-2 ring-[var(--card)]" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`truncate text-[15px] tracking-[-0.3px] ${hasUnread ? 'font-bold' : 'font-semibold'}`}
            >
              {labelRole} · {labelVessel}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted-foreground)]">
                {hasUnread ? `${unreadCount} of ${childCount}` : childCount}
              </span>
              <span className="font-mono text-[11px] text-[var(--tertiary)]">
                {lastActivity ? new Date(lastActivity).toLocaleDateString() : ''}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-[var(--muted-foreground)] ${prefersReducedMotion ? '' : 'transition-transform duration-200'} ${expanded ? 'rotate-180' : ''}`}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-[13px] text-[var(--muted-foreground)]">
            <span>Pre-selection chats</span>
            {portName && (
              <span className="flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />
                {portName}
              </span>
            )}
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-2 py-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
