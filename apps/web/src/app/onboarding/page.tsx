'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
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
    vesselType: 'charter' | 'private';
    loaMeters: string;
    useExisting: boolean;
    existingVesselId?: string;
  };
  experience: {
    roleId: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    charterOrPrivate: 'charter' | 'private';
    flagState: string;
    salaryAmount: string;
    salaryCurrency: string;
    salaryPeriod: string;
    rotationType: string;
    rotationDetails: string;
    description: string;
  };
}

const ROTATION_TYPES = [
  { value: '2:2', label: '2 months on / 2 months off' },
  { value: '3:1', label: '3 months on / 1 month off' },
  { value: '3:3', label: '3 months on / 3 months off' },
  { value: '5:1', label: '5 months on / 1 month off' },
  { value: 'permanent', label: 'Permanent (no rotation)' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'mlc_standard', label: 'MLC standard leave' },
  { value: 'other', label: 'Other' },
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'nl', label: 'Dutch' },
  { code: 'hr', label: 'Croatian' },
  { code: 'el', label: 'Greek' },
  { code: 'tr', label: 'Turkish' },
  { code: 'ru', label: 'Russian' },
  { code: 'ar', label: 'Arabic' },
  { code: 'zh', label: 'Chinese (Mandarin)' },
  { code: 'tl', label: 'Filipino/Tagalog' },
  { code: 'af', label: 'Afrikaans' },
  { code: 'pl', label: 'Polish' },
  { code: 'ro', label: 'Romanian' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'sv', label: 'Swedish' },
  { code: 'no', label: 'Norwegian' },
];

