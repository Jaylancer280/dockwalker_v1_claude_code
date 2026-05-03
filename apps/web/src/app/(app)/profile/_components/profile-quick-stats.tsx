import { Avatar } from '@/components/avatar';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { FlagIcon } from '@/components/flag-icon';
import { Badge } from '@/components/ui/badge';

interface Profile {
  display_name: string;
  avatar_url: string | null;
  nationality_id: string | null;
  nationalities: {
    id: string;
    name: string;
    country_code: string | null;
    flag_emoji: string;
  } | null;
  yacht_roles: { id: string; name: string; department: string } | null;
  location_port_id: string | null;
  location_city_id: string | null;
  location_cities: { id: string; name: string; regions: { name: string } } | null;
  ports: { id: string; name: string; cities: { name: string; regions: { name: string } } } | null;
  experience_brackets: { id: string; label: string } | null;
  bio: string | null;
  certification_ids: string[];
  primary_role_id: string | null;
}

interface ExperienceEntry {
  id: string;
}

interface ProfileQuickStatsProps {
  profile: Profile;
  experiences: ExperienceEntry[];
  permAvail: string | null;
  noticeDays: number | null;
}

export function ProfileQuickStats({
  profile,
  experiences,
  permAvail,
  noticeDays,
}: ProfileQuickStatsProps) {
  const cityName = profile.location_cities?.name ?? profile.ports?.cities?.name ?? null;
  const regionName =
    profile.location_cities?.regions?.name ?? profile.ports?.cities?.regions?.name ?? null;

  const completenessFields = [
    profile.nationality_id,
    profile.location_city_id ?? profile.location_port_id,
    profile.primary_role_id,
    profile.bio,
    profile.certification_ids?.length > 0 ? true : null,
    experiences.length > 0 ? true : null,
  ];
  const filled = completenessFields.filter(Boolean).length;
  const total = completenessFields.length;

  return (
    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar src={profile.avatar_url} name={profile.display_name} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-semibold">{profile.display_name}</p>
              {profile.nationalities && (
                <FlagIcon
                  code={profile.nationalities.country_code}
                  name={profile.nationalities.name}
                  emoji={profile.nationalities.flag_emoji}
                  className="text-sm"
                />
              )}
            </div>
            {profile.yacht_roles?.name && (
              <div className="mt-0.5 flex items-center gap-1.5">
                <p className="text-xs text-muted-foreground">{profile.yacht_roles.name}</p>
                <EpauletteBadge
                  roleName={profile.yacht_roles.name}
                  department={profile.yacht_roles.department}
                  size="sm"
                />
              </div>
            )}
          </div>
        </div>

        {cityName && (
          <div className="text-xs text-muted-foreground">
            {cityName}
            {regionName ? `, ${regionName}` : ''}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {permAvail === 'immediate' ? (
            <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-[10px]">
              Available now
            </Badge>
          ) : permAvail === 'after_notice' ? (
            <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 text-[10px]">
              After {noticeDays ?? '?'}d notice
            </Badge>
          ) : permAvail === 'not_looking' ? (
            <Badge variant="secondary" className="text-[10px]">
              Not looking
            </Badge>
          ) : null}
          {profile.experience_brackets && (
            <Badge variant="outline" className="text-[10px]">
              {profile.experience_brackets.label}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-[var(--border)]">
            <div
              className="h-1.5 rounded-full bg-[var(--accent)] transition-all"
              style={{ width: `${Math.round((filled / total) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">
            {filled}/{total} complete
          </span>
        </div>
      </div>
    </div>
  );
}
