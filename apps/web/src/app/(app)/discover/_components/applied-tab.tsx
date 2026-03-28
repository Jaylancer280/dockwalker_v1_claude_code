'use client';

import { useState } from 'react';
import { MapPin, Calendar, DollarSign, ClipboardList, X, Loader2, User } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { LoadingSpinner } from '@/components/loading-spinner';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { currencySymbol } from '@/lib/units';
import { PermanentApplicationCard } from './permanent-application-card';

export interface MyApplication {
  id: string;
  daywork_id?: string;
  permanent_posting_id?: string;
  type?: 'daywork' | 'permanent';
  status: string;
  message: string | null;
  applied_at: string;
  daywork?: {
    job_number: number;
    start_date: string;
    end_date: string;
    working_days: number;
    day_rate: number;
    currency: string;
    meals: string[];
    notes: string | null;
    daywork_status: string;
    poster_person_id: string | null;
    poster_name: string | null;
    role_name: string | null;
    role_department: string | null;
    port_name: string | null;
    city_name: string | null;
    region_name: string | null;
    experience_label: string | null;
    vessel_name: string | null;
    vessel_type: string | null;
    vessel_loa: number | null;
    vessel_size_label: string | null;
    positions_available: number | null;
    positions_filled: number | null;
    permanent_opportunity: boolean;
  } | null;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  applied: { label: 'Applied', className: 'bg-[var(--accent-lo)] text-[var(--accent)]' },
  viewed: {
    label: 'Under review',
    className: 'bg-[var(--warning-lo)] text-[var(--warning)]',
  },
  shortlisted: { label: 'Shortlisted', className: 'bg-[var(--success-lo)] text-[var(--success)]' },
};

interface AppliedTabProps {
  applications: MyApplication[];
  loadingApps: boolean;
  withdrawingId: string | null;
  onWithdraw: (dayworkId: string) => void;
  onPermanentWithdraw: (postingId: string) => void;
  onViewProfile: (personId: string) => void;
  onSwitchToBrowse: () => void;
  onRetry: () => void;
  appsError: string | null;
}

export function AppliedTab({
  applications,
  loadingApps,
  withdrawingId,
  onWithdraw,
  onPermanentWithdraw,
  onViewProfile,
  onSwitchToBrowse,
  onRetry,
  appsError,
}: AppliedTabProps) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-4 py-4">
      {loadingApps && <LoadingSpinner size="md" text="Loading applications..." />}

      {!loadingApps && applications.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title={appsError ? 'Something went wrong' : 'No pending applications'}
          description={appsError ?? 'Jobs you apply to will appear here.'}
          action={
            appsError ? (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={onSwitchToBrowse}>
                Browse jobs
              </Button>
            )
          }
        />
      )}

      {!loadingApps &&
        applications.map((app) =>
          app.type === 'permanent' ? (
            <PermanentApplicationCard
              key={app.id}
              application={app as import('./permanent-application-card').PermanentApplication}
              withdrawing={withdrawingId === app.permanent_posting_id}
              onWithdraw={(pid) => onPermanentWithdraw(pid)}
              onViewProfile={onViewProfile}
            />
          ) : (
            <ApplicationCard
              key={app.id}
              application={app}
              withdrawing={withdrawingId === app.daywork_id}
              onWithdraw={() => onWithdraw(app.daywork_id!)}
              onViewProfile={onViewProfile}
            />
          ),
        )}
    </div>
  );
}

