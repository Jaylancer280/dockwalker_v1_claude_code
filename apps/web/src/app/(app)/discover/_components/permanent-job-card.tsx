'use client';

import { MapPin, Briefcase, Award, Calendar, Users, Ship } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { currencySymbol } from '@/lib/units';

export interface PermanentPosting {
  id: string;
  job_number: number;
  start_date: string;
  salary_min: number;
  salary_max: number;
  salary_currency: string;
  salary_period: string;
  live_aboard: boolean;
  shortlist_cap: number;
  notes: string | null;
  status: string;
  created_at: string;
  required_certification_ids: string[];
  experience_bracket_id: string | null;
  role_name: string | null;
  role_department: string | null;
  port_name: string | null;
  city_name: string | null;
  region_name: string | null;
  vessel_name: string | null;
  vessel_nda: boolean;
  vessel_type: string | null;
  vessel_size_label: string | null;
  vessel_loa: number | null;
  experience_label: string | null;
  cert_names: string[];
  poster_name: string | null;
  poster_person_id: string | null;
}

interface PermanentJobCardProps {
  posting: PermanentPosting;
  onTap: () => void;
  onApply?: (postingId: string) => void;
  onPosterTap?: (personId: string) => void;
  crewCertIds?: string[];
  applying?: boolean;
}

function formatSalary(min: number, max: number, currency: string, period: string) {
  const sym = currencySymbol(currency);
  const per = period === 'annual' ? '/year' : '/month';
  if (min === max) return `${sym}${min.toLocaleString()}${per}`;
  return `${sym}${min.toLocaleString()} - ${sym}${max.toLocaleString()}${per}`;
}

function daysAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return '1 day ago';
  return `${diff} days ago`;
}

function formatStartDate(dateStr: string) {
  const d = new Date(dateStr);
  if (d <= new Date()) return 'ASAP';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function PermanentJobCard({
  posting,
  onTap,
  onApply,
  onPosterTap,
  crewCertIds,
  applying,
}: PermanentJobCardProps) {
  const missingCerts = (() => {
    if (!crewCertIds || posting.required_certification_ids.length === 0) return [];
    const crewSet = new Set(crewCertIds);
    return posting.cert_names.filter((_, i) => !crewSet.has(posting.required_certification_ids[i]));
  })();
  const canApply = missingCerts.length === 0;
  const vesselPrefix =
    posting.vessel_type === 'sail' ? 'S/Y' : posting.vessel_type === 'motor' ? 'M/Y' : '';
  const vesselDisplay = posting.vessel_nda
    ? 'NDA Vessel'
    : `${vesselPrefix} ${posting.vessel_name ?? 'Unknown'}`.trim();

  return (
    <div
      className="cursor-pointer rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
      onClick={onTap}
    >
      {/* Header: role + epaulette + job ref */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">{posting.role_name ?? 'Unknown Role'}</span>
          {posting.role_name && <EpauletteBadge roleName={posting.role_name} size="sm" />}
        </div>
        <span className="text-xs text-muted-foreground">
          PM-{String(posting.job_number).padStart(5, '0')}
        </span>
      </div>

      {/* Vessel */}
      <div className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Ship className="h-3.5 w-3.5" />
        <span>{vesselDisplay}</span>
        {posting.vessel_loa ? (
          <span className="text-xs">({posting.vessel_loa}m)</span>
        ) : posting.vessel_size_label ? (
          <span className="text-xs">({posting.vessel_size_label})</span>
        ) : null}
      </div>

      {/* Location */}
      <div className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" />
        <span>
          {[posting.port_name, posting.city_name, posting.region_name].filter(Boolean).join(', ')}
        </span>
      </div>

      {/* Salary */}
      <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-primary">
        <Briefcase className="h-3.5 w-3.5" />
        <span>
          {formatSalary(
            posting.salary_min,
            posting.salary_max,
            posting.salary_currency,
            posting.salary_period,
          )}
        </span>
      </div>

      {/* Start date */}
      <div className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        <span>Start: {formatStartDate(posting.start_date)}</span>
      </div>

      {/* Badges row */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {posting.live_aboard && (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Live aboard
          </Badge>
        )}
        {posting.experience_label && <Badge variant="outline">{posting.experience_label}</Badge>}
        {posting.cert_names.map((name, i) => {
          const certId = posting.required_certification_ids[i];
          const held = crewCertIds ? crewCertIds.includes(certId) : undefined;
          return (
            <Badge
              key={name}
              variant="outline"
              className={
                held === true
                  ? 'border-transparent bg-emerald-100 text-emerald-800 text-xs dark:bg-emerald-900/30 dark:text-emerald-400'
                  : held === false
                    ? 'border-transparent bg-amber-100 text-amber-800 text-xs dark:bg-amber-900/30 dark:text-amber-400'
                    : 'text-xs'
              }
            >
              <Award className="mr-0.5 h-3 w-3" />
              {name}
            </Badge>
          );
        })}
      </div>

      {/* Shortlist info */}
      <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        <span>Shortlist: up to {posting.shortlist_cap} candidates</span>
      </div>

      {/* Footer: poster + time */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {posting.poster_name && (
          <button
            className="hover:text-primary hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              if (posting.poster_person_id && onPosterTap) {
                onPosterTap(posting.poster_person_id);
              }
            }}
          >
            Posted by {posting.poster_name}
          </button>
        )}
        <span>{daysAgo(posting.created_at)}</span>
      </div>

      {/* Apply button */}
      {canApply ? (
        <Button
          className="mt-3 w-full"
          disabled={applying}
          onClick={(e) => {
            e.stopPropagation();
            if (onApply) onApply(posting.id);
          }}
        >
          {applying ? 'Applying...' : 'Apply'}
        </Button>
      ) : (
        <div className="mt-3">
          <Button className="w-full" disabled>
            Missing certifications
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">Requires: {missingCerts.join(', ')}</p>
        </div>
      )}
    </div>
  );
}
