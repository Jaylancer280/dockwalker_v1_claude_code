'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, SlidersHorizontal } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading-spinner';
import { Button } from '@/components/ui/button';
import { useLookups } from '@/hooks/use-lookups';
import { safeFetch } from '@/lib/safe-fetch';
import { logAgentActivity } from '@/lib/agent-activity';
import { MarketFilterPanel } from './_components/market-filter-panel';
import { MarketFeed } from './_components/market-feed';
import { CardDetail, type MarketCard } from './_components/market-job-card';

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
  const lookups = useLookups();
  const roles = lookups.roles as LookupItem[];
  const certs = lookups.certifications as LookupItem[];

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
        <LoadingSpinner size="md" />
      </main>
    );
  }

  // Detail view
  if (selectedCard) {
    return (
      <main className="flex min-h-svh flex-col bg-background">
        <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <button
            onClick={() => setSelectedCard(null)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to market
          </button>
        </header>
        <div className="page-width w-full p-4">
          <CardDetail card={selectedCard} />
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="page-width flex items-center justify-between">
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

      <div className="page-width w-full flex-1 px-4 py-4">
        {showFilters && (
          <MarketFilterPanel
            filterRoleId={filterRoleId}
            setFilterRoleId={setFilterRoleId}
            filterPortId={filterPortId}
            setFilterPortId={setFilterPortId}
            filterCertId={filterCertId}
            setFilterCertId={setFilterCertId}
            roles={roles}
            certs={certs}
          />
        )}

        <MarketFeed
          loading={loading}
          cards={cards}
          hasMore={hasMoreDaywork || hasMorePermanent}
          loadingMore={loadingMore}
          onLoadMore={() => loadFeed(true)}
          onSelectCard={setSelectedCard}
        />
      </div>
    </main>
  );
}
