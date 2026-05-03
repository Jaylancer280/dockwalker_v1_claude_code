'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Pencil, X, Check, Ship, Briefcase, Eye, FileText, Lock } from 'lucide-react';
import { Avatar } from '@/components/avatar';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { FlagIcon } from '@/components/flag-icon';
import { AvatarUpload } from '@/components/avatar-upload';
import { EmptyState } from '@/components/empty-state';
import { NotificationBell } from '@/components/notification-bell';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { HatSwitcher } from '@/components/hat-switcher';
import { AvailabilityOverlay } from '@/components/availability-overlay';
import { ProfileOverlay } from '@/components/profile-overlay';
import { useLookups } from '@/hooks/use-lookups';
import { safeFetch } from '@/lib/safe-fetch';
import { ProfileSummarySection } from './_components/profile-summary-section';
import { ProfileLookingForSection } from './_components/profile-looking-for-section';
import { ProfileAboutSection } from './_components/profile-about-section';
import { ProfileExperienceSection } from './_components/profile-experience-section';
import { ProfileEditForm } from './_components/profile-edit-form';
import { AgentProfileSection } from './_components/agent-profile-section';
import { ProfileQuickStats } from './_components/profile-quick-stats';
import {
  ProfileShoreExperienceSection,
  type ShoreExperienceEntry,
} from './_components/profile-shore-experience-section';

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
  nationality_ids?: string[];
  entry_right_ids: string[];
  languages: string[];
  nationalities: {
    id: string;
    name: string;
    country_code: string | null;
    flag_emoji: string;
  } | null;
  deck_name: string | null;
  smoker: boolean | null;
  visible_tattoos: boolean | null;
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

