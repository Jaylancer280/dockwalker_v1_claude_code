'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  MapPin,
  Calendar,
  Briefcase,
  Award,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LocationPicker } from '@/components/location-picker';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { createClient } from '@/lib/supabase/client';
import { safeFetch } from '@/lib/safe-fetch';
import { currencySymbol } from '@/lib/units';
import { languageLabel } from '@/lib/languages';
import { logAgentActivity } from '@/lib/agent-activity';

interface MarketCard {
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

interface LookupItem {
  id: string;
  name: string;
}

export default function MarketFeedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<MarketCard[]>([]);
  const [hasMoreDaywork, setHasMoreDaywork] = useState(true);
  const [hasMorePermanent, setHasMorePermanent] = useState(true);
  const [dayworkCursor, setDayworkCursor] = useState<string | null>(null);
  const [permanentCursor, setPermanentCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedCard, setSelectedCard] = useState<MarketCard | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterRoleId, setFilterRoleId] = useState('');
  const [filterPortId, setFilterPortId] = useState('');
  const [filterCertId, setFilterCertId] = useState('');
  const [roles, setRoles] = useState<LookupItem[]>([]);
  const [certs, setCerts] = useState<LookupItem[]>([]);

  // Access control — redirect non-agents
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  // Debounced filter telemetry
  const filterLogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!authorized) return;
    if (filterLogRef.current) clearTimeout(filterLogRef.current);
    filterLogRef.current = setTimeout(() => {
      const active: Record<string, string> = {};
      if (filterRoleId && filterRoleId !== 'all') active.roleId = filterRoleId;
      if (filterPortId && filterPortId !== 'all') active.portId = filterPortId;
      if (filterCertId && filterCertId !== 'all') active.certificationId = filterCertId;
      if (Object.keys(active).length > 0) {
        logAgentActivity('market_feed_filtered', active);
      }
    }, 2500);
    return () => {
      if (filterLogRef.current) clearTimeout(filterLogRef.current);
    };
  }, [authorized, filterRoleId, filterPortId, filterCertId]);

  useEffect(() => {
    async function checkAccess() {
      const result = await safeFetch<{ person?: { identity_type?: string } }>('/api/profile');
      if (result.ok && result.data.person?.identity_type === 'agent') {
        setAuthorized(true);
        logAgentActivity('market_feed_opened');
      } else {
        router.replace('/daywork/mine');
      }
    }
    checkAccess();
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
    async function loadLookups() {
      const supabase = createClient();
      const [rolesRes, certsRes] = await Promise.all([
        supabase.from('yacht_roles').select('id, name').order('sort_order'),
        supabase.from('certifications').select('id, name').order('sort_order'),
      ]);
      if (rolesRes.data) setRoles(rolesRes.data);
      if (certsRes.data) setCerts(certsRes.data);
    }
    loadLookups();
  }, [authorized]);

  const buildFilterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (filterRoleId && filterRoleId !== 'all') params.set('roleId', filterRoleId);
    if (filterPortId && filterPortId !== 'all') params.set('portId', filterPortId);
    if (filterCertId && filterCertId !== 'all') params.set('certificationId', filterCertId);
    return params.toString();
  }, [filterRoleId, filterPortId, filterCertId]);

  const loadFeed = useCallback(
    async (append = false) => {
      if (!authorized) return;
      if (!append) setLoading(true);
      else setLoadingMore(true);

      const filters = buildFilterParams();
      const dwCursor = append ? dayworkCursor : null;
      const pmCursor = append ? permanentCursor : null;

      const fetches: Promise<MarketCard[]>[] = [];

      // Daywork
      if (!append || hasMoreDaywork) {
        fetches.push(
          (async () => {
            const url = `/api/daywork/discover?${filters}${dwCursor ? `&cursor=${dwCursor}` : ''}`;
            const res = await safeFetch<{
              dayworks?: Record<string, unknown>[];
              has_more?: boolean;
              next_cursor?: string | null;
            }>(url);
            if (!res.ok) return [];
            setHasMoreDaywork(res.data.has_more ?? false);
            setDayworkCursor(res.data.next_cursor ?? null);
            return (res.data.dayworks ?? []).map((dw) => ({
              type: 'daywork' as const,
              id: dw.id as string,
              created_at: dw.created_at as string,
              role_name: (dw.yacht_roles as { name: string } | null)?.name ?? null,
              role_department:
                (dw.yacht_roles as { department: string } | null)?.department ?? null,
              vessel_name: (dw.vessels as { name: string; nda_flag: boolean } | null)?.name ?? null,
              vessel_nda: (dw.vessels as { nda_flag: boolean } | null)?.nda_flag ?? false,
              vessel_type: (dw.vessels as { vessel_type: string } | null)?.vessel_type ?? null,
              vessel_loa: (dw.vessels as { loa_meters: number } | null)?.loa_meters ?? null,
              vessel_size_label:
                (dw.vessels as { vessel_size_bands: { label: string } | null } | null)
                  ?.vessel_size_bands?.label ?? null,
              port_name: (dw.ports as { name: string } | null)?.name ?? null,
              city_name: (dw.ports as { cities: { name: string } } | null)?.cities?.name ?? null,
              region_name:
                (dw.ports as { cities: { regions: { name: string } } } | null)?.cities?.regions
                  ?.name ?? null,
              start_date: dw.start_date as string,
              end_date: dw.end_date as string,
              working_days: dw.working_days as number,
              day_rate: dw.day_rate as number,
              currency: dw.currency as string,
              experience_label: (dw.experience_brackets as { label: string } | null)?.label ?? null,
              cert_names: (dw.cert_names as string[]) ?? [],
              required_languages: (dw.required_languages as string[]) ?? [],
            }));
          })(),
        );
      } else {
        fetches.push(Promise.resolve([]));
      }

      // Permanent
      if (!append || hasMorePermanent) {
        fetches.push(
          (async () => {
            const url = `/api/permanent/discover?${filters}${pmCursor ? `&cursor=${pmCursor}` : ''}`;
            const res = await safeFetch<{
              postings?: Record<string, unknown>[];
              has_more?: boolean;
              next_cursor?: string | null;
            }>(url);
            if (!res.ok) return [];
            setHasMorePermanent(res.data.has_more ?? false);
            setPermanentCursor(res.data.next_cursor ?? null);
            return (res.data.postings ?? []).map((pm) => ({
              type: 'permanent' as const,
              id: pm.id as string,
              created_at: pm.created_at as string,
              role_name: pm.role_name as string | null,
              role_department: pm.role_department as string | null,
              vessel_name: pm.vessel_name as string | null,
              vessel_nda: (pm.vessel_nda as boolean) ?? false,
              vessel_type: pm.vessel_type as string | null,
              vessel_loa: pm.vessel_loa as number | null,
              vessel_size_label: pm.vessel_size_label as string | null,
              port_name: pm.port_name as string | null,
              city_name: pm.city_name as string | null,
              region_name: pm.region_name as string | null,
              salary_min: pm.salary_min as number,
              salary_max: pm.salary_max as number,
              salary_currency: pm.salary_currency as string,
              salary_period: pm.salary_period as string,
              live_aboard: pm.live_aboard as boolean,
              shortlist_cap: pm.shortlist_cap as number,
              start_date: pm.start_date as string,
              experience_label: pm.experience_label as string | null,
              cert_names: (pm.cert_names as string[]) ?? [],
              required_languages: (pm.required_languages as string[]) ?? [],
            }));
          })(),
        );
      } else {
        fetches.push(Promise.resolve([]));
      }

      const [dwCards, pmCards] = await Promise.all(fetches);
      const merged = [...dwCards, ...pmCards].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      if (append) {
        setCards((prev) => [...prev, ...merged]);
      } else {
        setCards(merged);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [
      authorized,
      buildFilterParams,
      dayworkCursor,
      permanentCursor,
      hasMoreDaywork,
      hasMorePermanent,
    ],
  );

  useEffect(() => {
    if (authorized) loadFeed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, filterRoleId, filterPortId, filterCertId]);

  if (authorized === null) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  // Detail view
  if (selectedCard) {
    return (
      <main className="flex min-h-svh flex-col bg-background">
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-4 py-3">
          <button
            onClick={() => setSelectedCard(null)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to market
          </button>
        </header>
        <div className="mx-auto w-full max-w-lg p-4">
          <CardDetail card={selectedCard} />
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <button
            onClick={() => router.push('/daywork/mine')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            My Jobs
          </button>
          <h1 className="text-sm font-semibold">Job Market</h1>
          <Button variant="ghost" size="icon" onClick={() => setShowFilters((f) => !f)}>
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-4">
        {showFilters && (
          <Card className="mb-4">
            <CardContent className="flex flex-col gap-3 pt-4">
              <Select value={filterRoleId} onValueChange={setFilterRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <LocationPicker
                mode="port-required"
                value={filterPortId ? { portId: filterPortId } : null}
                onValueChange={(v) => setFilterPortId(v.portId ?? '')}
                placeholder="All locations"
              />
              <Select value={filterCertId} onValueChange={setFilterCertId}>
                <SelectTrigger>
                  <SelectValue placeholder="All certifications" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All certifications</SelectItem>
                  {certs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && cards.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">No postings found</p>
        )}

        <div className="flex flex-col gap-3">
          {cards.map((card) => (
            <button
              key={`${card.type}-${card.id}`}
              onClick={() => {
                setSelectedCard(card);
                logAgentActivity('market_feed_card_viewed', { postingType: card.type });
              }}
              className="w-full text-left"
            >
              <MarketCardView card={card} />
            </button>
          ))}
        </div>

        {(hasMoreDaywork || hasMorePermanent) && !loading && cards.length > 0 && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={() => loadFeed(true)} disabled={loadingMore}>
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Load more
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

function MarketCardView({ card }: { card: MarketCard }) {
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

function CardDetail({ card }: { card: MarketCard }) {
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
        <Badge variant="secondary" className="w-fit bg-green-100 text-green-800">
          Live aboard
        </Badge>
      )}
    </div>
  );
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatSalary(min: number, max: number, currency: string, period: string): string {
  const sym = currencySymbol(currency);
  const per = period === 'annual' ? '/year' : '/month';
  if (min === max) return `${sym}${min.toLocaleString()}${per}`;
  return `${sym}${min.toLocaleString()} - ${sym}${max.toLocaleString()}${per}`;
}
