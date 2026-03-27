'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { safeFetch } from '@/lib/safe-fetch';
import { usePreferences } from '@/hooks/use-preferences';
import { feetToMeters } from '@/lib/units';

import { WelcomeStep } from './_components/welcome-step';
import { IdentityStep } from './_components/identity-step';
import { ExperienceForkStep } from './_components/experience-fork-step';
import { ProfileStep } from './_components/profile-step';
import { VesselExperienceStep } from './_components/vessel-experience-step';
import type { VesselExperienceEntry } from './_components/vessel-experience-step';
import { HatSelectionStep } from './_components/hat-selection-step';

type IdentityType = 'crew' | 'agent';
type HatType = 'crew' | 'employer' | 'agent';
type ExperienceLevel = 'green' | 'experienced';
type Step = 'welcome' | 'identity' | 'experience-fork' | 'profile' | 'vessel-experience' | 'hat';

interface LookupItem {
  id: string;
  name: string;
  label?: string;
  department?: string;
  category?: string;
}

interface FlagState {
  id: string;
  name: string;
}

interface SizeBandFull {
  id: string;
  label: string;
  min_meters: number;
  max_meters: number | null;
}

function emptyExperienceEntry(): VesselExperienceEntry {
  return {
    key: crypto.randomUUID(),
    vessel: {
      imoNumber: '',
      name: '',
      vesselType: 'motor',
      loaMeters: '',
      useExisting: false,
    },
    experience: {
      roleId: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      vesselOperation: 'charter',
      flagState: '',
      salaryAmount: '',
      salaryCurrency: '',
      salaryPeriod: '',
      contractType: '',
      contractDetails: '',
      description: '',
      seaTimeDays: '',
      seaTimeNauticalMiles: '',
    },
  };
}

