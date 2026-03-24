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
import { EpauletteBadge } from '@/components/epaulette-badge';
import { type CurrencyCode } from '@/lib/units';
import { LANGUAGES } from '@/lib/languages';

interface LookupItem {
  id: string;
  name: string;
  department?: string;
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
}: RoleLocationSectionProps) {
  return (
    <>
      {/* Vessel */}
      <div>
        <Label>Vessel</Label>
        <VesselSelector
          value={vesselId}
          onValueChange={setVesselId}
          onRequestCreate={onRequestCreateVessel}
        />
      </div>

      {/* Role */}
      <div>
        <Label className="flex items-center gap-2">
          Role
          {roleId && roles.find((r) => r.id === roleId)?.name && (
            <EpauletteBadge roleName={roles.find((r) => r.id === roleId)!.name} size="sm" />
          )}
        </Label>
        <Select value={roleId} onValueChange={setRoleId}>
          <SelectTrigger>
            <SelectValue placeholder="Select role..." />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
}

export function ContractTermsSection({
  liveAboard,
  setLiveAboard,
  shortlistCap,
  setShortlistCap,
  notes,
  setNotes,
}: ContractTermsSectionProps) {
  return (
    <>
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
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          rows={3}
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Job description, requirements, benefits..."
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
          className={`rounded-full px-3 py-1 text-sm ${salaryPeriod === 'monthly' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
          onClick={() => setSalaryPeriod('monthly')}
        >
          Monthly
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-sm ${salaryPeriod === 'annual' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
          onClick={() => setSalaryPeriod('annual')}
        >
          Annual
        </button>
      </div>
      {salaryPreview && <p className="mt-1 text-sm font-medium text-primary">{salaryPreview}</p>}
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
        <div className="mt-1 flex flex-wrap gap-2">
          {certifications.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`rounded-full px-3 py-1 text-xs ${
                certificationIds.includes(c.id)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
              onClick={() =>
                setCertificationIds((prev) =>
                  prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                )
              }
            >
              {c.name}
            </button>
          ))}
        </div>
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
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
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
        <Select value={experienceBracketId} onValueChange={setExperienceBracketId}>
          <SelectTrigger>
            <SelectValue placeholder="Any experience level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Any</SelectItem>
            {experienceBrackets.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
