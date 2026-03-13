'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Pencil, X, Check, Loader2, CalendarDays, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HatSwitcher } from '@/components/hat-switcher';
import { AvailabilityOverlay } from '@/components/availability-overlay';
import { LocationPicker } from '@/components/location-picker';
import { createClient } from '@/lib/supabase/client';

interface LookupItem {
  id: string;
  name: string;
  label?: string;
  department?: string;
  category?: string;
}

interface Profile {
  person_id: string;
  display_name: string;
  identity_type: string;
  bio: string | null;
  primary_role_id: string | null;
  certification_ids: string[];
  experience_bracket_id: string | null;
  vessel_size_exposure_ids: string[];
  location_port_id: string | null;
  agency_name: string | null;
  role_specialization_ids: string[];
  yacht_roles: { id: string; name: string } | null;
  experience_brackets: { id: string; label: string } | null;
  ports: { id: string; name: string; cities: { name: string; regions: { name: string } } } | null;
}

interface Person {
  id: string;
  identity_type: string;
  current_hat: string;
}

interface AvailabilityWindow {
  id: string;
  date: string;
  expires_at: string;
  city_id: string | null;
}

interface AvailabilityCity {
  id: string;
  name: string;
  region_name: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [person, setPerson] = useState<Person | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Availability state
  const [availWindows, setAvailWindows] = useState<AvailabilityWindow[]>([]);
  const [availCity, setAvailCity] = useState<AvailabilityCity | null>(null);
  const [availPort, setAvailPort] = useState<{ id: string; name: string } | null>(null);
  const [availStatus, setAvailStatus] = useState<'available' | 'not_available' | null>(null);
  const [showAvailOverlay, setShowAvailOverlay] = useState(false);

  // Edit form state
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [primaryRoleId, setPrimaryRoleId] = useState('');
  const [locationPortId, setLocationPortId] = useState('');
  const [experienceBracketId, setExperienceBracketId] = useState('');
  const [certificationIds, setCertificationIds] = useState<string[]>([]);
  const [vesselSizeExposureIds, setVesselSizeExposureIds] = useState<string[]>([]);
  const [agencyName, setAgencyName] = useState('');
  const [roleSpecializationIds, setRoleSpecializationIds] = useState<string[]>([]);

  // Lookups
  const [roles, setRoles] = useState<LookupItem[]>([]);
  const [certs, setCerts] = useState<LookupItem[]>([]);
  const [brackets, setBrackets] = useState<LookupItem[]>([]);
  const [sizeBands, setSizeBands] = useState<LookupItem[]>([]);

  const loadProfile = useCallback(async () => {
    const res = await fetch('/api/profile');
    const data = await res.json();
    if (data.person) setPerson(data.person);
    if (data.profile) setProfile(data.profile);
    setLoading(false);
  }, []);

