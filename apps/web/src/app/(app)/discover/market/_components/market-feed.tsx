'use client';

import { Briefcase, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { LoadingSpinner } from '@/components/loading-spinner';
import { MarketCardView, type MarketCard } from './market-job-card';
import { logAgentActivity } from '@/lib/agent-activity';

export interface MarketFeedProps {
  loading: boolean;
  cards: MarketCard[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onSelectCard: (card: MarketCard) => void;
}

export function MarketFeed({
  loading,
  cards,
  hasMore,
  loadingMore,
  onLoadMore,
  onSelectCard,
}: MarketFeedProps) {
  if (loading) {
    return <LoadingSpinner size="md" />;
  }

  if (cards.length === 0) {
    return (
      <EmptyState icon={Briefcase} title="No postings found" description="Try different filters." />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {cards.map((card) => (
          <button
            key={`${card.type}-${card.id}`}
            onClick={() => {
              onSelectCard(card);
              logAgentActivity('market_feed_card_viewed', { postingType: card.type });
            }}
            className="w-full text-left"
          >
            <MarketCardView card={card} />
          </button>
        ))}
      </div>

      {hasMore && cards.length > 0 && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Load more
          </Button>
        </div>
      )}
    </>
  );
}
