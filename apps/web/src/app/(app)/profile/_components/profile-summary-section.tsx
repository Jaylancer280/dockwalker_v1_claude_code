import { ChevronUp, ChevronDown } from 'lucide-react';
import { computeTotalExperience } from '@/lib/compute-total-experience';

interface Profile {
  person_id: string;
  display_name: string;
  identity_type: string;
  bio: string | null;
  primary_role_id: string | null;
  desired_role_id: string | null;
  certification_ids: string[];
  experience_bracket_id: string | null;
  vessel_size_exposure_ids: string[];
  location_port_id: string | null;
  location_city_id: string | null;
  avatar_url: string | null;
  agency_name: string | null;
  role_specialization_ids: string[];
  nationality_id: string | null;
  visa_ids: string[];
  languages: string[];
  nationalities: { id: string; name: string; flag_emoji: string } | null;
  deck_name: string | null;
  yacht_roles: { id: string; name: string; department: string } | null;
  desired_roles: { id: string; name: string } | null;
  experience_brackets: { id: string; label: string } | null;
  ports: {
    id: string;
    name: string;
    cities: { name: string; regions: { name: string } };
  } | null;
  location_cities: {
    id: string;
    name: string;
    regions: { name: string };
  } | null;
}

interface ExperienceEntry {
  id: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
}

interface ProfileSummarySectionProps {
  profile: Profile;
  experiences: ExperienceEntry[];
  expandedSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  sizeBandNames: Record<string, string>;
  onAddExperience: () => void;
  onEnterEdit: () => void;
}

export function ProfileSummarySection({
  profile,
  experiences,
  expandedSections,
  toggleSection,
  sizeBandNames,
  onAddExperience,
  onEnterEdit,
}: ProfileSummarySectionProps) {
  return (
    <>
      <button
        onClick={() => toggleSection('summary')}
        className="flex w-full items-center justify-between rounded-[14px] border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-left"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--tertiary)]">
            Summary
          </p>
          {!expandedSections.summary && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {profile.yacht_roles?.name
                ? `${profile.yacht_roles.name}${profile.experience_brackets?.label ? ` · ${profile.experience_brackets.label}` : ''}${experiences.length > 0 ? ` · ${computeTotalExperience(experiences)}` : ''}${(profile.location_cities?.name ?? profile.ports?.cities?.name) ? ` · ${profile.location_cities?.name ?? profile.ports?.cities?.name}` : ''}`
                : 'Tap to set up'}
            </p>
          )}
        </div>
        {expandedSections.summary ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {expandedSections.summary && (
        <div className="flex flex-col gap-3 px-4 pb-2">
          {profile.yacht_roles?.name ? (
            <div>
              <p className="text-xs text-muted-foreground">Current Role</p>
              <p className="text-sm font-medium">{profile.yacht_roles.name}</p>
            </div>
          ) : !profile.experience_brackets?.label && experiences.length === 0 ? (
            <button onClick={onAddExperience} className="text-left text-sm text-muted-foreground">
              Add your first experience to build your profile
            </button>
          ) : null}
          {profile.experience_brackets?.label && (
            <div>
              <p className="text-xs text-muted-foreground">
                Experience <span className="italic">(auto-derived)</span>
              </p>
              <p className="text-sm font-medium">
                {profile.experience_brackets.label}
                {experiences.length > 0 && ` (${computeTotalExperience(experiences)})`}
              </p>
            </div>
          )}
          {profile.vessel_size_exposure_ids?.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">
                Vessel Size Exposure <span className="italic">(auto-derived)</span>
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {profile.vessel_size_exposure_ids.map((sbId) => {
                  const sbLabel = sizeBandNames[sbId];
                  return (
                    <span
                      key={sbId}
                      className="rounded-full bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 text-xs"
                    >
                      {sbLabel ?? sbId.slice(0, 8)}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {profile.nationalities ? (
            <div>
              <p className="text-xs text-muted-foreground">Nationality</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-lg">{profile.nationalities.flag_emoji}</span>
                <span className="text-sm">{profile.nationalities.name}</span>
              </div>
            </div>
          ) : (
            <button
              onClick={onEnterEdit}
              className="flex items-center gap-2 text-sm text-muted-foreground border-l-2 border-muted pl-3 py-1"
            >
              Add your nationality — shown on your profile with your flag
            </button>
          )}
          {profile.location_cities?.name || profile.ports?.cities?.name ? (
            <div>
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="text-sm font-medium">
                {profile.location_cities?.name ?? profile.ports?.cities?.name}
                {(profile.location_cities?.regions?.name ?? profile.ports?.cities?.regions?.name) &&
                  `, ${profile.location_cities?.regions?.name ?? profile.ports?.cities?.regions?.name}`}
              </p>
            </div>
          ) : (
            <button
              onClick={onEnterEdit}
              className="flex items-center gap-2 text-sm text-muted-foreground border-l-2 border-muted pl-3 py-1"
            >
              Set your location — shown on your profile
            </button>
          )}
        </div>
      )}
    </>
  );
}
