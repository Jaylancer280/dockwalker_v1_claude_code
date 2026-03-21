'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { RolePicker } from '@/components/role-picker';
import { FlagStatePicker } from '@/components/flag-state-picker';
import { createClient } from '@/lib/supabase/client';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, Loader2, Search } from 'lucide-react';

interface RoleItem {
  id: string;
  name: string;
  department: string;
}

interface FlagState {
  id: string;
  name: string;
}

const CONTRACT_TYPES = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'rotational', label: 'Rotational' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'crossing', label: 'Crossing' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'temporary', label: 'Temporary' },
];

export default function AddExperiencePage() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [flagStates, setFlagStates] = useState<FlagState[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // IMO lookup
  const [imoNumber, setImoNumber] = useState('');
  const [lookingUpImo, setLookingUpImo] = useState(false);
  const [imoMessage, setImoMessage] = useState('');
  const [useExisting, setUseExisting] = useState(false);
  const [existingVesselId, setExistingVesselId] = useState('');

  // Vessel fields
  const [vesselName, setVesselName] = useState('');
  const [vesselType, setVesselType] = useState<'motor' | 'sail'>('motor');
  const [loaMeters, setLoaMeters] = useState('');

  // Experience fields
  const [roleId, setRoleId] = useState('');
  const [expVesselOperation, setExpVesselOperation] = useState<'charter' | 'private'>('charter');
  const [flagState, setFlagState] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCurrent, setIsCurrent] = useState(false);
  const [contractType, setContractType] = useState('');
  const [contractDetails, setContractDetails] = useState('');
  const [description, setDescription] = useState('');

  const loadLookups = useCallback(async () => {
    try {
      const supabase = createClient();
      const [rolesRes, flagsRes] = await Promise.all([
        supabase.from('yacht_roles').select('id, name, department').order('sort_order'),
        supabase.from('flag_states').select('id, name').order('sort_order'),
      ]);
      if (rolesRes.data) setRoles(rolesRes.data as RoleItem[]);
      if (flagsRes.data) setFlagStates(flagsRes.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  async function handleImoLookup() {
    if (imoNumber.length !== 7) return;
    setLookingUpImo(true);
    setImoMessage('');
    const result = await safeFetch<{
      found: boolean;
      vessel?: { name: string; loa_meters: number; vessel_type: string; id: string };
    }>(`/api/vessels/lookup?imo=${imoNumber}`);
    if (result.ok) {
      if (result.data.found && result.data.vessel) {
        const prefix = result.data.vessel.vessel_type === 'sail' ? 'S/Y' : 'M/Y';
        setImoMessage(
          `Found: ${prefix} ${result.data.vessel.name} (${result.data.vessel.loa_meters}m)`,
        );
        setVesselName(result.data.vessel.name);
        setLoaMeters(String(result.data.vessel.loa_meters));
        setVesselType(result.data.vessel.vessel_type as 'motor' | 'sail');
        setExistingVesselId(result.data.vessel.id);
        setUseExisting(true);
      } else {
        setImoMessage('Not found — enter vessel details below');
        setUseExisting(false);
        setExistingVesselId('');
      }
    }
    setLookingUpImo(false);
  }

  async function handleSubmit() {
    if (!roleId || !startDate || !expVesselOperation || !imoNumber) return;
    setSubmitting(true);

    let vesselId = existingVesselId;

    // Create vessel if not using existing
    if (!useExisting) {
      if (!vesselName || !loaMeters) {
        setSubmitting(false);
        return;
      }
      const vesselResult = await safeFetch<{ id: string }>('/api/vessels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imoNumber,
          name: vesselName,
          vesselType,
          loaMeters: Number(loaMeters),
          ndaFlag: false,
        }),
      });
      if (!vesselResult.ok) {
        showError(vesselResult.error);
        setSubmitting(false);
        return;
      }
      vesselId = vesselResult.data.id;
    }

    const result = await safeFetch('/api/experiences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vesselId,
        roleId,
        startDate,
        endDate: endDate || null,
        isCurrent,
        vesselOperation: expVesselOperation,
        flagState: flagState || null,
        contractType: contractType || null,
        contractDetails: contractDetails || null,
        description: description || null,
      }),
    });

    if (result.ok) {
      showSuccess('Experience added');
      router.push('/profile');
      router.refresh();
    } else {
      showError(result.error);
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const vesselPrefix = vesselType === 'sail' ? 'S/Y' : 'M/Y';

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center">
          <button
            onClick={() => router.push('/profile')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to profile
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Add experience</h1>
          <p className="text-sm text-muted-foreground">
            Add a vessel experience entry to your profile
          </p>
        </div>

        {/* IMO lookup */}
        <div className="flex flex-col gap-1.5">
          <Label>IMO number</Label>
          <div className="flex gap-2">
            <Input
              placeholder="7 digits"
              value={imoNumber}
              onChange={(e) => {
                setImoNumber(e.target.value.replace(/\D/g, '').slice(0, 7));
                setUseExisting(false);
                setExistingVesselId('');
                setImoMessage('');
              }}
              maxLength={7}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={imoNumber.length !== 7 || lookingUpImo}
              onClick={handleImoLookup}
            >
              {lookingUpImo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
          {imoMessage && !useExisting && (
            <p className="text-xs text-muted-foreground">{imoMessage}</p>
          )}
        </div>

        {/* Found vessel card */}
        {useExisting && (
          <div className="rounded-lg border border-success/40 bg-success/5 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {vesselType === 'sail' ? 'S/Y' : 'M/Y'} {vesselName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {loaMeters}m · IMO {imoNumber}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setUseExisting(false);
                  setExistingVesselId('');
                  setImoMessage('Enter vessel details below');
                }}
              >
                Enter manually
              </Button>
            </div>
          </div>
        )}

        {/* Vessel details — shown when not using existing vessel */}
        {!useExisting && (
          <>
            {/* Vessel type (motor/sail) + Operation (charter/private) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Vessel type</Label>
                <Select
                  value={vesselType}
                  onValueChange={(v) => setVesselType(v as 'motor' | 'sail')}
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
                  {vesselPrefix}
                </span>
                <Input
                  placeholder="Vessel Name"
                  value={vesselName}
                  onChange={(e) => setVesselName(e.target.value)}
                  className="rounded-l-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>LOA (meters)</Label>
              <Input
                type="number"
                placeholder="45"
                value={loaMeters}
                onChange={(e) => setLoaMeters(e.target.value)}
                min={1}
              />
            </div>
          </>
        )}

        {/* Role — department hierarchy picker */}
        <div className="flex flex-col gap-1.5">
          <Label>Role held</Label>
          <RolePicker roles={roles} value={roleId} onValueChange={setRoleId} />
        </div>

        {/* Vessel operation during tenure */}
        <div className="flex flex-col gap-1.5">
          <Label>Vessel operation (during your time)</Label>
          <Select
            value={expVesselOperation}
            onValueChange={(v) => setExpVesselOperation(v as 'charter' | 'private')}
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

        {/* Flag state — searchable picker */}
        <div className="flex flex-col gap-1.5">
          <Label>Flag state</Label>
          <FlagStatePicker flagStates={flagStates} value={flagState} onValueChange={setFlagState} />
        </div>

        {/* Dates — day-level precision */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Start date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>End date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={isCurrent}
              min={startDate || undefined}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={isCurrent}
            onCheckedChange={(checked) => {
              setIsCurrent(checked === true);
              if (checked) setEndDate('');
            }}
          />
          Currently onboard
        </label>

        {/* Contract type */}
        <div className="flex flex-col gap-1.5">
          <Label>Contract type</Label>
          <Select value={contractType} onValueChange={setContractType}>
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
        </div>

        {contractType === 'rotational' && (
          <div className="flex flex-col gap-2">
            <Label>Rotation pattern</Label>
            <div className="flex flex-wrap gap-1.5">
              {['2:2', '3:3', '3:1', '4:2', '5:1', '6:2', '10:10'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    const unit = contractDetails.includes('weeks') ? 'weeks' : 'months';
                    setContractDetails(`${p} ${unit}`);
                  }}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    contractDetails.startsWith(p + ' ')
                      ? 'border-primary bg-primary/10 font-medium'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={12}
                placeholder="On"
                value={(() => {
                  const m = contractDetails.match(/^(\d+):/);
                  return m?.[1] ?? '';
                })()}
                onChange={(e) => {
                  const off = contractDetails.match(/:(\d+)/)?.[1] ?? '';
                  const unit = contractDetails.includes('weeks') ? 'weeks' : 'months';
                  setContractDetails(`${e.target.value}:${off} ${unit}`);
                }}
                className="w-16"
              />
              <span className="text-sm font-medium">:</span>
              <Input
                type="number"
                min={1}
                max={12}
                placeholder="Off"
                value={(() => {
                  const m = contractDetails.match(/:(\d+)/);
                  return m?.[1] ?? '';
                })()}
                onChange={(e) => {
                  const on = contractDetails.match(/^(\d+):/)?.[1] ?? '';
                  const unit = contractDetails.includes('weeks') ? 'weeks' : 'months';
                  setContractDetails(`${on}:${e.target.value} ${unit}`);
                }}
                className="w-16"
              />
              <Select
                value={contractDetails.includes('weeks') ? 'weeks' : 'months'}
                onValueChange={(v) => {
                  const ratio = contractDetails.match(/^(\d+:\d+)/)?.[1] ?? '';
                  setContractDetails(ratio ? `${ratio} ${v}` : v);
                }}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="months">months</SelectItem>
                  <SelectItem value="weeks">weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {contractType === 'permanent' && (
          <div className="flex flex-col gap-1.5">
            <Label>Days leave per year</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={365}
                placeholder="28"
                value={(() => {
                  const m = contractDetails.match(/^(\d+)/);
                  return m?.[1] ?? '';
                })()}
                onChange={(e) =>
                  setContractDetails(e.target.value ? `${e.target.value} days leave/year` : '')
                }
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">days/year</span>
            </div>
          </div>
        )}

        {contractType === 'seasonal' && (
          <div className="flex flex-col gap-1.5">
            <Label>Season period</Label>
            <Input
              placeholder="e.g. March — October"
              value={contractDetails}
              onChange={(e) => setContractDetails(e.target.value)}
              maxLength={100}
            />
          </div>
        )}

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <Label>Description (optional)</Label>
          <Textarea
            placeholder="Brief description of your role and responsibilities"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={250}
            rows={3}
          />
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || !roleId || !startDate || !imoNumber}
          className="w-full"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Add experience'
          )}
        </Button>
      </div>
    </main>
  );
}
