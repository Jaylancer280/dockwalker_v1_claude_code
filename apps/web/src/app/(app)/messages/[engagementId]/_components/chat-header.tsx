'use client';

import { type RefObject } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  XCircle,
  CheckCircle,
  ClipboardCheck,
  ClipboardList,
  Clock,
  MoreVertical,
  Phone,
  Flag,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { EngagementContext } from './types';

interface ChatHeaderProps {
  context: EngagementContext | null;
  isCrew: boolean;
  isEmployer: boolean;
  isPermanent: boolean;
  /** B-011: when true, the engagement is a phase='shortlist' pre-selection
   *  chat. Lifecycle actions (work-started, postponement, complete, rate,
   *  checklist, cancel-engagement) are suppressed; only View profile +
   *  Report user remain. The new shortlist-specific actions (Select,
   *  Reject, Withdraw) live on the review tab and the chat footer. */
  isShortlistPhase: boolean;
  permPostingStatus: string | null;
  cancelLabel: string;
  showActionMenu: boolean;
  setShowActionMenu: (v: boolean) => void;
  menuRef: RefObject<HTMLDivElement | null>;
  showCancelForm: boolean;
  showCrewCancelForm: boolean;
  completing: boolean;
  workStarting: boolean;
  onViewProfile: (personId: string) => void;
  onReportUser: () => void;
  onShowCancelForm: () => void;
  onShowCrewCancelForm: () => void;
  onShowChecklistForm: () => void;
  onShowCompleteConfirm: () => void;
  onShowPostponementForm: () => void;
  onShowConfirmPlacement: () => void;
  onShowRevertSelection: () => void;
  onShowCloseConversation: () => void;
  onCancelPosting: (postingId: string) => void;
  onCrewWithdraw: () => void;
  onWorkStarted: (action: 'initiate' | 'confirm') => void;
}

