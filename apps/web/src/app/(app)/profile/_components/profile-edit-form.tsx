import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableNationalitySelect } from '@/components/searchable-nationality-select';
import { Checkbox } from '@/components/ui/checkbox';
import { LocationPicker } from '@/components/location-picker';
import { HierarchicalPills, rolesToGroups } from '@/components/hierarchical-pills';
import { CertificationPicker } from '@/components/certification-picker';
import { CitiesPicker } from '@/components/cities-picker';
import { EntryRightPicker } from '@/components/entry-right-picker';
import { LANGUAGES } from '@dockwalker/shared';

interface LookupItem {
  id: string;
  name: string;
  label?: string;
  department?: string;
  category?: string;
}

interface NationalityItem {
  id: string;
  name: string;
  flag_emoji: string;
}

interface ProfileEditFormProps {
  identityType: string;
  // Crew fields
  displayName: string;
  setDisplayName: (v: string) => void;
  bio: string;
  setBio: (v: string) => void;
  deckName: string;
  setDeckName: (v: string) => void;
  desiredRoleId: string;
  setDesiredRoleId: (v: string) => void;
  locationPortId: string;
  setLocationPortId: (v: string) => void;
  locationCityId: string;
  setLocationCityId: (v: string) => void;
  certificationIds: string[];
  setCertificationIds: (v: string[]) => void;
  nationalityIds: string[];
  setNationalityIds: (v: string[]) => void;
  entryRightIds: string[];
  setEntryRightIds: (v: string[]) => void;
  profileLanguages: string[];
  setProfileLanguages: (v: string[]) => void;
  smoker: boolean | null;
  setSmoker: (v: boolean | null) => void;
  visibleTattoos: boolean | null;
  setVisibleTattoos: (v: boolean | null) => void;
  // Agent fields
  agencyName: string;
  setAgencyName: (v: string) => void;
  roleSpecializationIds: string[];
  setRoleSpecializationIds: (v: string[]) => void;
  placementCityIds: string[];
  setPlacementCityIds: (v: string[]) => void;
  // Lookups
  roles: LookupItem[];
  nationalities: NationalityItem[];
}

function toggleArrayItem(arr: string[], item: string, setter: (v: string[]) => void) {
  setter(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
}

export function ProfileEditForm({
  identityType,
  displayName,
  setDisplayName,
  bio,
  setBio,
  deckName,
  setDeckName,
  desiredRoleId,
  setDesiredRoleId,
  locationPortId,
  setLocationPortId,
  locationCityId,
  setLocationCityId,
  certificationIds,
  setCertificationIds,
  nationalityIds,
  setNationalityIds,
  entryRightIds,
  setEntryRightIds,
  profileLanguages,
  setProfileLanguages,
  smoker,
  setSmoker,
  visibleTattoos,
  setVisibleTattoos,
  agencyName,
  setAgencyName,
  roleSpecializationIds,
  setRoleSpecializationIds,
  placementCityIds,
  setPlacementCityIds,
  roles,
  nationalities,
}: ProfileEditFormProps) {
  if (identityType === 'crew') {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deckName">Name on deck</Label>
            <Input
              id="deckName"
              placeholder="What your crew calls you"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              Optional &mdash; shown alongside your name
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Desired Role</Label>
          <HierarchicalPills
            groups={rolesToGroups(
              roles.filter((r): r is typeof r & { department: string } => !!r.department),
            )}
            value={desiredRoleId}
            onValueChange={(v) => setDesiredRoleId(v as string)}
            mode="single"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Where are you based?</Label>
            <LocationPicker
              mode="port-optional"
              value={locationCityId ? { cityId: locationCityId } : null}
              onValueChange={(v) => setLocationCityId(v.cityId ?? '')}
              placeholder="Select city"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Daywork port</Label>
            <LocationPicker
              mode="port-required"
              value={locationPortId ? { portId: locationPortId } : null}
              onValueChange={(v) => setLocationPortId(v.portId ?? '')}
              placeholder="Select port/marina"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell employers about yourself..."
            rows={3}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Certifications</Label>
          <CertificationPicker
            selectedIds={certificationIds}
            onChange={setCertificationIds}
            mode="profile"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Vessel Size Exposure</Label>
          <p className="text-xs text-muted-foreground">Auto-derived from your vessel experience</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Nationality</Label>
            <SearchableNationalitySelect
              value={nationalityIds}
              onChange={setNationalityIds}
              nationalities={nationalities}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Entry rights</Label>
            <EntryRightPicker selectedIds={entryRightIds} onChange={setEntryRightIds} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Languages</Label>
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  profileLanguages.includes(lang.code)
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent-lo)]'
                }`}
                onClick={() => toggleArrayItem(profileLanguages, lang.code, setProfileLanguages)}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={smoker === true} onCheckedChange={(v) => setSmoker(v === true)} />
            Smoker
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={visibleTattoos === true}
              onCheckedChange={(v) => setVisibleTattoos(v === true)}
            />
            Visible tattoos
          </label>
        </div>
      </div>
    );
  }

  // Agent edit form
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agentDisplayName">Display name</Label>
          <Input
            id="agentDisplayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agencyName">Agency Name</Label>
          <Input
            id="agencyName"
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agentNickname">
            Nickname <span className="text-xs text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="agentNickname"
            placeholder="What people in the industry call you"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value.slice(0, 50))}
            maxLength={50}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>
            Nationality <span className="text-xs text-muted-foreground">(optional)</span>
          </Label>
          <SearchableNationalitySelect
            value={nationalityIds}
            onChange={setNationalityIds}
            nationalities={nationalities}
            placeholder="Select nationality"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Location</Label>
        <LocationPicker
          mode="port-required"
          value={locationPortId ? { portId: locationPortId } : null}
          onValueChange={(v) => setLocationPortId(v.portId ?? '')}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>
          Bio <span className="text-xs text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell candidates about your agency and background..."
          rows={3}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Department Specialisations</Label>
        <HierarchicalPills
          groups={rolesToGroups(
            roles.filter((r): r is typeof r & { department: string } => !!r.department),
          )}
          value={roleSpecializationIds}
          onValueChange={(v) => setRoleSpecializationIds(v as string[])}
          mode="multi"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Languages</Label>
        <div className="flex flex-wrap gap-1.5">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                profileLanguages.includes(lang.code)
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent-lo)]'
              }`}
              onClick={() => toggleArrayItem(profileLanguages, lang.code, setProfileLanguages)}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Entry rights</Label>
        <EntryRightPicker selectedIds={entryRightIds} onChange={setEntryRightIds} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Placement Locations</Label>
        <p className="text-xs text-muted-foreground">Cities where you actively place crew</p>
        <CitiesPicker
          selectedIds={placementCityIds}
          onChange={setPlacementCityIds}
          placeholder="Search cities where you place crew…"
        />
      </div>
    </div>
  );
}