export default function OnboardingPage() {
  const router = useRouter();
  const { lengthUnit } = usePreferences();
  const [step, setStep] = useState<Step>('welcome');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Identity
  const [identityType, setIdentityType] = useState<IdentityType | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);

  // Profile data — shared
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [locationPortId, setLocationPortId] = useState('');
  const [locationCityId, setLocationCityId] = useState('');
  const [bio, setBio] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);

  // Crew fields
  const [primaryRoleId, setPrimaryRoleId] = useState('');
  const [certificationIds, setCertificationIds] = useState<string[]>([]);
  const [experienceBracketId, setExperienceBracketId] = useState('');
  const [vesselSizeExposureIds, setVesselSizeExposureIds] = useState<string[]>([]);

  // Green crew fields
  const [shoreExperience, setShoreExperience] = useState('');
  const [motivation, setMotivation] = useState('');
  const [availableToStart, setAvailableToStart] = useState('');

  // New optional crew fields (149c)
  const [deckName, setDeckName] = useState('');
  const [desiredRoleId, setDesiredRoleId] = useState('');
  const [permanentAvailability, setPermanentAvailability] = useState<string | null>(null);
  const [noticePeriodDays, setNoticePeriodDays] = useState(30);
  const [currentlyEmployed, setCurrentlyEmployed] = useState(false);

  // Nationality & visas
  const [nationalityId, setNationalityId] = useState('');
  const [visaIds, setVisaIds] = useState<string[]>([]);

  // Agent fields
  const [agencyName, setAgencyName] = useState('');
  const [roleSpecializationIds, setRoleSpecializationIds] = useState<string[]>([]);

  // Vessel experience entries (experienced crew)
  const [experienceEntries, setExperienceEntries] = useState<VesselExperienceEntry[]>([
    emptyExperienceEntry(),
  ]);

  // Hat selection
  const [hat, setHat] = useState<HatType | null>(null);

  // Skip flow
  const [skipping, setSkipping] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEmail() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) setUserEmail(user.email);
    }
    fetchEmail();
  }, []);

  // Lookup data
  const [roles, setRoles] = useState<LookupItem[]>([]);
  const [certs, setCerts] = useState<LookupItem[]>([]);
  const [brackets, setBrackets] = useState<LookupItem[]>([]);
  const [sizeBands, setSizeBands] = useState<LookupItem[]>([]);
  const [sizeBandsFull, setSizeBandsFull] = useState<SizeBandFull[]>([]);
  const [flagStates, setFlagStates] = useState<FlagState[]>([]);
  const [nationalities, setNationalities] = useState<
    { id: string; name: string; flag_emoji: string }[]
  >([]);
  const [visaTypes, setVisaTypes] = useState<{ id: string; name: string }[]>([]);
  const [lookupsLoaded, setLookupsLoaded] = useState(false);

  const needsLookups = step === 'profile' || step === 'vessel-experience';
  useEffect(() => {
    if (!needsLookups || lookupsLoaded) return;
    async function loadLookups() {
      const supabase = createClient();
      const [rolesRes, certsRes, bracketsRes, sizesRes, flagsRes, nationalitiesRes, visaTypesRes] =
        await Promise.all([
          supabase.from('yacht_roles').select('id, name, department').order('sort_order'),
          supabase.from('certifications').select('id, name, category').order('sort_order'),
          supabase.from('experience_brackets').select('id, label').order('sort_order'),
          supabase
            .from('vessel_size_bands')
            .select('id, label, min_meters, max_meters')
            .order('sort_order'),
          supabase.from('flag_states').select('id, name').order('sort_order'),
          supabase.from('nationalities').select('id, name, flag_emoji').order('sort_order'),
          supabase.from('visa_types').select('id, name').order('sort_order'),
        ]);
      if (rolesRes.data) setRoles(rolesRes.data);
      if (certsRes.data) setCerts(certsRes.data);
      if (bracketsRes.data) setBrackets(bracketsRes.data.map((b) => ({ ...b, name: b.label })));
      if (sizesRes.data) {
        setSizeBands(sizesRes.data.map((s) => ({ ...s, name: s.label })));
        setSizeBandsFull(sizesRes.data as SizeBandFull[]);
      }
      if (flagsRes.data) setFlagStates(flagsRes.data);
      if (nationalitiesRes.data) setNationalities(nationalitiesRes.data);
      if (visaTypesRes.data) setVisaTypes(visaTypesRes.data);
      setLookupsLoaded(true);
    }
    loadLookups();
  }, [needsLookups, lookupsLoaded]);

  const lookupsLoading = needsLookups && !lookupsLoaded;

  function updateEntry(
    key: string,
    field: 'vessel' | 'experience',
    updates: Record<string, unknown>,
  ) {
    setExperienceEntries((prev) =>
      prev.map((e) => (e.key === key ? { ...e, [field]: { ...e[field], ...updates } } : e)),
    );
  }

  function removeEntry(key: string) {
    setExperienceEntries((prev) => prev.filter((e) => e.key !== key));
  }

  async function handleSubmit(hatOverride?: HatType) {
    setError(null);
    setLoading(true);

    try {
      const currentHat = identityType === 'agent' ? 'agent' : (hatOverride ?? hat);
      const isGreen = experienceLevel === 'green';

      const profileData: Record<string, unknown> = {
        displayName,
        locationPortId: locationPortId || undefined,
        locationCityId: locationCityId || undefined,
        bio: bio || undefined,
        languages,
        onboardingVersion: 2,
        ...(avatarUrl ? { avatarUrl } : {}),
      };

      if (identityType === 'crew') {
        profileData.primaryRoleId = primaryRoleId || undefined;
        profileData.certificationIds = certificationIds;
        profileData.nationalityId = nationalityId || null;
        profileData.visaIds = visaIds;
        profileData.deckName = deckName || undefined;
        profileData.desiredRoleId = desiredRoleId || undefined;
        profileData.permanentAvailability = permanentAvailability || undefined;
        if (permanentAvailability === 'after_notice') {
          profileData.noticePeriodDays = noticePeriodDays;
        }
        profileData.currentlyEmployed = currentlyEmployed || undefined;

        if (isGreen) {
          profileData.experienceBracketId = experienceBracketId || undefined;
          profileData.vesselSizeExposureIds = vesselSizeExposureIds;
          profileData.shoreExperience = shoreExperience || undefined;
          profileData.motivation = motivation || undefined;
          profileData.availableToStart = availableToStart || undefined;
        }
      } else {
        profileData.agencyName = agencyName || undefined;
        profileData.roleSpecializationIds = roleSpecializationIds;
      }

      const experiences =
        experienceLevel === 'experienced'
          ? experienceEntries
              .filter((e) => e.vessel.imoNumber && e.experience.roleId)
              .map((e) => ({
                vessel: {
                  imoNumber: e.vessel.imoNumber,
                  name: e.vessel.name,
                  vesselType: e.vessel.vesselType,
                  loaMeters:
                    Math.round(
                      (lengthUnit === 'ft'
                        ? feetToMeters(Number(e.vessel.loaMeters))
                        : Number(e.vessel.loaMeters)) * 100,
                    ) / 100 || 0,
                },
                experience: {
                  roleId: e.experience.roleId,
                  startDate: e.experience.startDate,
                  endDate: e.experience.endDate || undefined,
                  isCurrent: e.experience.isCurrent,
                  vesselOperation: e.experience.vesselOperation,
                  flagState: e.experience.flagState || undefined,
                  salaryAmount: e.experience.salaryAmount
                    ? Number(e.experience.salaryAmount)
                    : undefined,
                  salaryCurrency: e.experience.salaryCurrency || undefined,
                  salaryPeriod: e.experience.salaryPeriod || undefined,
                  contractType: e.experience.contractType || undefined,
                  contractDetails: e.experience.contractDetails || undefined,
                  description: e.experience.description || undefined,
                  seaTimeDays: e.experience.seaTimeDays
                    ? Number(e.experience.seaTimeDays)
                    : undefined,
                  seaTimeNauticalMiles: e.experience.seaTimeNauticalMiles
                    ? Number(e.experience.seaTimeNauticalMiles)
                    : undefined,
                },
              }))
          : [];

      const result = await safeFetch<{ error?: string }>('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityType,
          currentHat,
          profile: profileData,
          experiences,
        }),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push('/profile');
    } finally {
      setLoading(false);
    }
  }

  // ── Step routing ──────────────────────────────────────────────────────────

  if (step === 'welcome') {
    return <WelcomeStep onNext={() => setStep('identity')} />;
  }

  if (step === 'identity') {
    return (
      <IdentityStep
        onBack={() => setStep('welcome')}
        onSelectCrew={() => setStep('experience-fork')}
        onSelectAgent={() => setStep('profile')}
        setIdentityType={setIdentityType}
        setExperienceLevel={() => setExperienceLevel(null)}
      />
    );
  }

  if (step === 'experience-fork') {
    return (
      <ExperienceForkStep
        onBack={() => setStep('identity')}
        onSelect={(level) => {
          setExperienceLevel(level);
          setStep('profile');
        }}
      />
    );
  }

  if (step === 'profile') {
    return (
      <ProfileStep
        identityType={identityType}
        experienceLevel={experienceLevel}
        loading={loading}
        error={error}
        lookupsLoading={lookupsLoading}
        userEmail={userEmail}
        displayName={displayName}
        setDisplayName={setDisplayName}
        avatarUrl={avatarUrl}
        setAvatarUrl={setAvatarUrl}
        locationPortId={locationPortId}
        setLocationPortId={setLocationPortId}
        locationCityId={locationCityId}
        setLocationCityId={setLocationCityId}
        bio={bio}
        setBio={setBio}
        languages={languages}
        setLanguages={setLanguages}
        primaryRoleId={primaryRoleId}
        setPrimaryRoleId={setPrimaryRoleId}
        certificationIds={certificationIds}
        setCertificationIds={setCertificationIds}
        experienceBracketId={experienceBracketId}
        setExperienceBracketId={setExperienceBracketId}
        vesselSizeExposureIds={vesselSizeExposureIds}
        setVesselSizeExposureIds={setVesselSizeExposureIds}
        shoreExperience={shoreExperience}
        setShoreExperience={setShoreExperience}
        motivation={motivation}
        setMotivation={setMotivation}
        availableToStart={availableToStart}
        setAvailableToStart={setAvailableToStart}
        deckName={deckName}
        setDeckName={setDeckName}
        desiredRoleId={desiredRoleId}
        setDesiredRoleId={setDesiredRoleId}
        permanentAvailability={permanentAvailability}
        setPermanentAvailability={setPermanentAvailability}
        noticePeriodDays={noticePeriodDays}
        setNoticePeriodDays={setNoticePeriodDays}
        currentlyEmployed={currentlyEmployed}
        setCurrentlyEmployed={setCurrentlyEmployed}
        nationalityId={nationalityId}
        setNationalityId={setNationalityId}
        visaIds={visaIds}
        setVisaIds={setVisaIds}
        agencyName={agencyName}
        setAgencyName={setAgencyName}
        roleSpecializationIds={roleSpecializationIds}
        setRoleSpecializationIds={setRoleSpecializationIds}
        roles={roles}
        certs={certs}
        brackets={brackets}
        sizeBands={sizeBands}
        nationalities={nationalities}
        visaTypes={visaTypes}
        onBack={() => setStep(identityType === 'crew' ? 'experience-fork' : 'identity')}
        onNext={() => setStep(experienceLevel === 'experienced' ? 'vessel-experience' : 'hat')}
        onSkip={() => setStep('hat')}
        onSubmitAgent={() => handleSubmit()}
        setError={setError}
        setSkipping={setSkipping}
      />
    );
  }

  if (step === 'vessel-experience') {
    return (
      <VesselExperienceStep
        experienceEntries={experienceEntries}
        setExperienceEntries={setExperienceEntries}
        error={error}
        roles={roles}
        flagStates={flagStates}
        sizeBands={sizeBandsFull}
        updateEntry={updateEntry}
        removeEntry={removeEntry}
        addEntry={() => setExperienceEntries((prev) => [...prev, emptyExperienceEntry()])}
        onBack={() => setStep('profile')}
        onNext={() => setStep('hat')}
        setError={setError}
      />
    );
  }

  // step === 'hat'
  return (
    <HatSelectionStep
      loading={loading}
      error={error}
      hat={hat}
      skipping={skipping}
      experienceLevel={experienceLevel}
      setHat={setHat}
      setSkipping={setSkipping}
      onBack={() => {
        if (skipping) {
          setStep('profile');
        } else {
          setStep(experienceLevel === 'experienced' ? 'vessel-experience' : 'profile');
        }
      }}
      onSelect={(selectedHat) => handleSubmit(selectedHat)}
    />
  );
}