function ApplicationCard({
  application,
  withdrawing,
  onWithdraw,
  onViewProfile,
}: {
  application: MyApplication;
  withdrawing: boolean;
  onWithdraw: () => void;
  onViewProfile?: (personId: string) => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const dw = application.daywork;
  if (!dw) return null;

  const statusInfo = STATUS_LABELS[application.status] ?? STATUS_LABELS.applied;
  const symbol = currencySymbol(dw.currency);
  const canWithdraw = ['applied', 'viewed', 'shortlisted'].includes(application.status);
  const isShortlisted = application.status === 'shortlisted';

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-4">
        {/* Header: role + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold tracking-[-0.3px] leading-tight flex items-center gap-1.5">
              {dw.role_name ?? 'Unknown role'}
              {dw.role_name && (
                <EpauletteBadge
                  roleName={dw.role_name}
                  department={dw.role_department ?? undefined}
                  size="sm"
                />
              )}
            </h3>
            <p className="text-[13px] text-muted-foreground">
              {dw.vessel_type ? (dw.vessel_type === 'sail' ? 'S/Y' : 'M/Y') + ' ' : ''}
              {dw.vessel_name ?? 'Unknown vessel'}
              {dw.vessel_loa
                ? ` · ${dw.vessel_loa}m`
                : dw.vessel_size_label
                  ? ` · ${dw.vessel_size_label}`
                  : ''}
            </p>
          </div>
          {dw.poster_person_id && (
            <button
              className="shrink-0 text-muted-foreground hover:text-primary"
              onClick={() => onViewProfile?.(dw.poster_person_id!)}
            >
              <User className="h-4 w-4" />
            </button>
          )}
          <Badge className={`shrink-0 text-[10px] ${statusInfo.className}`}>
            {statusInfo.label}
          </Badge>
        </div>

        {/* Details */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[13px]">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>
              {dw.port_name ?? 'Unknown'}
              {dw.city_name && `, ${dw.city_name}`}
              {dw.region_name && ` · ${dw.region_name}`}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[13px]">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>
              {dw.start_date} — {dw.end_date} ({dw.working_days} day
              {dw.working_days !== 1 ? 's' : ''})
            </span>
          </div>

          <div className="flex items-center gap-2 text-[13px]">
            <DollarSign className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>
              <span className="font-mono text-[17px] font-bold tracking-[-0.5px]">
                {symbol}
                {dw.day_rate}
              </span>
              <span className="text-[11px] font-medium text-[var(--muted-foreground)] opacity-60">
                /day
              </span>
            </span>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          {dw.positions_available && dw.positions_available > 1 && dw.positions_filled !== null && (
            <span className="rounded-full bg-[var(--accent-lo)] px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
              {dw.positions_available - dw.positions_filled}/{dw.positions_available} open
            </span>
          )}
          {dw.permanent_opportunity && (
            <Badge variant="outline" className="text-xs">
              Could go permanent
            </Badge>
          )}
        </div>

        {/* Application message preview */}
        {application.message && (
          <p className="rounded-md bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--foreground)] italic">
            &ldquo;{application.message}&rdquo;
          </p>
        )}

        {/* Footer: job ref + withdraw */}
        <div className="flex items-center justify-between pt-1">
          <span className="font-mono text-[11px] text-[var(--tertiary)]">
            DW-{String(dw.job_number).padStart(5, '0')} · Applied{' '}
            {new Date(application.applied_at).toLocaleDateString()}
          </span>
          {canWithdraw && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={withdrawing}
              onClick={() => setShowConfirm(true)}
            >
              {withdrawing ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <X className="mr-1 h-3 w-3" />
              )}
              Withdraw
            </Button>
          )}
        </div>
      </CardContent>

      {/* Withdraw confirmation dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw application?</DialogTitle>
            <DialogDescription>
              {isShortlisted && (
                <span className="mb-1 block font-medium text-foreground">
                  You&apos;ve been shortlisted for this position.
                </span>
              )}
              This will remove your application for{' '}
              <span className="font-medium text-foreground">{dw.role_name ?? 'this job'}</span>
              {dw.vessel_name && (
                <>
                  {' '}
                  on <span className="font-medium text-foreground">{dw.vessel_name}</span>
                </>
              )}
              . This job will not reappear in your browse feed — this action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Keep application
            </Button>
            <Button
              variant="destructive"
              disabled={withdrawing}
              onClick={() => {
                setShowConfirm(false);
                onWithdraw();
              }}
            >
              {withdrawing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Withdraw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