  const loadAvailability = useCallback(async () => {
    const res = await fetch('/api/availability');
    if (res.ok) {
      const data = await res.json();
      setAvailWindows(data.windows ?? []);
      setAvailCity(data.city ?? null);
      setAvailPort(data.port ?? null);
      setAvailStatus(data.status ?? null);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (person?.identity_type === 'crew') {
      loadAvailability();
    }
  }, [person?.identity_type, loadAvailability]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Availability summary
  const availSummary = useMemo(() => {
    if (availWindows.length === 0) return null;
    const dates = availWindows.map((w) => w.date).sort();
    const earliest = new Date(
      availWindows.reduce((min, w) => (w.expires_at < min.expires_at ? w : min)).expires_at,
    );
    const now = new Date();
    const hoursLeft = Math.max(
      0,
      Math.round((earliest.getTime() - now.getTime()) / (1000 * 60 * 60)),
    );
    const daysLeft = Math.floor(hoursLeft / 24);
    const expiryText = daysLeft > 0 ? `${daysLeft}d left` : `${hoursLeft}h left`;

    return {
      dateRange:
        dates.length === 1
          ? formatShortDate(dates[0])
          : `${formatShortDate(dates[0])} - ${formatShortDate(dates[dates.length - 1])}`,
      count: dates.length,
      expiryText,
      cityName: availCity ? `${availCity.name}, ${availCity.region_name}` : null,
    };
  }, [availWindows, availCity]);

  function enterEdit() {
    if (!profile) return;
    setDisplayName(profile.display_name);
    setBio(profile.bio ?? '');
    setPrimaryRoleId(profile.primary_role_id ?? '');
    setLocationPortId(profile.location_port_id ?? '');
    setExperienceBracketId(profile.experience_bracket_id ?? '');
    setCertificationIds(profile.certification_ids ?? []);
    setVesselSizeExposureIds(profile.vessel_size_exposure_ids ?? []);
    setAgencyName(profile.agency_name ?? '');
    setRoleSpecializationIds(profile.role_specialization_ids ?? []);
    setEditing(true);

    // Load lookups for edit mode
    const supabase = createClient();
    Promise.all([
      supabase.from('yacht_roles').select('id, name, department').order('sort_order'),
      supabase.from('certifications').select('id, name, category').order('sort_order'),
      supabase.from('experience_brackets').select('id, label').order('sort_order'),
      supabase.from('vessel_size_bands').select('id, label').order('min_meters'),
    ]).then(([rolesRes, certsRes, bracketsRes, sizeBandsRes]) => {
      if (rolesRes.data) setRoles(rolesRes.data);
      if (certsRes.data) setCerts(certsRes.data);
      if (bracketsRes.data) setBrackets(bracketsRes.data.map((b) => ({ ...b, name: b.label })));
      if (sizeBandsRes.data) setSizeBands(sizeBandsRes.data.map((b) => ({ ...b, name: b.label })));
    });
  }

  async function handleSave() {
    setSaving(true);
    const body: Record<string, unknown> = {
      displayName,
      locationPortId: locationPortId || null,
    };

    if (profile?.identity_type === 'crew') {
      body.primaryRoleId = primaryRoleId || null;
      body.bio = bio || null;
      body.experienceBracketId = experienceBracketId || null;
      body.certificationIds = certificationIds;
      body.vesselSizeExposureIds = vesselSizeExposureIds;
    } else {
      body.agencyName = agencyName || null;
      body.roleSpecializationIds = roleSpecializationIds;
    }

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setEditing(false);
      await loadProfile();
    }
    setSaving(false);
  }

  function toggleArrayItem(arr: string[], item: string, setter: (v: string[]) => void) {
    setter(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
  }

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!person || !profile) return null;

  const initial = profile.display_name.charAt(0).toUpperCase();
  const isCrewHat = person.current_hat === 'crew';

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">Profile</h1>
          <div className="flex items-center gap-1">
            {!editing && (
              <Button variant="ghost" size="sm" onClick={enterEdit}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
            )}
            {editing && (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Check className="mr-1 h-3.5 w-3.5" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
            {!editing && (
              <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-6">
        {/* Avatar + Name */}
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
            {initial}
          </div>
          <div className="flex-1">
            {!editing ? (
              <>
                <p className="text-lg font-semibold">{profile.display_name}</p>
                <Badge variant="secondary" className="capitalize">
                  {profile.identity_type}
                </Badge>
              </>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label>Display name</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
            )}
          </div>
        </div>

        {/* Hat Switcher */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Current role:</span>
          <HatSwitcher currentHat={person.current_hat} identityType={person.identity_type} />
        </div>

        {/* Availability card — crew hat only, view mode only */}
        {profile.identity_type === 'crew' && isCrewHat && !editing && (
          <button
            onClick={() => setShowAvailOverlay(true)}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                availStatus === 'available'
                  ? 'bg-success/15 text-success'
                  : availStatus === 'not_available'
                    ? 'bg-destructive/15 text-destructive'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="flex-1">
              {availStatus === 'not_available' ? (
                <>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-destructive">Not available</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You have confirmed you are not available for daywork
                    {availCity ? ` \u00B7 ${availCity.name}, ${availCity.region_name}` : ''}
                  </p>
                </>
              ) : availSummary ? (
                <>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-success">Available</p>
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <Clock className="h-2.5 w-2.5" />
                      {availSummary.expiryText}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {availSummary.dateRange} ({availSummary.count} day
                    {availSummary.count !== 1 ? 's' : ''})
                    {availSummary.cityName && ` \u00B7 ${availSummary.cityName}`}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Availability not set</p>
                  <p className="text-xs text-muted-foreground">
                    Tap to set your availability dates and location
                  </p>
                </>
              )}
            </div>
          </button>
        )}

        <Separator />

        {/* Crew-specific fields */}
        {profile.identity_type === 'crew' && !editing && (
          <div className="flex flex-col gap-3">
            {profile.yacht_roles?.name && (
              <div>
                <p className="text-xs text-muted-foreground">Primary Role</p>
                <p className="text-sm font-medium">{profile.yacht_roles.name}</p>
              </div>
            )}
            {profile.experience_brackets?.label && (
              <div>
                <p className="text-xs text-muted-foreground">Experience</p>
                <p className="text-sm font-medium">{profile.experience_brackets.label}</p>
              </div>
            )}
            {profile.ports?.name && (
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="text-sm font-medium">
                  {profile.ports.name}, {profile.ports.cities?.name}
                </p>
              </div>
            )}
            {profile.bio && (
              <div>
                <p className="text-xs text-muted-foreground">Bio</p>
                <p className="text-sm">{profile.bio}</p>
              </div>
            )}
            {profile.certification_ids?.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">Certifications</p>
                <p className="text-sm text-muted-foreground">
                  {profile.certification_ids.length} certification(s)
                </p>
              </div>
            )}
            {profile.vessel_size_exposure_ids?.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">Vessel Size Exposure</p>
                <p className="text-sm text-muted-foreground">
                  {profile.vessel_size_exposure_ids.length} size band(s)
                </p>
              </div>
            )}
          </div>
        )}

        {/* Crew edit form */}
        {profile.identity_type === 'crew' && editing && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Primary Role</Label>
              <Select value={primaryRoleId} onValueChange={setPrimaryRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Experience</Label>
              <Select value={experienceBracketId} onValueChange={setExperienceBracketId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select experience" />
                </SelectTrigger>
                <SelectContent>
                  {brackets.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.label ?? b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <div className="max-h-40 overflow-y-auto rounded-md border border-border p-3">
                {certs.map((cert) => (
                  <label key={cert.id} className="flex items-center gap-2 py-1.5 text-sm">
                    <Checkbox
                      checked={certificationIds.includes(cert.id)}
                      onCheckedChange={() =>
                        toggleArrayItem(certificationIds, cert.id, setCertificationIds)
                      }
                    />
                    {cert.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Vessel Size Exposure</Label>
              <div className="flex flex-col gap-1 rounded-md border border-border p-3">
                {sizeBands.map((sb) => (
                  <label key={sb.id} className="flex items-center gap-2 py-1 text-sm">
                    <Checkbox
                      checked={vesselSizeExposureIds.includes(sb.id)}
                      onCheckedChange={() =>
                        toggleArrayItem(vesselSizeExposureIds, sb.id, setVesselSizeExposureIds)
                      }
                    />
                    {sb.label ?? sb.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Agent-specific fields */}
        {profile.identity_type === 'agent' && !editing && (
          <div className="flex flex-col gap-3">
            {profile.agency_name && (
              <div>
                <p className="text-xs text-muted-foreground">Agency</p>
                <p className="text-sm font-medium">{profile.agency_name}</p>
              </div>
            )}
            {profile.ports?.name && (
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="text-sm font-medium">
                  {profile.ports.name}, {profile.ports.cities?.name}
                </p>
              </div>
            )}
            {profile.role_specialization_ids?.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">Role Specializations</p>
                <p className="text-sm text-muted-foreground">
                  {profile.role_specialization_ids.length} specialization(s)
                </p>
              </div>
            )}
          </div>
        )}

        {/* Agent edit form */}
        {profile.identity_type === 'agent' && editing && (
          <div className="flex flex-col gap-4">
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
              <div className="max-h-40 overflow-y-auto rounded-md border border-border p-3">
                {roles.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 py-1.5 text-sm">
                    <Checkbox
                      checked={roleSpecializationIds.includes(r.id)}
                      onCheckedChange={() =>
                        toggleArrayItem(roleSpecializationIds, r.id, setRoleSpecializationIds)
                      }
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Availability overlay */}
      {showAvailOverlay && (
        <AvailabilityOverlay
          existingDates={availWindows.map((w) => w.date)}
          existingCityId={availCity?.id}
          existingPortId={availPort?.id}
          existingNotAvailable={availStatus === 'not_available'}
          onConfirm={() => {
            setShowAvailOverlay(false);
            loadAvailability();
          }}
          onCancel={() => setShowAvailOverlay(false)}
        />
      )}
    </main>
  );
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
