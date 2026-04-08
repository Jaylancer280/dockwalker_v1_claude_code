'use client';

import { X, MapPin, Briefcase, Award, Calendar, Users, Ship } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExpandableText } from '@/components/expandable-text';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { ProfileOverlay } from '@/components/profile-overlay';
import { currencySymbol } from '@dockwalker/shared';
import { languageLabel } from '@dockwalker/shared';
import type { PermanentPosting } from './permanent-job-card';
import { useState } from 'react';

interface PermanentJobDetailProps {
  posting: PermanentPosting;
  onClose: () => void;
  onApply?: (postingId: string) => void;
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

function formatStartDate(dateStr: string) {
  const d = new Date(dateStr);
  if (d <= new Date()) return 'ASAP';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function PermanentJobDetail({
  posting,
  onClose,
  onApply,
  crewCertIds,
  crewLangs,
  applying,
}: PermanentJobDetailProps) {
  const [profilePersonId, setProfilePersonId] = useState<string | null>(null);

  const vesselPrefix =
    posting.vessel_type === 'sail' ? 'S/Y' : posting.vessel_type === 'motor' ? 'M/Y' : '';
  const vesselDisplay = posting.vessel_nda
    ? 'NDA Vessel'
    : `${vesselPrefix} ${posting.vessel_name ?? 'Unknown'}`.trim();

  return (
    <>
      <div className="fixed inset-0 z-60 flex flex-col bg-background md:left-[var(--content-inset-left)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-bold">PM-{String(posting.job_number).padStart(5, '0')}</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="page-width space-y-4">
            {/* Role */}
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-bold">{posting.role_name ?? 'Unknown Role'}</h3>
              {posting.role_name && <EpauletteBadge roleName={posting.role_name} size="md" />}
            </div>

            {/* Vessel */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Ship className="h-4 w-4" />
              <span>{vesselDisplay}</span>
              {posting.vessel_size_label && <span>({posting.vessel_size_label})</span>}
              {posting.vessel_loa && <span>{posting.vessel_loa}m</span>}
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>
                {[posting.port_name, posting.city_name, posting.region_name]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            </div>

            {/* Salary */}
            <div className="flex items-center gap-2 text-lg font-semibold text-primary">
              <Briefcase className="h-5 w-5" />
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
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Start: {formatStartDate(posting.start_date)}</span>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {posting.live_aboard && (
                <Badge variant="secondary" className="bg-[var(--success-lo)] text-[var(--success)]">
                  Live aboard
                </Badge>
              )}
              {posting.experience_label && (
                <Badge variant="outline">{posting.experience_label}</Badge>
              )}
            </div>

            {/* Certifications */}
            {posting.cert_names.length > 0 && (
              <div>
                <h4 className="mb-1 text-sm font-medium text-muted-foreground">
                  Required certifications
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {posting.cert_names.map((name, i) => {
                    const certId = posting.required_certification_ids[i];
                    const held = crewCertIds ? crewCertIds.includes(certId) : undefined;
                    return (
                      <Badge
                        key={name}
                        variant="outline"
                        className={
                          held === true
                            ? 'border-transparent bg-[var(--success-lo)] text-[var(--success)]'
                            : held === false
                              ? 'border-transparent bg-[var(--warning-lo)] text-[var(--warning)]'
                              : undefined
                        }
                      >
                        <Award className="mr-0.5 h-3 w-3" />
                        {name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {posting.required_languages?.length > 0 && (
              <div>
                <h4 className="mb-1 text-sm font-medium text-muted-foreground">Languages</h4>
                <div className="flex flex-wrap gap-1.5">
                  {posting.required_languages.map((code) => {
                    const held = crewLangs ? crewLangs.includes(code) : undefined;
                    return (
                      <Badge
                        key={code}
                        variant="outline"
                        className={
                          held === true
                            ? 'border-transparent bg-[var(--success-lo)] text-[var(--success)]'
                            : held === false
                              ? 'border-transparent bg-[var(--warning-lo)] text-[var(--warning)]'
                              : undefined
                        }
                      >
                        {languageLabel(code)}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Shortlist */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Shortlist: up to {posting.shortlist_cap} candidates</span>
            </div>

            {/* Notes */}
            {posting.notes && (
              <div>
                <h4 className="mb-1 text-sm font-medium text-muted-foreground">Notes</h4>
                <ExpandableText text={posting.notes} className="text-sm" />
              </div>
            )}

            {/* Posted by */}
            {posting.poster_name && (
              <button
                className="text-sm text-muted-foreground underline decoration-muted-foreground/40 hover:text-[var(--accent)]"
                onClick={() => {
                  if (posting.poster_person_id) setProfilePersonId(posting.poster_person_id);
                }}
              >
                Posted by {posting.poster_name}
                {posting.poster_is_agent && ' (Agent)'}
              </button>
            )}

            {/* Apply */}
            <Button
              className="w-full"
              disabled={
                applying ||
                (crewCertIds !== undefined &&
                  posting.required_certification_ids.some((id) => !crewCertIds.includes(id)))
              }
              onClick={() => onApply?.(posting.id)}
            >
              {applying ? 'Applying...' : 'Apply'}
            </Button>
          </div>
        </div>
      </div>

      {profilePersonId && (
        <ProfileOverlay
          personId={profilePersonId}
          isOpen={true}
          onClose={() => setProfilePersonId(null)}
        />
      )}
    </>
  );
}
