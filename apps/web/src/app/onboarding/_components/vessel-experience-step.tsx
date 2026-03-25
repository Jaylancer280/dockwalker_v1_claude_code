'use client';

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
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react';

interface FlagState {
  id: string;
  name: string;
}

interface LookupItem {
  id: string;
  name: string;
  label?: string;
  department?: string;
  category?: string;
}

export interface VesselExperienceEntry {
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

export interface VesselExperienceStepProps {
  experienceEntries: VesselExperienceEntry[];
  setExperienceEntries: React.Dispatch<React.SetStateAction<VesselExperienceEntry[]>>;
  lookingUpImo: string | null;
  error: string | null;
  roles: LookupItem[];
  flagStates: FlagState[];

  lookupImo: (entryKey: string, imoNumber: string) => void;
  updateEntry: (
    key: string,
    field: 'vessel' | 'experience',
    updates: Record<string, unknown>,
  ) => void;
  removeEntry: (key: string) => void;
  addEntry: () => void;
  onBack: () => void;
  onNext: () => void;
  setError: (v: string | null) => void;
}

export function VesselExperienceStep(props: VesselExperienceStepProps) {
  const {
    experienceEntries,
    lookingUpImo,
    error,
    roles,
    flagStates,
    lookupImo,
    updateEntry,
    removeEntry,
    addEntry,
    onBack,
    onNext,
    setError,
  } = props;

  return (
    <main className="flex min-h-svh flex-col items-start justify-start bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <button
          onClick={onBack}
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
            className="flex flex-col gap-4 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4"
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
                onValueChange={(v) => updateEntry(entry.key, 'experience', { vesselOperation: v })}
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
                  onValueChange={(v) => updateEntry(entry.key, 'experience', { salaryCurrency: v })}
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
          onClick={addEntry}
          className="flex items-center justify-center gap-2 rounded-[14px] border border-dashed border-border p-3 text-sm text-muted-foreground transition-colors hover:border-[var(--border-hi)] hover:text-foreground"
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
            onNext();
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
