import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LocationPicker } from '@/components/location-picker';
import { HierarchicalPills, rolesToGroups, certsToGroups } from '@/components/hierarchical-pills';
import { LANGUAGES } from '@/lib/languages';

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

interface VisaItem {
  id: string;
  name: string;
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
  nationalityId: string;
  setNationalityId: (v: string) => void;
  visaIds: string[];
  setVisaIds: (v: string[]) => void;
  profileLanguages: string[];
  setProfileLanguages: (v: string[]) => void;
  // Agent fields
  agencyName: string;
  setAgencyName: (v: string) => void;
  roleSpecializationIds: string[];
  setRoleSpecializationIds: (v: string[]) => void;
  // Lookups
  roles: LookupItem[];
  certs: LookupItem[];
  nationalities: NationalityItem[];
  visaTypes: VisaItem[];
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
  nationalityId,
  setNationalityId,
  visaIds,
  setVisaIds,
  profileLanguages,
  setProfileLanguages,
  agencyName,
  setAgencyName,
  roleSpecializationIds,
  setRoleSpecializationIds,
  roles,
  certs,
  nationalities,
  visaTypes,
}: ProfileEditFormProps) {
  if (identityType === 'crew') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Display name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Name on deck</Label>
          <Input
            placeholder="What your crew calls you"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            maxLength={50}
          />
          <p className="text-xs text-muted-foreground">
            Optional &mdash; shown alongside your name
          </p>
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

        <div className="flex flex-col gap-1.5">
          <Label>Bio</Label>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell employers about yourself..."
            rows={3}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Certifications</Label>
          <HierarchicalPills
            groups={certsToGroups(
              certs.filter((c): c is typeof c & { category: string } => !!c.category),
            )}
            value={certificationIds}
            onValueChange={(v) => setCertificationIds(v as string[])}
            mode="multi"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Vessel Size Exposure</Label>
          <p className="text-xs text-muted-foreground">Auto-derived from your vessel experience</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Nationality</Label>
          <Select value={nationalityId} onValueChange={setNationalityId}>
            <SelectTrigger>
              <SelectValue placeholder="Select nationality" />
            </SelectTrigger>
            <SelectContent>
              {nationalities.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.flag_emoji} {n.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Visas</Label>
          <div className="flex flex-wrap gap-1.5">
            {visaTypes.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  visaIds.includes(v.id)
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent-lo)]'
                }`}
                onClick={() => toggleArrayItem(visaIds, v.id, setVisaIds)}
              >
                {v.name}
              </button>
            ))}
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
      </div>
    );
  }

  // Agent edit form
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>Display name</Label>
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Agency Name</Label>
        <Input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} />
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
        <Label>Role Specializations</Label>
        <HierarchicalPills
          groups={rolesToGroups(
            roles.filter((r): r is typeof r & { department: string } => !!r.department),
          )}
          value={roleSpecializationIds}
          onValueChange={(v) => setRoleSpecializationIds(v as string[])}
          mode="multi"
        />
      </div>
    </div>
  );
}
