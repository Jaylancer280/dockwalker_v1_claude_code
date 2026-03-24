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

export interface PrivateIntelligenceSectionProps {
  salaryAmount: string;
  setSalaryAmount: (v: string) => void;
  salaryPeriod: 'daily' | 'monthly' | 'annually';
  setSalaryPeriod: (v: 'daily' | 'monthly' | 'annually') => void;
  salaryCurrency: string;
  setSalaryCurrency: (v: string) => void;
  seaTimeDays: string;
  setSeaTimeDays: (v: string) => void;
  seaTimeNauticalMiles: string;
  setSeaTimeNauticalMiles: (v: string) => void;
  /** Optional extra note below heading, e.g. for edit page */
  extraNote?: string;
}

export function PrivateIntelligenceSection({
  salaryAmount,
  setSalaryAmount,
  salaryPeriod,
  setSalaryPeriod,
  salaryCurrency,
  setSalaryCurrency,
  seaTimeDays,
  setSeaTimeDays,
  seaTimeNauticalMiles,
  setSeaTimeNauticalMiles,
  extraNote,
}: PrivateIntelligenceSectionProps) {
  return (
    <div className="border-t border-border pt-4">
      <h3 className="text-sm font-semibold">Private intelligence (optional)</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        This data is never shown to anyone. It enhances Docky&apos;s career advice accuracy for you.
        {extraNote && ` ${extraNote}`}
      </p>

      {/* Salary */}
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
            onValueChange={(v) => setSalaryPeriod(v as 'daily' | 'monthly' | 'annually')}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">per day</SelectItem>
              <SelectItem value="monthly">per month</SelectItem>
              <SelectItem value="annually">per year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Verified sea time */}
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
  );
}
