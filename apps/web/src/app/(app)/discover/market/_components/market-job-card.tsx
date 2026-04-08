'use client';

import { MapPin, Calendar, Briefcase, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { currencySymbol } from '@dockwalker/shared';
import { languageLabel } from '@dockwalker/shared';

export interface MarketCard {
  type: 'daywork' | 'permanent';
  id: string;
  created_at: string;
  role_name: string | null;
  role_department: string | null;
  vessel_name: string | null;
  vessel_nda: boolean;
  vessel_type: string | null;
  vessel_loa: number | null;
  vessel_size_label: string | null;
  port_name: string | null;
  city_name: string | null;
  region_name: string | null;
  // Daywork-specific
  start_date?: string;
  end_date?: string;
  working_days?: number;
  day_rate?: number;
  currency?: string;
  // Permanent-specific
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  salary_period?: string;
  live_aboard?: boolean;
  shortlist_cap?: number;
  // Shared
  experience_label: string | null;
  cert_names: string[];
  required_languages: string[];
}

export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function formatSalary(min: number, max: number, currency: string, period: string): string {
  const sym = currencySymbol(currency);
  const per = period === 'annual' ? '/year' : '/month';
  if (min === max) return `${sym}${min.toLocaleString()}${per}`;
  return `${sym}${min.toLocaleString()} - ${sym}${max.toLocaleString()}${per}`;
}

export function MarketCardView({ card }: { card: MarketCard }) {
  const vesselDisplay = card.vessel_nda ? 'NDA Vessel' : (card.vessel_name ?? 'Vessel');
  const typePrefix =
    card.vessel_type === 'motor' ? 'M/Y' : card.vessel_type === 'sail' ? 'S/Y' : '';

  return (
    <Card className="transition-colors hover:border-primary/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {card.role_name && (
                <EpauletteBadge
                  roleName={card.role_name}
                  department={card.role_department ?? 'deck'}
                  size="sm"
                />
              )}
              <p className="text-sm font-semibold">{card.role_name ?? 'Role'}</p>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {typePrefix} {vesselDisplay}
              {card.vessel_size_label && ` · ${card.vessel_size_label}`}
            </p>
          </div>
          <Badge
            variant={card.type === 'daywork' ? 'secondary' : 'outline'}
            className="text-[10px]"
          >
            {card.type === 'daywork' ? 'Daywork' : 'Permanent'}
          </Badge>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {card.port_name && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {card.port_name}
            </span>
          )}
          {card.start_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {card.type === 'daywork' && card.end_date
                ? `${formatShortDate(card.start_date)} - ${formatShortDate(card.end_date)}`
                : formatShortDate(card.start_date)}
            </span>
          )}
          {card.type === 'daywork' && card.day_rate && (
            <span className="flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {currencySymbol(card.currency ?? 'EUR')}
              {card.day_rate}/day
            </span>
          )}
          {card.type === 'permanent' && card.salary_min != null && (
            <span className="flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {formatSalary(
                card.salary_min,
                card.salary_max ?? card.salary_min,
                card.salary_currency ?? 'EUR',
                card.salary_period ?? 'monthly',
              )}
            </span>
          )}
        </div>

        {(card.cert_names.length > 0 || card.required_languages.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {card.cert_names.map((name) => (
              <span
                key={name}
                className="inline-flex items-center rounded-full border border-muted-foreground/30 px-2 py-0.5 text-xs text-muted-foreground"
              >
                <Award className="mr-0.5 h-3 w-3" />
                {name}
              </span>
            ))}
            {card.required_languages.map((code) => (
              <span
                key={code}
                className="inline-flex items-center rounded-full border border-muted-foreground/30 px-2 py-0.5 text-xs text-muted-foreground"
              >
                {languageLabel(code)}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CardDetail({ card }: { card: MarketCard }) {
  const vesselDisplay = card.vessel_nda ? 'NDA Vessel' : (card.vessel_name ?? 'Vessel');
  const typePrefix =
    card.vessel_type === 'motor' ? 'M/Y' : card.vessel_type === 'sail' ? 'S/Y' : '';

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          {card.role_name && (
            <EpauletteBadge
              roleName={card.role_name}
              department={card.role_department ?? 'deck'}
              size="md"
            />
          )}
          <h2 className="text-lg font-bold">{card.role_name ?? 'Role'}</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {typePrefix} {vesselDisplay}
          {card.vessel_size_label && ` · ${card.vessel_size_label}`}
          {card.vessel_loa && ` · ${card.vessel_loa}m`}
        </p>
      </div>

      <Badge variant={card.type === 'daywork' ? 'secondary' : 'outline'} className="w-fit">
        {card.type === 'daywork' ? 'Daywork' : 'Permanent'}
      </Badge>

      <div className="flex flex-col gap-2 text-sm">
        {card.port_name && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>
              {[card.port_name, card.city_name, card.region_name].filter(Boolean).join(', ')}
            </span>
          </div>
        )}
        {card.start_date && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>
              {card.type === 'daywork' && card.end_date
                ? `${formatShortDate(card.start_date)} - ${formatShortDate(card.end_date)} (${card.working_days} days)`
                : `Start: ${formatShortDate(card.start_date)}`}
            </span>
          </div>
        )}
        {card.type === 'daywork' && card.day_rate && (
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <span>
              {currencySymbol(card.currency ?? 'EUR')}
              {card.day_rate}/day
            </span>
          </div>
        )}
        {card.type === 'permanent' && card.salary_min != null && (
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <span>
              {formatSalary(
                card.salary_min,
                card.salary_max ?? card.salary_min,
                card.salary_currency ?? 'EUR',
                card.salary_period ?? 'monthly',
              )}
            </span>
          </div>
        )}
        {card.experience_label && (
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-muted-foreground" />
            <span>{card.experience_label}</span>
          </div>
        )}
      </div>

      {(card.cert_names.length > 0 || card.required_languages.length > 0) && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Requirements</p>
          <div className="flex flex-wrap gap-1.5">
            {card.cert_names.map((name) => (
              <Badge key={name} variant="outline" className="text-xs">
                <Award className="mr-0.5 h-3 w-3" />
                {name}
              </Badge>
            ))}
            {card.required_languages.map((code) => (
              <Badge key={code} variant="outline" className="text-xs">
                {languageLabel(code)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {card.live_aboard && (
        <Badge variant="secondary" className="w-fit bg-[var(--success-lo)] text-[var(--success)]">
          Live aboard
        </Badge>
      )}
    </div>
  );
}
