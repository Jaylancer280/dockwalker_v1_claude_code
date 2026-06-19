'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  X,
  MapPin,
  Ship,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Flag,
  Users,
  MessageSquarePlus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FlagIcon } from '@/components/flag-icon';
import { languageLabel } from '@dockwalker/shared';
import { Avatar } from '@/components/avatar';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { ExpandableText } from '@/components/expandable-text';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';
import { safeFetch } from '@/lib/safe-fetch';
import { ReportDialog } from '@/components/report-dialog';
import { ContactReferenceDialog } from '@/components/references/contact-reference-dialog';

interface ReferenceRow {
  id: string;
  referee_person_id: string;
  claimed_referee_role: string;
  claimed_referee_name: string;
  comment: string | null;
  consented_at: string;
  comment_updated_at: string | null;
  referee_display_name: string | null;
  referee_role_id: string | null;
  referee_role_name: string | null;
  referee_role_department: string | null;
}

interface CrewExperience {
  id?: string;
  vessel_name: string | null;
  /** Set when vessel was renamed AFTER this experience — surfaces the
   *  name the user knew it as. Null when current name was already in
   *  effect during the experience window. */
  historical_vessel_name: string | null;
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
  references?: ReferenceRow[];
}

interface ShoreExperienceEntry {
  id: string;
  category_name: string | null;
  employer_name: string;
  job_title: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
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
  entry_rights: { id: string; name: string; category: string }[];
  languages: string[];
  location: { port: string; city: string; region: string } | null;
  city_location: { city: string; region: string | null } | null;
  experiences: CrewExperience[];
  shore_experiences?: ShoreExperienceEntry[];
  permanent_availability: string | null;
  notice_period_days: number | null;
  smoker: boolean | null;
  visible_tattoos: boolean | null;
}

interface EmployerProfile {
  person_id: string;
  display_name: string;
  identity_type: string;
  avatar_url: string | null;
  bio: string | null;
  deck_name: string | null;
  agency_name: string | null;
  role_specializations: { id: string; name: string }[];
  location: { port: string; city: string; region: string } | null;
  vessels: { name: string; vessel_type: string; loa_meters: number; size_band: string | null }[];
  active_posting_count: number;
  maritime_background?: {
    vessel_name: string | null;
    historical_vessel_name: string | null;
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

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [viewerHat, setViewerHat] = useState<'crew' | 'employer' | 'agent' | null>(null);
  const [nestedRefereeId, setNestedRefereeId] = useState<string | null>(null);
  const [contactDialogRef, setContactDialogRef] = useState<{
    referenceId: string;
    refereeName: string;
  } | null>(null);
  const canContactReferences = viewerHat === 'employer' || viewerHat === 'agent';
  const handleSelectReferee = useCallback((personId: string) => {
    setNestedRefereeId(personId);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    safeFetch<{ person?: { current_hat?: string } }>('/api/profile').then((r) => {
      if (r.ok) {
        const hat = r.data.person?.current_hat as 'crew' | 'employer' | 'agent' | undefined;
        if (hat) setViewerHat(hat);
      }
    });
  }, [isOpen]);

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
          <button
            onClick={onClose}
            aria-label="Close profile"
            className="text-muted-foreground hover:text-foreground"
          >
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
              <CrewProfileView
                profile={profile as CrewProfile}
                canContactReferences={canContactReferences}
                handleSelectReferee={handleSelectReferee}
                handleContactReference={(payload) => setContactDialogRef(payload)}
              />
            ) : profile.identity_type === 'agent' ? (
              <AgentProfileView profile={profile as EmployerProfile} />
            ) : (
              <EmployerProfileView profile={profile as EmployerProfile} />
            ))}

          {!loading && !error && profile && (
            <div className="mt-4 border-t border-[var(--border)] pt-3">
              <button
                type="button"
                onClick={() => setReportDialogOpen(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Flag className="h-3 w-3" />
                Report this user
              </button>
            </div>
          )}
        </div>
      </div>

      {profile && (
        <ReportDialog
          open={reportDialogOpen}
          onClose={() => setReportDialogOpen(false)}
          reportedPersonId={profile.person_id}
          reportedName={profile.display_name}
        />
      )}

      {nestedRefereeId && (
        <ProfileOverlay
          personId={nestedRefereeId}
          isOpen={true}
          onClose={() => setNestedRefereeId(null)}
        />
      )}

      {contactDialogRef && (
        <ContactReferenceDialog
          open={!!contactDialogRef}
          onOpenChange={(o) => !o && setContactDialogRef(null)}
          referenceId={contactDialogRef.referenceId}
          refereeDisplayName={contactDialogRef.refereeName}
        />
      )}
    </div>
  );
}

