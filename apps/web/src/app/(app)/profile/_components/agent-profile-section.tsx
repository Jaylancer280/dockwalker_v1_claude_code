import { Ship, Plus, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { computeTotalExperience } from '@dockwalker/shared';

interface Profile {
  agency_name: string | null;
  role_specialization_ids: string[];
  ports: {
    id: string;
    name: string;
    cities: { name: string; regions: { name: string } };
  } | null;
}

interface ExperienceEntry {
  id: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  vessel_operation: string;
  vessels: {
    id: string;
    name: string;
  } | null;
  yacht_roles: { id: string; name: string; department: string } | null;
}

interface AgentProfileSectionProps {
  profile: Profile;
  experiences: ExperienceEntry[];
  expandedSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  onEnterEdit: () => void;
  onAddExperience: () => void;
  onNavigateVessels: () => void;
}

export function AgentProfileSection({
  profile,
  experiences,
  expandedSections,
  toggleSection,
  onEnterEdit,
  onAddExperience,
  onNavigateVessels,
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
                  ? `${profile.role_specialization_ids.length} specialization(s)`
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
              <p className="text-xs text-muted-foreground">Role Specializations</p>
              <p className="text-sm text-muted-foreground">
                {profile.role_specialization_ids.length} specialization(s)
              </p>
            </div>
          ) : (
            <button onClick={onEnterEdit} className="text-left text-sm text-muted-foreground">
              Add role specializations — shows which departments you place for
            </button>
          )}
        </div>
      )}

      {/* Maritime Background section */}
      <button
        onClick={() => toggleSection('maritime')}
        className="flex w-full items-center justify-between rounded-[14px] border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-medium">Maritime Background</p>
          {!expandedSections.maritime && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {experiences.length > 0
                ? `${experiences.length} entries · ${computeTotalExperience(experiences)}`
                : 'Share your maritime history'}
            </p>
          )}
        </div>
        {expandedSections.maritime ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {expandedSections.maritime && experiences.length === 0 && (
        <button
          onClick={onAddExperience}
          className="mx-4 rounded-lg border border-dashed border-border p-3 text-center text-sm text-muted-foreground"
        >
          Share your maritime history — helps candidates know you understand their world
        </button>
      )}
      {expandedSections.maritime && experiences.length > 0 && (
        <>
          <div className="flex items-center justify-between px-4">
            <Badge variant="secondary" className="text-[10px]">
              {computeTotalExperience(experiences)} total
            </Badge>
            <Button variant="ghost" size="sm" onClick={onAddExperience}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
          {experiences.map((exp) => (
            <div
              key={exp.id}
              className="mx-4 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{exp.vessels?.name ?? 'Unknown vessel'}</p>
                  <p className="text-xs text-muted-foreground">
                    {exp.yacht_roles?.name} · {formatDateRange(exp.start_date, exp.end_date, false)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

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

function formatDateRange(start: string, end: string | null, isCurrent: boolean): string {
  const fmt = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  };
  if (isCurrent) return `${fmt(start)} — Present`;
  if (!end) return fmt(start);
  return `${fmt(start)} — ${fmt(end)}`;
}
