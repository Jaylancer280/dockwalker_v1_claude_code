'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { LocationPicker } from '@/components/location-picker';
import { Anchor, Building2, ChevronLeft, ChevronRight, Loader2, Ship, User } from 'lucide-react';

type IdentityType = 'crew' | 'agent';
type HatType = 'crew' | 'employer' | 'agent';
type Step = 'identity' | 'profile' | 'hat';

interface LookupItem {
  id: string;
  name: string;
  label?: string;
  department?: string;
  category?: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('identity');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Identity type
  const [identityType, setIdentityType] = useState<IdentityType | null>(null);

  // Step 2: Profile data
  const [displayName, setDisplayName] = useState('');
  // Crew fields
  const [primaryRoleId, setPrimaryRoleId] = useState('');
  const [certificationIds, setCertificationIds] = useState<string[]>([]);
  const [experienceBracketId, setExperienceBracketId] = useState('');
  const [vesselSizeExposureIds, setVesselSizeExposureIds] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  // Agent fields
  const [agencyName, setAgencyName] = useState('');
  const [roleSpecializationIds, setRoleSpecializationIds] = useState<string[]>([]);
  // Shared
  const [locationPortId, setLocationPortId] = useState('');

  // Step 3: Hat selection (crew only)
  const [hat, setHat] = useState<HatType | null>(null);

  // Lookup data
  const [roles, setRoles] = useState<LookupItem[]>([]);
  const [certs, setCerts] = useState<LookupItem[]>([]);
  const [brackets, setBrackets] = useState<LookupItem[]>([]);
  const [sizeBands, setSizeBands] = useState<LookupItem[]>([]);
  const [lookupsLoaded, setLookupsLoaded] = useState(false);

  useEffect(() => {
    if (step !== 'profile' || lookupsLoaded) return;
    async function loadLookups() {
      const supabase = createClient();
      const [rolesRes, certsRes, bracketsRes, sizesRes] = await Promise.all([
        supabase.from('yacht_roles').select('id, name, department').order('sort_order'),
        supabase.from('certifications').select('id, name, category').order('sort_order'),
        supabase.from('experience_brackets').select('id, label').order('sort_order'),
        supabase.from('vessel_size_bands').select('id, label').order('sort_order'),
      ]);
      if (rolesRes.data) setRoles(rolesRes.data);
      if (certsRes.data) setCerts(certsRes.data);
      if (bracketsRes.data) setBrackets(bracketsRes.data.map((b) => ({ ...b, name: b.label })));
      if (sizesRes.data) setSizeBands(sizesRes.data.map((s) => ({ ...s, name: s.label })));
      setLookupsLoaded(true);
    }
    loadLookups();
  }, [step, lookupsLoaded]);

  const lookupsLoading = step === 'profile' && !lookupsLoaded;

  function toggleArrayItem(arr: string[], id: string): string[] {
    return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
  }

  async function handleSubmit(hatOverride?: HatType) {
    setError(null);
    setLoading(true);

    try {
      const currentHat = identityType === 'agent' ? 'agent' : (hatOverride ?? hat);

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityType,
          currentHat,
          profile: {
            displayName,
            primaryRoleId: primaryRoleId || undefined,
            certificationIds,
            experienceBracketId: experienceBracketId || undefined,
            vesselSizeExposureIds,
            bio: bio || undefined,
            agencyName: agencyName || undefined,
            roleSpecializationIds,
            locationPortId: locationPortId || undefined,
          },
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

  // ── Step 1: Identity type ──────────────────────────────────────────────────
  if (step === 'identity') {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <Image
              src="/images/brand/dw_app_icon_cropped.png"
              alt="DockWalker"
              width={64}
              height={64}
              className="rounded-2xl"
            />
            <h1 className="text-xl font-bold tracking-tight">Welcome to DockWalker</h1>
            <p className="text-center text-sm text-muted-foreground">
              Tell us about yourself to get started
            </p>
          </div>

          <div className="flex w-full flex-col gap-3">
            <button
              onClick={() => {
                setIdentityType('crew');
                setStep('profile');
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

  // ── Step 2: Profile form ──────────────────────────────────────────────────
  if (step === 'profile') {
    return (
      <main className="flex min-h-svh flex-col items-start justify-start bg-background px-4 py-8">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
          <button
            onClick={() => setStep('identity')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {identityType === 'crew' ? 'Your crew profile' : 'Your agency profile'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {identityType === 'crew'
                ? 'This is what employers will see when you apply'
                : 'Set up your agency details'}
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
            {identityType === 'crew' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label>Primary role</Label>
                  <Select value={primaryRoleId} onValueChange={setPrimaryRoleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your role" />
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

                <div className="flex flex-col gap-1.5">
                  <Label>Experience</Label>
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

                <div className="flex flex-col gap-1.5">
                  <Label>Vessel size experience</Label>
                  <div className="flex flex-wrap gap-2">
                    {sizeBands.map((band) => (
                      <button
                        key={band.id}
                        type="button"
                        onClick={() =>
                          setVesselSizeExposureIds(toggleArrayItem(vesselSizeExposureIds, band.id))
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
                  <Label htmlFor="bio">Short bio (optional)</Label>
                  <Input
                    id="bio"
                    placeholder="A few words about yourself"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
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
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            onClick={() => {
              if (!displayName.trim()) {
                setError('Display name is required');
                return;
              }
              setError(null);
              if (identityType === 'crew') {
                setStep('hat');
              } else {
                handleSubmit();
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

  // ── Step 3: Hat selection (crew only) ─────────────────────────────────────
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <button
          onClick={() => setStep('profile')}
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