export default function ProfilePage() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [person, setPerson] = useState<Person | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Maritime experience state
  const [experiences, setExperiences] = useState<ExperienceEntry[]>([]);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string>('free');
  const [expandedExpId, setExpandedExpId] = useState<string | null>(null);
  const [deletingExpId, setDeletingExpId] = useState<string | null>(null);
  const [confirmDeleteExpId, setConfirmDeleteExpId] = useState<string | null>(null);

  // Shore experience state
  const [shoreExperiences, setShoreExperiences] = useState<ShoreExperienceEntry[]>([]);
  const [expandedShoreId, setExpandedShoreId] = useState<string | null>(null);
  const [deletingShoreId, setDeletingShoreId] = useState<string | null>(null);
  const [confirmDeleteShoreId, setConfirmDeleteShoreId] = useState<string | null>(null);

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
  const [nationalityIds, setNationalityIds] = useState<string[]>([]);
  const [entryRightIds, setEntryRightIds] = useState<string[]>([]);
  const [profileLanguages, setProfileLanguages] = useState<string[]>([]);
  const [deckName, setDeckName] = useState('');
  const [smoker, setSmoker] = useState<boolean | null>(null);
  const [visibleTattoos, setVisibleTattoos] = useState<boolean | null>(null);
  const [placementCityIds, setPlacementCityIds] = useState<string[]>([]);

  // Lookups from cached context
  const lookups = useLookups();
  const roles = lookups.roles as LookupItem[];
  const nationalities = lookups.nationalities;
  const entryRights = lookups.entryRights;

  // Name maps for view-mode pills (derived from context)
  const certNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of lookups.certifications) map[c.id] = c.name;
    return map;
  }, [lookups.certifications]);

  const [placementCitiesDisplay, setPlacementCitiesDisplay] = useState<
    { id: string; name: string; region_name: string | null }[]
  >([]);
  useEffect(() => {
    if (placementCityIds.length === 0) {
      setPlacementCitiesDisplay([]);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({ cities: placementCityIds.join(',') });
    safeFetch<{
      results: {
        id: string;
        kind: 'port' | 'city';
        name: string;
        region_name: string | null;
      }[];
    }>(`/api/locations/by-ids?${params.toString()}`)
      .then((res) => {
        if (cancelled || !res.ok) return;
        const cities = res.data.results
          .filter((r) => r.kind === 'city')
          .map((c) => ({ id: c.id, name: c.name, region_name: c.region_name }));
        setPlacementCitiesDisplay(cities);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [placementCityIds]);
  const sizeBandNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of lookups.sizeBands) map[s.id] = s.label;
    return map;
  }, [lookups.sizeBands]);
  const sizeBandRanges = useMemo(() => {
    const map: Record<string, { min_meters: number; max_meters: number | null }> = {};
    for (const s of lookups.sizeBands) {
      map[s.id] = { min_meters: s.min_meters, max_meters: s.max_meters };
    }
    return map;
  }, [lookups.sizeBands]);

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
        placement_city_ids?: string[];
      }>('/api/profile');
      if (result.ok) {
        if (result.data.person) setPerson(result.data.person);
        if (result.data.profile) {
          setProfile(result.data.profile);
          // Prefer the new nationality_ids array; fall back to legacy
          // single nationality_id during the migration window.
          if (
            Array.isArray(result.data.profile.nationality_ids) &&
            result.data.profile.nationality_ids.length > 0
          ) {
            setNationalityIds(result.data.profile.nationality_ids);
          } else if (result.data.profile.nationality_id) {
            setNationalityIds([result.data.profile.nationality_id]);
          }
          if (result.data.profile.entry_right_ids)
            setEntryRightIds(result.data.profile.entry_right_ids);
          setDesiredRoleId(result.data.profile.desired_role_id ?? '');
          setPermAvail(result.data.profile.permanent_availability ?? null);
          setNoticeDays(result.data.profile.notice_period_days ?? null);
          setEmployed(result.data.profile.currently_employed ?? false);
        }
        if (result.data.placement_city_ids) {
          setPlacementCityIds(result.data.placement_city_ids);
        }
        if (!result.data.person || !result.data.profile) {
          setLoadError(true);
        }
      } else {
        setLoadError(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadExperiences = useCallback(async () => {
    const result = await safeFetch<{
      experiences?: ExperienceEntry[];
      subscription_plan?: string;
    }>('/api/experiences');
    if (result.ok) {
      setExperiences(result.data.experiences ?? []);
      if (result.data.subscription_plan) {
        setSubscriptionPlan(result.data.subscription_plan);
      }
    }
  }, []);

  const loadShoreExperiences = useCallback(async () => {
    const result = await safeFetch<{ experiences?: ShoreExperienceEntry[] }>(
      '/api/shore-experiences',
    );
    if (result.ok) {
      setShoreExperiences(result.data.experiences ?? []);
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

  // Lookups loaded from LookupsProvider context — certNames and sizeBandNames derived above via useMemo

  // Parallel initial fetch — profile, availability, experiences all fire at once
  useEffect(() => {
    loadProfile();
    loadAvailability();
    loadExperiences();
    loadShoreExperiences();
  }, [loadProfile, loadAvailability, loadExperiences, loadShoreExperiences]);

  // Re-fetch profile + experiences when tab regains focus (handles stale data after navigation)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        loadProfile();
        if (person?.identity_type === 'crew' || person?.identity_type === 'agent') {
          loadExperiences();
          loadShoreExperiences();
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadProfile, loadExperiences, loadShoreExperiences, person?.identity_type]);

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

  const toggleSection = useCallback((key: string) => {
    setExpandedSections((s) => ({ ...s, [key]: !s[key] }));
  }, []);

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
    setNationalityIds(
      Array.isArray(profile.nationality_ids) && profile.nationality_ids.length > 0
        ? profile.nationality_ids
        : profile.nationality_id
          ? [profile.nationality_id]
          : [],
    );
    setEntryRightIds(profile.entry_right_ids ?? []);
    setProfileLanguages(profile.languages ?? []);
    setDeckName(profile.deck_name ?? '');
    setSmoker(profile.smoker ?? null);
    setVisibleTattoos(profile.visible_tattoos ?? null);
    // placementCityIds already loaded from API
    setEditing(true);
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
      body.nationalityIds = nationalityIds;
      body.entryRightIds = entryRightIds;
      body.languages = profileLanguages;
      body.smoker = smoker;
      body.visibleTattoos = visibleTattoos;
    } else {
      body.agencyName = agencyName || null;
      body.roleSpecializationIds = roleSpecializationIds;
      body.bio = bio || null;
      body.deckName = deckName || null;
      body.nationalityIds = nationalityIds;
      body.entryRightIds = entryRightIds;
      body.languages = profileLanguages;
      body.placementCityIds = placementCityIds;
    }

    const result = await safeFetch<{ error?: string }>('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (result.ok) {
      setEditing(false);
      window.scrollTo(0, 0);
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

  async function handleDeleteShoreExperience(id: string) {
    setDeletingShoreId(id);
    const result = await safeFetch<{ error?: string }>(`/api/shore-experiences/${id}`, {
      method: 'DELETE',
    });
    if (result.ok) {
      setShoreExperiences((prev) => prev.filter((e) => e.id !== id));
      if (expandedShoreId === id) setExpandedShoreId(null);
      showSuccess('Shore experience removed');
    } else {
      showError(result.error);
    }
    setDeletingShoreId(null);
  }

  if (loading) {
    return (
      <main className="flex flex-col gap-4 px-4 pb-nav pt-4">
        {/* Avatar + name skeleton */}
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 animate-pulse rounded-full bg-[var(--card)]" />
          <div className="flex flex-col gap-2">
            <div className="h-5 w-40 animate-pulse rounded bg-[var(--surface)]" />
            <div className="h-3 w-28 animate-pulse rounded bg-[var(--surface)]" />
          </div>
        </div>

        {/* Section skeletons */}
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface)]" />
            <div className="h-3 w-full animate-pulse rounded bg-[var(--surface)]" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--surface)]" />
          </div>
        ))}
      </main>
    );
  }

  if (!person || !profile) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4">
        <p className="text-[15px] text-muted-foreground">
          {loadError ? 'Failed to load profile.' : 'Profile not found.'}
        </p>
        <button
          onClick={() => {
            setLoading(true);
            setLoadError(false);
            loadProfile();
          }}
          className="mt-3 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        >
          Retry
        </button>
      </main>
    );
  }

  const isCrewHat = person.current_hat === 'crew';

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="page-width flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-[24px] font-bold tracking-[-0.5px]">Profile</h1>
            <span className="md:hidden">
              <NotificationBell />
            </span>
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
                  onClick={() => {
                    setEditing(false);
                    window.scrollTo(0, 0);
                  }}
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

      <div className="page-width flex w-full flex-col gap-6 px-4 py-6">
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
                  {profile.identity_type === 'crew' && profile.nationalities && (
                    <FlagIcon
                      code={profile.nationalities.country_code}
                      name={profile.nationalities.name}
                      emoji={profile.nationalities.flag_emoji}
                      className="text-lg"
                    />
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
                  {profile.identity_type === 'crew' ? (
                    permAvail === 'immediate' ? (
                      <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        Available now
                      </Badge>
                    ) : permAvail === 'after_notice' ? (
                      <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                        After {noticeDays ?? '?'}d notice
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        {permAvail === 'not_looking' ? 'Not looking' : 'Status not set'}
                      </Badge>
                    )
                  ) : (
                    <Badge variant="secondary" className="capitalize">
                      {profile.identity_type}
                    </Badge>
                  )}
                  <span className="md:hidden">
                    <HatSwitcher
                      currentHat={person.current_hat}
                      identityType={person.identity_type}
                    />
                  </span>
                </div>
              </>
            ) : null}
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

        {/* CV Builder hot button — locked in Stage 1 (Phase 8 unlocks). Crew-only;
            agents have no CV by design (out of scope per spec §12 v2-deferred). */}
        {!editing && isCrewHat && person.identity_type === 'crew' && (
          <button
            type="button"
            onClick={() => showSuccess('DockWalker CV — Coming Soon')}
            aria-disabled="true"
            aria-label="DockWalker CV — coming soon"
            className="flex w-full items-center gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-left opacity-60 transition-colors hover:bg-accent"
          >
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-medium">Build your DockWalker CV</span>
              <span className="text-xs text-muted-foreground">
                Coming soon — configure your settings now in{' '}
                <span className="underline">Settings → CV Builder</span>.
              </span>
            </div>
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        )}
        {!editing && !isCrewHat && person.identity_type === 'agent' && (
          <Button
            variant="outline"
            size="sm"
            className="w-fit gap-2"
            onClick={() => setShowPreview(true)}
          >
            <Eye className="h-4 w-4" />
            How candidates see you
          </Button>
        )}
        {!editing && !isCrewHat && person.identity_type !== 'agent' && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="w-fit gap-2"
              size="sm"
              onClick={() => setShowPreview(true)}
            >
              <Eye className="h-4 w-4" />
              How candidates see you
            </Button>
            <Button
              variant="outline"
              className="w-fit gap-2"
              size="sm"
              onClick={() => router.push('/daywork/mine')}
            >
              <Briefcase className="h-4 w-4" />
              My jobs
            </Button>
          </div>
        )}

        <Separator />

        {/* Crew view mode — 2-column on desktop */}
        {profile.identity_type === 'crew' && !editing && (
          <div className="lg:flex lg:gap-6">
            <div className="flex flex-1 flex-col gap-4">
              {/*
                Fresh-crew empty state — shown when no maritime experience, no
                shore experience, and no bio have been added yet. Gives a
                brand-new signup a warm first impression of the profile page
                instead of a wall of empty section headers. Disappears as
                soon as any of the three is populated.
              */}
              {experiences.length === 0 &&
                shoreExperiences.length === 0 &&
                !profile.bio?.trim() && (
                  <EmptyState
                    imageSrc="/images/empty-states/profile.jpg"
                    title="Tell your story"
                    description="Add an experience, a bit about yourself, or your shore-side background — employers use this to get to know you."
                    action={
                      <Button size="sm" onClick={() => router.push('/profile/add-experience')}>
                        Add first experience
                      </Button>
                    }
                  />
                )}
              <div className="flex flex-col gap-2">
                <ProfileSummarySection
                  profile={profile}
                  experiences={experiences}
                  shoreExperienceCategories={[
                    ...new Set(
                      shoreExperiences
                        .map((se) => se.shore_experience_categories?.name)
                        .filter((n): n is string => !!n),
                    ),
                  ]}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                  sizeBandNames={sizeBandNames}
                  sizeBandRanges={sizeBandRanges}
                  onAddExperience={() => router.push('/profile/add-experience')}
                  onEnterEdit={enterEdit}
                />

                <ProfileLookingForSection
                  profile={profile}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                  availStatus={availStatus}
                  availSummary={availSummary}
                  permAvail={permAvail}
                  setPermAvail={setPermAvail}
                  noticeDays={noticeDays}
                  setNoticeDays={setNoticeDays}
                  employed={employed}
                  setEmployed={setEmployed}
                  editingCareer={editingCareer}
                  setEditingCareer={setEditingCareer}
                  savingCareer={savingCareer}
                  setSavingCareer={setSavingCareer}
                  isCrewHat={isCrewHat}
                  setShowAvailOverlay={setShowAvailOverlay}
                  onEnterEdit={enterEdit}
                />

                <ProfileAboutSection
                  profile={profile}
                  certNames={certNames}
                  entryRightIds={entryRightIds}
                  entryRights={entryRights}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                  onEnterEdit={enterEdit}
                />
              </div>

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
                onAddExperience={() => router.push('/profile/add-experience')}
                onEditExperience={(id) => router.push(`/profile/edit-experience/${id}`)}
                subscriptionPlan={subscriptionPlan}
                onReferencesChanged={loadExperiences}
              />

              <ProfileShoreExperienceSection
                experiences={shoreExperiences}
                expandedSections={expandedSections}
                toggleSection={toggleSection}
                expandedId={expandedShoreId}
                setExpandedId={setExpandedShoreId}
                deletingId={deletingShoreId}
                confirmDeleteId={confirmDeleteShoreId}
                setConfirmDeleteId={setConfirmDeleteShoreId}
                handleDelete={handleDeleteShoreExperience}
                onAdd={() => router.push('/profile/add-shore-experience')}
                onEdit={(id) => router.push(`/profile/edit-shore-experience/${id}`)}
              />
            </div>

            <aside className="hidden shrink-0 lg:sticky lg:top-16 lg:block lg:w-[300px] lg:self-start">
              <ProfileQuickStats
                profile={profile}
                experiences={experiences}
                permAvail={permAvail}
                noticeDays={noticeDays}
              />
            </aside>
          </div>
        )}

        {/* Crew edit form */}
        {editing && (
          <ProfileEditForm
            identityType={profile.identity_type}
            displayName={displayName}
            setDisplayName={setDisplayName}
            bio={bio}
            setBio={setBio}
            deckName={deckName}
            setDeckName={setDeckName}
            desiredRoleId={desiredRoleId}
            setDesiredRoleId={setDesiredRoleId}
            locationPortId={locationPortId}
            setLocationPortId={setLocationPortId}
            locationCityId={locationCityId}
            setLocationCityId={setLocationCityId}
            certificationIds={certificationIds}
            setCertificationIds={setCertificationIds}
            nationalityIds={nationalityIds}
            setNationalityIds={setNationalityIds}
            entryRightIds={entryRightIds}
            setEntryRightIds={setEntryRightIds}
            profileLanguages={profileLanguages}
            setProfileLanguages={setProfileLanguages}
            smoker={smoker}
            setSmoker={setSmoker}
            visibleTattoos={visibleTattoos}
            setVisibleTattoos={setVisibleTattoos}
            agencyName={agencyName}
            setAgencyName={setAgencyName}
            roleSpecializationIds={roleSpecializationIds}
            setRoleSpecializationIds={setRoleSpecializationIds}
            placementCityIds={placementCityIds}
            setPlacementCityIds={setPlacementCityIds}
            roles={roles}
            nationalities={nationalities}
          />
        )}

        {/* Agent-specific fields */}
        {profile.identity_type === 'agent' && !editing && (
          <AgentProfileSection
            profile={profile}
            experiences={experiences}
            entryRights={entryRights}
            placementCities={placementCitiesDisplay}
            roles={roles}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
            onEnterEdit={enterEdit}
            onAddExperience={() => router.push('/profile/add-experience')}
            onEditExperience={(id) => router.push(`/profile/edit-experience/${id}`)}
            onNavigateVessels={() => router.push('/vessels')}
            expandedExpId={expandedExpId}
            setExpandedExpId={setExpandedExpId}
            deletingExpId={deletingExpId}
            confirmDeleteExpId={confirmDeleteExpId}
            setConfirmDeleteExpId={setConfirmDeleteExpId}
            handleDeleteExperience={handleDeleteExperience}
          />
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
            showSuccess('Availability updated');
            setAvailStatus('available');
            setTimeout(() => loadAvailability(), 1000);
          }}
          onCancel={() => setShowAvailOverlay(false)}
        />
      )}

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
