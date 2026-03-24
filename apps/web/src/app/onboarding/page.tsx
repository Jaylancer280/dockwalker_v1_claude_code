'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { AvatarUpload } from '@/components/avatar-upload';
import { Button } from '@/components/ui/button';
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
import { Checkbox } from '@/components/ui/checkbox';
import { LocationPicker } from '@/components/location-picker';
import { RolePicker } from '@/components/role-picker';
import { FlagStatePicker } from '@/components/flag-state-picker';
import {
  Anchor,
  Building2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Ship,
  User,
  Plus,
  Trash2,
  Sparkles,
  Compass,
  CheckCircle2,
} from 'lucide-react';
import { safeFetch } from '@/lib/safe-fetch';

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

interface VesselExperienceEntry {
  key: string;
  vessel: {
    imoNumber: string;
    name: string;
    vesselType: 'motor' | 'sail';
    loaMeters: string;
    useExisting: boolean;
    existingVesselId?: string;
  };
  experience: {
    roleId: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    vesselOperation: 'charter' | 'private';
    flagState: string;
    salaryAmount: string;
    salaryCurrency: string;
    salaryPeriod: string;
    contractType: string;
    contractDetails: string;
    description: string;
  };
}

const CONTRACT_TYPES = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'rotational', label: 'Rotational' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'crossing', label: 'Crossing' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'temporary', label: 'Temporary' },
];

import { LANGUAGES } from '@/lib/languages';

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
    },
  };
}

