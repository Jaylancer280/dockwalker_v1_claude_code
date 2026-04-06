'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Pencil, X, Check, Loader2, Ship, Briefcase, Eye } from 'lucide-react';
import { Avatar } from '@/components/avatar';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { AvatarUpload } from '@/components/avatar-upload';
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
  const [smoker, setSmoker] = useState<boolean | null>(null);
  const [visibleTattoos, setVisibleTattoos] = useState<boolean | null>(null);
  const [placementCityIds, setPlacementCityIds] = useState<string[]>([]);

  // Lookups from cached context
  const lookups = useLookups();
  const roles = lookups.roles as LookupItem[];
  const certs = lookups.certifications as LookupItem[];
  const nationalities = lookups.nationalities;
  const visaTypes = lookups.visaTypes;

  // Name maps for view-mode pills (derived from context)
  const certNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of lookups.certifications) map[c.id] = c.name;
    return map;
  }, [lookups.certifications]);

  const placementCitiesDisplay = useMemo(() => {
    return placementCityIds
      .map((id) => {
        const city = lookups.cities.find((c) => c.id === id);
        return city
          ? { id: city.id, name: city.name, region_name: city.regions?.name ?? null }
          : null;
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }, [placementCityIds, lookups.cities]);
  const sizeBandNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of lookups.sizeBands) map[s.id] = s.label;
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
          if (result.data.profile.nationality_id)
            setNationalityId(result.data.profile.nationality_id);
          if (result.data.profile.visa_ids) setVisaIds(result.data.profile.visa_ids);
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

  // Lookups loaded from LookupsProvider context — certNames and sizeBandNames derived above via useMemo

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (person?.identity_type === 'crew') {
      loadAvailability();
    }
    if (person?.identity_type === 'crew' || person?.identity_type === 'agent') {
      loadExperiences();
    }
  }, [person?.identity_type, loadAvailability, loadExperiences]);

  // Re-fetch profile + experiences when tab regains focus (handles stale data after navigation)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        loadProfile();
        if (person?.identity_type === 'crew' || person?.identity_type === 'agent') {
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
    setNationalityId(profile.nationality_id ?? '');
    setVisaIds(profile.visa_ids ?? []);
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
      body.nationalityId = nationalityId || null;
      body.visaIds = visaIds;
      body.languages = profileLanguages;
      body.smoker = smoker;
      body.visibleTattoos = visibleTattoos;
    } else {
      body.agencyName = agencyName || null;
      body.roleSpecializationIds = roleSpecializationIds;
      body.bio = bio || null;
      body.deckName = deckName || null;
      body.nationalityId = nationalityId || null;
      body.visaIds = visaIds;
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

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
              <div className="flex flex-col gap-2">
                <ProfileSummarySection
                  profile={profile}
                  experiences={experiences}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                  sizeBandNames={sizeBandNames}
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
                  visaIds={visaIds}
                  visaTypes={visaTypes}
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
            nationalityId={nationalityId}
            setNationalityId={setNationalityId}
            visaIds={visaIds}
            setVisaIds={setVisaIds}
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
            certs={certs}
            nationalities={nationalities}
            visaTypes={visaTypes}
            cities={lookups.cities}
          />
        )}

        {/* Agent-specific fields */}
        {profile.identity_type === 'agent' && !editing && (
          <AgentProfileSection
            profile={profile}
            experiences={experiences}
            visaTypes={visaTypes}
            placementCities={placementCitiesDisplay}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
            onEnterEdit={enterEdit}
            onAddExperience={() => router.push('/profile/add-experience')}
            onNavigateVessels={() => router.push('/vessels')}
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
            loadAvailability();
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
