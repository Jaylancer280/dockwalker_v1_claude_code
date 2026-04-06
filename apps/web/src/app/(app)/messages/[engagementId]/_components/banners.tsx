'use client';

import { useState } from 'react';
import {
  Loader2,
  XCircle,
  CheckCircle,
  AlertTriangle,
  Star,
  ClipboardCheck,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EngagementContext } from './types';
import { RatingSummary } from './rating-summary';
import { ExpandableText } from '@/components/expandable-text';

// ---------------------------------------------------------------------------
// Work Started Banner
// ---------------------------------------------------------------------------

export function WorkStartedBanner({
  context,
  isCrew,
  isEmployer,
  working,
  onConfirm,
}: {
  context: EngagementContext;
  isCrew: boolean;
  isEmployer: boolean;
  working: boolean;
  onConfirm: () => void;
}) {
  const initiatedByCrew = context.work_started_status === 'initiated_by_crew';
  const initiatedByEmployer = context.work_started_status === 'initiated_by_employer';

  // If I initiated, show waiting message
  if ((isCrew && initiatedByCrew) || (isEmployer && initiatedByEmployer)) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Waiting for the other party to confirm work has started</span>
      </div>
    );
  }

  // If the other party initiated, show confirm button
  const initiator = initiatedByCrew ? 'Crew' : 'Employer';
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle className="h-4 w-4 text-[var(--accent)]" />
        <span>{initiator} has confirmed that work has started.</span>
      </div>
      <Button size="sm" className="w-full" onClick={onConfirm} disabled={working}>
        {working ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle className="mr-1.5 h-4 w-4" />
        )}
        Confirm work started
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Postponement Banner
// ---------------------------------------------------------------------------

