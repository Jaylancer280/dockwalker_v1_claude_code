'use client';

import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTheme } from '@/components/theme-provider';
import type { DistanceUnit, CurrencyCode } from '@dockwalker/shared';

export interface AppearanceSectionProps {
  distanceUnit: DistanceUnit;
  onDistanceUnitChange: (v: DistanceUnit) => void;
  currencyPref: CurrencyCode;
  onCurrencyPrefChange: (v: CurrencyCode) => void;
}

type ThemeOption = 'light' | 'dark' | 'system';

const themeOptions: { value: ThemeOption; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function AppearanceSection({
  distanceUnit,
  onDistanceUnitChange,
  currencyPref,
  onCurrencyPrefChange,
}: AppearanceSectionProps) {
  const { theme, setTheme } = useTheme();

  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Appearance
      </h2>
      <div className="flex flex-col gap-1 rounded-[14px] border border-[var(--border)] bg-[var(--card)]">
        {/* Theme */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-xs text-muted-foreground">Choose light, dark, or system default</p>
          </div>
          <div className="flex gap-1 rounded-lg border border-border bg-background p-0.5">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  theme === opt.value
                    ? 'bg-accent text-white'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Distance units */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium">Distance &amp; size units</p>
            <p className="text-xs text-muted-foreground">
              {distanceUnit === 'mi' ? 'Vessel sizes in feet' : 'Vessel sizes in metres'}
            </p>
          </div>
          <Select
            value={distanceUnit}
            onValueChange={(v) => onDistanceUnitChange(v as DistanceUnit)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="km">Kilometres</SelectItem>
              <SelectItem value="mi">Miles / feet</SelectItem>
              <SelectItem value="nm">Nautical miles</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Default posting currency */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium">Default posting currency</p>
            <p className="text-xs text-muted-foreground">Pre-selected when creating a job</p>
          </div>
          <Select
            value={currencyPref}
            onValueChange={(v) => onCurrencyPrefChange(v as CurrencyCode)}
          >
            <SelectTrigger className="w-[100px]">
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
      </div>
    </section>
  );
}