interface ReferenceRowListProps {
  references: ReferenceRow[];
  canContact: boolean;
  onSelectReferee: (personId: string) => void;
  onContactReference?: (ref: { referenceId: string; refereeName: string }) => void;
}

function ReferenceRowList({
  references,
  canContact,
  onSelectReferee,
  onContactReference,
}: ReferenceRowListProps) {
  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Users className="h-3 w-3" />
        References ({references.length})
      </p>
      <ul className="space-y-2">
        {references.map((ref) => {
          const displayName = ref.referee_display_name ?? ref.claimed_referee_name;
          const role = ref.referee_role_name ?? ref.claimed_referee_role;
          return (
            <li key={ref.id} className="rounded-lg border border-border bg-[var(--surface)] p-2">
              <button
                type="button"
                onClick={() => onSelectReferee(ref.referee_person_id)}
                className="flex w-full items-center gap-2 text-left"
              >
                {ref.referee_role_name && (
                  <EpauletteBadge
                    roleName={ref.referee_role_name}
                    department={ref.referee_role_department ?? undefined}
                    size="sm"
                  />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{role}</p>
                </div>
              </button>
              {ref.comment && (
                <>
                  <ExpandableText
                    text={`"${ref.comment}"`}
                    maxLines={3}
                    className="mt-2 text-sm italic text-muted-foreground"
                  />
                  {ref.comment_updated_at && ref.comment_updated_at !== ref.consented_at && (
                    <p
                      className="mt-1 text-[11px] text-muted-foreground"
                      title={`Edited ${new Date(ref.comment_updated_at).toLocaleString()}`}
                    >
                      Edited {formatEditedAt(ref.comment_updated_at)}
                    </p>
                  )}
                </>
              )}
              {canContact && onContactReference && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 gap-1 text-xs"
                  onClick={() =>
                    onContactReference({
                      referenceId: ref.id,
                      refereeName: displayName,
                    })
                  }
                >
                  <MessageSquarePlus className="h-3 w-3" />
                  Contact reference
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CrewProfileView({
  profile,
  canContactReferences,
  handleSelectReferee,
  handleContactReference,
}: {
  profile: CrewProfile;
  canContactReferences: boolean;
  handleSelectReferee: (personId: string) => void;
  handleContactReference: (payload: { referenceId: string; refereeName: string }) => void;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Avatar src={profile.avatar_url} name={profile.display_name} size="md" />
        <div>
          <p className="font-semibold flex items-center gap-1.5">
            {profile.display_name}
            {profile.nationality && (
              <FlagIcon
                code={profile.nationality.country_code}
                name={profile.nationality.name}
                emoji={profile.nationality.flag_emoji}
              />
            )}
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

      {/* Smoker / Tattoos */}
      {(profile.smoker != null || profile.visible_tattoos != null) && (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {profile.smoker != null && <span>{profile.smoker ? 'Smoker' : 'Non-smoker'}</span>}
          {profile.visible_tattoos != null && (
            <span>{profile.visible_tattoos ? 'Visible tattoos' : 'No visible tattoos'}</span>
          )}
        </div>
      )}

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

      {/* Entry rights */}
      {profile.entry_rights.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Entry rights</p>
          <div className="flex flex-wrap gap-1">
            {profile.entry_rights.map((v) => (
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
                  aria-expanded={isExpanded}
                  className="flex w-full items-center gap-3 p-3 text-left"
                >
                  <Ship className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium"
                      title={
                        exp.historical_vessel_name && exp.vessel_name
                          ? `Now ${prefix} ${exp.vessel_name}`
                          : undefined
                      }
                    >
                      {prefix} {exp.historical_vessel_name ?? exp.vessel_name ?? 'Unknown vessel'}
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
                    {exp.references && exp.references.length > 0 && (
                      <ReferenceRowList
                        references={exp.references}
                        canContact={canContactReferences}
                        onSelectReferee={handleSelectReferee}
                        onContactReference={handleContactReference}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Shore-based experience */}
      {profile.shore_experiences && profile.shore_experiences.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Shore-Based Experience
          </p>
          {profile.shore_experiences.map((se) => {
            const dateRange = formatDateRange(se.start_date, se.end_date, se.is_current);
            return (
              <div key={se.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <Briefcase className="h-4 w-4 flex-shrink-0 text-[var(--success)]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{se.employer_name}</p>
                      {se.category_name && (
                        <span className="shrink-0 rounded-full bg-[var(--success-lo)] px-2 py-0.5 text-[10px] font-medium text-[var(--success)]">
                          {se.category_name}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {se.job_title} · {dateRange}
                    </p>
                  </div>
                </div>
                {se.description && (
                  <p className="mt-2 text-sm text-muted-foreground">{se.description}</p>
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
              <p
                className="text-sm font-medium"
                title={
                  entry.historical_vessel_name && entry.vessel_name
                    ? `Now ${entry.vessel_name}`
                    : undefined
                }
              >
                {entry.historical_vessel_name ?? entry.vessel_name ?? 'Vessel'}
              </p>
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

function AgentProfileView({ profile }: { profile: EmployerProfile }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Avatar src={profile.avatar_url} name={profile.display_name} size="md" />
        <div>
          <p className="font-semibold">{profile.display_name}</p>
          {profile.deck_name && (
            <p className="text-xs text-muted-foreground">{profile.deck_name}</p>
          )}
          {profile.agency_name && (
            <p className="text-sm text-muted-foreground">{profile.agency_name}</p>
          )}
        </div>
      </div>

      {/* Bio */}
      {profile.bio && <p className="text-sm">{profile.bio}</p>}

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

      {/* Department specialisations */}
      {profile.role_specializations.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Department Specialisations
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profile.role_specializations.map((r) => (
              <span key={r.id} className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs">
                {r.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Active postings */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Briefcase className="h-3.5 w-3.5" />
        <span>
          {profile.active_posting_count} active posting
          {profile.active_posting_count !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Vessels */}
      {profile.vessels.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Vessels</p>
          <div className="flex flex-col gap-1.5">
            {profile.vessels.map((v, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <Ship className="h-3.5 w-3.5 text-muted-foreground" />
                <span>
                  {v.vessel_type === 'sail' ? 'S/Y' : 'M/Y'} {v.name}
                  {v.loa_meters ? ` — ${v.loa_meters}m` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Maritime background */}
      {profile.maritime_background && profile.maritime_background.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Maritime Background ({profile.maritime_background.length})
          </p>
          <div className="flex flex-col gap-1.5">
            {profile.maritime_background.map((entry, idx) => {
              const prefix = entry.vessel_type === 'sail' ? 'S/Y' : 'M/Y';
              return (
                <div key={idx} className="rounded-lg border border-border p-2.5">
                  <p
                    className="text-sm font-medium"
                    title={
                      entry.historical_vessel_name && entry.vessel_name
                        ? `Now ${prefix} ${entry.vessel_name}`
                        : undefined
                    }
                  >
                    {prefix} {entry.historical_vessel_name ?? entry.vessel_name ?? 'Vessel'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.role ?? 'Role'} ·{' '}
                    {formatDateRange(entry.start_date, entry.end_date, false)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
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

function formatEditedAt(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffMs = Date.now() - t;
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