export function PostponementBanner({
  context,
  isCrew,
  responding,
  onRespond,
}: {
  context: EngagementContext;
  isCrew: boolean;
  responding: boolean;
  onRespond: (accepted: boolean) => void;
}) {
  if (isCrew) {
    return (
      <div className="flex flex-col gap-2 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-3">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-[var(--accent)]" />
          <span>
            Date change proposed: {context.proposed_start_date} to {context.proposed_end_date}
            {context.proposed_working_days &&
              ` (${context.proposed_working_days} working day${context.proposed_working_days !== 1 ? 's' : ''})`}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-destructive hover:text-destructive"
            onClick={() => onRespond(false)}
            disabled={responding}
          >
            Reject
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onRespond(true)}
            disabled={responding}
          >
            {responding ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-1.5 h-4 w-4" />
            )}
            Approve
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-3 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Waiting for crew to respond to your date change proposal</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cancellation Banner
// ---------------------------------------------------------------------------

const REASON_LABELS: Record<string, string> = {
  vessel_leaving: 'Vessel leaving port earlier than expected',
  crew_requirements_changed: 'Change in crew requirements',
  vessel_operational: 'Vessel operational issues',
  postponement: 'Date change rejected',
  personal_reasons: 'Personal circumstances changed',
  found_other_work: 'Accepted another job',
  unsafe_conditions: 'Safety or working condition concerns',
  other: 'Other',
};

export function CancellationBanner({
  context,
  canRate,
  isEmployer,
  relistingAfterRejection,
  respondingCrewCancel,
  onOpenRating,
  onRelistAfterRejection,
  onRespondCrewCancel,
}: {
  context: EngagementContext;
  canRate: boolean;
  isEmployer: boolean;
  relistingAfterRejection: boolean;
  respondingCrewCancel: boolean;
  onOpenRating: () => void;
  onRelistAfterRejection: () => void;
  onRespondCrewCancel: (action: 'relist' | 'cancel') => void;
}) {
  const reasonLabel = context.cancellation_reason_category
    ? context.cancellation_reason_category === 'other' && context.cancellation_reason_text
      ? context.cancellation_reason_text
      : (REASON_LABELS[context.cancellation_reason_category] ??
        context.cancellation_reason_category)
    : null;

  if (context.has_rated) {
    return <RatedBanner context={context} />;
  }

  const showRelistOption =
    isEmployer && context.postponement_status === 'rejected' && context.proposed_start_date;

  // Show relist/cancel prompt to employer when crew cancelled and daywork is still in_progress
  const showCrewCancelResponse =
    isEmployer && context.cancelled_by === 'crew' && !context.crew_cancel_responded;
  const startDatePassed = context.start_date < new Date().toISOString().split('T')[0];

  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <XCircle className="h-4 w-4 shrink-0" />
        <ExpandableText
          text={`This engagement was cancelled${reasonLabel ? `: ${reasonLabel}` : ''}`}
          maxLines={2}
          className="text-sm text-muted-foreground"
        />
      </div>
      {showCrewCancelResponse && (
        <div className="flex flex-col gap-2 rounded-lg border border-[var(--border-hi)] bg-[var(--accent-lo)] p-2.5">
          <p className="text-xs text-muted-foreground">
            {startDatePassed
              ? 'The crew member has cancelled and the original start date has passed. You can create a new posting with the same details.'
              : 'The crew member has cancelled. Would you like to relist this job for new applicants?'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={respondingCrewCancel}
              onClick={() => onRespondCrewCancel('cancel')}
            >
              No, cancel posting
            </Button>
            <Button
              size="sm"
              className="flex-1"
              disabled={respondingCrewCancel}
              onClick={() => onRespondCrewCancel('relist')}
            >
              {respondingCrewCancel ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-1.5 h-4 w-4" />
              )}
              {startDatePassed ? 'Create new posting' : 'Yes, relist'}
            </Button>
          </div>
        </div>
      )}
      {showRelistOption && (
        <div className="flex flex-col gap-2 rounded-lg border border-[var(--border-hi)] bg-[var(--accent-lo)] p-2.5">
          <p className="text-xs text-muted-foreground">
            Relist this job with the proposed dates ({context.proposed_start_date} to{' '}
            {context.proposed_end_date}
            {context.proposed_working_days
              ? `, ${context.proposed_working_days} working day${context.proposed_working_days !== 1 ? 's' : ''}`
              : ''}
            )?
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={relistingAfterRejection}
            onClick={onRelistAfterRejection}
          >
            {relistingAfterRejection ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Clock className="mr-1.5 h-4 w-4" />
            )}
            Relist with proposed dates
          </Button>
        </div>
      )}
      {canRate && (
        <Button variant="outline" size="sm" onClick={onOpenRating} className="w-full">
          <ClipboardCheck className="mr-1.5 h-4 w-4" />
          Rate this experience
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Completion Banner
// ---------------------------------------------------------------------------

export function CompletionBanner({
  context,
  userId,
  isCrew,
  isEmployer,
  canRate,
  confirming,
  onConfirm,
  onOpenRating,
}: {
  context: EngagementContext;
  userId: string | null;
  isCrew: boolean;
  isEmployer: boolean;
  canRate: boolean;
  confirming: boolean;
  onConfirm: (confirmed: boolean) => void;
  onOpenRating: () => void;
}) {
  if (isCrew && userId === context.crew_person_id && context.crew_completion_status === null) {
    return (
      <div className="flex flex-col gap-2 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-3">
        <p className="text-center text-sm text-muted-foreground">
          The employer has marked this daywork as completed. Please confirm or dispute.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 text-destructive hover:text-destructive"
            onClick={() => onConfirm(false)}
            disabled={confirming}
            size="sm"
          >
            <AlertTriangle className="mr-1.5 h-4 w-4" />
            Dispute
          </Button>
          <Button
            className="flex-1"
            onClick={() => onConfirm(true)}
            disabled={confirming}
            size="sm"
          >
            {confirming ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-1.5 h-4 w-4" />
            )}
            Confirm completed
          </Button>
        </div>
      </div>
    );
  }

  if (canRate) {
    return (
      <div className="flex items-center gap-2 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-3">
        <CompletionStatusLine context={context} />
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onOpenRating}>
          <ClipboardCheck className="mr-1.5 h-4 w-4" />
          Rate
        </Button>
      </div>
    );
  }

  if (context.has_rated) {
    return <RatedBanner context={context} />;
  }

  if (isEmployer && !context.crew_completion_status) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Waiting for crew to confirm completion</span>
      </div>
    );
  }

  if (context.crew_completion_status) {
    return (
      <div className="flex items-center justify-center rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-3">
        <CompletionStatusLine context={context} />
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function CompletionStatusLine({ context }: { context: EngagementContext }) {
  if (!context.crew_completion_status) return null;
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {context.crew_completion_status === 'confirmed' ? (
        <>
          <CheckCircle className="h-4 w-4 text-success" />
          <span>Completion confirmed by crew</span>
        </>
      ) : (
        <>
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span>Completion disputed by crew</span>
        </>
      )}
    </div>
  );
}

function RatedBanner({ context }: { context: EngagementContext }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex items-center justify-between">
        {context.status === 'completed' ? (
          <CompletionStatusLine context={context} />
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <XCircle className="h-4 w-4" />
            <span>Cancelled</span>
          </div>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <Star className="h-4 w-4 fill-[var(--accent)] text-[var(--accent)]" />
          <span>{expanded ? 'Hide rating' : 'View rating'}</span>
        </button>
      </div>
      {expanded && context.my_rating && <RatingSummary rating={context.my_rating} />}
    </div>
  );
}
