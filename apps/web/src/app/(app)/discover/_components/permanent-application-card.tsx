'use client';

import { useState } from 'react';
import { MapPin, Briefcase, Ship } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { currencySymbol } from '@/lib/units';

interface PermanentApplicationPosting {
  job_number: number;
  start_date: string;
  salary_min: number;
  salary_max: number;
  salary_currency: string;
  salary_period: string;
  live_aboard: boolean;
  poster_person_id: string | null;
  poster_name: string | null;
  role_name: string | null;
  port_name: string | null;
  city_name: string | null;
  vessel_name: string | null;
  vessel_type: string | null;
}

export interface PermanentApplication {
  id: string;
  permanent_posting_id: string;
  status: string;
  message: string | null;
  rejection_reason: string | null;
  applied_at: string;
  type: 'permanent';
  posting: PermanentApplicationPosting | null;
}

interface PermanentApplicationCardProps {
  application: PermanentApplication;
  onWithdraw: (postingId: string) => void;
  onViewProfile?: (personId: string) => void;
  withdrawing?: boolean;
}

const STATUS_LABELS: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  applied: { label: 'Under review', variant: 'secondary' },
  shortlisted: { label: 'Shortlisted', variant: 'default' },
  selected: { label: 'Selected', variant: 'default' },
  not_selected: { label: 'Position filled', variant: 'outline' },
  rejected: { label: 'Position closed', variant: 'destructive' },
};

function formatSalary(min: number, max: number, currency: string, period: string) {
  const sym = currencySymbol(currency);
  const per = period === 'annual' ? '/yr' : '/mo';
  if (min === max) return `${sym}${min.toLocaleString()}${per}`;
  return `${sym}${min.toLocaleString()} - ${sym}${max.toLocaleString()}${per}`;
}

function formatStartDate(dateStr: string) {
  const d = new Date(dateStr);
  if (d <= new Date()) return 'ASAP';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function PermanentApplicationCard({
  application,
  onWithdraw,
  onViewProfile,
  withdrawing,
}: PermanentApplicationCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const p = application.posting;
  if (!p) return null;

  const statusInfo = STATUS_LABELS[application.status] ?? {
    label: application.status,
    variant: 'outline' as const,
  };
  const canWithdraw = ['applied', 'shortlisted', 'selected'].includes(application.status);
  const vesselPrefix = p.vessel_type === 'sail' ? 'S/Y' : p.vessel_type === 'motor' ? 'M/Y' : '';
  const vesselDisplay = p.vessel_name ? `${vesselPrefix} ${p.vessel_name}`.trim() : 'Unknown';

  return (
    <div className="rounded-xl border bg-card p-4">
      {/* Header: job ref + status */}
      <div className="mb-2 flex items-center justify-between">
        <Badge variant="outline" className="text-xs font-mono">
          PM-{String(p.job_number).padStart(5, '0')}
        </Badge>
        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
      </div>

      {/* Role + vessel */}
      <p className="text-sm font-semibold">{p.role_name ?? 'Unknown Role'}</p>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Ship className="h-3 w-3" />
        <span>{vesselDisplay}</span>
      </div>

      {/* Location */}
      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3" />
        <span>{[p.port_name, p.city_name].filter(Boolean).join(', ')}</span>
      </div>

      {/* Salary + start */}
      <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-primary">
        <Briefcase className="h-3 w-3" />
        <span>{formatSalary(p.salary_min, p.salary_max, p.salary_currency, p.salary_period)}</span>
        <span className="text-muted-foreground">· Start: {formatStartDate(p.start_date)}</span>
      </div>

      {/* Live aboard */}
      {p.live_aboard && (
        <Badge
          variant="secondary"
          className="mt-2 bg-[var(--success-lo)] text-[var(--success)] text-xs"
        >
          Live aboard
        </Badge>
      )}

      {/* Message preview */}
      {application.message && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground italic">
          &quot;{application.message}&quot;
        </p>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        {p.poster_name && (
          <button
            className="text-xs text-muted-foreground hover:text-primary hover:underline"
            onClick={() => {
              if (p.poster_person_id && onViewProfile) onViewProfile(p.poster_person_id);
            }}
          >
            Posted by {p.poster_name}
          </button>
        )}
        {canWithdraw && (
          <Button
            variant="outline"
            size="sm"
            disabled={withdrawing}
            onClick={() => {
              if (application.status === 'selected') {
                setConfirmOpen(true);
              } else {
                onWithdraw(application.permanent_posting_id);
              }
            }}
          >
            {withdrawing ? 'Withdrawing...' : 'Withdraw'}
          </Button>
        )}
      </div>

      {/* Confirmation dialog for selected withdrawal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw application?</DialogTitle>
            <DialogDescription>
              Withdrawing will close the conversation with the employer and return the posting to
              their shortlist. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={withdrawing}
              onClick={() => {
                setConfirmOpen(false);
                onWithdraw(application.permanent_posting_id);
              }}
            >
              Withdraw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
