'use client';

import { Play } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { LoadingSpinner } from '@/components/loading-spinner';
import type { DayworkPosting } from './daywork-types';

export interface DayworkInProgressSectionProps {
  loading: boolean;
  postings: DayworkPosting[];
  renderPostingCard: (posting: DayworkPosting, showActions: boolean) => React.ReactNode;
}

export function DayworkInProgressSection({
  loading,
  postings,
  renderPostingCard,
}: DayworkInProgressSectionProps) {
  return (
    <>
      {loading && <LoadingSpinner size="md" />}
      {!loading && postings.length === 0 && (
        <EmptyState
          icon={Play}
          title="No in-progress jobs"
          description="Jobs move here after you accept an applicant."
        />
      )}
      {postings.map((p) => renderPostingCard(p, true))}
    </>
  );
}
