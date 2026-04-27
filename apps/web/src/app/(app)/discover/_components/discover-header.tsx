'use client';

import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { UnderlineTabs } from '@/components/ui/underline-tabs';
import { NotificationBell } from '@/components/notification-bell';

/**
 * Sticky header for the Discover page.
 *
 * Renders the Daywork ↔ Permanent segmented toggle, the (browse-only)
 * Clear / Filters buttons, the notification bell (mobile-only) and
 * the sub-tab strip below. All state lives at the page level — this
 * component is purely presentational.
 */
export function DiscoverHeader({
  browseMode,
  onBrowseModeChange,
  activeTab,
  onActiveTabChange,
  subTabOptions,
  showFilters,
  onToggleFilters,
  hasActiveFilters,
  onClearFilters,
}: {
  browseMode: 'daywork' | 'permanent';
  onBrowseModeChange: (mode: 'daywork' | 'permanent') => void;
  activeTab: 'browse' | 'invitations' | 'applied';
  onActiveTabChange: (tab: 'browse' | 'invitations' | 'applied') => void;
  subTabOptions: Array<{ value: string; label: string; count?: number }>;
  showFilters: boolean;
  onToggleFilters: () => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="page-width flex items-center justify-between px-4 pt-3 pb-2">
        <div className="min-w-0 flex-1">
          <SegmentedToggle
            options={[
              { value: 'daywork', label: 'Daywork' },
              { value: 'permanent', label: 'Permanent' },
            ]}
            value={browseMode}
            onChange={(v) => onBrowseModeChange(v as 'daywork' | 'permanent')}
          />
        </div>
        <div className="flex items-center gap-1.5">
          {activeTab === 'browse' && hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClearFilters}>
              <X className="mr-1 h-3 w-3" />
              Clear
            </Button>
          )}
          {activeTab === 'browse' && (
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              onClick={onToggleFilters}
            >
              <SlidersHorizontal className="mr-1 h-4 w-4" />
              Filters
              {hasActiveFilters && <span className="ml-1 text-xs">(active)</span>}
            </Button>
          )}
          <span className="md:hidden">
            <NotificationBell />
          </span>
        </div>
      </div>
      <div className="page-width border-t border-[var(--border)]">
        <UnderlineTabs
          options={subTabOptions}
          value={activeTab}
          onChange={(v) => onActiveTabChange(v as 'browse' | 'invitations' | 'applied')}
        />
      </div>
    </header>
  );
}
