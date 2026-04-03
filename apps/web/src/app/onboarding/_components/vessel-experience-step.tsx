'use client';

import { useMemo } from 'react';
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
import { HierarchicalPills, rolesToGroups } from '@/components/hierarchical-pills';
import { FlagStatePicker } from '@/components/flag-state-picker';
import { ContractDetailsInput } from '@/components/contract-details-input';
import { ImoLookupSection } from '@/components/vessels/imo-lookup-section';
import { VesselDetailsSection } from '@/app/(app)/profile/_components/vessel-details-section';
import { usePreferences } from '@/hooks/use-preferences';
import { metersToFeet } from '@dockwalker/shared';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';

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

interface SizeBand {
  id: string;
  label: string;
  min_meters: number;
  max_meters: number | null;
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
    seaTimeDays: string;
    seaTimeNauticalMiles: string;
  };
}

export interface VesselExperienceStepProps {
  experienceEntries: VesselExperienceEntry[];
  setExperienceEntries: React.Dispatch<React.SetStateAction<VesselExperienceEntry[]>>;
  error: string | null;
  roles: LookupItem[];
  flagStates: FlagState[];
  sizeBands?: SizeBand[];

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
    error,
    roles,
    flagStates,
    updateEntry,
    removeEntry,
    addEntry,
    onBack,
    onNext,
    setError,
    sizeBands,
  } = props;
  const { lengthUnit } = usePreferences();

  return (
    <main className="flex min-h-svh flex-col items-start justify-start bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 md:max-w-2xl">
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
          <ExperienceEntryCard
            key={entry.key}
            entry={entry}
            index={index}
            canRemove={experienceEntries.length > 1}
            roles={roles}
            flagStates={flagStates}
            sizeBands={sizeBands}
            lengthUnit={lengthUnit}
            updateEntry={updateEntry}
            removeEntry={removeEntry}
          />
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

/**
 * Single experience entry card — field order matches add-experience page:
 * IMO → Type → Name → LOA → [divider] → Role → Operation → Flag → Dates →
 * Currently onboard → Contract → Description → [divider] → Salary → Sea time
 */
function ExperienceEntryCard({
  entry,
  index,
  canRemove,
  roles,
  flagStates,
  sizeBands,
  lengthUnit,
  updateEntry,
  removeEntry,
}: {
  entry: VesselExperienceEntry;
  index: number;
  canRemove: boolean;
  roles: LookupItem[];
  flagStates: FlagState[];
  sizeBands?: SizeBand[];
  lengthUnit: 'm' | 'ft';
  updateEntry: VesselExperienceStepProps['updateEntry'];
  removeEntry: VesselExperienceStepProps['removeEntry'];
}) {
  // Memoize vessel type for the VesselDetailsSection
  const setVesselType = useMemo(
    () => (v: 'motor' | 'sail') => updateEntry(entry.key, 'vessel', { vesselType: v }),
    [entry.key, updateEntry],
  );
  const setVesselName = useMemo(
    () => (v: string) =>
      updateEntry(entry.key, 'vessel', {
        name: v,
        useExisting: false,
        existingVesselId: undefined,
      }),
    [entry.key, updateEntry],
  );
  const setLoaMeters = useMemo(
    () => (v: string) => updateEntry(entry.key, 'vessel', { loaMeters: v }),
    [entry.key, updateEntry],
  );
  // Convert metres from IMO lookup to display units
  const handleLoaFromLookup = useMemo(
    () => (v: string) => {
      const m = Number(v);
      if (lengthUnit === 'ft' && Number.isFinite(m) && m > 0) {
        updateEntry(entry.key, 'vessel', { loaMeters: String(Math.round(metersToFeet(m))) });
      } else {
        updateEntry(entry.key, 'vessel', { loaMeters: v });
      }
    },
    [entry.key, updateEntry, lengthUnit],
  );

  return (
    <div className="flex flex-col gap-4 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Experience {index + 1}</p>
        {canRemove && (
          <button
            onClick={() => removeEntry(entry.key)}
            className="flex items-center gap-1 text-xs text-destructive hover:underline"
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </button>
        )}
      </div>

      {/* === Vessel section === */}
      {/* IMO lookup with partial match (shared component) */}
      <ImoLookupSection
        imoNumber={entry.vessel.imoNumber}
        setImoNumber={(v) =>
          updateEntry(entry.key, 'vessel', {
            imoNumber: v,
            useExisting: false,
            existingVesselId: undefined,
          })
        }
        useExisting={entry.vessel.useExisting}
        setUseExisting={(v) => updateEntry(entry.key, 'vessel', { useExisting: v })}
        existingVesselId={entry.vessel.existingVesselId ?? ''}
        setExistingVesselId={(v) => updateEntry(entry.key, 'vessel', { existingVesselId: v })}
        vesselName={entry.vessel.name}
        setVesselName={setVesselName}
        vesselType={entry.vessel.vesselType}
        setVesselType={setVesselType}
        loaMeters={entry.vessel.loaMeters}
        setLoaMeters={handleLoaFromLookup}
      />

      {/* Vessel details — shown when not using existing vessel */}
      {!entry.vessel.useExisting && (
        <VesselDetailsSection
          vesselType={entry.vessel.vesselType}
          setVesselType={setVesselType}
          vesselName={entry.vessel.name}
          setVesselName={setVesselName}
          loaMeters={entry.vessel.loaMeters}
          setLoaMeters={setLoaMeters}
          lengthUnit={lengthUnit}
          sizeBands={sizeBands}
        />
      )}

      <div className="my-1 border-t border-border" />

      {/* === Experience section === */}
      {/* Role held — department hierarchy picker */}
      <div className="flex flex-col gap-1.5">
        <Label>Role held</Label>
        <HierarchicalPills
          groups={rolesToGroups(
            roles.filter((r): r is typeof r & { department: string } => !!r.department),
          )}
          value={entry.experience.roleId}
          onValueChange={(v) => updateEntry(entry.key, 'experience', { roleId: v as string })}
          mode="single"
        />
      </div>

      {/* Vessel operation during tenure */}
      <div className="flex flex-col gap-1.5">
        <Label>Vessel operation (during your time)</Label>
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

      {/* Flag state — searchable picker */}
      <div className="flex flex-col gap-1.5">
        <Label>Flag state</Label>
        <FlagStatePicker
          flagStates={flagStates}
          value={entry.experience.flagState}
          onValueChange={(v) => updateEntry(entry.key, 'experience', { flagState: v })}
        />
      </div>

      {/* Dates — day-level precision */}
      <div className="grid grid-cols-1 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Start date</Label>
          <Input
            type="date"
            value={entry.experience.startDate}
            onChange={(e) => updateEntry(entry.key, 'experience', { startDate: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>End date</Label>
          <Input
            type="date"
            disabled={entry.experience.isCurrent}
            value={entry.experience.endDate}
            onChange={(e) => updateEntry(entry.key, 'experience', { endDate: e.target.value })}
            min={entry.experience.startDate || undefined}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={entry.experience.isCurrent}
          onCheckedChange={(checked) =>
            updateEntry(entry.key, 'experience', { isCurrent: !!checked, endDate: '' })
          }
        />
        Currently onboard
      </label>

      {/* Contract type — shared component with rich inputs */}
      <ContractDetailsInput
        contractType={entry.experience.contractType}
        onContractTypeChange={(v) => updateEntry(entry.key, 'experience', { contractType: v })}
        contractDetails={entry.experience.contractDetails}
        onContractDetailsChange={(v) =>
          updateEntry(entry.key, 'experience', { contractDetails: v })
        }
      />

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <Label>Description (optional)</Label>
        <Textarea
          placeholder="Brief description of your role and responsibilities"
          value={entry.experience.description}
          onChange={(e) => updateEntry(entry.key, 'experience', { description: e.target.value })}
          maxLength={250}
          rows={3}
        />
      </div>

      <div className="my-1 border-t border-border" />

      {/* === Private intelligence section === */}
      <h3 className="text-sm font-semibold">Private intelligence (optional)</h3>
      <p className="-mt-2 text-xs text-muted-foreground">
        This data is never shown to anyone. It enhances Docky&apos;s career advice accuracy for you.
      </p>

      {/* Salary */}
      <div className="flex flex-col gap-1.5">
        <Label>Salary</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Amount"
            value={entry.experience.salaryAmount}
            onChange={(e) => updateEntry(entry.key, 'experience', { salaryAmount: e.target.value })}
            min={0}
            className="flex-1"
          />
          <Select
            value={entry.experience.salaryCurrency}
            onValueChange={(v) => updateEntry(entry.key, 'experience', { salaryCurrency: v })}
          >
            <SelectTrigger className="w-24">
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
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">per day</SelectItem>
              <SelectItem value="monthly">per month</SelectItem>
              <SelectItem value="annually">per year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sea time */}
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
              value={entry.experience.seaTimeDays}
              onChange={(e) =>
                updateEntry(entry.key, 'experience', { seaTimeDays: e.target.value })
              }
              min={0}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Nautical miles</Label>
            <Input
              type="number"
              placeholder="0"
              value={entry.experience.seaTimeNauticalMiles}
              onChange={(e) =>
                updateEntry(entry.key, 'experience', { seaTimeNauticalMiles: e.target.value })
              }
              min={0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
