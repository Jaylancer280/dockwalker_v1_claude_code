'use client';

import { Briefcase, Loader2 } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {!loading && postings.length === 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">No active postings</CardTitle>
            </div>
            <CardDescription>Post your first daywork to start finding crew.</CardDescription>
          </CardHeader>
        </Card>
      )}
      {postings.map((p) => renderPostingCard(p, true))}
    </>
  );
}
