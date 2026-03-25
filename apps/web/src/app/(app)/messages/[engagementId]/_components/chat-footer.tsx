'use client';

import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EngagementContext } from './types';
import {
  WorkStartedBanner,
  PostponementBanner,
  CompletionBanner,
  CancellationBanner,
} from './banners';

interface ChatFooterProps {
  context: EngagementContext | null;
  userId: string | null;
  isCrew: boolean;
  isEmployer: boolean;
  canRate: boolean;
  input: string;
  sending: boolean;
  confirming: boolean;
  workStarting: boolean;
  respondingPostponement: boolean;
  relistingAfterRejection: boolean;
  respondingCrewCancel: boolean;
  onInputChange: (v: string) => void;
  onSend: (e: React.FormEvent) => void;
  onConfirmCompletion: (confirmed: boolean) => void;
  onOpenRating: () => void;
  onRespondPostponement: (accepted: boolean) => void;
  onWorkStartedConfirm: () => void;
  onRelistAfterRejection: () => void;
  onRespondCrewCancel: (action: 'relist' | 'cancel') => void;
}

export function ChatFooter({
  context,
  userId,
  isCrew,
  isEmployer,
  canRate,
  input,
  sending,
  confirming,
  workStarting,
  respondingPostponement,
  relistingAfterRejection,
  respondingCrewCancel,
  onInputChange,
  onSend,
  onConfirmCompletion,
  onOpenRating,
  onRespondPostponement,
  onWorkStartedConfirm,
  onRelistAfterRejection,
  onRespondCrewCancel,
}: ChatFooterProps) {
  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 pb-safe">
      <div className="mx-auto flex max-w-lg flex-col gap-2">
        {/* Work started confirmation banner */}
        {context?.status === 'active' &&
          context.work_started_status &&
          context.work_started_status !== 'confirmed' && (
            <WorkStartedBanner
              context={context}
              isCrew={isCrew}
              isEmployer={isEmployer}
              working={workStarting}
              onConfirm={onWorkStartedConfirm}
            />
          )}

        {/* Postponement banner — crew sees approve/reject, employer sees waiting */}
        {context?.status === 'active' && context.postponement_status === 'proposed' && (
          <PostponementBanner
            context={context}
            isCrew={isCrew}
            responding={respondingPostponement}
            onRespond={onRespondPostponement}
          />
        )}

        {/* Completion banner */}
        {context?.status === 'completed' && (
          <CompletionBanner
            context={context}
            userId={userId}
            isCrew={isCrew}
            isEmployer={isEmployer}
            canRate={canRate}
            confirming={confirming}
            onConfirm={onConfirmCompletion}
            onOpenRating={onOpenRating}
          />
        )}

        {/* Cancellation banner */}
        {context?.status === 'cancelled' && (
          <CancellationBanner
            context={context}
            canRate={canRate}
            isEmployer={isEmployer}
            relistingAfterRejection={relistingAfterRejection}
            respondingCrewCancel={respondingCrewCancel}
            onOpenRating={onOpenRating}
            onRelistAfterRejection={onRelistAfterRejection}
            onRespondCrewCancel={onRespondCrewCancel}
          />
        )}

        {/* Message input */}
        <form onSubmit={onSend} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={
              context?.status === 'completed' || context?.status === 'cancelled'
                ? 'This engagement has ended'
                : 'Type a message...'
            }
            className="flex-1 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
            disabled={sending || context?.status === 'completed' || context?.status === 'cancelled'}
          />
          <Button
            type="submit"
            size="icon"
            disabled={
              sending ||
              !input.trim() ||
              context?.status === 'completed' ||
              context?.status === 'cancelled'
            }
            className="h-9 w-9 shrink-0 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
