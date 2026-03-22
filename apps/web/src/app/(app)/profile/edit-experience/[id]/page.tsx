'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import { ChevronLeft, Loader2 } from 'lucide-react';

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

export default function EditExperiencePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { showSuccess } = useToast();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [flagStates, setFlagStates] = useState<FlagState[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vessel info (read-only)
  const [vesselName, setVesselName] = useState('');
  const [vesselType, setVesselType] = useState('motor');

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

  // Private intelligence fields (write-only — GET never returns these)
  const [salaryAmount, setSalaryAmount] = useState('');
  const [salaryPeriod, setSalaryPeriod] = useState<'monthly' | 'annually'>('monthly');
  const [salaryCurrency, setSalaryCurrency] = useState(
    () => (typeof window !== 'undefined' && localStorage.getItem('dw-currency-pref')) || 'EUR',
  );
  const [seaTimeDays, setSeaTimeDays] = useState('');
  const [seaTimeNauticalMiles, setSeaTimeNauticalMiles] = useState('');

  const loadData = useCallback(async () => {
    try {
      const supabase = createClient();
      const [rolesRes, flagsRes, expResult] = await Promise.all([
        supabase.from('yacht_roles').select('id, name, department').order('sort_order'),
        supabase.from('flag_states').select('id, name').order('sort_order'),
        safeFetch<{
          experiences?: {
            id: string;
            role_id: string;
            vessel_operation: string;
            flag_state: string;
            start_date: string;
            end_date: string;
            is_current: boolean;
            contract_type: string;
            contract_details: string;
            description: string;
            vessels: { name: string; vessel_type: string } | null;
          }[];
        }>('/api/experiences'),
      ]);
      if (rolesRes.data) setRoles(rolesRes.data as RoleItem[]);
      if (flagsRes.data) setFlagStates(flagsRes.data);

      if (expResult.ok) {
        const exp = (expResult.data.experiences ?? []).find((e) => e.id === id);
        if (exp) {
          setRoleId(exp.role_id ?? '');
          setExpVesselOperation((exp.vessel_operation as 'charter' | 'private') ?? 'charter');
          setFlagState(exp.flag_state ?? '');
          setStartDate(exp.start_date ?? '');
          setEndDate(exp.end_date ?? '');
          setIsCurrent(exp.is_current ?? false);
          setContractType(exp.contract_type ?? '');
          setContractDetails(exp.contract_details ?? '');
          setDescription(exp.description ?? '');
          if (exp.vessels) {
            setVesselName(exp.vessels.name ?? '');
            setVesselType(exp.vessels.vessel_type ?? 'motor');
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSubmit() {
    if (!roleId || !startDate) return;
    setSubmitting(true);
    setError(null);

    const result = await safeFetch<{ error?: string }>(`/api/experiences/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roleId,
        startDate,
        endDate: endDate || null,
        isCurrent,
        vesselOperation: expVesselOperation,
        flagState: flagState || null,
        salaryAmount: salaryAmount ? Number(salaryAmount) : null,
        salaryCurrency: salaryAmount ? salaryCurrency : null,
        salaryPeriod: salaryAmount ? salaryPeriod : null,
        seaTimeDays: seaTimeDays ? Number(seaTimeDays) : null,
        seaTimeNauticalMiles: seaTimeNauticalMiles ? Number(seaTimeNauticalMiles) : null,
        contractType: contractType || null,
        contractDetails: contractDetails || null,
        description: description || null,
      }),
    });

    if (result.ok) {
      showSuccess('Experience updated');
      router.push('/profile');
      router.refresh();
    } else {
      setError(result.error);
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
          <h1 className="text-xl font-bold tracking-tight">Edit experience</h1>
          <p className="text-sm text-muted-foreground">
            {vesselPrefix} {vesselName || 'Unknown vessel'}
          </p>
        </div>

        {/* Role */}
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

        {/* Flag state */}
        <div className="flex flex-col gap-1.5">
          <Label>Flag state</Label>
          <FlagStatePicker flagStates={flagStates} value={flagState} onValueChange={setFlagState} />
        </div>

        {/* Dates */}
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

        {/* Private intelligence */}
        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Private intelligence (optional)</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            This data is never shown to anyone. It enhances Docky&apos;s career advice accuracy for
            you. Previously entered data is stored securely and cannot be retrieved.
          </p>

          <div className="mb-3 flex flex-col gap-1.5">
            <Label>Salary</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Amount"
                value={salaryAmount}
                onChange={(e) => setSalaryAmount(e.target.value)}
                min={0}
                className="flex-1"
              />
              <Select value={salaryCurrency} onValueChange={(v) => setSalaryCurrency(v)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="AED">AED</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={salaryPeriod}
                onValueChange={(v) => setSalaryPeriod(v as 'monthly' | 'annually')}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">per month</SelectItem>
                  <SelectItem value="annually">per year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Verified sea time</Label>
            <p className="text-[11px] text-muted-foreground">
              Engineering Officer routes require days. Deck Officer routes require nautical miles.
            </p>
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Days at sea</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={seaTimeDays}
                  onChange={(e) => setSeaTimeDays(e.target.value)}
                  min={0}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Nautical miles</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={seaTimeNauticalMiles}
                  onChange={(e) => setSeaTimeNauticalMiles(e.target.value)}
                  min={0}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || !roleId || !startDate}
          className="w-full"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save changes'
          )}
        </Button>
      </div>
    </main>
  );
}
