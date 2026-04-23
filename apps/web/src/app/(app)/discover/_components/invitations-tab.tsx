'use client';

import { MapPin, Calendar, DollarSign, Check, X, Loader2, Mail, User } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { LoadingSpinner } from '@/components/loading-spinner';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { currencySymbol } from '@dockwalker/shared';

export interface Invitation {
  id: string;
  daywork_id: string;
  employer_person_id: string;
  employer_name: string | null;
  created_at: string;
  daywork: {
    job_number: number;
    start_date: string;
    end_date: string;
    working_days: number;
    day_rate: number;
    currency: string;
    meals: string[];
    notes: string | null;
    daywork_status: string;
    role_name: string | null;
    role_department: string | null;
    port_name: string | null;
    city_name: string | null;
    region_name: string | null;
    experience_label: string | null;
    vessel_name: string | null;
    vessel_type: string | null;
    vessel_size_label: string | null;
  } | null;
}

interface InvitationsTabProps {
  invitations: Invitation[];
  loadingInvitations: boolean;
  respondingId: string | null;
  invitationError: string | null;
  onAccept: (inv: Invitation) => void;
  onDecline: (inv: Invitation) => void;
  onViewProfile: (personId: string) => void;
  onSwitchToBrowse: () => void;
}

export function InvitationsTab({
  invitations,
  loadingInvitations,
  respondingId,
  invitationError,
  onAccept,
  onDecline,
  onViewProfile,
  onSwitchToBrowse,
}: InvitationsTabProps) {
  return (
    <div className="page-width flex w-full flex-1 flex-col gap-3 px-4 py-4">
      {loadingInvitations && <LoadingSpinner size="md" text="Loading invitations..." />}

      {invitationError && <p className="text-center text-sm text-destructive">{invitationError}</p>}

      {!loadingInvitations && invitations.length === 0 && (
        <EmptyState
          icon={Mail}
          imageSrc="/images/empty-states/messages.jpg"
          title="No pending invitations"
          description="When employers invite you to daywork, invitations will appear here."
          action={
            <Button variant="outline" size="sm" onClick={onSwitchToBrowse}>
              Browse jobs
            </Button>
          }
        />
      )}

      {!loadingInvitations && invitations.length > 0 && (
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
          {invitations.map((inv) => (
            <InvitationCard
              key={inv.id}
              invitation={inv}
              responding={respondingId === inv.id}
              onAccept={() => onAccept(inv)}
              onDecline={() => onDecline(inv)}
              onViewProfile={onViewProfile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InvitationCard({
  invitation,
  responding,
  onAccept,
  onDecline,
  onViewProfile,
}: {
  invitation: Invitation;
  responding: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onViewProfile?: (personId: string) => void;
}) {
  const dw = invitation.daywork;
  if (!dw) return null;

  const symbol = currencySymbol(dw.currency);

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-4">
        {/* Invited by header */}
        <p className="text-xs font-medium text-[var(--accent)]">
          Invited by {invitation.employer_name ?? 'an employer'}
        </p>

        {/* Role + vessel */}
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
              {dw.vessel_size_label && ` · ${dw.vessel_size_label}`}
            </p>
          </div>
          {invitation.employer_person_id && (
            <button
              className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary"
              onClick={() => onViewProfile?.(invitation.employer_person_id)}
            >
              <User className="h-4 w-4" />
            </button>
          )}
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

        {/* Footer: job ref */}
        <p className="font-mono text-[11px] text-[var(--tertiary)]">
          DW-{String(dw.job_number).padStart(5, '0')}
        </p>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={responding}
            onClick={onDecline}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Decline
          </Button>
          <Button size="sm" className="flex-1" disabled={responding} onClick={onAccept}>
            {responding ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="mr-1 h-3.5 w-3.5" />
            )}
            Accept
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
