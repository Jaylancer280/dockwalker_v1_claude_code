'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, X, MapPin, Ship, ChevronDown, ChevronUp, Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { languageLabel } from '@dockwalker/shared';
import { Avatar } from '@/components/avatar';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';
import { safeFetch } from '@/lib/safe-fetch';

interface CrewExperience {
  vessel_name: string | null;
  vessel_type: string | null;
  vessel_loa_meters: number | null;
  vessel_size_band: string | null;
  role: string | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  vessel_operation: string | null;
  flag_state: string | null;
  contract_type: string | null;
  contract_details: string | null;
  description: string | null;
}

interface CrewProfile {
  person_id: string;
  display_name: string;
  identity_type: 'crew';
  avatar_url: string | null;
  deck_name: string | null;
  bio: string | null;
  primary_role: { id: string; name: string; department: string } | null;
  desired_role: { id: string; name: string } | null;
  certifications: { id: string; name: string }[];
  experience_bracket: { id: string; label: string } | null;
  vessel_size_exposure: { id: string; label: string }[];
  nationality: { id: string; name: string; country_code: string; flag_emoji: string } | null;
  visas: { id: string; name: string }[];
  languages: string[];
  location: { port: string; city: string; region: string } | null;
  city_location: { city: string; region: string | null } | null;
  experiences: CrewExperience[];
  permanent_availability: string | null;
  notice_period_days: number | null;
}

interface EmployerProfile {
  person_id: string;
  display_name: string;
  identity_type: string;
  avatar_url: string | null;
  agency_name: string | null;
  role_specializations: { id: string; name: string }[];
  location: { port: string; city: string; region: string } | null;
  vessels: { name: string; vessel_type: string; loa_meters: number; size_band: string | null }[];
  active_posting_count: number;
  maritime_background?: {
    vessel_name: string | null;
    vessel_type: string | null;
    role: string | null;
    start_date: string;
    end_date: string | null;
    flag_state: string | null;
  }[];
}

type ProfileData = CrewProfile | EmployerProfile;

