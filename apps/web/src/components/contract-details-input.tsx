'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const CONTRACT_TYPES = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'rotational', label: 'Rotational' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'crossing', label: 'Crossing' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'temporary', label: 'Temporary' },
] as const;

export interface ContractDetailsInputProps {
  contractType: string;
  onContractTypeChange: (v: string) => void;
  contractDetails: string;
  onContractDetailsChange: (v: string) => void;
}

export function ContractDetailsInput({
  contractType,
  onContractTypeChange,
  contractDetails,
  onContractDetailsChange,
}: ContractDetailsInputProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label>Contract type</Label>
        <Select
          value={contractType}
          onValueChange={(v) => {
            onContractTypeChange(v);
            onContractDetailsChange('');
          }}
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
                  onContractDetailsChange(`${p} ${unit}`);
                }}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  contractDetails.startsWith(p + ' ')
                    ? 'border-[var(--accent)] bg-[var(--accent-lo)] font-medium'
                    : 'border-[var(--border)] hover:border-[var(--border-hi)]'
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
                onContractDetailsChange(`${e.target.value}:${off} ${unit}`);
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
                onContractDetailsChange(`${on}:${e.target.value} ${unit}`);
              }}
              className="w-16"
            />
            <Select
              value={contractDetails.includes('weeks') ? 'weeks' : 'months'}
              onValueChange={(v) => {
                const ratio = contractDetails.match(/^(\d+:\d+)/)?.[1] ?? '';
                onContractDetailsChange(ratio ? `${ratio} ${v}` : v);
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
                onContractDetailsChange(e.target.value ? `${e.target.value} days leave/year` : '')
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
            onChange={(e) => onContractDetailsChange(e.target.value)}
            maxLength={100}
          />
        </div>
      )}
    </>
  );
}
