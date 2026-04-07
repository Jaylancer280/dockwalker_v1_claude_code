'use client';

import Image from 'next/image';
import { MapPin, Briefcase, Award, Calendar, Users, Ship, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { getDepartmentImageSrc } from '@/lib/department-image';
import { currencySymbol } from '@dockwalker/shared';
import { languageLabel } from '@dockwalker/shared';
import { ShareJobButton } from '@/components/share-job-button';

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
  required_languages: string[];
  contract_type: string | null;
  description: string | null;
  meals: string[];
  positions_available: number;
  positions_filled: number;
  poster_name: string | null;
  poster_is_agent: boolean;
  poster_person_id: string | null;
}

interface PermanentJobCardProps {
  posting: PermanentPosting;
  onTap: () => void;
  onApply?: (postingId: string) => void;
  onPosterTap?: (personId: string) => void;
  crewCertIds?: string[];
  crewLangs?: string[];
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
  crewLangs,
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

  const bgSrc = getDepartmentImageSrc(posting.role_department, posting.id);

  return (
    <div
      className="relative cursor-pointer overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--card)]"
      onClick={onTap}
    >
      {/* Full-bleed department background — opacity controls how visible the image is */}
      <Image
        src={bgSrc}
        alt=""
        fill
        className="object-cover opacity-20 blur-[1px]"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
        loading="lazy"
      />

      {/* Card content */}
      <div className="relative p-4">
        {/* Header: role + epaulette + job ref */}
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold tracking-[-0.3px]">
              {posting.role_name ?? 'Unknown Role'}
            </span>
            {posting.role_name && <EpauletteBadge roleName={posting.role_name} size="sm" />}
          </div>
          <span className="font-mono text-[11px] text-[var(--tertiary)]">
            PM-{String(posting.job_number).padStart(5, '0')}
          </span>
          <ShareJobButton
            jobNumber={`PM-${String(posting.job_number).padStart(5, '0')}`}
            roleName={posting.role_name ?? 'Permanent'}
            location={posting.city_name ?? ''}
            rate={`${currencySymbol(posting.salary_currency)}${posting.salary_min.toLocaleString()}${posting.salary_period === 'annual' ? '/year' : '/month'}`}
          />
        </div>

        {/* Vessel */}
        <div className="mb-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Ship className="h-3.5 w-3.5" />
          <span>{vesselDisplay}</span>
          {posting.vessel_loa ? (
            <span className="text-xs">({posting.vessel_loa}m)</span>
          ) : posting.vessel_size_label ? (
            <span className="text-xs">({posting.vessel_size_label})</span>
          ) : null}
        </div>

        {/* Location */}
        <div className="mb-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>
            {[posting.port_name, posting.city_name, posting.region_name].filter(Boolean).join(', ')}
          </span>
        </div>

        {/* Salary */}
        <div className="mb-2 flex items-center gap-1.5 text-[13px]">
          <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-[17px] font-bold tracking-[-0.5px]">
            {formatSalary(
              posting.salary_min,
              posting.salary_max,
              posting.salary_currency,
              posting.salary_period,
            )}
          </span>
        </div>

        {/* Start date */}
        <div className="mb-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>Start: {formatStartDate(posting.start_date)}</span>
        </div>

        {/* Badges row */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {posting.contract_type && posting.contract_type !== 'permanent' && (
            <Badge variant="outline" className="capitalize">
              {posting.contract_type}
            </Badge>
          )}
          {posting.positions_available > 1 && (
            <Badge variant="outline">
              <Users className="mr-0.5 h-3 w-3" />
              {posting.positions_available} position{posting.positions_available !== 1 ? 's' : ''}
            </Badge>
          )}
          {posting.live_aboard && (
            <Badge variant="secondary" className="bg-[var(--success-lo)] text-[var(--success)]">
              Live aboard
            </Badge>
          )}
          {posting.meals?.length > 0 && (
            <Badge variant="outline" className="text-xs">
              Meals: {posting.meals.join(', ')}
            </Badge>
          )}
          {posting.experience_label && <Badge variant="outline">{posting.experience_label}</Badge>}
          {posting.cert_names.slice(0, 3).map((name, i) => {
            const certId = posting.required_certification_ids[i];
            const held = crewCertIds ? crewCertIds.includes(certId) : undefined;
            return (
              <Badge
                key={name}
                variant="outline"
                className={
                  held === true
                    ? 'border-transparent bg-[var(--success-lo)] text-[var(--success)] text-xs'
                    : held === false
                      ? 'border-transparent bg-[var(--warning-lo)] text-[var(--warning)] text-xs'
                      : 'text-xs'
                }
              >
                <Award className="mr-0.5 h-3 w-3" />
                {name}
              </Badge>
            );
          })}
          {posting.cert_names.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{posting.cert_names.length - 3} more
            </Badge>
          )}
          {(posting.required_languages ?? []).slice(0, 2).map((code) => {
            const held = crewLangs ? crewLangs.includes(code) : undefined;
            return (
              <Badge
                key={code}
                variant="outline"
                className={
                  held === true
                    ? 'border-transparent bg-[var(--success-lo)] text-[var(--success)] text-xs'
                    : held === false
                      ? 'border-transparent bg-[var(--warning-lo)] text-[var(--warning)] text-xs'
                      : 'text-xs'
                }
              >
                {languageLabel(code)}
              </Badge>
            );
          })}
          {(posting.required_languages ?? []).length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{posting.required_languages.length - 2} more
            </Badge>
          )}
        </div>

        {/* Shortlist info */}
        <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>Shortlist: up to {posting.shortlist_cap} candidates</span>
        </div>

        {/* Footer: poster + time */}
        <div className="flex items-center justify-between border-t border-[var(--border)] pt-3 text-xs text-muted-foreground">
          {posting.poster_name && (
            <button
              className="underline decoration-muted-foreground/40 hover:text-[var(--accent)]"
              onClick={(e) => {
                e.stopPropagation();
                if (posting.poster_person_id && onPosterTap) {
                  onPosterTap(posting.poster_person_id);
                }
              }}
            >
              <User className="mr-1 inline h-3 w-3" />
              Posted by {posting.poster_name}
              {posting.poster_is_agent && ' (Agent)'}
            </button>
          )}
          <span className="font-mono text-[11px] text-[var(--tertiary)]">
            {daysAgo(posting.created_at)}
          </span>
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
            <p className="mt-1 text-xs text-white/60">Requires: {missingCerts.join(', ')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