export function ProfileOverlay({
  personId,
  isOpen,
  onClose,
}: {
  personId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  useBodyScrollLock(isOpen);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await safeFetch<ProfileData>(`/api/profile/${personId}`);
      if (result.ok) {
        setProfile(result.data);
      } else {
        setError('Profile unavailable');
      }
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    if (isOpen) loadProfile();
  }, [isOpen, loadProfile]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 md:left-[var(--content-inset-left)]"
      style={{ bottom: 'calc(var(--nav-height, 4rem) + env(safe-area-inset-bottom))' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-3 mb-2 flex max-h-[calc(85vh-var(--nav-height,4rem))] w-full max-w-lg animate-in slide-in-from-bottom flex-col rounded-[14px] bg-background">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 rounded-t-[14px]">
          <h2 className="text-sm font-bold">Profile</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-3 py-12">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          )}

          {!loading &&
            !error &&
            profile &&
            (profile.identity_type === 'crew' ? (
              <CrewProfileView profile={profile as CrewProfile} />
            ) : (
              <EmployerProfileView profile={profile as EmployerProfile} />
            ))}
        </div>
      </div>
    </div>
  );
}

function CrewProfileView({ profile }: { profile: CrewProfile }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Avatar src={profile.avatar_url} name={profile.display_name} size="md" />
        <div>
          <p className="font-semibold flex items-center gap-1.5">
            {profile.display_name}
            {profile.nationality?.flag_emoji && <span>{profile.nationality.flag_emoji}</span>}
            {profile.primary_role && (
              <EpauletteBadge
                roleName={profile.primary_role.name}
                department={profile.primary_role.department}
                size="sm"
              />
            )}
          </p>
          {profile.deck_name && (
            <p className="text-sm text-muted-foreground italic">
              &ldquo;{profile.deck_name}&rdquo;
            </p>
          )}
          {profile.primary_role && (
            <p className="text-xs text-muted-foreground">{profile.primary_role.name}</p>
          )}
          {profile.desired_role && profile.desired_role.id !== profile.primary_role?.id && (
            <p className="text-xs text-muted-foreground">Seeking: {profile.desired_role.name}</p>
          )}
          <div className="mt-1">
            {profile.permanent_availability === 'immediate' ? (
              <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                Available now
              </Badge>
            ) : profile.permanent_availability === 'after_notice' ? (
              <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                After {profile.notice_period_days ?? '?'}d notice
              </Badge>
            ) : (
              <Badge variant="secondary">
                {profile.permanent_availability === 'not_looking'
                  ? 'Not looking'
                  : 'Status not set'}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Location */}
      {(profile.city_location || profile.location) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>
            {profile.city_location
              ? [profile.city_location.city, profile.city_location.region]
                  .filter(Boolean)
                  .join(', ')
              : [profile.location?.port, profile.location?.city, profile.location?.region]
                  .filter(Boolean)
                  .join(', ')}
          </span>
        </div>
      )}

      {/* Bio */}
      {profile.bio && <p className="text-sm">{profile.bio}</p>}

      {/* Experience bracket */}
      {profile.experience_bracket && (
        <div>
          <p className="text-xs text-muted-foreground">Experience</p>
          <p className="text-sm font-medium">{profile.experience_bracket.label}</p>
        </div>
      )}

      {/* Certifications */}
      {profile.certifications.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Certifications</p>
          <div className="flex flex-wrap gap-1">
            {profile.certifications.map((c) => (
              <span
                key={c.id}
                className="rounded-full bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 text-xs"
              >
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Vessel size exposure */}
      {profile.vessel_size_exposure.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Vessel Size Exposure</p>
          <div className="flex flex-wrap gap-1">
            {profile.vessel_size_exposure.map((s) => (
              <span
                key={s.id}
                className="rounded-full bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 text-xs"
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Visas */}
      {profile.visas.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Visas</p>
          <div className="flex flex-wrap gap-1">
            {profile.visas.map((v) => (
              <span
                key={v.id}
                className="rounded-full bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 text-xs"
              >
                {v.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {profile.languages.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Languages</p>
          <div className="flex flex-wrap gap-1">
            {profile.languages.map((code) => (
              <span
                key={code}
                className="rounded-full bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 text-xs"
              >
                {languageLabel(code)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Experience history */}
      {profile.experiences.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Experience
          </p>
          {profile.experiences.map((exp, idx) => {
            const isExpanded = expandedIdx === idx;
            const prefix = exp.vessel_type === 'sail' ? 'S/Y' : 'M/Y';
            const dateRange = formatDateRange(exp.start_date, exp.end_date, exp.is_current);
            return (
              <div key={idx} className="rounded-lg border border-border">
                <button
                  onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                  className="flex w-full items-center gap-3 p-3 text-left"
                >
                  <Ship className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {prefix} {exp.vessel_name ?? 'Unknown vessel'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {exp.role ?? 'Unknown role'} · {dateRange}
                    </p>
                  </div>
                  {exp.role && <EpauletteBadge roleName={exp.role} size="sm" />}
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  )}
                </button>
                {isExpanded && (
                  <div className="border-t border-border px-3 pb-3 pt-2">
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                      {exp.vessel_operation && (
                        <div>
                          <p className="text-[11px] text-muted-foreground">Operation</p>
                          <p className="capitalize">{exp.vessel_operation}</p>
                        </div>
                      )}
                      {exp.flag_state && (
                        <div>
                          <p className="text-[11px] text-muted-foreground">Flag state</p>
                          <p>{exp.flag_state}</p>
                        </div>
                      )}
                      {exp.vessel_size_band && (
                        <div>
                          <p className="text-[11px] text-muted-foreground">Size band</p>
                          <p>{exp.vessel_size_band}</p>
                        </div>
                      )}
                      {exp.contract_type && (
                        <div>
                          <p className="text-[11px] text-muted-foreground">Contract</p>
                          <p className="capitalize">
                            {exp.contract_type}
                            {exp.contract_details && ` — ${exp.contract_details}`}
                          </p>
                        </div>
                      )}
                    </div>
                    {exp.description && (
                      <p className="mt-2 text-sm text-muted-foreground">{exp.description}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmployerProfileView({ profile }: { profile: EmployerProfile }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Avatar src={profile.avatar_url} name={profile.display_name} size="md" />
        <div>
          <p className="font-semibold">{profile.display_name}</p>
          {profile.agency_name && (
            <p className="text-sm text-muted-foreground">{profile.agency_name}</p>
          )}
        </div>
      </div>

      {/* Location */}
      {profile.location && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>
            {[profile.location.port, profile.location.city, profile.location.region]
              .filter(Boolean)
              .join(', ')}
          </span>
        </div>
      )}

      {/* Role specializations */}
      {profile.role_specializations.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Role Specializations</p>
          <div className="flex flex-wrap gap-1">
            {profile.role_specializations.map((r) => (
              <span
                key={r.id}
                className="rounded-full bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 text-xs"
              >
                {r.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Vessels */}
      {profile.vessels.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Vessels
          </p>
          {profile.vessels.map((v, idx) => (
            <div key={idx} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Ship className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {v.vessel_type === 'sail' ? 'S/Y' : 'M/Y'} {v.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {v.loa_meters}m{v.size_band && ` · ${v.size_band}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Maritime Background — agent only */}
      {profile.maritime_background && profile.maritime_background.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Maritime Background
          </p>
          {profile.maritime_background.map((entry, idx) => (
            <div key={idx} className="rounded-lg border border-border p-2.5">
              <p className="text-sm font-medium">{entry.vessel_name ?? 'Vessel'}</p>
              <p className="text-xs text-muted-foreground">
                {entry.role ?? 'Role'} · {formatDateRange(entry.start_date, entry.end_date, false)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Active posting count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Briefcase className="h-3.5 w-3.5" />
        <span>
          {profile.active_posting_count} active posting
          {profile.active_posting_count !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

function formatDateRange(start: string, end: string | null, isCurrent: boolean): string {
  const fmt = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  };
  if (isCurrent) return `${fmt(start)} — Present`;
  if (!end) return fmt(start);
  return `${fmt(start)} — ${fmt(end)}`;
}