export default function OnboardingPage() {
  const router = useRouter();
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
  const [lookingUpImo, setLookingUpImo] = useState<string | null>(null);

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
          supabase.from('vessel_size_bands').select('id, label').order('sort_order'),
          supabase.from('flag_states').select('id, name').order('sort_order'),
          supabase.from('nationalities').select('id, name, flag_emoji').order('sort_order'),
          supabase.from('visa_types').select('id, name').order('sort_order'),
        ]);
      if (rolesRes.data) setRoles(rolesRes.data);
      if (certsRes.data) setCerts(certsRes.data);
      if (bracketsRes.data) setBrackets(bracketsRes.data.map((b) => ({ ...b, name: b.label })));
      if (sizesRes.data) setSizeBands(sizesRes.data.map((s) => ({ ...s, name: s.label })));
      if (flagsRes.data) setFlagStates(flagsRes.data);
      if (nationalitiesRes.data) setNationalities(nationalitiesRes.data);
      if (visaTypesRes.data) setVisaTypes(visaTypesRes.data);
      setLookupsLoaded(true);
    }
    loadLookups();
  }, [needsLookups, lookupsLoaded]);

  const lookupsLoading = needsLookups && !lookupsLoaded;

  function toggleArrayItem(arr: string[], id: string): string[] {
    return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
  }

  const lookupImo = useCallback(async (entryKey: string, imoNumber: string) => {
    const imoClean = imoNumber.replace(/\D/g, '');
    if (imoClean.length !== 7) return;

    setLookingUpImo(entryKey);
    try {
      const result = await safeFetch<{
        found: boolean;
        vessel?: { name: string; vessel_type?: 'motor' | 'sail'; loa_meters: number; id: string };
      }>(`/api/vessels/lookup?imo=${imoClean}`);
      if (result.ok && result.data.found && result.data.vessel) {
        setExperienceEntries((prev) =>
          prev.map((e) =>
            e.key === entryKey
              ? {
                  ...e,
                  vessel: {
                    ...e.vessel,
                    name: result.data.vessel!.name,
                    vesselType: result.data.vessel!.vessel_type ?? 'motor',
                    loaMeters: String(result.data.vessel!.loa_meters),
                    useExisting: true,
                    existingVesselId: result.data.vessel!.id,
                  },
                }
              : e,
          ),
        );
      }
    } finally {
      setLookingUpImo(null);
    }
  }, []);

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
                  loaMeters: Number(e.vessel.loaMeters) || 0,
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

  // ── Step: Welcome ───────────────────────────────────────────────────────
  if (step === 'welcome') {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-8">
          <Image
            src="/images/brand/dw_app_icon_cropped.png"
            alt="DockWalker"
            width={80}
            height={80}
            className="rounded-2xl"
          />

          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="text-2xl font-bold tracking-tight">Welcome to DockWalker</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The fast, structured dispatch layer for superyacht daywork. We connect crew seeking
              short-term work with employers who need immediate cover — no noise, no politics, no
              hidden algorithms.
            </p>
          </div>

          <div className="flex w-full flex-col items-center gap-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-3 text-sm text-foreground">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-sea" />
              <span>Apply to daywork in seconds</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-foreground">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-sea" />
              <span>Structured, transparent hiring</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-foreground">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-sea" />
              <span>Built for the superyacht industry</span>
            </div>
          </div>

          <Button onClick={() => setStep('identity')} className="w-full" size="lg">
            Get started
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </main>
    );
  }

  // ── Step: Identity type ─────────────────────────────────────────────────
  if (step === 'identity') {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <button
            onClick={() => setStep('welcome')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold tracking-tight">Tell us about yourself</h1>
            <p className="text-sm text-muted-foreground">
              This determines your onboarding experience
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                setIdentityType('crew');
                setStep('experience-fork');
              }}
              className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Anchor className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">I&apos;m Crew</p>
                <p className="text-sm text-muted-foreground">
                  Currently onboard or looking for daywork
                </p>
              </div>
            </button>

            <button
              onClick={() => {
                setIdentityType('agent');
                setExperienceLevel(null);
                setStep('profile');
              }}
              className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">I&apos;m an Agency Agent</p>
                <p className="text-sm text-muted-foreground">I hire crew on behalf of vessels</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  You&apos;ll post jobs on behalf of vessels. This cannot be changed — agents cannot
                  apply for jobs or switch to a crew profile.
                </p>
              </div>
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Step: Experience fork (crew only) ───────────────────────────────────
  if (step === 'experience-fork') {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <button
            onClick={() => setStep('identity')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold tracking-tight">Your experience level</h1>
            <p className="text-sm text-muted-foreground">
              This helps us tailor your profile and onboarding
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                setExperienceLevel('green');
                setStep('profile');
              }}
              className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success text-white">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">New to yachting</p>
                <p className="text-sm text-muted-foreground">
                  No yacht experience yet, looking to get started
                </p>
              </div>
            </button>

            <button
              onClick={() => {
                setExperienceLevel('experienced');
                setStep('profile');
              }}
              className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sea text-white">
                <Compass className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">I have yacht experience</p>
                <p className="text-sm text-muted-foreground">
                  I&apos;ve worked on one or more yachts
                </p>
              </div>
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Step: Profile form ──────────────────────────────────────────────────
  if (step === 'profile') {
    const isGreen = experienceLevel === 'green';
    const isExperienced = experienceLevel === 'experienced';
    const isCrew = identityType === 'crew';

    return (
      <main className="flex min-h-svh flex-col items-start justify-start bg-background px-4 py-8">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
          <button
            onClick={() => setStep(isCrew ? 'experience-fork' : 'identity')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {identityType === 'agent' ? 'Your agency profile' : 'Your crew profile'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {identityType === 'agent'
                ? 'Set up your agency details'
                : 'This is what employers will see when you apply'}
            </p>
          </div>

          {lookupsLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading form data...
            </div>
          )}

          <div className="flex flex-col gap-4">
            {/* Avatar upload */}
            <AvatarUpload
              currentUrl={avatarUrl}
              name={displayName || 'You'}
              onUploaded={setAvatarUrl}
            />

            {/* Display name — shared */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                placeholder="How you want to appear"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            {/* Deck name — crew only, optional */}
            {isCrew && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="deckName">
                  Deck name <span className="text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="deckName"
                  placeholder="What your crew calls you"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value.slice(0, 50))}
                  maxLength={50}
                />
              </div>
            )}

            {/* Location — city for crew, port for agents */}
            <div className="flex flex-col gap-1.5">
              <Label>{isCrew ? 'Where are you based?' : 'Current location'}</Label>
              <LocationPicker
                mode={isCrew ? 'port-optional' : 'port-required'}
                value={
                  isCrew
                    ? locationCityId
                      ? { cityId: locationCityId }
                      : null
                    : locationPortId
                      ? { portId: locationPortId }
                      : null
                }
                onValueChange={(v) => {
                  if (isCrew) {
                    setLocationCityId(v.cityId ?? '');
                  } else {
                    setLocationPortId(v.portId ?? '');
                  }
                }}
                placeholder={isCrew ? 'Select city' : 'Select port/marina'}
              />
            </div>

            {/* ── Crew-specific fields ── */}
            {isCrew && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label>{isGreen ? 'Target role' : 'Primary role'}</Label>
                  <RolePicker
                    roles={roles as { id: string; name: string; department: string }[]}
                    value={primaryRoleId}
                    onValueChange={setPrimaryRoleId}
                    placeholder={isGreen ? 'What role are you targeting?' : 'Select your role'}
                  />
                </div>

                {/* Green crew: manual experience + size selection */}
                {isGreen && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label>Experience level</Label>
                      <Select value={experienceBracketId} onValueChange={setExperienceBracketId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select experience level" />
                        </SelectTrigger>
                        <SelectContent>
                          {brackets.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label>Vessel size experience</Label>
                      <div className="flex flex-wrap gap-2">
                        {sizeBands.map((band) => (
                          <button
                            key={band.id}
                            type="button"
                            onClick={() =>
                              setVesselSizeExposureIds(
                                toggleArrayItem(vesselSizeExposureIds, band.id),
                              )
                            }
                            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                              vesselSizeExposureIds.includes(band.id)
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-card text-foreground hover:border-primary'
                            }`}
                          >
                            {band.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="shoreExperience">Shore-side experience</Label>
                      <Textarea
                        id="shoreExperience"
                        placeholder="Relevant work experience outside yachting (e.g. bartending, hospitality, engineering)"
                        value={shoreExperience}
                        onChange={(e) => setShoreExperience(e.target.value)}
                        maxLength={250}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="motivation">Motivation &amp; goals</Label>
                      <Textarea
                        id="motivation"
                        placeholder="Why yachting? What department or role are you targeting?"
                        value={motivation}
                        onChange={(e) => setMotivation(e.target.value)}
                        maxLength={250}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label>Available to start</Label>
                      <Select value={availableToStart} onValueChange={setAvailableToStart}>
                        <SelectTrigger>
                          <SelectValue placeholder="When can you start?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">Immediately</SelectItem>
                          <SelectItem value="within_1_week">Within 1 week</SelectItem>
                          <SelectItem value="within_2_weeks">Within 2 weeks</SelectItem>
                          <SelectItem value="within_1_month">Within 1 month</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div className="flex flex-col gap-1.5">
                  <Label>Certifications</Label>
                  <div className="max-h-48 overflow-y-auto rounded-md border border-border p-3">
                    {certs.length === 0 && (
                      <p className="text-sm text-muted-foreground">Loading certifications...</p>
                    )}
                    {certs.map((cert) => (
                      <label key={cert.id} className="flex items-center gap-2 py-1.5 text-sm">
                        <Checkbox
                          checked={certificationIds.includes(cert.id)}
                          onCheckedChange={() =>
                            setCertificationIds(toggleArrayItem(certificationIds, cert.id))
                          }
                        />
                        {cert.name}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Languages — all crew */}
                <div className="flex flex-col gap-1.5">
                  <Label>Languages</Label>
                  <div className="max-h-48 overflow-y-auto rounded-md border border-border p-3">
                    {LANGUAGES.map((lang) => (
                      <label key={lang.code} className="flex items-center gap-2 py-1.5 text-sm">
                        <Checkbox
                          checked={languages.includes(lang.code)}
                          onCheckedChange={() =>
                            setLanguages(toggleArrayItem(languages, lang.code))
                          }
                        />
                        {lang.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Nationality */}
                <div className="flex flex-col gap-1.5">
                  <Label>
                    Nationality <span className="text-destructive">*</span>
                  </Label>
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

                {/* Visas */}
                <div className="flex flex-col gap-1.5">
                  <Label>
                    Visas <span className="text-xs text-muted-foreground">(optional)</span>
                  </Label>
                  <div className="max-h-40 overflow-y-auto rounded-md border border-border p-3">
                    {visaTypes.map((v) => (
                      <label key={v.id} className="flex items-center gap-2 py-1.5 text-sm">
                        <Checkbox
                          checked={visaIds.includes(v.id)}
                          onCheckedChange={() => {
                            setVisaIds((prev) =>
                              prev.includes(v.id)
                                ? prev.filter((id) => id !== v.id)
                                : [...prev, v.id],
                            );
                          }}
                        />
                        {v.name}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Desired role — optional */}
                <div className="flex flex-col gap-1.5">
                  <Label>
                    What role are you looking for?{' '}
                    <span className="text-xs text-muted-foreground">(optional)</span>
                  </Label>
                  <RolePicker
                    roles={roles as { id: string; name: string; department: string }[]}
                    value={desiredRoleId}
                    onValueChange={setDesiredRoleId}
                    placeholder="Select desired role"
                  />
                </div>

                {/* Career status — optional */}
                <div className="flex flex-col gap-1.5">
                  <Label>
                    Career status <span className="text-xs text-muted-foreground">(optional)</span>
                  </Label>
                  <div className="flex flex-col gap-2">
                    {[
                      { value: 'immediate', label: 'Available immediately' },
                      { value: 'after_notice', label: 'Available after notice period' },
                      { value: 'not_looking', label: 'Not looking' },
                    ].map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="permanentAvail"
                          checked={permanentAvailability === opt.value}
                          onChange={() => setPermanentAvailability(opt.value)}
                          className="accent-primary"
                        />
                        {opt.label}
                      </label>
                    ))}
                    {permanentAvailability === 'after_notice' && (
                      <div className="ml-6 flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={noticePeriodDays}
                          onChange={(e) => setNoticePeriodDays(Number(e.target.value) || 30)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">days</span>
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={currentlyEmployed}
                        onCheckedChange={(v) => setCurrentlyEmployed(v === true)}
                      />
                      Currently employed
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* ── Agent-specific fields ── */}
            {identityType === 'agent' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="agencyName">
                    Agency name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="agencyName"
                    placeholder="Your agency"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                  />
                </div>

                {/* Deck name for agents — "Nickname" */}
                <div className="flex flex-col gap-1.5">
                  <Label>
                    Nickname <span className="text-xs text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    placeholder="What people in the industry call you"
                    value={deckName}
                    onChange={(e) => setDeckName(e.target.value.slice(0, 50))}
                    maxLength={50}
                  />
                </div>

                {/* Nationality for agents — optional */}
                <div className="flex flex-col gap-1.5">
                  <Label>
                    Nationality <span className="text-xs text-muted-foreground">(optional)</span>
                  </Label>
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
                  <Label>Which departments do you typically place for?</Label>
                  <div className="max-h-48 overflow-y-auto rounded-md border border-border p-3">
                    {roles.map((role) => (
                      <label key={role.id} className="flex items-center gap-2 py-1.5 text-sm">
                        <Checkbox
                          checked={roleSpecializationIds.includes(role.id)}
                          onCheckedChange={() =>
                            setRoleSpecializationIds(
                              toggleArrayItem(roleSpecializationIds, role.id),
                            )
                          }
                        />
                        {role.name}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Bio — crew only */}
            {isCrew && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bio">Short bio (optional)</Label>
                <Input
                  id="bio"
                  placeholder="A few words about yourself"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            onClick={() => {
              if (!displayName.trim()) {
                setError('Display name is required');
                return;
              }
              if (identityType === 'crew' && !nationalityId) {
                setError('Nationality is required');
                return;
              }
              if (identityType === 'agent' && !agencyName.trim()) {
                setError('Agency name is required');
                return;
              }
              setError(null);
              if (identityType === 'agent') {
                handleSubmit();
              } else if (isExperienced) {
                setStep('vessel-experience');
              } else {
                setStep('hat');
              }
            }}
            disabled={loading}
            className="w-full"
          >
            {identityType === 'agent' ? (
              loading ? (
                'Creating profile...'
              ) : (
                'Complete setup'
              )
            ) : (
              <>
                Continue
                <ChevronRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>

          {isCrew && (
            <button
              onClick={() => {
                const emailPrefix = userEmail?.split('@')[0] ?? 'User';
                const autoName =
                  emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1).substring(0, 99);
                setDisplayName(autoName);
                setSkipping(true);
                setError(null);
                setStep('hat');
              }}
              className="mx-auto text-sm text-muted-foreground hover:text-foreground"
            >
              Skip for now
            </button>
          )}
        </div>
      </main>
    );
  }

  // ── Step: Vessel experience entries (experienced crew only) ─────────────
  if (step === 'vessel-experience') {
    return (
      <main className="flex min-h-svh flex-col items-start justify-start bg-background px-4 py-8">
        <div className="mx-auto flex w-full max-w-md flex-col gap-6">
          <button
            onClick={() => setStep('profile')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <div>
            <h1 className="text-xl font-bold tracking-tight">Your vessel experience</h1>
            <p className="text-sm text-muted-foreground">
              Add your yacht work history, starting with the most recent. At least one entry is
              required.
            </p>
          </div>

          {experienceEntries.map((entry, index) => (
            <div
              key={entry.key}
              className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Experience {index + 1}</p>
                {experienceEntries.length > 1 && (
                  <button
                    onClick={() => removeEntry(entry.key)}
                    className="flex items-center gap-1 text-xs text-destructive hover:underline"
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove
                  </button>
                )}
              </div>

              {/* IMO number */}
              <div className="flex flex-col gap-1.5">
                <Label>IMO number</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="7 digits (e.g. 9876543)"
                    value={entry.vessel.imoNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 7);
                      updateEntry(entry.key, 'vessel', {
                        imoNumber: val,
                        useExisting: false,
                        existingVesselId: undefined,
                      });
                    }}
                    maxLength={7}
                  />
                  {entry.vessel.imoNumber.length === 7 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => lookupImo(entry.key, entry.vessel.imoNumber)}
                      disabled={lookingUpImo === entry.key}
                    >
                      {lookingUpImo === entry.key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Look up'
                      )}
                    </Button>
                  )}
                </div>
                {entry.vessel.useExisting && (
                  <p className="text-xs text-sea">
                    Found existing vessel record. You can override below if needed.
                  </p>
                )}
              </div>

              {/* Vessel type + operation */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Vessel type</Label>
                  <Select
                    value={entry.vessel.vesselType}
                    onValueChange={(v) => updateEntry(entry.key, 'vessel', { vesselType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="motor">Motor (M/Y)</SelectItem>
                      <SelectItem value="sail">Sail (S/Y)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Vessel name with M/Y or S/Y prefix */}
              <div className="flex flex-col gap-1.5">
                <Label>Vessel name</Label>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                    {entry.vessel.vesselType === 'sail' ? 'S/Y' : 'M/Y'}
                  </span>
                  <Input
                    placeholder="Vessel Name"
                    value={entry.vessel.name}
                    onChange={(e) =>
                      updateEntry(entry.key, 'vessel', {
                        name: e.target.value,
                        useExisting: false,
                        existingVesselId: undefined,
                      })
                    }
                    className="rounded-l-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>LOA (meters)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 45"
                  value={entry.vessel.loaMeters}
                  onChange={(e) => updateEntry(entry.key, 'vessel', { loaMeters: e.target.value })}
                />
              </div>

              <div className="my-1 border-t border-border" />

              {/* Role held — department hierarchy picker */}
              <div className="flex flex-col gap-1.5">
                <Label>Role held</Label>
                <RolePicker
                  roles={roles as { id: string; name: string; department: string }[]}
                  value={entry.experience.roleId}
                  onValueChange={(v) => updateEntry(entry.key, 'experience', { roleId: v })}
                />
              </div>

              {/* Vessel operation during tenure */}
              <div className="flex flex-col gap-1.5">
                <Label>Vessel operation during your tenure</Label>
                <Select
                  value={entry.experience.vesselOperation}
                  onValueChange={(v) =>
                    updateEntry(entry.key, 'experience', { vesselOperation: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="charter">Charter</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Dates — day-level precision */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    value={entry.experience.startDate}
                    onChange={(e) =>
                      updateEntry(entry.key, 'experience', { startDate: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>End date</Label>
                  <Input
                    type="date"
                    disabled={entry.experience.isCurrent}
                    value={entry.experience.endDate}
                    onChange={(e) =>
                      updateEntry(entry.key, 'experience', { endDate: e.target.value })
                    }
                    min={entry.experience.startDate || undefined}
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={entry.experience.isCurrent}
                      onCheckedChange={(checked) =>
                        updateEntry(entry.key, 'experience', { isCurrent: !!checked, endDate: '' })
                      }
                    />
                    Currently onboard
                  </label>
                </div>
              </div>

              {/* Flag state — searchable picker */}
              <div className="flex flex-col gap-1.5">
                <Label>Flag state</Label>
                <FlagStatePicker
                  flagStates={flagStates}
                  value={entry.experience.flagState}
                  onValueChange={(v) => updateEntry(entry.key, 'experience', { flagState: v })}
                />
              </div>

              {/* Salary — private, DB only */}
              <div className="flex flex-col gap-1.5">
                <Label>Salary (private — never displayed publicly)</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={entry.experience.salaryAmount}
                    onChange={(e) =>
                      updateEntry(entry.key, 'experience', { salaryAmount: e.target.value })
                    }
                  />
                  <Select
                    value={entry.experience.salaryCurrency}
                    onValueChange={(v) =>
                      updateEntry(entry.key, 'experience', { salaryCurrency: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Curr." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="AED">AED</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={entry.experience.salaryPeriod}
                    onValueChange={(v) => updateEntry(entry.key, 'experience', { salaryPeriod: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Contract type */}
              <div className="flex flex-col gap-1.5">
                <Label>Contract type</Label>
                <Select
                  value={entry.experience.contractType}
                  onValueChange={(v) => updateEntry(entry.key, 'experience', { contractType: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select contract type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map((ct) => (
                      <SelectItem key={ct.value} value={ct.value}>
                        {ct.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {['rotational', 'seasonal'].includes(entry.experience.contractType) && (
                  <Input
                    placeholder={
                      entry.experience.contractType === 'rotational'
                        ? 'e.g. 2 months on / 2 months off'
                        : 'e.g. March — October'
                    }
                    value={entry.experience.contractDetails}
                    onChange={(e) =>
                      updateEntry(entry.key, 'experience', { contractDetails: e.target.value })
                    }
                    maxLength={100}
                  />
                )}
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <Label>Brief description (optional)</Label>
                <Textarea
                  placeholder="Key responsibilities or highlights"
                  value={entry.experience.description}
                  onChange={(e) =>
                    updateEntry(entry.key, 'experience', { description: e.target.value })
                  }
                  maxLength={250}
                />
              </div>
            </div>
          ))}

          <button
            onClick={() => setExperienceEntries((prev) => [...prev, emptyExperienceEntry()])}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            Add another vessel experience
          </button>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            onClick={() => {
              const validEntries = experienceEntries.filter(
                (e) =>
                  e.vessel.imoNumber.length === 7 && e.experience.roleId && e.experience.startDate,
              );
              if (validEntries.length === 0) {
                setError(
                  'At least one complete experience entry is required (IMO, role, and start date)',
                );
                return;
              }
              setError(null);
              setStep('hat');
            }}
            className="w-full"
          >
            Continue
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </main>
    );
  }

  // ── Step: Hat selection (crew only) ─────────────────────────────────────
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <button
          onClick={() => {
            if (skipping) {
              setSkipping(false);
              setStep('profile');
            } else {
              setStep(experienceLevel === 'experienced' ? 'vessel-experience' : 'profile');
            }
          }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <div>
          <h1 className="text-xl font-bold tracking-tight">How are you using DockWalker?</h1>
          <p className="text-sm text-muted-foreground">You can switch between these anytime</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              setHat('crew');
              handleSubmit('crew');
            }}
            disabled={loading}
            className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent disabled:opacity-50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sea text-white">
              {loading && hat === 'crew' ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <User className="h-6 w-6" />
              )}
            </div>
            <div>
              <p className="font-semibold">Looking for daywork</p>
              <p className="text-sm text-muted-foreground">
                {loading && hat === 'crew'
                  ? 'Setting up your profile...'
                  : 'Browse and apply to jobs'}
              </p>
            </div>
          </button>

          <button
            onClick={() => {
              setHat('employer');
              handleSubmit('employer');
            }}
            disabled={loading}
            className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent disabled:opacity-50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-navy-light text-white">
              {loading && hat === 'employer' ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Ship className="h-6 w-6" />
              )}
            </div>
            <div>
              <p className="font-semibold">Looking to hire crew</p>
              <p className="text-sm text-muted-foreground">
                {loading && hat === 'employer'
                  ? 'Setting up your profile...'
                  : 'Post daywork and find crew'}
              </p>
            </div>
          </button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </main>
  );
}
