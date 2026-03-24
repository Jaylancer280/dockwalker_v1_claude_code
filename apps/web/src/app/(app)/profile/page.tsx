'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings,
  Pencil,
  X,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Ship,
  Briefcase,
  Eye,
} from 'lucide-react';
import { Avatar } from '@/components/avatar';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { AvatarUpload } from '@/components/avatar-upload';
import { NotificationBell } from '@/components/notification-bell';
import { useToast } from '@/hooks/use-toast';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HatSwitcher } from '@/components/hat-switcher';
import { AvailabilityOverlay } from '@/components/availability-overlay';
import { LocationPicker } from '@/components/location-picker';
import { RolePicker } from '@/components/role-picker';
import { ProfileOverlay } from '@/components/profile-overlay';
import { createClient } from '@/lib/supabase/client';
import { safeFetch } from '@/lib/safe-fetch';
import { computeTotalExperience } from '@/lib/compute-total-experience';
import { LANGUAGES, languageLabel } from '@/lib/languages';

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
  ports: { id: string; name: string; cities: { name: string; regions: { name: string } } } | null;
  location_cities: { id: string; name: string; regions: { name: string } } | null;
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

export default function ProfilePage() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [person, setPerson] = useState<Person | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Experience state
  const [experiences, setExperiences] = useState<ExperienceEntry[]>([]);
  const [expandedExpId, setExpandedExpId] = useState<string | null>(null);
  const [deletingExpId, setDeletingExpId] = useState<string | null>(null);
  const [confirmDeleteExpId, setConfirmDeleteExpId] = useState<string | null>(null);

  // Collapsible sections + preview
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem('dw_profile_sections');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('dw_profile_sections', JSON.stringify(expandedSections));
    } catch {
      /* ignore */
    }
  }, [expandedSections]);

  // Availability state
  const [availWindows, setAvailWindows] = useState<AvailabilityWindow[]>([]);
  const [availCity, setAvailCity] = useState<AvailabilityCity | null>(null);
  const [availPort, setAvailPort] = useState<{ id: string; name: string } | null>(null);
  const [availStatus, setAvailStatus] = useState<'available' | 'not_available' | null>(null);
  const [showAvailOverlay, setShowAvailOverlay] = useState(false);

  // Career status state
  const [permAvail, setPermAvail] = useState<string | null>(null);
  const [noticeDays, setNoticeDays] = useState<number | null>(null);
  const [employed, setEmployed] = useState(false);
  const [savingCareer, setSavingCareer] = useState(false);
  const [editingCareer, setEditingCareer] = useState(false);

  // Edit form state
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [desiredRoleId, setDesiredRoleId] = useState('');
  const [locationPortId, setLocationPortId] = useState('');
  const [locationCityId, setLocationCityId] = useState('');
  const [certificationIds, setCertificationIds] = useState<string[]>([]);
  const [agencyName, setAgencyName] = useState('');
  const [roleSpecializationIds, setRoleSpecializationIds] = useState<string[]>([]);
  const [nationalityId, setNationalityId] = useState('');
  const [visaIds, setVisaIds] = useState<string[]>([]);
  const [profileLanguages, setProfileLanguages] = useState<string[]>([]);
  const [deckName, setDeckName] = useState('');

  // Lookups
  const [roles, setRoles] = useState<LookupItem[]>([]);
  const [certs, setCerts] = useState<LookupItem[]>([]);
  const [nationalities, setNationalities] = useState<
    { id: string; name: string; flag_emoji: string }[]
  >([]);
  const [visaTypes, setVisaTypes] = useState<{ id: string; name: string }[]>([]);

  // Name maps for view-mode pills
  const [certNames, setCertNames] = useState<Record<string, string>>({});
  const [sizeBandNames, setSizeBandNames] = useState<Record<string, string>>({});

  const loadProfile = useCallback(async () => {
    try {
      const result = await safeFetch<{
        person?: Person;
        profile?: Profile & {
          desired_role_id?: string | null;
          desired_roles?: { id: string; name: string } | null;
          permanent_availability?: string;
          notice_period_days?: number;
          currently_employed?: boolean;
        };
      }>('/api/profile');
      if (result.ok) {
        if (result.data.person) setPerson(result.data.person);
        if (result.data.profile) {
          setProfile(result.data.profile);
          if (result.data.profile.nationality_id)
            setNationalityId(result.data.profile.nationality_id);
          if (result.data.profile.visa_ids) setVisaIds(result.data.profile.visa_ids);
          setDesiredRoleId(result.data.profile.desired_role_id ?? '');
          setPermAvail(result.data.profile.permanent_availability ?? null);
          setNoticeDays(result.data.profile.notice_period_days ?? null);
          setEmployed(result.data.profile.currently_employed ?? false);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadExperiences = useCallback(async () => {
    const result = await safeFetch<{ experiences?: ExperienceEntry[] }>('/api/experiences');
    if (result.ok) {
      setExperiences(result.data.experiences ?? []);
    }
  }, []);

  const loadAvailability = useCallback(async () => {
    const result = await safeFetch<{
      windows?: AvailabilityWindow[];
      city?: AvailabilityCity | null;
      port?: { id: string; name: string } | null;
      status?: 'available' | 'not_available' | null;
    }>('/api/availability');
    if (result.ok) {
      setAvailWindows(result.data.windows ?? []);
      setAvailCity(result.data.city ?? null);
      setAvailPort(result.data.port ?? null);
      setAvailStatus(result.data.status ?? null);
    }
  }, []);

  // Load cert and size band names for view-mode pills
  const loadLookupNames = useCallback(async (p: Profile) => {
    const supabase = createClient();
    // Load nationalities and visa types for view + edit modes
    const [natRes, visaRes] = await Promise.all([
      supabase.from('nationalities').select('id, name, flag_emoji').order('sort_order'),
      supabase.from('visa_types').select('id, name').order('sort_order'),
    ]);
    if (natRes.data) setNationalities(natRes.data);
    if (visaRes.data) setVisaTypes(visaRes.data);

    if (p.certification_ids?.length > 0) {
      const { data } = await supabase
        .from('certifications')
        .select('id, name')
        .in('id', p.certification_ids);
      if (data) {
        const map: Record<string, string> = {};
        for (const c of data) map[c.id] = c.name;
        setCertNames(map);
      }
    }
    if (p.vessel_size_exposure_ids?.length > 0) {
      const { data } = await supabase
        .from('vessel_size_bands')
        .select('id, label')
        .in('id', p.vessel_size_exposure_ids);
      if (data) {
        const map: Record<string, string> = {};
        for (const s of data) map[s.id] = s.label;
        setSizeBandNames(map);
      }
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (profile) loadLookupNames(profile);
  }, [profile, loadLookupNames]);

  useEffect(() => {
    if (person?.identity_type === 'crew') {
      loadAvailability();
      loadExperiences();
    }
  }, [person?.identity_type, loadAvailability, loadExperiences]);

  // Re-fetch profile + experiences when tab regains focus (handles stale data after navigation)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        loadProfile();
        if (person?.identity_type === 'crew') {
          loadExperiences();
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadProfile, loadExperiences, person?.identity_type]);

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
    // primary_role_id is auto-derived — not editable
    setDesiredRoleId(profile.desired_role_id ?? '');
    setLocationPortId(profile.location_port_id ?? '');
    setLocationCityId(profile.location_city_id ?? '');
    // experience_bracket_id is auto-derived — not editable
    setCertificationIds(profile.certification_ids ?? []);
    // vessel_size_exposure_ids is auto-derived — not editable
    setAgencyName(profile.agency_name ?? '');
    setRoleSpecializationIds(profile.role_specialization_ids ?? []);
    setNationalityId(profile.nationality_id ?? '');
    setVisaIds(profile.visa_ids ?? []);
    setProfileLanguages(profile.languages ?? []);
    setDeckName(profile.deck_name ?? '');
    setEditing(true);

    // Load lookups for edit mode
    const supabase = createClient();
    Promise.all([
      supabase.from('yacht_roles').select('id, name, department').order('sort_order'),
      supabase.from('certifications').select('id, name, category').order('sort_order'),
    ]).then(([rolesRes, certsRes]) => {
      if (rolesRes.data) setRoles(rolesRes.data);
      if (certsRes.data) setCerts(certsRes.data);
    });
  }

  async function handleSave() {
    setSaving(true);
    const body: Record<string, unknown> = {
      displayName,
      locationPortId: locationPortId || null,
      locationCityId: locationCityId || null,
    };

    if (profile?.identity_type === 'crew') {
      body.desiredRoleId = desiredRoleId || null;
      body.bio = bio || null;
      body.deckName = deckName || null;
      body.certificationIds = certificationIds;
      // vesselSizeExposureIds is auto-derived — not sent in PATCH
      body.nationalityId = nationalityId || null;
      body.visaIds = visaIds;
      body.languages = profileLanguages;
    } else {
      body.agencyName = agencyName || null;
      body.roleSpecializationIds = roleSpecializationIds;
    }

    const result = await safeFetch<{ error?: string }>('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (result.ok) {
      setEditing(false);
      await loadProfile();
      showSuccess('Profile updated');
    } else {
      showError(result.error);
    }
    setSaving(false);
  }

  async function handleDeleteExperience(expId: string) {
    setDeletingExpId(expId);
    const result = await safeFetch<{ error?: string }>(`/api/experiences/${expId}`, {
      method: 'DELETE',
    });
    if (result.ok) {
      setExperiences((prev) => prev.filter((e) => e.id !== expId));
      if (expandedExpId === expId) setExpandedExpId(null);
      showSuccess('Experience removed');
      // Re-fetch profile so auto-derived fields (bracket, role, size exposure) update
      loadProfile();
    } else {
      showError(result.error);
    }
    setDeletingExpId(null);
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

  const isCrewHat = person.current_hat === 'crew';

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight">Profile</h1>
            <NotificationBell />
          </div>
          <div className="flex items-center gap-1">
            {!editing && (
              <Button variant="ghost" size="icon" onClick={() => router.push('/vessels')}>
                <Ship className="h-4 w-4" />
              </Button>
            )}
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
        {editing && (
          <AvatarUpload
            currentUrl={profile.avatar_url}
            name={profile.display_name}
            onUploaded={(url) => {
              setProfile((prev) => (prev ? { ...prev, avatar_url: url } : prev));
            }}
          />
        )}
        <div className="flex items-center gap-4">
          {!editing && <Avatar src={profile.avatar_url} name={profile.display_name} size="lg" />}
          <div className="flex-1">
            {!editing ? (
              <>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold">{profile.display_name}</p>
                  {profile.identity_type === 'crew' && profile.nationalities?.flag_emoji && (
                    <span className="text-lg">{profile.nationalities.flag_emoji}</span>
                  )}
                  {profile.identity_type === 'crew' && profile.yacht_roles?.name && (
                    <EpauletteBadge
                      roleName={profile.yacht_roles.name}
                      department={profile.yacht_roles.department}
                      size="sm"
                    />
                  )}
                </div>
                {profile.identity_type === 'crew' && profile.deck_name && (
                  <p className="text-sm text-muted-foreground italic">
                    &ldquo;{profile.deck_name}&rdquo;
                  </p>
                )}
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {profile.identity_type}
                  </Badge>
                  <HatSwitcher
                    currentHat={person.current_hat}
                    identityType={person.identity_type}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label>Display name</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
            )}
          </div>
        </div>

        {/* Preview + quick actions */}
        {!editing && isCrewHat && (
          <Button
            variant="outline"
            size="sm"
            className="w-fit gap-2"
            onClick={() => setShowPreview(true)}
          >
            <Eye className="h-4 w-4" />
            How employers see you
          </Button>
        )}
        {!editing && !isCrewHat && (
          <Button
            variant="outline"
            className="w-fit gap-2"
            onClick={() => router.push('/daywork/mine')}
          >
            <Briefcase className="h-4 w-4" />
            My jobs
          </Button>
        )}

        <Separator />

        {/* Crew view mode — collapsible semantic sections */}
        {profile.identity_type === 'crew' && !editing && (
          <div className="flex flex-col gap-2">
            {/* Section 1: Summary */}
            <button
              onClick={() => setExpandedSections((s) => ({ ...s, summary: !s.summary }))}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                  <button
                    onClick={() => router.push('/profile/add-experience')}
                    className="text-left text-sm text-muted-foreground"
                  >
                    Add your first experience to build your profile
                  </button>
                ) : null}
                {profile.experience_brackets?.label && (
                  <div>
                    <p className="text-xs text-muted-foreground">Experience</p>
                    <p className="text-sm font-medium">
                      {profile.experience_brackets.label}
                      {experiences.length > 0 && ` (${computeTotalExperience(experiences)})`}
                    </p>
                  </div>
                )}
                {profile.vessel_size_exposure_ids?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Vessel Size Exposure</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {profile.vessel_size_exposure_ids.map((sbId) => {
                        const sbLabel = sizeBandNames[sbId];
                        return (
                          <span key={sbId} className="rounded-full bg-muted px-2 py-0.5 text-xs">
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
                    onClick={enterEdit}
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
                      {(profile.location_cities?.regions?.name ??
                        profile.ports?.cities?.regions?.name) &&
                        `, ${profile.location_cities?.regions?.name ?? profile.ports?.cities?.regions?.name}`}
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={enterEdit}
                    className="flex items-center gap-2 text-sm text-muted-foreground border-l-2 border-muted pl-3 py-1"
                  >
                    Set your location — shown on your profile
                  </button>
                )}
              </div>
            )}

            {/* Section 2: Looking for */}
            <button
              onClick={() => setExpandedSections((s) => ({ ...s, looking: !s.looking }))}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Looking for
                </p>
                {!expandedSections.looking && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[
                      profile.desired_roles?.name,
                      profile.ports ? `${profile.ports.cities?.name}` : null,
                      permAvail === 'immediate'
                        ? 'Available now'
                        : permAvail === 'after_notice'
                          ? 'After notice'
                          : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Not set'}
                  </p>
                )}
              </div>
              {expandedSections.looking ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {expandedSections.looking && (
              <div className="flex flex-col gap-3 px-4 pb-2">
                <div>
                  <p className="text-xs text-muted-foreground">Desired Role</p>
                  {profile.desired_roles?.name ? (
                    <p className="text-sm font-medium">{profile.desired_roles.name}</p>
                  ) : (
                    <button
                      onClick={enterEdit}
                      className="flex items-center gap-2 text-sm text-muted-foreground border-l-2 border-muted pl-3 py-1"
                    >
                      Set the role you&apos;re looking for — shown to employers on your profile
                    </button>
                  )}
                </div>
                {profile.ports?.name ? (
                  <div>
                    <p className="text-xs text-muted-foreground">Daywork port</p>
                    <p className="text-sm font-medium">
                      {profile.ports.name}, {profile.ports.cities?.name}
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={enterEdit}
                    className="flex items-center gap-2 text-sm text-muted-foreground border-l-2 border-muted pl-3 py-1"
                  >
                    Set your daywork port — helps employers find local crew
                  </button>
                )}
                {/* Career status — visible for crew and employer hats */}
                {profile.identity_type === 'crew' && (
                  <div>
                    <p className="text-xs text-muted-foreground">Career status</p>
                    {!editingCareer ? (
                      <div className="flex items-center gap-1.5">
                        {permAvail === 'immediate' ? (
                          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                            Available immediately
                          </p>
                        ) : permAvail === 'after_notice' ? (
                          <p className="text-sm font-medium">
                            Available after {noticeDays ?? 30} days notice
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Not open to permanent roles
                          </p>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setEditingCareer(true)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-1 space-y-3">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={permAvail !== null}
                            onChange={async (e) => {
                              const val = e.target.checked ? 'immediate' : null;
                              setPermAvail(val);
                              setSavingCareer(true);
                              const result = await safeFetch('/api/profile', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  permanentAvailability: val,
                                  noticePeriodDays: val === null ? null : noticeDays,
                                  currentlyEmployed: val === null ? false : employed,
                                }),
                              });
                              if (result.ok) showSuccess('Career status updated');
                              else showError('Failed to update');
                              setSavingCareer(false);
                            }}
                            className="h-4 w-4 rounded border-border"
                          />
                          <span className="text-sm">Open to permanent opportunities</span>
                        </label>
                        {permAvail !== null && (
                          <div className="ml-6 space-y-2">
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="permAvail"
                                checked={permAvail === 'immediate'}
                                onChange={async () => {
                                  setPermAvail('immediate');
                                  setSavingCareer(true);
                                  const result = await safeFetch('/api/profile', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ permanentAvailability: 'immediate' }),
                                  });
                                  if (result.ok) showSuccess('Updated');
                                  else showError('Failed');
                                  setSavingCareer(false);
                                }}
                                className="h-4 w-4"
                              />
                              <span className="text-sm">Available immediately</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="permAvail"
                                checked={permAvail === 'after_notice'}
                                onChange={async () => {
                                  setPermAvail('after_notice');
                                  setSavingCareer(true);
                                  const result = await safeFetch('/api/profile', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      permanentAvailability: 'after_notice',
                                      noticePeriodDays: noticeDays || 30,
                                    }),
                                  });
                                  if (result.ok) {
                                    showSuccess('Updated');
                                    if (!noticeDays) setNoticeDays(30);
                                  } else showError('Failed');
                                  setSavingCareer(false);
                                }}
                                className="h-4 w-4"
                              />
                              <span className="text-sm">After notice period</span>
                            </label>
                            {permAvail === 'after_notice' && (
                              <div className="ml-6 flex items-center gap-2">
                                <input
                                  type="number"
                                  value={noticeDays ?? ''}
                                  onChange={(e) =>
                                    setNoticeDays(parseInt(e.target.value, 10) || null)
                                  }
                                  onBlur={async () => {
                                    if (noticeDays && noticeDays > 0) {
                                      const result = await safeFetch('/api/profile', {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ noticePeriodDays: noticeDays }),
                                      });
                                      if (result.ok) showSuccess('Updated');
                                    }
                                  }}
                                  className="w-20 rounded border bg-background px-2 py-1 text-sm"
                                  min={1}
                                />
                                <span className="text-xs text-muted-foreground">days</span>
                              </div>
                            )}
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={employed}
                                onChange={async (e) => {
                                  setEmployed(e.target.checked);
                                  const result = await safeFetch('/api/profile', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ currentlyEmployed: e.target.checked }),
                                  });
                                  if (result.ok) showSuccess('Updated');
                                }}
                                className="h-4 w-4 rounded border-border"
                              />
                              <span className="text-sm">Currently employed</span>
                            </label>
                          </div>
                        )}
                        {savingCareer && <p className="text-xs text-muted-foreground">Saving...</p>}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1"
                          onClick={() => setEditingCareer(false)}
                        >
                          <Check className="mr-1 h-3.5 w-3.5" /> Done
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {/* Daywork availability */}
                {isCrewHat && (
                  <div>
                    <p className="text-xs text-muted-foreground">Daywork availability</p>
                    <button
                      onClick={() => setShowAvailOverlay(true)}
                      className="flex items-center gap-1.5 text-sm"
                    >
                      {availStatus === 'available' && availSummary ? (
                        <>
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            Available
                          </span>
                          <span className="text-muted-foreground">
                            &middot; {availSummary.dateRange}
                          </span>
                          {availSummary.cityName && (
                            <span className="text-muted-foreground">
                              &middot; {availSummary.cityName}
                            </span>
                          )}
                        </>
                      ) : availStatus === 'not_available' ? (
                        <>
                          <span className="inline-block h-2 w-2 rounded-full bg-destructive flex-shrink-0" />
                          <span className="font-medium text-destructive">Not available</span>
                        </>
                      ) : (
                        <>
                          <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                          <span className="text-muted-foreground">Not set — tap to set</span>
                        </>
                      )}
                      <Pencil className="ml-1 h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Section 3: About */}
            <button
              onClick={() => setExpandedSections((s) => ({ ...s, about: !s.about }))}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  About
                </p>
                {!expandedSections.about && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[
                      profile.deck_name ? `"${profile.deck_name}"` : null,
                      profile.certification_ids?.length > 0
                        ? `${profile.certification_ids.length} certs`
                        : null,
                      visaIds.length > 0 ? `${visaIds.length} visas` : null,
                      profile.languages?.length > 0
                        ? `${profile.languages.length} languages`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Add your details'}
                  </p>
                )}
              </div>
              {expandedSections.about ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {expandedSections.about && (
              <div className="flex flex-col gap-3 px-4 pb-2">
                <div>
                  <p className="text-xs text-muted-foreground">Deck Name</p>
                  {profile.deck_name ? (
                    <p className="text-sm font-medium">&ldquo;{profile.deck_name}&rdquo;</p>
                  ) : (
                    <button
                      onClick={enterEdit}
                      className="flex items-center gap-2 text-sm text-muted-foreground border-l-2 border-muted pl-3 py-1"
                    >
                      What does your crew call you? Shown alongside your name on the app
                    </button>
                  )}
                </div>
                {profile.bio ? (
                  <div>
                    <p className="text-xs text-muted-foreground">Bio</p>
                    <p className="text-sm">{profile.bio}</p>
                  </div>
                ) : (
                  <button
                    onClick={enterEdit}
                    className="flex items-center gap-2 text-sm text-muted-foreground border-l-2 border-muted pl-3 py-1"
                  >
                    Add a short bio — it&apos;s the first thing employers read when reviewing
                    applicants
                  </button>
                )}
                {profile.certification_ids?.length > 0 ? (
                  <div>
                    <p className="text-xs text-muted-foreground">Certifications</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {profile.certification_ids.map((certId) => {
                        const cn = certNames[certId];
                        return (
                          <span key={certId} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                            {cn ?? certId.slice(0, 8)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={enterEdit}
                    className="flex items-center gap-2 text-sm text-muted-foreground border-l-2 border-muted pl-3 py-1"
                  >
                    Add your certifications — employers check these against job requirements
                  </button>
                )}
                {visaIds.length > 0 ? (
                  <div>
                    <p className="text-xs text-muted-foreground">Visas</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {visaTypes
                        .filter((v) => visaIds.includes(v.id))
                        .map((v) => (
                          <Badge key={v.id} variant="outline">
                            {v.name}
                          </Badge>
                        ))}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={enterEdit}
                    className="flex items-center gap-2 text-sm text-muted-foreground border-l-2 border-muted pl-3 py-1"
                  >
                    Add visa info — helps employers in regulated ports find qualified crew faster
                  </button>
                )}
                {profile.languages?.length > 0 ? (
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
                ) : (
                  <button
                    onClick={enterEdit}
                    className="flex items-center gap-2 text-sm text-muted-foreground border-l-2 border-muted pl-3 py-1"
                  >
                    Add your languages — helps employers find crew who speak their guests&apos;
                    languages
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Section 4: Experience history — crew view mode */}
        {profile.identity_type === 'crew' && !editing && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setExpandedSections((s) => ({ ...s, experience: !s.experience }))}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Experience
                </p>
                {!expandedSections.experience && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {experiences.length > 0
                      ? `${experiences.length} entries · ${computeTotalExperience(experiences)}`
                      : 'No experience added'}
                  </p>
                )}
              </div>
              {expandedSections.experience ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {expandedSections.experience && experiences.length === 0 && (
              <button
                onClick={() => router.push('/profile/add-experience')}
                className="flex items-center gap-2 px-4 text-sm text-muted-foreground border-l-2 border-muted pl-3 py-1"
              >
                Add your vessel experience — it auto-derives your role, experience level, and vessel
                size exposure
              </button>
            )}
            {expandedSections.experience && experiences.length > 0 && (
              <>
                <div className="flex items-center justify-between px-4">
                  <Badge variant="secondary" className="text-[10px]">
                    {computeTotalExperience(experiences)} total
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => router.push('/profile/add-experience')}
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </Button>
                </div>

                {experiences.map((exp, idx) => {
                  const isExpanded = expandedExpId === exp.id || idx === 0;
                  const dateRange = formatDateRange(exp.start_date, exp.end_date, exp.is_current);

                  return (
                    <div key={exp.id} className="rounded-lg border border-border bg-card">
                      <button
                        onClick={() => setExpandedExpId(isExpanded && idx !== 0 ? null : exp.id)}
                        className="flex w-full items-center gap-3 p-3 text-left"
                      >
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Ship className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {exp.vessels?.vessel_type === 'sail' ? 'S/Y' : 'M/Y'}{' '}
                              {exp.vessels?.name ?? 'Unknown vessel'}
                            </p>
                            <Badge variant="outline" className="text-[10px] flex-shrink-0">
                              {exp.vessel_operation}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {exp.yacht_roles?.name ?? 'Unknown role'} · {dateRange}
                          </p>
                        </div>
                        {exp.yacht_roles?.name && (
                          <EpauletteBadge
                            roleName={exp.yacht_roles.name}
                            department={exp.yacht_roles?.department}
                            size="md"
                          />
                        )}
                        {idx !== 0 &&
                          (isExpanded ? (
                            <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          ))}
                      </button>

                      {isExpanded && (
                        <div className="border-t border-border px-3 pb-3 pt-2">
                          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                            {exp.flag_state && (
                              <div>
                                <p className="text-[11px] text-muted-foreground">Flag state</p>
                                <p className="text-sm">{exp.flag_state}</p>
                              </div>
                            )}
                            {exp.vessels?.loa_meters && (
                              <div>
                                <p className="text-[11px] text-muted-foreground">LOA</p>
                                <p className="text-sm">{exp.vessels.loa_meters}m</p>
                              </div>
                            )}
                            {exp.contract_type && (
                              <div>
                                <p className="text-[11px] text-muted-foreground">Contract</p>
                                <p className="text-sm capitalize">
                                  {exp.contract_type}
                                  {exp.contract_details && ` — ${exp.contract_details}`}
                                </p>
                              </div>
                            )}
                            {exp.vessels?.vessel_type && (
                              <div>
                                <p className="text-[11px] text-muted-foreground">Vessel type</p>
                                <p className="text-sm capitalize">{exp.vessels.vessel_type}</p>
                              </div>
                            )}
                          </div>
                          {exp.description && (
                            <p className="mt-2 text-sm text-muted-foreground">{exp.description}</p>
                          )}
                          <div className="mt-3 flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/profile/edit-experience/${exp.id}`);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                              disabled={deletingExpId === exp.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteExpId(exp.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                              {deletingExpId === exp.id ? 'Removing...' : 'Remove'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Crew edit form */}
        {profile.identity_type === 'crew' && editing && (
          <div className="flex flex-col gap-4">
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
              <RolePicker
                roles={roles as { id: string; name: string; department: string }[]}
                value={desiredRoleId}
                onValueChange={setDesiredRoleId}
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
              <p className="text-xs text-muted-foreground">
                Auto-derived from your vessel experience
              </p>
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
              <div className="max-h-40 overflow-y-auto rounded-md border border-border p-3">
                {visaTypes.map((v) => (
                  <label key={v.id} className="flex items-center gap-2 py-1.5 text-sm">
                    <Checkbox
                      checked={visaIds.includes(v.id)}
                      onCheckedChange={() => toggleArrayItem(visaIds, v.id, setVisaIds)}
                    />
                    {v.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Languages</Label>
              <div className="max-h-40 overflow-y-auto rounded-md border border-border p-3">
                {LANGUAGES.map((lang) => (
                  <label key={lang.code} className="flex items-center gap-2 py-1.5 text-sm">
                    <Checkbox
                      checked={profileLanguages.includes(lang.code)}
                      onCheckedChange={() =>
                        toggleArrayItem(profileLanguages, lang.code, setProfileLanguages)
                      }
                    />
                    {lang.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Agent-specific fields */}
        {profile.identity_type === 'agent' && !editing && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setExpandedSections((s) => ({ ...s, agencyInfo: !s.agencyInfo }))}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left"
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
                  <button
                    onClick={() => setEditing(true)}
                    className="text-left text-sm text-muted-foreground"
                  >
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
                  <button
                    onClick={() => setEditing(true)}
                    className="text-left text-sm text-muted-foreground"
                  >
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
                  <button
                    onClick={() => setEditing(true)}
                    className="text-left text-sm text-muted-foreground"
                  >
                    Add role specializations — shows which departments you place for
                  </button>
                )}
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

      <Dialog open={!!confirmDeleteExpId} onOpenChange={() => setConfirmDeleteExpId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete experience</DialogTitle>
            <DialogDescription>
              This will permanently remove this experience entry from your profile. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDeleteExpId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!!deletingExpId}
              onClick={async () => {
                if (confirmDeleteExpId) {
                  await handleDeleteExperience(confirmDeleteExpId);
                  setConfirmDeleteExpId(null);
                }
              }}
            >
              {deletingExpId ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {showPreview && profile && (
        <ProfileOverlay
          personId={profile.person_id}
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
        />
      )}
    </main>
  );
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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
