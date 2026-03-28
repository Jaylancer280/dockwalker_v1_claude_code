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
import { HierarchicalPills, rolesToGroups } from '@/components/hierarchical-pills';
import { FlagStatePicker } from '@/components/flag-state-picker';
import { ContractDetailsInput } from '@/components/contract-details-input';

interface RoleItem {
  id: string;
  name: string;
  department: string;
}

interface FlagState {
  id: string;
  name: string;
}

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
        <HierarchicalPills
          groups={rolesToGroups(roles)}
          value={roleId}
          onValueChange={(v) => setRoleId(v as string)}
          mode="single"
        />
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
      <div className="grid grid-cols-1 gap-3">
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
      <ContractDetailsInput
        contractType={contractType}
        onContractTypeChange={setContractType}
        contractDetails={contractDetails}
        onContractDetailsChange={setContractDetails}
      />

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
