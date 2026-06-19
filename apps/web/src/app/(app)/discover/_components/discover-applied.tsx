'use client';

import { useMemo } from 'react';
import { AppliedTab } from './applied-tab';
import { useDiscoverData } from './discover-data-context';

/**
 * Container for the Applied tab. Reads applications + handlers from
 * the shared DiscoverDataProvider, filters them by browseMode (the
 * page-level Daywork ↔ Permanent toggle), and forwards the slim
 * prop-set into the presentational <AppliedTab>.
 */
export function DiscoverApplied({
  browseMode,
  onSwitchToBrowse,
  onViewProfile,
}: {
  browseMode: 'daywork' | 'permanent';
  onSwitchToBrowse: () => void;
  onViewProfile: (personId: string) => void;
}) {
  const {
    applications,
    loadingApps,
    appsError,
    withdrawingId,
    loadApplications,
    handleWithdraw,
    handlePermanentWithdraw,
  } = useDiscoverData();

  const filteredApplications = useMemo(
    () =>
      applications.filter((a) =>
        browseMode === 'daywork' ? a.type === 'daywork' : a.type === 'permanent',
      ),
    [applications, browseMode],
  );

  return (
    <AppliedTab
      applications={filteredApplications}
      loadingApps={loadingApps}
      withdrawingId={withdrawingId}
      onWithdraw={handleWithdraw}
      onPermanentWithdraw={handlePermanentWithdraw}
      onViewProfile={onViewProfile}
      onSwitchToBrowse={onSwitchToBrowse}
      onRetry={loadApplications}
      appsError={appsError}
    />
  );
}
