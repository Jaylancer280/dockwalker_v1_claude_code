import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  ClipboardCheck,
  ClipboardList,
  Clock,
  XCircle,
  User,
  Flag,
} from 'lucide-react';
import type { EngagementContext } from './types';

interface ChatSidebarActionsProps {
  context: EngagementContext;
  isCrew: boolean;
  isEmployer: boolean;
  isPermanent: boolean;
  permPostingStatus: string | null;
  cancelLabel: string;
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

export function ChatSidebarActions({
  context,
  isCrew,
  isEmployer,
  isPermanent,
  permPostingStatus,
  cancelLabel,
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
}: ChatSidebarActionsProps) {
  const permPostingId = context.permanent_postings?.id ?? null;

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--border)] p-4">
      <Button
        variant="outline"
        size="sm"
        className="justify-start gap-2"
        onClick={() => {
          const otherPersonId = isCrew ? context.employer_person_id : context.crew_person_id;
          onViewProfile(otherPersonId);
        }}
      >
        <User className="h-4 w-4" />
        View profile
      </Button>
      <Button variant="outline" size="sm" className="justify-start gap-2" onClick={onReportUser}>
        <Flag className="h-4 w-4" />
        Report user
      </Button>

      {/* Permanent-specific actions */}
      {isPermanent && permPostingStatus === 'in_negotiation' && isEmployer && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="justify-start"
            onClick={onShowConfirmPlacement}
          >
            Confirm placement
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="justify-start"
            onClick={onShowRevertSelection}
          >
            Not proceeding
          </Button>
        </>
      )}
      {isPermanent && permPostingStatus === 'filled' && (
        <Button
          variant="outline"
          size="sm"
          className="justify-start"
          onClick={onShowCloseConversation}
        >
          Close conversation
        </Button>
      )}
      {isPermanent && isCrew && permPostingStatus === 'in_negotiation' && (
        <Button
          variant="outline"
          size="sm"
          className="justify-start text-destructive"
          onClick={onCrewWithdraw}
        >
          Withdraw
        </Button>
      )}
      {isPermanent && isEmployer && permPostingId && (
        <Button
          variant="outline"
          size="sm"
          className="justify-start text-destructive"
          onClick={() => onCancelPosting(permPostingId)}
        >
          Cancel posting
        </Button>
      )}

      {/* Daywork-specific actions */}
      {!isPermanent && context.work_started_status === null && (
        <Button
          variant="outline"
          size="sm"
          className="justify-start gap-2"
          onClick={() => onWorkStarted('initiate')}
          disabled={workStarting}
        >
          <CheckCircle className="h-4 w-4" />
          {workStarting ? 'Updating...' : 'Confirm work started'}
        </Button>
      )}
      {!isPermanent && context.work_started_status === 'confirmed' && (
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground/50">
          <CheckCircle className="h-4 w-4" />
          <span>Work started (confirmed)</span>
        </div>
      )}

      {!isPermanent && isEmployer && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="justify-start gap-2"
            onClick={onShowChecklistForm}
          >
            <ClipboardList className="h-4 w-4" />
            {context.checklist ? 'Edit checklist' : 'Pre-arrival checklist'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="justify-start gap-2"
            onClick={onShowCompleteConfirm}
            disabled={completing}
          >
            <ClipboardCheck className="h-4 w-4" />
            {completing ? 'Completing...' : 'Mark complete'}
          </Button>
          {context.work_started_status === 'confirmed' ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground/50">
              <Clock className="h-4 w-4" />
              <span className="flex flex-col">
                <span>Propose date change</span>
                <span className="text-[10px]">Work has already started</span>
              </span>
            </div>
          ) : context.postponement_status === null ? (
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-2"
              onClick={onShowPostponementForm}
            >
              <Clock className="h-4 w-4" />
              Propose date change
            </Button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground/50">
              <Clock className="h-4 w-4" />
              <span className="flex flex-col">
                <span>Propose date change</span>
                <span className="text-[10px]">One-time only — already used</span>
              </span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="justify-start gap-2 text-destructive"
            onClick={onShowCancelForm}
          >
            <XCircle className="h-4 w-4" />
            {cancelLabel}
          </Button>
        </>
      )}

      {!isPermanent && isCrew && (
        <Button
          variant="outline"
          size="sm"
          className="justify-start gap-2 text-destructive"
          onClick={onShowCrewCancelForm}
        >
          <XCircle className="h-4 w-4" />
          {cancelLabel}
        </Button>
      )}
    </div>
  );
}
