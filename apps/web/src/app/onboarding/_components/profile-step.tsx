'use client';

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
import { HierarchicalPills, rolesToGroups, certsToGroups } from '@/components/hierarchical-pills';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { LANGUAGES } from '@/lib/languages';

interface LookupItem {
  id: string;
  name: string;
  label?: string;
  department?: string;
  category?: string;
}

export interface ProfileStepProps {
  identityType: 'crew' | 'agent' | null;
  experienceLevel: 'green' | 'experienced' | null;
  loading: boolean;
  error: string | null;
  lookupsLoading: boolean;
  userEmail: string | null;

  // Shared profile fields
  displayName: string;
  setDisplayName: (v: string) => void;
  avatarUrl: string | null;
  setAvatarUrl: (v: string | null) => void;
  locationPortId: string;
  setLocationPortId: (v: string) => void;
  locationCityId: string;
  setLocationCityId: (v: string) => void;
  bio: string;
  setBio: (v: string) => void;
  languages: string[];
  setLanguages: (v: string[]) => void;

  // Crew fields
  primaryRoleId: string;
  setPrimaryRoleId: (v: string) => void;
  certificationIds: string[];
  setCertificationIds: (v: string[]) => void;
  experienceBracketId: string;
  setExperienceBracketId: (v: string) => void;
  vesselSizeExposureIds: string[];
  setVesselSizeExposureIds: (v: string[]) => void;
  shoreExperience: string;
  setShoreExperience: (v: string) => void;
  motivation: string;
  setMotivation: (v: string) => void;
  availableToStart: string;
  setAvailableToStart: (v: string) => void;
  deckName: string;
  setDeckName: (v: string) => void;
  desiredRoleId: string;
  setDesiredRoleId: (v: string) => void;
  permanentAvailability: string | null;
  setPermanentAvailability: (v: string | null) => void;
  noticePeriodDays: number;
  setNoticePeriodDays: (v: number) => void;
  currentlyEmployed: boolean;
  setCurrentlyEmployed: (v: boolean) => void;
  nationalityId: string;
  setNationalityId: (v: string) => void;
  visaIds: string[];
  setVisaIds: (v: string[]) => void;

  // Agent fields
  agencyName: string;
  setAgencyName: (v: string) => void;
  roleSpecializationIds: string[];
  setRoleSpecializationIds: (v: string[]) => void;

  // Lookups
  roles: LookupItem[];
  certs: LookupItem[];
  brackets: LookupItem[];
  sizeBands: LookupItem[];
  nationalities: { id: string; name: string; flag_emoji: string }[];
  visaTypes: { id: string; name: string }[];

  // Navigation
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  onSubmitAgent: () => void;
  setError: (v: string | null) => void;
  setSkipping: (v: boolean) => void;
}

function toggleArrayItem(arr: string[], id: string): string[] {
  return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
}

export function ProfileStep(props: ProfileStepProps) {
  const {
    identityType,
    experienceLevel,
    loading,
    error,
    lookupsLoading,
    userEmail,
    displayName,
    setDisplayName,
    avatarUrl,
    setAvatarUrl,
    locationPortId,
    setLocationPortId,
    locationCityId,
    setLocationCityId,
    bio,
    setBio,
    languages: selectedLanguages,
    setLanguages: setSelectedLanguages,
    primaryRoleId,
    setPrimaryRoleId,
    certificationIds,
    setCertificationIds,
    experienceBracketId,
    setExperienceBracketId,
    vesselSizeExposureIds,
    setVesselSizeExposureIds,
    shoreExperience,
    setShoreExperience,
    motivation,
    setMotivation,
    availableToStart,
    setAvailableToStart,
    deckName,
    setDeckName,
    desiredRoleId,
    setDesiredRoleId,
    permanentAvailability,
    setPermanentAvailability,
    noticePeriodDays,
    setNoticePeriodDays,
    currentlyEmployed,
    setCurrentlyEmployed,
    nationalityId,
    setNationalityId,
    visaIds,
    setVisaIds,
    agencyName,
    setAgencyName,
    roleSpecializationIds,
    setRoleSpecializationIds,
    roles,
    certs,
    brackets,
    sizeBands,
    nationalities,
    visaTypes,
    onBack,
    onNext,
    onSkip,
    onSubmitAgent,
    setError,
    setSkipping,
  } = props;

  const isGreen = experienceLevel === 'green';
  const isExperienced = experienceLevel === 'experienced';
  const isCrew = identityType === 'crew';

  return (
    <main className="flex min-h-svh flex-col items-start justify-start bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
        <button
          onClick={onBack}
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
                <HierarchicalPills
                  groups={rolesToGroups(
                    roles.filter((r): r is typeof r & { department: string } => !!r.department),
                  )}
                  value={primaryRoleId}
                  onValueChange={(v) => setPrimaryRoleId(v as string)}
                  mode="single"
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
                {certs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Loading certifications...</p>
                ) : (
                  <HierarchicalPills
                    groups={certsToGroups(
                      certs.filter((c): c is typeof c & { category: string } => !!c.category),
                    )}
                    value={certificationIds}
                    onValueChange={(v) => setCertificationIds(v as string[])}
                    mode="multi"
                  />
                )}
              </div>

              {/* Languages — all crew */}
              <div className="flex flex-col gap-1.5">
                <Label>Languages</Label>
                <div className="flex flex-wrap gap-1.5">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      className={`rounded-full px-3 py-1 text-xs transition-colors ${
                        selectedLanguages.includes(lang.code)
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent-lo)]'
                      }`}
                      onClick={() =>
                        setSelectedLanguages(toggleArrayItem(selectedLanguages, lang.code))
                      }
                    >
                      {lang.label}
                    </button>
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
                      onClick={() =>
                        setVisaIds(
                          visaIds.includes(v.id)
                            ? visaIds.filter((id) => id !== v.id)
                            : [...visaIds, v.id],
                        )
                      }
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Desired role — optional */}
              <div className="flex flex-col gap-1.5">
                <Label>
                  What role are you looking for?{' '}
                  <span className="text-xs text-muted-foreground">(optional)</span>
                </Label>
                <HierarchicalPills
                  groups={rolesToGroups(
                    roles.filter((r): r is typeof r & { department: string } => !!r.department),
                  )}
                  value={desiredRoleId}
                  onValueChange={(v) => setDesiredRoleId(v as string)}
                  mode="single"
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
                          setRoleSpecializationIds(toggleArrayItem(roleSpecializationIds, role.id))
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
              onSubmitAgent();
            } else if (isExperienced) {
              onNext();
            } else {
              onNext();
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
              onSkip();
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
