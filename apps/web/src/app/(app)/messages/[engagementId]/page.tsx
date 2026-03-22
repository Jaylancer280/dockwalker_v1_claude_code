'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  Send,
  Loader2,
  XCircle,
  CheckCircle,
  ClipboardCheck,
  ClipboardList,
  Clock,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { safeFetch } from '@/lib/safe-fetch';
import { useRealtimeMessages } from '@/hooks/use-realtime-messages';

import type { Message, EngagementContext } from './_components/types';
import { POLL_INTERVAL } from './_components/types';
import { CancelFormOverlay } from './_components/cancel-form-overlay';
import { CrewCancelFormOverlay } from './_components/crew-cancel-form-overlay';
import { PostponementFormOverlay } from './_components/postponement-form-overlay';
import { RatingFormOverlay } from './_components/rating-form-overlay';
import { ChecklistFormOverlay } from './_components/checklist-form-overlay';
import { DayworkSummaryCard } from './_components/daywork-summary-card';
import { PermanentSummaryCard } from './_components/permanent-summary-card';
import { ConfirmPlacementDialog } from '../../permanent/_components/confirm-placement-dialog';
import { RevertSelectionDialog } from '../../permanent/_components/revert-selection-dialog';
import { CloseConversationDialog } from '../../permanent/_components/close-conversation-dialog';
import { ProfileOverlay } from '@/components/profile-overlay';
import { ChecklistCard } from './_components/checklist-card';
import {
  WorkStartedBanner,
  PostponementBanner,
  CompletionBanner,
  CancellationBanner,
} from './_components/banners';

