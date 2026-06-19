'use client';

import { Briefcase } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { LoadingSpinner } from '@/components/loading-spinner';
import type { DayworkPosting } from './daywork-types';

export interface DayworkActiveSectionProps {
  loading: boolean;
  postings: DayworkPosting[];
  renderPostingCard: (posting: DayworkPosting, showActions: boolean) => React.ReactNode;
}

export function DayworkActiveSection({
  loading,
  postings,
  renderPostingCard,
}: DayworkActiveSectionProps) {
  return (
    <>
      {loading && <LoadingSpinner size="md" />}
      {!loading && postings.length === 0 && (
        <EmptyState
          icon={Briefcase}
          title="No active postings"
          description="Post your first daywork to start finding crew."
        />
      )}
      {postings.map((p) => renderPostingCard(p, true))}
    </>
  );
}
