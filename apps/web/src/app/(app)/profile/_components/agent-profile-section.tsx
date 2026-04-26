import { Ship, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ExpandableText } from '@/components/expandable-text';
import { languageLabel } from '@dockwalker/shared';
import { ProfileExperienceSection } from './profile-experience-section';

interface Profile {
  agency_name: string | null;
  role_specialization_ids: string[];
  bio: string | null;
  deck_name: string | null;
  nationality_id: string | null;
  nationalities: { id: string; name: string; flag_emoji: string } | null;
  entry_right_ids: string[];
  languages: string[];
  ports: {
    id: string;
    name: string;
    cities: { name: string; regions: { name: string } };
  } | null;
}

interface ExperienceEntry {
  id: string;
  vessel_id: string;
  role_id: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  vessel_operation: string;
  flag_state: string | null;
  contract_type: string | null;
  contract_details: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  historical_vessel_name: string | null;
  vessels: {
    id: string;
    imo_number: string;
    name: string;
    vessel_type: string;
    size_band_id: string;
    loa_meters: number;
    vessel_size_bands: unknown;
  } | null;
  yacht_roles: { id: string; name: string; department: string } | null;
}

interface EntryRight {
  id: string;
  name: string;
  category: 'citizenship' | 'residence' | 'visa';
}

interface CityDisplay {
  id: string;
  name: string;
  region_name: string | null;
}

interface AgentProfileSectionProps {
  profile: Profile;
  experiences: ExperienceEntry[];
  entryRights: EntryRight[];
  placementCities: CityDisplay[];
  roles: { id: string; name: string; department?: string }[];
  expandedSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  onEnterEdit: () => void;
  onAddExperience: () => void;
  onEditExperience: (id: string) => void;
  onNavigateVessels: () => void;
  expandedExpId: string | null;
  setExpandedExpId: (id: string | null) => void;
  deletingExpId: string | null;
  confirmDeleteExpId: string | null;
  setConfirmDeleteExpId: (id: string | null) => void;
  handleDeleteExperience: (id: string) => Promise<void>;
}

export function AgentProfileSection({
  profile,
  experiences,
  entryRights,
  placementCities,
  roles,
  expandedSections,
  toggleSection,
  onEnterEdit,
  onAddExperience,
  onEditExperience,
  onNavigateVessels,
  expandedExpId,
  setExpandedExpId,
  deletingExpId,
  confirmDeleteExpId,
  setConfirmDeleteExpId,
  handleDeleteExperience,
}: AgentProfileSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => toggleSection('agencyInfo')}
        className="flex w-full items-center justify-between rounded-[14px] border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-medium">Agency Info</p>
          {!expandedSections.agencyInfo && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[
                profile.agency_name,
                profile.ports?.name,
                profile.role_specialization_ids?.length > 0
                  ? (() => {
                      const depts = new Set<string>();
                      for (const id of profile.role_specialization_ids) {
                        const role = roles.find((r) => r.id === id);
                        if (role?.department) {
                          for (const d of role.department.split('_')) depts.add(d);
                        }
                      }
                      return (
                        [...depts].sort().join(', ') ||
                        `${profile.role_specialization_ids.length} dept specialisation(s)`
                      );
                    })()
                  : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Tap to set up'}
            </p>
          )}
        </div>
        {expandedSections.agencyInfo ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {expandedSections.agencyInfo && (
        <div className="flex flex-col gap-3 px-4 pb-2">
          {profile.agency_name ? (
            <div>
              <p className="text-xs text-muted-foreground">Agency</p>
              <p className="text-sm font-medium">{profile.agency_name}</p>
            </div>
          ) : (
            <button onClick={onEnterEdit} className="text-left text-sm text-muted-foreground">
              Add your agency name — your commercial identity on DockWalker
            </button>
          )}
          {profile.ports?.name ? (
            <div>
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="text-sm font-medium">
                {profile.ports.name}, {profile.ports.cities?.name}
              </p>
            </div>
          ) : (
            <button onClick={onEnterEdit} className="text-left text-sm text-muted-foreground">
              Add your location — helps crew know where you&apos;re based
            </button>
          )}
          {profile.role_specialization_ids?.length > 0 ? (
            <div>
              <p className="text-xs text-muted-foreground">Department Specialisations</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(() => {
                  const depts = new Set<string>();
                  for (const id of profile.role_specialization_ids) {
                    const role = roles.find((r) => r.id === id);
                    if (role?.department) {
                      for (const d of role.department.split('_')) depts.add(d);
                    }
                  }
                  return [...depts].sort().map((d) => (
                    <Badge key={d} variant="outline" className="capitalize">
                      {d}
                    </Badge>
                  ));
                })()}
              </div>
            </div>
          ) : (
            <button onClick={onEnterEdit} className="text-left text-sm text-muted-foreground">
              Add department specialisations — shows which departments you place for
            </button>
          )}
          {profile.deck_name && (
            <div>
              <p className="text-xs text-muted-foreground">Nickname</p>
              <p className="text-sm font-medium">&ldquo;{profile.deck_name}&rdquo;</p>
            </div>
          )}
          {profile.bio ? (
            <div>
              <p className="text-xs text-muted-foreground">Bio</p>
              <ExpandableText text={profile.bio} className="text-sm" />
            </div>
          ) : (
            <button onClick={onEnterEdit} className="text-left text-sm text-muted-foreground">
              Add a short bio — helps crew understand your background
            </button>
          )}
          {profile.nationalities && (
            <div>
              <p className="text-xs text-muted-foreground">Nationality</p>
              <p className="text-sm font-medium">
                {profile.nationalities.flag_emoji} {profile.nationalities.name}
              </p>
            </div>
          )}
          {profile.languages?.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">Languages</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {profile.languages.map((code) => (
                  <Badge key={code} variant="outline">
                    {languageLabel(code)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {profile.entry_right_ids?.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">Entry rights</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {entryRights
                  .filter((e) => profile.entry_right_ids.includes(e.id))
                  .map((e) => (
                    <Badge key={e.id} variant="outline">
                      {e.name}
                    </Badge>
                  ))}
              </div>
            </div>
          )}
          {placementCities.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">Placement Locations</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {placementCities.map((c) => (
                  <Badge key={c.id} variant="outline">
                    {c.name}
                    {c.region_name ? `, ${c.region_name}` : ''}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Maritime Background — shared experience section */}
      <ProfileExperienceSection
        experiences={experiences}
        expandedSections={expandedSections}
        toggleSection={toggleSection}
        expandedExpId={expandedExpId}
        setExpandedExpId={setExpandedExpId}
        deletingExpId={deletingExpId}
        confirmDeleteExpId={confirmDeleteExpId}
        setConfirmDeleteExpId={setConfirmDeleteExpId}
        handleDeleteExperience={handleDeleteExperience}
        onAddExperience={onAddExperience}
        onEditExperience={onEditExperience}
      />

      {/* My Vessels section */}
      <button
        onClick={onNavigateVessels}
        className="flex w-full items-center justify-between rounded-[14px] border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Ship className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">My Vessels</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
