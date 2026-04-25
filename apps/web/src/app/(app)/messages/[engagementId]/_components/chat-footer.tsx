'use client';

import { useRef, useState } from 'react';
import { Send, Paperclip, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';
import type { EngagementContext } from './types';
import {
  WorkStartedBanner,
  PostponementBanner,
  CompletionBanner,
  CancellationBanner,
  ClosedBanner,
} from './banners';

interface ChatFooterProps {
  context: EngagementContext | null;
  engagementId: string;
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
  onDocumentsUploaded?: () => void;
}

export function ChatFooter({
  context,
  engagementId,
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
  onDocumentsUploaded,
}: ChatFooterProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { showSuccess, showError } = useToast();

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const documentIds: string[] = [];

    const MAX_FILE_SIZE = 4 * 1024 * 1024;
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        showError(
          `${file.name} is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum file size is 4MB.`,
        );
        continue;
      }
      const formData = new FormData();
      formData.append('file', file);
      const res = await safeFetch<{ documentId?: string; error?: string }>(
        `/api/messages/${engagementId}/documents/upload`,
        { method: 'POST', body: formData },
      );
      if (res.ok && res.data.documentId) {
        documentIds.push(res.data.documentId);
      } else {
        showError(!res.ok ? res.error : `Failed to upload ${file.name}`);
      }
    }

    // Finalize if any uploaded
    if (documentIds.length > 0) {
      const finalRes = await safeFetch(`/api/messages/${engagementId}/documents/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds }),
      });
      if (finalRes.ok) {
        showSuccess(`${documentIds.length} document(s) shared`);
        onDocumentsUploaded?.();
      } else {
        showError('Failed to finalize documents');
      }
    }

    setUploading(false);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="page-width-wide flex  flex-col gap-2">
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

        {/* Closed banner (permanent engagements — withdrew, not_successful, successful_placement) */}
        {context?.status === 'closed' && (
          <ClosedBanner context={context} canRate={canRate} onOpenRating={onOpenRating} />
        )}

        {/* Message input */}
        <form onSubmit={onSend} className="flex items-center gap-2">
          {context?.status === 'active' && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </Button>
            </>
          )}
          <AutoGrowTextarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={
              context?.status === 'completed' ||
              context?.status === 'cancelled' ||
              context?.status === 'closed'
                ? 'This engagement has ended'
                : 'Type a message...'
            }
            className="flex-1 resize-none rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm leading-5 outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
            disabled={
              sending ||
              context?.status === 'completed' ||
              context?.status === 'cancelled' ||
              context?.status === 'closed'
            }
            maxRows={6}
          />
          <Button
            type="submit"
            size="icon"
            disabled={
              sending ||
              !input.trim() ||
              context?.status === 'completed' ||
              context?.status === 'cancelled' ||
              context?.status === 'closed'
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
