'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VesselSelector } from '@/components/vessels/vessel-selector';
import { LocationPicker } from '@/components/location-picker';
import { HierarchicalPills, rolesToGroups, certsToGroups } from '@/components/hierarchical-pills';
import { ExperienceBracketPills } from '@/components/experience-bracket-pills';
import { type CurrencyCode } from '@dockwalker/shared';
import { LANGUAGES } from '@dockwalker/shared';

interface LookupItem {
  id: string;
  name: string;
  department?: string;
  category?: string;
}

// ── RoleLocationSection ──

export interface RoleLocationSectionProps {
  vesselId: string;
  setVesselId: (v: string) => void;
  roleId: string;
  setRoleId: (v: string) => void;
  roles: LookupItem[];
  locationPortId: string;
  setLocationPortId: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  onRequestCreateVessel: () => void;
  onVesselNameChange?: (name: string) => void;
}

export function RoleLocationSection({
  vesselId,
  setVesselId,
  roleId,
  setRoleId,
  roles,
  locationPortId,
  setLocationPortId,
  startDate,
  setStartDate,
  onRequestCreateVessel,
  onVesselNameChange,
}: RoleLocationSectionProps) {
  return (
    <>
      {/* Vessel */}
      <div>
        <Label>Vessel</Label>
        <VesselSelector
          value={vesselId}
          onValueChange={setVesselId}
          onNameChange={onVesselNameChange}
          onRequestCreate={onRequestCreateVessel}
        />
      </div>

      {/* Role */}
      <div>
        <Label>Role</Label>
        <HierarchicalPills
          groups={rolesToGroups(
            roles.filter((r): r is typeof r & { department: string } => !!r.department),
          )}
          value={roleId}
          onValueChange={(v) => setRoleId(v as string)}
          mode="single"
        />
      </div>

      {/* Location */}
      <div>
        <Label>Location (port/marina)</Label>
        <LocationPicker
          mode="port-required"
          value={locationPortId ? { portId: locationPortId } : null}
          onValueChange={(v) => setLocationPortId(v.portId ?? '')}
        />
      </div>

      {/* Start date */}
      <div>
        <Label>Start date</Label>
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <p className="mt-1 text-xs text-muted-foreground">
          Past dates are allowed — they display as &quot;ASAP&quot; on cards.
        </p>
      </div>
    </>
  );
}

// ── ContractTermsSection ──

export interface ContractTermsSectionProps {
  liveAboard: boolean;
  setLiveAboard: (v: boolean) => void;
  shortlistCap: string;
  setShortlistCap: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  contractType: string;
  setContractType: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  meals: string[];
  setMeals: React.Dispatch<React.SetStateAction<string[]>>;
  positionsAvailable: string;
  setPositionsAvailable: (v: string) => void;
}

const CONTRACT_TYPES = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'rotational', label: 'Rotational' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'crossing', label: 'Crossing' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'temporary', label: 'Temporary' },
];

const MEAL_OPTIONS = ['breakfast', 'lunch', 'dinner'];