export function ChatHeader({
  context,
  isCrew,
  isEmployer,
  isPermanent,
  isShortlistPhase,
  permPostingStatus,
  cancelLabel,
  showActionMenu,
  setShowActionMenu,
  menuRef,
  showCancelForm,
  showCrewCancelForm,
  completing,
  workStarting,
  onViewProfile,
  onReportUser,
  onShowCancelForm,
  onShowCrewCancelForm,
  onShowChecklistForm,
  onShowCompleteConfirm,
  onShowPostponementForm,
  onShowConfirmPlacement,
  onShowRevertSelection,
  onShowCloseConversation,
  onCancelPosting,
  onCrewWithdraw,
  onWorkStarted,
}: ChatHeaderProps) {
  const permPostingId = context?.permanent_postings?.id ?? null;
  const { showSuccess } = useToast();

  return (
    <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="page-width-wide flex  items-center gap-3">
        <Link href="/messages" className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold tracking-[-0.3px]">
            {context?.other_name ?? 'Chat'}
          </h1>
        </div>
        {/* Voice calls deferred post-launch. Button always visible but inert
            so users see the feature is planned; aria-disabled keeps the click
            firing so taps still surface the "coming soon" toast (native
            disabled buttons swallow pointer events). Voice subsystem was
            ripped out 2026-04-30; re-add as a green-field LiveKit Cloud
            integration when prioritised, then swap the onClick for the real
            handler. */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => showSuccess('Voice calls — coming soon')}
          aria-disabled="true"
          aria-label="Voice calls — coming soon"
          title="Voice calls — coming soon"
          className="opacity-60"
        >
          <Phone className="h-4 w-4" />
        </Button>
        {context && context.status === 'active' && !showCancelForm && !showCrewCancelForm && (
          <div ref={menuRef} className="relative shrink-0 lg:hidden">
            <Button variant="ghost" size="sm" onClick={() => setShowActionMenu(!showActionMenu)}>
              <MoreVertical className="h-4 w-4" />
            </Button>
            {showActionMenu && (
              <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-[14px] border border-[var(--border)] bg-[var(--card)]">
                {/* View other party's profile */}
                <button
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-[var(--accent-lo)]"
                  onClick={() => {
                    setShowActionMenu(false);
                    const otherPersonId = isCrew
                      ? context.employer_person_id
                      : context.crew_person_id;
                    onViewProfile(otherPersonId);
                  }}
                >
                  View profile
                </button>

                {/* Report user */}
                <button
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-[var(--accent-lo)]"
                  onClick={() => {
                    setShowActionMenu(false);
                    onReportUser();
                  }}
                >
                  <Flag className="h-4 w-4" />
                  Report user
                </button>

                {isShortlistPhase && isEmployer && permPostingId && (
                  <Link
                    href={`/permanent/${permPostingId}/review?tab=shortlisted`}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-[var(--accent-lo)]"
                    onClick={() => setShowActionMenu(false)}
                  >
                    <Star className="h-4 w-4" />
                    Return to shortlist
                  </Link>
                )}

                {/* B-011: shortlist-phase chats suppress all lifecycle
                    actions. View profile + Report user above this block
                    remain. Shortlist-specific actions (Select, Reject,
                    Withdraw, Open chat) live on the review tab + footer. */}
                {!isShortlistPhase && (
                  <>
                    {/* ── Permanent-specific actions ── */}
                    {isPermanent && permPostingStatus === 'in_negotiation' && isEmployer && (
                      <>
                        <button
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-[var(--accent-lo)]"
                          onClick={() => {
                            setShowActionMenu(false);
                            onShowConfirmPlacement();
                          }}
                        >
                          Confirm placement
                        </button>
                        <button
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-[var(--accent-lo)]"
                          onClick={() => {
                            setShowActionMenu(false);
                            onShowRevertSelection();
                          }}
                        >
                          Not proceeding
                        </button>
                      </>
                    )}
                    {isPermanent && permPostingStatus === 'filled' && (
                      <button
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-[var(--accent-lo)]"
                        onClick={() => {
                          setShowActionMenu(false);
                          onShowCloseConversation();
                        }}
                      >
                        Close conversation
                      </button>
                    )}
                    {isPermanent && isCrew && permPostingStatus === 'in_negotiation' && (
                      <button
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-[var(--accent-lo)]"
                        onClick={() => {
                          setShowActionMenu(false);
                          onCrewWithdraw();
                        }}
                      >
                        Withdraw
                      </button>
                    )}
                    {isPermanent && isEmployer && (
                      <button
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-[var(--accent-lo)]"
                        onClick={() => {
                          setShowActionMenu(false);
                          if (permPostingId) onCancelPosting(permPostingId);
                        }}
                      >
                        Cancel posting
                      </button>
                    )}

                    {/* ── Daywork-specific actions ── */}
                    {!isPermanent && context.work_started_status === null && (
                      <button
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-[var(--accent-lo)]"
                        onClick={() => {
                          setShowActionMenu(false);
                          onWorkStarted('initiate');
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
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-[var(--accent-lo)]"
                          onClick={() => {
                            setShowActionMenu(false);
                            onShowChecklistForm();
                          }}
                        >
                          <ClipboardList className="h-4 w-4" />
                          {context.checklist ? 'Edit checklist' : 'Pre-arrival checklist'}
                        </button>
                        <button
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-[var(--accent-lo)]"
                          onClick={() => {
                            setShowActionMenu(false);
                            onShowCompleteConfirm();
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
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-[var(--accent-lo)]"
                            onClick={() => {
                              setShowActionMenu(false);
                              onShowPostponementForm();
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
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-[var(--accent-lo)]"
                          onClick={() => {
                            setShowActionMenu(false);
                            onShowCancelForm();
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
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-[var(--accent-lo)]"
                        onClick={() => {
                          setShowActionMenu(false);
                          onShowCrewCancelForm();
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                        {cancelLabel}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
