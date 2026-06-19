'use client';

import { CheckCircle } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { LoadingSpinner } from '@/components/loading-spinner';
import type { DayworkPosting } from './daywork-types';

export interface DayworkCompletedSectionProps {
  loading: boolean;
  postings: DayworkPosting[];
  renderPostingCard: (posting: DayworkPosting, showActions: boolean) => React.ReactNode;
}

export function DayworkCompletedSection({
  loading,
  postings,
  renderPostingCard,
}: DayworkCompletedSectionProps) {
  return (
    <>
      {loading && <LoadingSpinner size="md" />}
      {!loading && postings.length === 0 && (
        <EmptyState
          icon={CheckCircle}
          title="No completed postings"
          description="Completed and cancelled postings will appear here."
        />
      )}
      {postings.map((p) => renderPostingCard(p, false))}
    </>
  );
}