export function ContractTermsSection({
  liveAboard,
  setLiveAboard,
  shortlistCap,
  setShortlistCap,
  notes,
  setNotes,
  contractType,
  setContractType,
  description,
  setDescription,
  meals,
  setMeals,
  positionsAvailable,
  setPositionsAvailable,
}: ContractTermsSectionProps) {
  return (
    <>
      {/* Contract type */}
      <div>
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

      {/* Description */}
      <div>
        <Label>Job description (optional)</Label>
        <textarea
          className="w-full rounded-md border bg-[var(--card)] px-3 py-2 text-sm"
          rows={4}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the role, responsibilities, and what you're looking for..."
        />
      </div>

      {/* Positions available */}
      <div>
        <Label>Positions available</Label>
        <Input
          type="number"
          min={1}
          max={20}
          value={positionsAvailable}
          onChange={(e) => setPositionsAvailable(e.target.value)}
          className="w-24"
        />
      </div>

      {/* Live aboard */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="liveAboard"
          checked={liveAboard}
          onCheckedChange={(v) => setLiveAboard(v === true)}
        />
        <Label htmlFor="liveAboard" className="cursor-pointer">
          Live aboard included
        </Label>
      </div>

      {/* Meals */}
      <div>
        <Label>Meals provided</Label>
        <div className="flex gap-3 mt-1">
          {MEAL_OPTIONS.map((meal) => (
            <label key={meal} className="flex items-center gap-1.5 text-sm">
              <Checkbox
                checked={meals.includes(meal)}
                onCheckedChange={() =>
                  setMeals((prev) =>
                    prev.includes(meal) ? prev.filter((m) => m !== meal) : [...prev, meal],
                  )
                }
              />
              {meal}
            </label>
          ))}
        </div>
      </div>

      {/* Shortlist cap */}
      <div>
        <Label>Shortlist cap</Label>
        <Input
          type="number"
          min={1}
          max={20}
          value={shortlistCap}
          onChange={(e) => setShortlistCap(e.target.value)}
          className="w-24"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Maximum candidates on your shortlist (1-20).
        </p>
      </div>

      {/* Notes */}
      <div>
        <Label>Notes (optional)</Label>
        <textarea
          className="w-full rounded-md border bg-[var(--card)] px-3 py-2 text-sm"
          rows={3}
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes, benefits, perks..."
        />
        <p className="text-right text-xs text-muted-foreground">{notes.length}/500</p>
      </div>
    </>
  );
}

// ── SalarySection ──

export interface SalarySectionProps {
  salaryMin: string;
  setSalaryMin: (v: string) => void;
  salaryMax: string;
  setSalaryMax: (v: string) => void;
  salaryCurrency: CurrencyCode;
  setSalaryCurrency: (v: CurrencyCode) => void;
  salaryPeriod: string;
  setSalaryPeriod: (v: string) => void;
  salaryPreview: string | null;
}

export function SalarySection({
  salaryMin,
  setSalaryMin,
  salaryMax,
  setSalaryMax,
  salaryCurrency,
  setSalaryCurrency,
  salaryPeriod,
  setSalaryPeriod,
  salaryPreview,
}: SalarySectionProps) {
  return (
    <div>
      <Label>Salary range</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          placeholder="Min"
          value={salaryMin}
          onChange={(e) => setSalaryMin(e.target.value)}
          className="w-28"
        />
        <span className="text-muted-foreground">-</span>
        <Input
          type="number"
          placeholder="Max"
          value={salaryMax}
          onChange={(e) => setSalaryMax(e.target.value)}
          className="w-28"
        />
        <Select value={salaryCurrency} onValueChange={(v) => setSalaryCurrency(v as CurrencyCode)}>
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
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-sm ${salaryPeriod === 'monthly' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--card)] border border-[var(--border)]'}`}
          onClick={() => setSalaryPeriod('monthly')}
        >
          Monthly
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-sm ${salaryPeriod === 'annual' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--card)] border border-[var(--border)]'}`}
          onClick={() => setSalaryPeriod('annual')}
        >
          Annual
        </button>
      </div>
      {salaryPreview && (
        <p className="mt-1 text-sm font-medium text-[var(--accent)]">{salaryPreview}</p>
      )}
    </div>
  );
}

// ── RequirementsSection ──

export interface RequirementsSectionProps {
  certifications: LookupItem[];
  certificationIds: string[];
  setCertificationIds: React.Dispatch<React.SetStateAction<string[]>>;
  requiredLangs: string[];
  setRequiredLangs: React.Dispatch<React.SetStateAction<string[]>>;
  experienceBrackets: LookupItem[];
  experienceBracketId: string;
  setExperienceBracketId: (v: string) => void;
}

export function RequirementsSection({
  certifications,
  certificationIds,
  setCertificationIds,
  requiredLangs,
  setRequiredLangs,
  experienceBrackets,
  experienceBracketId,
  setExperienceBracketId,
}: RequirementsSectionProps) {
  return (
    <>
      {/* Certifications */}
      <div>
        <Label>Required certifications</Label>
        <HierarchicalPills
          groups={certsToGroups(
            certifications.filter((c): c is typeof c & { category: string } => !!c.category),
          )}
          value={certificationIds}
          onValueChange={(v) => setCertificationIds(v as string[])}
          mode="multi"
        />
      </div>

      {/* Languages */}
      <div>
        <Label>Languages (optional)</Label>
        <div className="mt-1 flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              className={`rounded-full px-3 py-1 text-xs ${
                requiredLangs.includes(lang.code)
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)]'
              }`}
              onClick={() =>
                setRequiredLangs((prev) =>
                  prev.includes(lang.code)
                    ? prev.filter((c) => c !== lang.code)
                    : [...prev, lang.code],
                )
              }
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Experience bracket */}
      <div>
        <Label>Minimum experience (optional)</Label>
        <ExperienceBracketPills
          brackets={experienceBrackets}
          value={experienceBracketId}
          onValueChange={setExperienceBracketId}
          optional
        />
      </div>
    </>
  );
}