export default function ChatPage() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
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
  // Permanent-specific dialog state
  const [showConfirmPlacement, setShowConfirmPlacement] = useState(false);
  const [showRevertSelection, setShowRevertSelection] = useState(false);
  const [showCloseConversation, setShowCloseConversation] = useState(false);
  const [cancelPostingId, setCancelPostingId] = useState<string | null>(null);
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

  // Realtime subscription for messages — falls back to polling if not connected after 5s
  const { isConnected: realtimeConnected } = useRealtimeMessages(engagementId, (newMsg) => {
    setMessages((prev) => {
      // Deduplicate: skip if message already in state
      if (prev.some((m) => m.id === newMsg.id)) return prev;
      return [...prev, newMsg as Message];
    });
  });

  // Init: load data, set up context polling and visibility handler
  useEffect(() => {
    let contextInterval: ReturnType<typeof setInterval>;

    function markRead() {
      void safeFetch('/api/messages/' + engagementId + '/read', { method: 'POST' });
    }

    async function init() {
      const [, userResult] = await Promise.all([
        Promise.all([loadContext(), loadMessages()]),
        safeFetch<{ userId?: string }>('/api/auth/me'),
      ]);
      if (userResult.ok && userResult.data.userId) setUserId(userResult.data.userId);

      // These MUST run even if init fetches failed
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
  }, [engagementId, loadContext, loadMessages]);

  // Reactive message polling: start when realtime is disconnected, stop when connected
  useEffect(() => {
    if (realtimeConnected) {
      // Connected — stop polling if running
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = undefined;
      }
      return;
    }

    // Not connected — start polling after a short grace period
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

    // No new messages — don't touch scroll
    if (count <= prev) return;

    const container = scrollContainerRef.current;
    if (!container) {
      // First render — scroll to bottom
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      return;
    }

    // Auto-scroll only if user is near the bottom (within 150px)
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
    // If relisting but start date has passed, cancel the old daywork first, then redirect
    // to the post form so the employer can create a fresh posting with pre-filled fields.
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
    if (!result.ok) {
      throw new Error(result.error);
    }
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
    // Optimistic update
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
      // Rollback
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
    <main className="flex h-[calc(100svh-var(--nav-height)-env(safe-area-inset-bottom))] flex-col bg-background">
      {/* Header with engagement context */}
      <header className="shrink-0 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link href="/messages" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold">{context?.other_name ?? 'Chat'}</h1>
          </div>
          {context && context.status === 'active' && !showCancelForm && !showCrewCancelForm && (
            <div ref={menuRef} className="relative shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setShowActionMenu(!showActionMenu)}>
                <MoreVertical className="h-4 w-4" />
              </Button>
              {showActionMenu && (
                <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-border bg-background shadow-lg">
                  {/* View other party's profile */}
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent"
                    onClick={() => {
                      setShowActionMenu(false);
                      const otherPersonId = isCrew
                        ? context.employer_person_id
                        : context.crew_person_id;
                      setViewProfileId(otherPersonId);
                    }}
                  >
                    View profile
                  </button>
                  {/* ── Permanent-specific actions ── */}
                  {isPermanent && permPostingStatus === 'in_negotiation' && isEmployer && (
                    <>
                      <button
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent"
                        onClick={() => {
                          setShowActionMenu(false);
                          setShowConfirmPlacement(true);
                        }}
                      >
                        Confirm placement
                      </button>
                      <button
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent"
                        onClick={() => {
                          setShowActionMenu(false);
                          setShowRevertSelection(true);
                        }}
                      >
                        Not proceeding
                      </button>
                    </>
                  )}
                  {isPermanent && permPostingStatus === 'filled' && (
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent"
                      onClick={() => {
                        setShowActionMenu(false);
                        setShowCloseConversation(true);
                      }}
                    >
                      Close conversation
                    </button>
                  )}
                  {isPermanent && isCrew && permPostingStatus === 'in_negotiation' && (
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-accent"
                      onClick={async () => {
                        setShowActionMenu(false);
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
                    </button>
                  )}
                  {isPermanent && isEmployer && (
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-accent"
                      onClick={() => {
                        setShowActionMenu(false);
                        setCancelPostingId(permPostingId);
                      }}
                    >
                      Cancel posting
                    </button>
                  )}

                  {/* ── Daywork-specific actions ── */}
                  {/* Work started — available to both parties */}
                  {!isPermanent && context.work_started_status === null && (
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent"
                      onClick={() => {
                        setShowActionMenu(false);
                        handleWorkStarted('initiate');
                      }}
                      disabled={workStarting}
                    >
                      <CheckCircle className="h-4 w-4" />
                      {workStarting ? 'Updating...' : 'Confirm work started'}
                    </button>
                  )}
                  {!isPermanent && context.work_started_status === 'confirmed' && (
                    <div className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground/50 cursor-not-allowed">
                      <CheckCircle className="h-4 w-4" />
                      <span className="flex flex-col">
                        <span>Work started</span>
                        <span className="text-[10px]">Confirmed by both parties</span>
                      </span>
                    </div>
                  )}

                  {/* Employer-only actions */}
                  {!isPermanent && isEmployer && (
                    <>
                      <button
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent"
                        onClick={() => {
                          setShowActionMenu(false);
                          setShowChecklistForm(true);
                        }}
                      >
                        <ClipboardList className="h-4 w-4" />
                        {context.checklist ? 'Edit checklist' : 'Pre-arrival checklist'}
                      </button>
                      <button
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent"
                        onClick={() => {
                          setShowActionMenu(false);
                          setShowCompleteConfirm(true);
                        }}
                        disabled={completing}
                      >
                        <ClipboardCheck className="h-4 w-4" />
                        {completing ? 'Completing...' : 'Mark complete'}
                      </button>
                      {context.work_started_status === 'confirmed' ? (
                        <div className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground/50 cursor-not-allowed">
                          <Clock className="h-4 w-4" />
                          <span className="flex flex-col">
                            <span>Propose date change</span>
                            <span className="text-[10px]">Work has already started</span>
                          </span>
                        </div>
                      ) : context.postponement_status === null ? (
                        <button
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent"
                          onClick={() => {
                            setShowActionMenu(false);
                            setShowPostponementForm(true);
                          }}
                        >
                          <Clock className="h-4 w-4" />
                          Propose date change
                        </button>
                      ) : (
                        <div className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground/50 cursor-not-allowed">
                          <Clock className="h-4 w-4" />
                          <span className="flex flex-col">
                            <span>Propose date change</span>
                            <span className="text-[10px]">One-time only — already used</span>
                          </span>
                        </div>
                      )}
                      <button
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-accent"
                        onClick={() => {
                          setShowActionMenu(false);
                          setShowCancelForm(true);
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                        {cancelLabel}
                      </button>
                    </>
                  )}

                  {/* Crew-only actions */}
                  {!isPermanent && isCrew && (
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-accent"
                      onClick={() => {
                        setShowActionMenu(false);
                        setShowCrewCancelForm(true);
                      }}
                    >
                      <XCircle className="h-4 w-4" />
                      {cancelLabel}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          {loading && (
            <div className="flex items-center justify-center pt-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading &&
            context &&
            (context.type === 'permanent' ? (
              <PermanentSummaryCard context={context} />
            ) : context.dayworks ? (
              <DayworkSummaryCard context={context} />
            ) : (
              <div className="rounded-lg border border-border bg-accent/30 px-4 py-3">
                <p className="text-sm font-medium">Job details unavailable</p>
                <p className="text-xs text-muted-foreground">
                  {context.start_date && context.end_date
                    ? `${context.start_date} — ${context.end_date}`
                    : 'Engagement dates not available'}
                  {context.status && ` · ${context.status}`}
                </p>
              </div>
            ))}

          {!loading && context?.checklist && (
            <ChecklistCard
              items={context.checklist.items}
              acknowledgedItemIds={context.checklist.acknowledged_item_ids}
              isCrew={isCrew ?? false}
              isEmployer={isEmployer ?? false}
              onToggle={handleChecklistToggle}
              onEdit={() => setShowChecklistForm(true)}
            />
          )}

          {!loading && messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">No messages yet. Say hello!</p>
          )}

          {messages.map((msg) => {
            if (msg.is_system) {
              return (
                <div key={msg.id} className="flex justify-center py-1">
                  <div className="rounded-lg bg-muted/60 px-3 py-1.5 text-center text-xs text-muted-foreground">
                    {msg.content}
                  </div>
                </div>
              );
            }

            const isMine = msg.sender_person_id === userId;
            return (
              <div
                key={msg.id}
                className={`group flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div className="relative max-w-[80%]">
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm ${
                      isMine
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-accent text-foreground rounded-bl-md'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <div className="mt-0.5">
                    <span className="text-[10px] text-muted-foreground/60">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border bg-background px-4 py-3 pb-safe">
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          {/* Work started confirmation banner */}
          {context?.status === 'active' &&
            context.work_started_status &&
            context.work_started_status !== 'confirmed' && (
              <WorkStartedBanner
                context={context}
                isCrew={isCrew ?? false}
                isEmployer={isEmployer ?? false}
                working={workStarting}
                onConfirm={() => handleWorkStarted('confirm')}
              />
            )}

          {/* Postponement banner — crew sees approve/reject, employer sees waiting */}
          {context?.status === 'active' && context.postponement_status === 'proposed' && (
            <PostponementBanner
              context={context}
              isCrew={isCrew ?? false}
              responding={respondingPostponement}
              onRespond={handleRespondPostponement}
            />
          )}

          {/* Completion banner */}
          {context?.status === 'completed' && (
            <CompletionBanner
              context={context}
              userId={userId}
              isCrew={isCrew ?? false}
              isEmployer={isEmployer ?? false}
              canRate={canRate ?? false}
              confirming={confirming}
              onConfirm={handleConfirmCompletion}
              onOpenRating={() => setShowRating(true)}
            />
          )}

          {/* Cancellation banner */}
          {context?.status === 'cancelled' && (
            <CancellationBanner
              context={context}
              canRate={canRate ?? false}
              isEmployer={isEmployer ?? false}
              relistingAfterRejection={relistingAfterRejection}
              respondingCrewCancel={respondingCrewCancel}
              onOpenRating={() => setShowRating(true)}
              onRelistAfterRejection={handleRelistAfterRejection}
              onRespondCrewCancel={handleRespondCrewCancel}
            />
          )}

          {/* Message input */}
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                context?.status === 'completed' || context?.status === 'cancelled'
                  ? 'This engagement has ended'
                  : 'Type a message...'
              }
              className="flex-1 rounded-full border border-border bg-accent px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              disabled={
                sending || context?.status === 'completed' || context?.status === 'cancelled'
              }
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

      {/* Cancel form overlay (employer only) */}
      {showCancelForm && context && isEmployer && (
        <CancelFormOverlay
          workStarted={context.work_started_status === 'confirmed'}
          startDatePassed={context.start_date < new Date().toISOString().split('T')[0]}
          onSubmit={handleCancelSubmit}
          onCancel={() => setShowCancelForm(false)}
        />
      )}

      {/* Crew cancel form overlay (crew only) */}
      {showCrewCancelForm && context && isCrew && (
        <CrewCancelFormOverlay
          workStarted={context.work_started_status === 'confirmed'}
          onSubmit={handleCrewCancelSubmit}
          onCancel={() => setShowCrewCancelForm(false)}
        />
      )}

      {/* Postponement form overlay (employer only) */}
      {showPostponementForm && context && isEmployer && (
        <PostponementFormOverlay
          currentStartDate={context.start_date}
          currentEndDate={context.end_date}
          currentWorkingDays={context.dayworks?.working_days ?? 1}
          onSubmit={handlePostponementSubmit}
          onCancel={() => setShowPostponementForm(false)}
        />
      )}

      {/* Checklist form overlay (employer only) */}
      {showChecklistForm && context && isEmployer && (
        <ChecklistFormOverlay
          existingItems={context.checklist?.items ?? null}
          onSubmit={handleChecklistSubmit}
          onCancel={() => setShowChecklistForm(false)}
        />
      )}

      {/* Complete confirmation dialog */}
      <Dialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark daywork as completed</DialogTitle>
            <DialogDescription>
              This will mark the daywork as completed for all engaged crew. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCompleteConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={handleComplete} disabled={completing}>
              {completing ? 'Completing...' : 'Mark complete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rating form overlay */}
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

      {/* Profile overlay */}
      {viewProfileId && (
        <ProfileOverlay
          personId={viewProfileId}
          isOpen={true}
          onClose={() => setViewProfileId(null)}
        />
      )}

      {/* Permanent dialogs */}
      {isPermanent && (
        <>
          <ConfirmPlacementDialog
            open={showConfirmPlacement}
            onOpenChange={setShowConfirmPlacement}
            onConfirm={async () => {
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
            crewName={context?.other_name ?? 'crew member'}
            roleName={context?.permanent_postings?.yacht_roles?.name ?? 'this role'}
          />
          <RevertSelectionDialog
            open={showRevertSelection}
            onOpenChange={setShowRevertSelection}
            onRevert={async () => {
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
            crewName={context?.other_name ?? 'this candidate'}
          />
          <CloseConversationDialog
            open={showCloseConversation}
            onOpenChange={setShowCloseConversation}
            onClose={async (outcome: string) => {
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
            isCrew={isCrew}
          />
          {/* Cancel posting dialog */}
          <Dialog open={!!cancelPostingId} onOpenChange={() => setCancelPostingId(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancel posting?</DialogTitle>
                <DialogDescription>
                  This will cancel the posting and reject all pending applicants.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setCancelPostingId(null)}>
                  Keep
                </Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
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
                >
                  Cancel posting
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </main>
  );
}