function emptyExperienceEntry(): VesselExperienceEntry {
  return {
    key: crypto.randomUUID(),
    vessel: { imoNumber: '', name: '', vesselType: 'charter', loaMeters: '', useExisting: false },
    experience: {
      roleId: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      charterOrPrivate: 'charter',
      flagState: '',
      salaryAmount: '',
      salaryCurrency: '',
      salaryPeriod: '',
      rotationType: '',
      rotationDetails: '',
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
  const [locationPortId, setLocationPortId] = useState('');
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

  // Lookup data
  const [roles, setRoles] = useState<LookupItem[]>([]);
  const [certs, setCerts] = useState<LookupItem[]>([]);
  const [brackets, setBrackets] = useState<LookupItem[]>([]);
  const [sizeBands, setSizeBands] = useState<LookupItem[]>([]);
  const [flagStates, setFlagStates] = useState<FlagState[]>([]);
  const [lookupsLoaded, setLookupsLoaded] = useState(false);

  const needsLookups = step === 'profile' || step === 'vessel-experience';
  useEffect(() => {
    if (!needsLookups || lookupsLoaded) return;
    async function loadLookups() {
      const supabase = createClient();
      const [rolesRes, certsRes, bracketsRes, sizesRes, flagsRes] = await Promise.all([
        supabase.from('yacht_roles').select('id, name, department').order('sort_order'),
        supabase.from('certifications').select('id, name, category').order('sort_order'),
        supabase.from('experience_brackets').select('id, label').order('sort_order'),
        supabase.from('vessel_size_bands').select('id, label').order('sort_order'),
        supabase.from('flag_states').select('id, name').order('sort_order'),
      ]);
      if (rolesRes.data) setRoles(rolesRes.data);
      if (certsRes.data) setCerts(certsRes.data);
      if (bracketsRes.data) setBrackets(bracketsRes.data.map((b) => ({ ...b, name: b.label })));
      if (sizesRes.data) setSizeBands(sizesRes.data.map((s) => ({ ...s, name: s.label })));
      if (flagsRes.data) setFlagStates(flagsRes.data);
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
      const res = await fetch(`/api/vessels/lookup?imo=${imoClean}`);
      const data = await res.json();
      if (data.found && data.vessel) {
        setExperienceEntries((prev) =>
          prev.map((e) =>
            e.key === entryKey
              ? {
                  ...e,
                  vessel: {
                    ...e.vessel,
                    name: data.vessel.name,
                    vesselType: data.vessel.vessel_type,
                    loaMeters: String(data.vessel.loa_meters),
                    useExisting: true,
                    existingVesselId: data.vessel.id,
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
        bio: bio || undefined,
        languages,
        onboardingVersion: 2,
      };

      if (identityType === 'crew') {
        profileData.primaryRoleId = primaryRoleId || undefined;
        profileData.certificationIds = certificationIds;

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
                  charterOrPrivate: e.experience.charterOrPrivate,
                  flagState: e.experience.flagState || undefined,
                  salaryAmount: e.experience.salaryAmount
                    ? Number(e.experience.salaryAmount)
                    : undefined,
                  salaryCurrency: e.experience.salaryCurrency || undefined,
                  salaryPeriod: e.experience.salaryPeriod || undefined,
                  rotationType: e.experience.rotationType || undefined,
                  rotationDetails: e.experience.rotationDetails || undefined,
                  description: e.experience.description || undefined,
                },
              }))
          : [];

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityType,
          currentHat,
          profile: profileData,
          experiences,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }

      router.push('/profile');
    } catch {
      setError('Network error. Please try again.');
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

            {/* Location — shared */}
            <div className="flex flex-col gap-1.5">
              <Label>Current location</Label>
              <LocationPicker
                mode="port-required"
                value={locationPortId ? { portId: locationPortId } : null}
                onValueChange={(v) => setLocationPortId(v.portId ?? '')}
                placeholder="Select port/marina"
              />
            </div>

            {/* ── Crew-specific fields ── */}
            {isCrew && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label>{isGreen ? 'Target role' : 'Primary role'}</Label>
                  <Select value={primaryRoleId} onValueChange={setPrimaryRoleId}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={isGreen ? 'What role are you targeting?' : 'Select your role'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              </>
            )}

            {/* ── Agent-specific fields ── */}
            {identityType === 'agent' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="agencyName">Agency name</Label>
                  <Input
                    id="agencyName"
                    placeholder="Your agency"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Roles you hire for</Label>
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

            {/* Bio — shared */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bio">Short bio (optional)</Label>
              <Input
                id="bio"
                placeholder="A few words about yourself"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            onClick={() => {
              if (!displayName.trim()) {
                setError('Display name is required');
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

              {/* Vessel details */}
              <div className="flex flex-col gap-1.5">
                <Label>Vessel name</Label>
                <Input
                  placeholder="M/Y Vessel Name"
                  value={entry.vessel.name}
                  onChange={(e) =>
                    updateEntry(entry.key, 'vessel', {
                      name: e.target.value,
                      useExisting: false,
                      existingVesselId: undefined,
                    })
                  }
                />
              </div>

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
                      <SelectItem value="charter">Charter</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>LOA (meters)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 45"
                    value={entry.vessel.loaMeters}
                    onChange={(e) =>
                      updateEntry(entry.key, 'vessel', { loaMeters: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="my-1 border-t border-border" />

              {/* Role held */}
              <div className="flex flex-col gap-1.5">
                <Label>Role held</Label>
                <Select
                  value={entry.experience.roleId}
                  onValueChange={(v) => updateEntry(entry.key, 'experience', { roleId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Charter/private during tenure */}
              <div className="flex flex-col gap-1.5">
                <Label>Charter or private during your tenure</Label>
                <Select
                  value={entry.experience.charterOrPrivate}
                  onValueChange={(v) =>
                    updateEntry(entry.key, 'experience', { charterOrPrivate: v })
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

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Start date</Label>
                  <Input
                    type="month"
                    value={entry.experience.startDate ? entry.experience.startDate.slice(0, 7) : ''}
                    onChange={(e) =>
                      updateEntry(entry.key, 'experience', {
                        startDate: e.target.value ? `${e.target.value}-01` : '',
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>End date</Label>
                  <Input
                    type="month"
                    disabled={entry.experience.isCurrent}
                    value={entry.experience.endDate ? entry.experience.endDate.slice(0, 7) : ''}
                    onChange={(e) =>
                      updateEntry(entry.key, 'experience', {
                        endDate: e.target.value ? `${e.target.value}-01` : '',
                      })
                    }
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

              {/* Flag state */}
              <div className="flex flex-col gap-1.5">
                <Label>Flag state</Label>
                <Select
                  value={entry.experience.flagState}
                  onValueChange={(v) => updateEntry(entry.key, 'experience', { flagState: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select flag state" />
                  </SelectTrigger>
                  <SelectContent>
                    {flagStates.map((fs) => (
                      <SelectItem key={fs.id} value={fs.id}>
                        {fs.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              {/* Rotation */}
              <div className="flex flex-col gap-1.5">
                <Label>Rotation</Label>
                <Select
                  value={entry.experience.rotationType}
                  onValueChange={(v) => updateEntry(entry.key, 'experience', { rotationType: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select rotation type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROTATION_TYPES.map((rt) => (
                      <SelectItem key={rt.value} value={rt.value}>
                        {rt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {['other', 'mlc_standard', 'seasonal'].includes(entry.experience.rotationType) && (
                  <Input
                    placeholder={
                      entry.experience.rotationType === 'mlc_standard'
                        ? 'e.g. 38 days/year'
                        : entry.experience.rotationType === 'seasonal'
                          ? 'e.g. March — October'
                          : 'Describe your rotation'
                    }
                    value={entry.experience.rotationDetails}
                    onChange={(e) =>
                      updateEntry(entry.key, 'experience', { rotationDetails: e.target.value })
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
          onClick={() =>
            setStep(experienceLevel === 'experienced' ? 'vessel-experience' : 'profile')
          }
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
