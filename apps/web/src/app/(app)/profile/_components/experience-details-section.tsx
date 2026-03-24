'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RolePicker } from '@/components/role-picker';
import { FlagStatePicker } from '@/components/flag-state-picker';

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

export interface ExperienceDetailsSectionProps {
  roles: RoleItem[];
  roleId: string;
  setRoleId: (v: string) => void;
  expVesselOperation: 'charter' | 'private';
  setExpVesselOperation: (v: 'charter' | 'private') => void;
  flagStates: FlagState[];
  flagState: string;
  setFlagState: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  isCurrent: boolean;
  setIsCurrent: (v: boolean) => void;
  isAgent: boolean;
  contractType: string;
  setContractType: (v: string) => void;
  contractDetails: string;
  setContractDetails: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
}

export function ExperienceDetailsSection({
  roles,
  roleId,
  setRoleId,
  expVesselOperation,
  setExpVesselOperation,
  flagStates,
  flagState,
  setFlagState,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  isCurrent,
  setIsCurrent,
  isAgent,
  contractType,
  setContractType,
  contractDetails,
  setContractDetails,
  description,
  setDescription,
}: ExperienceDetailsSectionProps) {
  return (
    <>
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
      {!isAgent && (
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
      )}

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
    </>
  );
}
