'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { safeFetch } from '@/lib/safe-fetch';
import { useRealtimeMessages } from '@/hooks/use-realtime-messages';
import { ProfileOverlay } from '@/components/profile-overlay';

import type { Message, EngagementContext } from './_components/types';
import { POLL_INTERVAL } from './_components/types';
import { CancelFormOverlay } from './_components/cancel-form-overlay';
import { CrewCancelFormOverlay } from './_components/crew-cancel-form-overlay';
import { PostponementFormOverlay } from './_components/postponement-form-overlay';
import { RatingFormOverlay } from './_components/rating-form-overlay';
import { ChecklistFormOverlay } from './_components/checklist-form-overlay';
import { ChatHeader } from './_components/chat-header';
import { MessageList } from './_components/message-list';
import { ChatFooter } from './_components/chat-footer';
import { ChatDialogs } from './_components/chat-dialogs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChatSidebarActions } from './_components/chat-sidebar-actions';
import { DayworkSummaryCard } from './_components/daywork-summary-card';
import { PermanentSummaryCard } from './_components/permanent-summary-card';
import { useVoiceCall } from '@/hooks/use-voice-call';
import { CallBar } from '@/components/call-bar';
import { useNotificationCounts } from '@/hooks/use-notification-counts';

export default function ChatPage() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const { refresh: refreshCounts } = useNotificationCounts();
  const [messages, setMessages] = useState<Message[]>([]);
  const [documentMap, setDocumentMap] = useState<
    Map<
      string,
      Array<{
        id: string;
        message_id: string | null;
        file_name: string;
        file_size_bytes: number;
        mime_type: string;
        expires_at: string;
        deleted_at: string | null;
        uploader_person_id: string;
      }>
    >
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [context, setContext] = useState<EngagementContext | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [showCrewCancelForm, setShowCrewCancelForm] = useState(false);
  const [showPostponementForm, setShowPostponementForm] = useState(false);
  const [showChecklistForm, setShowChecklistForm] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);
  const [showConfirmPlacement, setShowConfirmPlacement] = useState(false);
  const [showRevertSelection, setShowRevertSelection] = useState(false);
  const [showCloseConversation, setShowCloseConversation] = useState(false);
  const [cancelPostingId, setCancelPostingId] = useState<string | null>(null);
  const [showCrewWithdraw, setShowCrewWithdraw] = useState(false);
  const [showConfirmCancelAfterCrewCancel, setShowConfirmCancelAfterCrewCancel] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [relistingAfterRejection, setRelistingAfterRejection] = useState(false);
  const [respondingCrewCancel, setRespondingCrewCancel] = useState(false);
  const [respondingPostponement, setRespondingPostponement] = useState(false);
  const [workStarting, setWorkStarting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const menuRef = useRef<HTMLDivElement>(null);

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  const loadContext = useCallback(async () => {
    const result = await safeFetch<{ engagement?: EngagementContext }>(
      `/api/messages/${engagementId}/context`,
    );
    if (result.ok && result.data.engagement) setContext(result.data.engagement);
  }, [engagementId]);

  const loadMessages = useCallback(async () => {
    const result = await safeFetch<{ messages?: Message[] }>(`/api/messages/${engagementId}`);
    if (result.ok && result.data.messages) setMessages(result.data.messages);
    setLoading(false);
  }, [engagementId]);

  const loadDocuments = useCallback(async () => {
    const result = await safeFetch<{
      documents?: Array<{
        id: string;
        message_id: string | null;
        file_name: string;
        file_size_bytes: number;
        mime_type: string;
        expires_at: string;
        deleted_at: string | null;
        uploader_person_id: string;
      }>;
    }>(`/api/messages/${engagementId}/documents`);
    if (result.ok && result.data.documents) {
      const map = new Map<string, typeof result.data.documents>();
      for (const doc of result.data.documents) {
        if (doc.message_id) {
          const existing = map.get(doc.message_id) ?? [];
          existing.push(doc);
          map.set(doc.message_id, existing);
        }
      }
      setDocumentMap(map);
    }
  }, [engagementId]);

  const { isConnected: realtimeConnected } = useRealtimeMessages(engagementId, (newMsg) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === newMsg.id)) return prev;
      return [...prev, newMsg as Message];
    });
  });

  useEffect(() => {
    let contextInterval: ReturnType<typeof setInterval>;

    function markRead() {
      void safeFetch('/api/messages/' + engagementId + '/read', { method: 'POST' }).then(() =>
        refreshCounts(),
      );
    }

    async function init() {
      const [, userResult] = await Promise.all([
        Promise.all([loadContext(), loadMessages(), loadDocuments()]),
        safeFetch<{ userId?: string }>('/api/auth/me'),
      ]);
      if (userResult.ok && userResult.data.userId) setUserId(userResult.data.userId);
      markRead();
      contextInterval = setInterval(() => void loadContext(), POLL_INTERVAL);
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') markRead();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    void init();
    return () => {
      clearInterval(contextInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId, loadContext, loadMessages, loadDocuments]);

  useEffect(() => {
    if (realtimeConnected) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = undefined;
      }
      return;
    }
    const fallbackTimeout = setTimeout(() => {
      if (!pollRef.current) {
        pollRef.current = setInterval(() => void loadMessages(), POLL_INTERVAL);
      }
    }, POLL_INTERVAL);
    return () => {
      clearTimeout(fallbackTimeout);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = undefined;
      }
    };
  }, [realtimeConnected, loadMessages]);

  useEffect(() => {
    const count = messages.length;
    const prev = prevMessageCountRef.current;
    prevMessageCountRef.current = count;
    if (count <= prev) return;
    const container = scrollContainerRef.current;
    if (!container) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      return;
    }
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 150) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (!showActionMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowActionMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActionMenu]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    const result = await safeFetch(`/api/messages/${engagementId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: input.trim() }),
    });
    if (result.ok) {
      setInput('');
      await loadMessages();
    } else {
      showError(result.error);
    }
    setSending(false);
  }

  async function handleConfirmCompletion(confirmed: boolean) {
    if (!context) return;
    setConfirming(true);
    const result = await safeFetch<{ status: string }>(
      `/api/engagements/${engagementId}/confirm-completion`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed }),
      },
    );
    if (result.ok) {
      setContext((prev) => (prev ? { ...prev, crew_completion_status: result.data.status } : prev));
      showSuccess('Completion confirmed');
    } else {
      showError(result.error);
    }
    setConfirming(false);
  }

  async function handleSubmitRating(ratingData: Record<string, unknown>) {
    setSubmittingRating(true);
    const result = await safeFetch<{ id?: string }>(`/api/engagements/${engagementId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ratingData),
    });
    if (result.ok) {
      setContext((prev) =>
        prev
          ? {
              ...prev,
              has_rated: true,
              my_rating: {
                id: result.data.id ?? 'local',
                rater_role: isCrew ? 'crew' : 'employer',
                rating_context: prev.status === 'cancelled' ? 'cancelled' : 'completed',
                pay_accuracy: (ratingData.pay_accuracy as string) ?? null,
                meals_accuracy: (ratingData.meals_accuracy as string) ?? null,
                role_accuracy: (ratingData.role_accuracy as string) ?? null,
                working_days_accuracy: (ratingData.working_days_accuracy as string) ?? null,
                vessel_condition: (ratingData.vessel_condition as number) ?? null,
                would_work_on_vessel_again:
                  (ratingData.would_work_on_vessel_again as boolean) ?? null,
                skills_as_advertised: (ratingData.skills_as_advertised as string) ?? null,
                certifications_verified: (ratingData.certifications_verified as string) ?? null,
                punctuality: (ratingData.punctuality as string) ?? null,
                would_rehire: (ratingData.would_rehire as boolean) ?? null,
                communication_accuracy: (ratingData.communication_accuracy as boolean) ?? null,
                overall_match: (ratingData.overall_match as number) ?? null,
                notice_given: (ratingData.notice_given as string) ?? null,
                permanent_opportunity_accuracy:
                  (ratingData.permanent_opportunity_accuracy as string) ?? null,
              },
            }
          : prev,
      );
      setShowRating(false);
      showSuccess('Rating submitted');
    } else {
      showError(result.error);
    }
    setSubmittingRating(false);
  }

  async function handleCancelSubmit(cancelData: {
    reason_category: string;
    reason_text?: string;
    relist_requested: boolean;
    relist_reason_category?: string;
    relist_reason_text?: string;
  }) {
    const result = await safeFetch(`/api/engagements/${engagementId}/cancel-employer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cancelData),
    });
    if (result.ok) {
      setShowCancelForm(false);
      showSuccess('Cancellation submitted');
      await Promise.all([loadContext(), loadMessages()]);
    } else {
      showError(result.error);
    }
  }

  async function handleCrewCancelSubmit(cancelData: {
    reason_category: string;
    reason_text?: string;
  }) {
    const result = await safeFetch(`/api/engagements/${engagementId}/cancel-crew`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cancelData),
    });
    if (result.ok) {
      setShowCrewCancelForm(false);
      showSuccess('Cancellation submitted');
      await Promise.all([loadContext(), loadMessages()]);
    } else {
      showError(result.error);
    }
  }

  async function handleRespondCrewCancel(action: 'relist' | 'cancel') {
    // Confirm before cancelling the posting (destructive)
    if (action === 'cancel' && !showConfirmCancelAfterCrewCancel) {
      setShowConfirmCancelAfterCrewCancel(true);
      return;
    }
    setShowConfirmCancelAfterCrewCancel(false);
    if (action === 'relist' && context) {
      const today = new Date().toISOString().split('T')[0];
      if (context.start_date < today) {
        setRespondingCrewCancel(true);
        const result = await safeFetch(`/api/engagements/${engagementId}/respond-crew-cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cancel' }),
        });
        if (result.ok) {
          router.push(`/daywork/post?fromDaywork=${context.daywork_id}`);
        } else {
          showError(result.error);
          setRespondingCrewCancel(false);
        }
        return;
      }
    }
    setRespondingCrewCancel(true);
    const result = await safeFetch(`/api/engagements/${engagementId}/respond-crew-cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (result.ok) {
      showSuccess(action === 'relist' ? 'Job relisted' : 'Posting cancelled');
      await Promise.all([loadContext(), loadMessages()]);
    } else {
      showError(result.error);
    }
    setRespondingCrewCancel(false);
  }

  async function handleComplete() {
    if (!context) return;
    setShowCompleteConfirm(false);
    setCompleting(true);
    const result = await safeFetch(`/api/daywork/${context.daywork_id}/complete`, {
      method: 'POST',
    });
    if (result.ok) {
      showSuccess('Daywork marked complete');
      await Promise.all([loadContext(), loadMessages()]);
    } else {
      showError(result.error);
    }
    setCompleting(false);
  }

  async function handlePostponementSubmit(data: {
    start_date: string;
    end_date: string;
    working_days: number;
    confirm_conflict?: boolean;
  }): Promise<{ outcome: string }> {
    const result = await safeFetch<{ outcome: string }>(
      `/api/engagements/${engagementId}/propose-postponement`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
    );
    if (!result.ok) throw new Error(result.error);
    if (result.data.outcome === 'proposed' || result.data.outcome === 'conflict_confirmed') {
      setShowPostponementForm(false);
      showSuccess('Date change proposed');
      await Promise.all([loadContext(), loadMessages()]);
    }
    return result.data;
  }

  async function handleRelistAfterRejection() {
    setRelistingAfterRejection(true);
    const result = await safeFetch(`/api/engagements/${engagementId}/relist-with-dates`, {
      method: 'POST',
    });
    if (result.ok) {
      showSuccess('Job relisted');
      await Promise.all([loadContext(), loadMessages()]);
    } else {
      showError(result.error);
    }
    setRelistingAfterRejection(false);
  }

  async function handleRespondPostponement(accepted: boolean) {
    setRespondingPostponement(true);
    const result = await safeFetch(`/api/engagements/${engagementId}/respond-postponement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accepted }),
    });
    if (result.ok) {
      showSuccess(accepted ? 'New dates approved' : 'Date change rejected');
      await Promise.all([loadContext(), loadMessages()]);
    } else {
      showError(result.error);
    }
    setRespondingPostponement(false);
  }

  async function handleWorkStarted(action: 'initiate' | 'confirm') {
    setWorkStarting(true);
    const result = await safeFetch(`/api/engagements/${engagementId}/work-started`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (result.ok) {
      showSuccess(
        action === 'initiate' ? 'Work started notification sent' : 'Work started confirmed',
      );
      await Promise.all([loadContext(), loadMessages()]);
    } else {
      showError(result.error);
    }
    setWorkStarting(false);
  }

  async function handleChecklistSubmit(items: Array<{ id: string; label: string; value: string }>) {
    const result = await safeFetch(`/api/engagements/${engagementId}/checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (result.ok) {
      setShowChecklistForm(false);
      showSuccess('Checklist saved');
      await Promise.all([loadContext(), loadMessages()]);
    } else {
      showError(result.error);
    }
  }

  async function handleChecklistToggle(itemId: string, checked: boolean) {
    const previousAcked = context?.checklist?.acknowledged_item_ids ?? [];
    setContext((prev) => {
      if (!prev?.checklist) return prev;
      const newAcked = checked
        ? [...prev.checklist.acknowledged_item_ids.filter((id) => id !== itemId), itemId]
        : prev.checklist.acknowledged_item_ids.filter((id) => id !== itemId);
      return { ...prev, checklist: { ...prev.checklist, acknowledged_item_ids: newAcked } };
    });
    const result = await safeFetch(`/api/engagements/${engagementId}/checklist/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId, checked }),
    });
    if (!result.ok) {
      setContext((prev) => {
        if (!prev?.checklist) return prev;
        return {
          ...prev,
          checklist: { ...prev.checklist, acknowledged_item_ids: previousAcked },
        };
      });
      showError(result.error);
    }
  }

  // -----------------------------------------------------------------------
  // Derived state
  // -----------------------------------------------------------------------

  const isCrew = context?.crew_person_id === userId;
  const isEmployer = context?.employer_person_id === userId;
  const isPermanent = context?.type === 'permanent';
  const permPostingId = context?.permanent_postings?.id ?? null;

  // Voice call
  const voiceCall = useVoiceCall({
    engagementId: engagementId ?? '',
    personId: userId ?? '',
    remoteName: context?.other_name ?? '',
  });
  const voiceCallEnabled =
    isPermanent && context?.status === 'active' && voiceCall.callState === 'idle';

  // Post system message when call ends
  useEffect(() => {
    if (voiceCall.callState === 'ended' && voiceCall.duration > 0) {
      safeFetch(`/api/messages/${engagementId}/call-ended`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: voiceCall.duration }),
      });
    }
  }, [voiceCall.callState, voiceCall.duration, engagementId]);
  const permPostingStatus = context?.permanent_postings?.status ?? null;
  const canRate =
    (context?.status === 'completed' &&
      context.has_rated === false &&
      ((isCrew && context.crew_completion_status !== null) || isEmployer === true)) ||
    (context?.status === 'cancelled' && context.has_rated === false);

  const cancelLabel =
    context?.work_started_status === 'confirmed' ? 'Terminate job early' : 'Cancel engagement';

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <main className="fixed inset-x-0 top-0 bottom-0 z-10 flex flex-col bg-background pb-[calc(var(--nav-height)+env(safe-area-inset-bottom))] md:static md:inset-auto md:bottom-auto md:z-auto md:h-dvh md:pb-0 lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <CallBar
          callState={voiceCall.callState}
          remoteName={context?.other_name ?? ''}
          duration={voiceCall.duration}
          isMuted={voiceCall.isMuted}
          onToggleMute={voiceCall.toggleMute}
          onHangUp={() => voiceCall.hangUp()}
          onAccept={voiceCall.acceptCall}
          onDecline={voiceCall.declineCall}
        />
        <ChatHeader
          context={context}
          isCrew={isCrew ?? false}
          isEmployer={isEmployer ?? false}
          isPermanent={isPermanent ?? false}
          permPostingStatus={permPostingStatus}
          cancelLabel={cancelLabel}
          showActionMenu={showActionMenu}
          setShowActionMenu={setShowActionMenu}
          menuRef={menuRef}
          showCancelForm={showCancelForm}
          showCrewCancelForm={showCrewCancelForm}
          completing={completing}
          workStarting={workStarting}
          onViewProfile={setViewProfileId}
          onShowCancelForm={() => setShowCancelForm(true)}
          onShowCrewCancelForm={() => setShowCrewCancelForm(true)}
          onShowChecklistForm={() => setShowChecklistForm(true)}
          onShowCompleteConfirm={() => setShowCompleteConfirm(true)}
          onShowPostponementForm={() => setShowPostponementForm(true)}
          onShowConfirmPlacement={() => setShowConfirmPlacement(true)}
          onShowRevertSelection={() => setShowRevertSelection(true)}
          onShowCloseConversation={() => setShowCloseConversation(true)}
          onCancelPosting={setCancelPostingId}
          onCrewWithdraw={() => setShowCrewWithdraw(true)}
          onWorkStarted={handleWorkStarted}
          onStartVoiceCall={voiceCall.startCall}
          voiceCallEnabled={voiceCallEnabled}
        />

        <MessageList
          messages={messages}
          context={context}
          userId={userId}
          loading={loading}
          isCrew={isCrew ?? false}
          isEmployer={isEmployer ?? false}
          engagementId={engagementId}
          documentMap={documentMap}
          scrollContainerRef={scrollContainerRef}
          messagesEndRef={messagesEndRef}
          onChecklistToggle={handleChecklistToggle}
          onEditChecklist={() => setShowChecklistForm(true)}
          onDocumentDeleted={(docId) => {
            setDocumentMap((prev) => {
              const next = new Map(prev);
              for (const [msgId, docs] of next) {
                next.set(
                  msgId,
                  docs.map((d) =>
                    d.id === docId ? { ...d, deleted_at: new Date().toISOString() } : d,
                  ),
                );
              }
              return next;
            });
          }}
        />

        <ChatFooter
          context={context}
          engagementId={engagementId}
          userId={userId}
          isCrew={isCrew ?? false}
          isEmployer={isEmployer ?? false}
          canRate={canRate ?? false}
          input={input}
          sending={sending}
          confirming={confirming}
          workStarting={workStarting}
          respondingPostponement={respondingPostponement}
          relistingAfterRejection={relistingAfterRejection}
          respondingCrewCancel={respondingCrewCancel}
          onInputChange={setInput}
          onSend={handleSend}
          onConfirmCompletion={handleConfirmCompletion}
          onOpenRating={() => setShowRating(true)}
          onRespondPostponement={handleRespondPostponement}
          onWorkStartedConfirm={() => handleWorkStarted('confirm')}
          onRelistAfterRejection={handleRelistAfterRejection}
          onRespondCrewCancel={handleRespondCrewCancel}
          onDocumentsUploaded={loadDocuments}
        />
      </div>

      {/* Desktop engagement sidebar */}
      {context && (
        <aside className="hidden lg:flex lg:w-[320px] lg:shrink-0 lg:flex-col lg:border-l lg:border-[var(--border)] lg:overflow-y-auto">
          <div className="p-4">
            {context.type === 'permanent' ? (
              <PermanentSummaryCard context={context} />
            ) : context.dayworks ? (
              <DayworkSummaryCard context={context} />
            ) : null}
          </div>
          {context.status === 'active' && (
            <ChatSidebarActions
              context={context}
              isCrew={isCrew ?? false}
              isEmployer={isEmployer ?? false}
              isPermanent={isPermanent ?? false}
              permPostingStatus={permPostingStatus}
              cancelLabel={cancelLabel}
              completing={completing}
              workStarting={workStarting}
              onViewProfile={setViewProfileId}
              onShowCancelForm={() => setShowCancelForm(true)}
              onShowCrewCancelForm={() => setShowCrewCancelForm(true)}
              onShowChecklistForm={() => setShowChecklistForm(true)}
              onShowCompleteConfirm={() => setShowCompleteConfirm(true)}
              onShowPostponementForm={() => setShowPostponementForm(true)}
              onShowConfirmPlacement={() => setShowConfirmPlacement(true)}
              onShowRevertSelection={() => setShowRevertSelection(true)}
              onShowCloseConversation={() => setShowCloseConversation(true)}
              onCancelPosting={setCancelPostingId}
              onCrewWithdraw={() => setShowCrewWithdraw(true)}
              onWorkStarted={handleWorkStarted}
            />
          )}
        </aside>
      )}

      {/* Form overlays */}
      {showCancelForm && context && isEmployer && (
        <CancelFormOverlay
          workStarted={context.work_started_status === 'confirmed'}
          startDatePassed={context.start_date < new Date().toISOString().split('T')[0]}
          onSubmit={handleCancelSubmit}
          onCancel={() => setShowCancelForm(false)}
        />
      )}
      {showCrewCancelForm && context && isCrew && (
        <CrewCancelFormOverlay
          workStarted={context.work_started_status === 'confirmed'}
          onSubmit={handleCrewCancelSubmit}
          onCancel={() => setShowCrewCancelForm(false)}
        />
      )}
      {showPostponementForm && context && isEmployer && (
        <PostponementFormOverlay
          currentStartDate={context.start_date}
          currentEndDate={context.end_date}
          currentWorkingDays={context.dayworks?.working_days ?? 1}
          onSubmit={handlePostponementSubmit}
          onCancel={() => setShowPostponementForm(false)}
        />
      )}
      {showChecklistForm && context && isEmployer && (
        <ChecklistFormOverlay
          existingItems={context.checklist?.items ?? null}
          onSubmit={handleChecklistSubmit}
          onCancel={() => setShowChecklistForm(false)}
        />
      )}
      {showRating && context && userId && (
        <RatingFormOverlay
          isCrew={isCrew ?? false}
          isCancelled={context.status === 'cancelled'}
          hasPermanentOpportunity={context.dayworks?.permanent_opportunity ?? false}
          submitting={submittingRating}
          onSubmit={handleSubmitRating}
          onCancel={() => setShowRating(false)}
        />
      )}

      <ChatDialogs
        context={context}
        isPermanent={isPermanent ?? false}
        isCrew={isCrew ?? false}
        showCompleteConfirm={showCompleteConfirm}
        setShowCompleteConfirm={setShowCompleteConfirm}
        completing={completing}
        onComplete={handleComplete}
        showConfirmPlacement={showConfirmPlacement}
        setShowConfirmPlacement={setShowConfirmPlacement}
        onConfirmPlacement={async () => {
          setShowConfirmPlacement(false);
          if (!permPostingId) return;
          const r = await safeFetch(`/api/permanent/${permPostingId}/confirm`, {
            method: 'POST',
          });
          if (r.ok) {
            showSuccess('Placement confirmed');
            loadContext();
          } else {
            showError(r.error);
          }
        }}
        showRevertSelection={showRevertSelection}
        setShowRevertSelection={setShowRevertSelection}
        onRevertSelection={async () => {
          setShowRevertSelection(false);
          if (!permPostingId) return;
          const r = await safeFetch(`/api/permanent/${permPostingId}/revert`, {
            method: 'POST',
          });
          if (r.ok) {
            showSuccess('Selection reverted');
            router.push('/messages');
          } else {
            showError(r.error);
          }
        }}
        showCloseConversation={showCloseConversation}
        setShowCloseConversation={setShowCloseConversation}
        onCloseConversation={async (outcome: string) => {
          setShowCloseConversation(false);
          const r = await safeFetch(`/api/permanent/engagements/${engagementId}/close`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ outcome }),
          });
          if (r.ok) {
            showSuccess('Conversation closed');
            router.push('/messages');
          } else {
            showError(r.error);
          }
        }}
        cancelPostingId={cancelPostingId}
        setCancelPostingId={setCancelPostingId}
        onCancelPosting={async () => {
          if (!cancelPostingId) return;
          setCancelPostingId(null);
          const r = await safeFetch(`/api/permanent/${cancelPostingId}/cancel`, {
            method: 'POST',
            body: '{}',
          });
          if (r.ok) {
            showSuccess('Posting cancelled');
            router.push('/messages');
          } else {
            showError(r.error);
          }
        }}
      />

      {/* Cancel posting after crew cancel — confirmation */}
      <Dialog
        open={showConfirmCancelAfterCrewCancel}
        onOpenChange={setShowConfirmCancelAfterCrewCancel}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this posting?</DialogTitle>
            <DialogDescription>
              This will cancel the posting and reject all pending applicants. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConfirmCancelAfterCrewCancel(false)}>
              Keep posting
            </Button>
            <Button variant="destructive" onClick={() => handleRespondCrewCancel('cancel')}>
              Cancel posting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Crew withdraw confirmation */}
      <Dialog open={showCrewWithdraw} onOpenChange={setShowCrewWithdraw}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw application?</DialogTitle>
            <DialogDescription>
              This will permanently withdraw your application for this position. You cannot undo
              this action.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCrewWithdraw(false)}>
              Keep application
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setShowCrewWithdraw(false);
                if (!permPostingId) return;
                const r = await safeFetch(`/api/permanent/${permPostingId}/withdraw`, {
                  method: 'POST',
                });
                if (r.ok) {
                  showSuccess('Application withdrawn');
                  router.push('/messages');
                } else {
                  showError(r.error);
                }
              }}
            >
              Withdraw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile overlay */}
      {viewProfileId && (
        <ProfileOverlay
          personId={viewProfileId}
          isOpen={true}
          onClose={() => setViewProfileId(null)}
        />
      )}
    </main>
  );
}
