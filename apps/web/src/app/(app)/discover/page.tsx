'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { hapticMedium, hapticLight } from '@/lib/haptics';
import {
  MapPin,
  Calendar,
  DollarSign,
  Briefcase,
  Award,
  Check,
  X,
  SlidersHorizontal,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';

interface DayworkCard {
  id: string;
  start_date: string;
  end_date: string;
  working_days: number;
  day_rate: number | null;
  meals: string[];
  notes: string | null;
  status: string;
  created_at: string;
  yacht_roles: { id: string; name: string; department: string } | null;
  ports: {
    id: string;
    name: string;
    cities: { name: string; regions: { name: string } };
  } | null;
  vessels: {
    name: string;
    nda_flag: boolean;
    vessel_type: string;
    vessel_size_bands: { label: string } | null;
  } | null;
  experience_brackets: { label: string } | null;
  required_certification_ids: string[] | null;
}

interface LookupItem {
  id: string;
  name: string;
}

interface PortItem {
  id: string;
  name: string;
  cities: { name: string; regions: { name: string } };
}

const SWIPE_THRESHOLD = 100;

export default function DiscoverPage() {
  const [cards, setCards] = useState<DayworkCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState('recency');
  const [filterRoleId, setFilterRoleId] = useState('');
  const [filterPortId, setFilterPortId] = useState('');

  // Lookups for filters
  const [roles, setRoles] = useState<LookupItem[]>([]);
  const [ports, setPorts] = useState<PortItem[]>([]);

  // Load filter options
  useEffect(() => {
    async function loadLookups() {
      const supabase = createClient();
      const [rolesRes, portsRes] = await Promise.all([
        supabase.from('yacht_roles').select('id, name').order('sort_order'),
        supabase.from('ports').select('id, name, cities(name, regions(name))').order('name'),
      ]);
      if (rolesRes.data) setRoles(rolesRes.data);
      if (portsRes.data) setPorts(portsRes.data as unknown as PortItem[]);
    }
    loadLookups();
  }, []);

  const loadCards = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ sort });
    if (filterRoleId && filterRoleId !== 'all') params.set('roleId', filterRoleId);
    if (filterPortId && filterPortId !== 'all') params.set('portId', filterPortId);

    const res = await fetch(`/api/daywork/discover?${params}`);
    const data = await res.json();
    if (data.dayworks) setCards(data.dayworks);
    setLoading(false);
  }, [sort, filterRoleId, filterPortId]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadCards();
  }, [loadCards]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleApply(dayworkId: string) {
    setApplying(true);
    const res = await fetch(`/api/daywork/${dayworkId}/apply`, { method: 'POST' });
    if (res.ok) {
      setCards((prev) => prev.filter((c) => c.id !== dayworkId));
    }
    setApplying(false);
  }

  function handlePass(dayworkId: string) {
    setCards((prev) => prev.filter((c) => c.id !== dayworkId));
  }

  const topCard = cards[0] ?? null;
  const nextCard = cards[1] ?? null;

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">Discover</h1>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="mr-1 h-4 w-4" />
            Filters
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-6">
        {/* Filters panel */}
        {showFilters && (
          <Card>
            <CardContent className="flex flex-col gap-3 pt-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Sort by</label>
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recency">Most recent</SelectItem>
                    <SelectItem value="proximity">Proximity</SelectItem>
                    <SelectItem value="tenure">Tenure match</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Role</label>
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
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Location</label>
                <Select value={filterPortId} onValueChange={setFilterPortId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations</SelectItem>
                    {ports.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {p.cities?.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card stack */}
        <div className="relative flex flex-1 items-start justify-center pt-4">
          {loading && (
            <div className="flex flex-col items-center gap-2 pt-20 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Finding jobs...</p>
            </div>
          )}

          {!loading && cards.length === 0 && (
            <Card className="w-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">No jobs found</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No daywork postings match your availability and filters right now. Try adjusting
                  your filters or check back later.
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={loadCards}>
                  Refresh
                </Button>
              </CardContent>
            </Card>
          )}

          {!loading && cards.length > 0 && (
            <div className="relative h-[420px] w-full">
              {/* Next card preview (underneath) */}
              {nextCard && (
                <div className="absolute inset-0 z-0">
                  <JobCard card={nextCard} isPreview />
                </div>
              )}

              {/* Top card (swipeable) */}
              {topCard && (
                <SwipeableCard
                  key={topCard.id}
                  card={topCard}
                  onApply={() => handleApply(topCard.id)}
                  onPass={() => handlePass(topCard.id)}
                  disabled={applying}
                />
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!loading && topCard && (
          <div className="flex items-center justify-center gap-6 pb-4">
            <button
              onClick={() => handlePass(topCard.id)}
              disabled={applying}
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-destructive text-destructive transition-colors hover:bg-destructive hover:text-white disabled:opacity-50"
            >
              <X className="h-6 w-6" />
            </button>
            <button
              onClick={() => handleApply(topCard.id)}
              disabled={applying}
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-success text-success transition-colors hover:bg-success hover:text-white disabled:opacity-50"
            >
              <Check className="h-6 w-6" />
            </button>
          </div>
        )}

        {/* Counter */}
        {!loading && cards.length > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            {cards.length} job{cards.length !== 1 ? 's' : ''} available
          </p>
        )}
      </div>
    </main>
  );
}

function SwipeableCard({
  card,
  onApply,
  onPass,
  disabled,
}: {
  card: DayworkCard;
  onApply: () => void;
  onPass: () => void;
  disabled: boolean;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const applyOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const passOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (disabled) return;

    if (info.offset.x > SWIPE_THRESHOLD) {
      hapticMedium();
      animate(x, 400, { duration: 0.3 });
      setTimeout(onApply, 300);
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      hapticLight();
      animate(x, -400, { duration: 0.3 });
      setTimeout(onPass, 300);
    } else {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
    }
  }

  return (
    <motion.div
      className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={handleDragEnd}
    >
      {/* Swipe indicators */}
      <motion.div
        className="pointer-events-none absolute left-4 top-4 z-20 rounded-lg border-2 border-success bg-success/10 px-3 py-1 text-sm font-bold text-success"
        style={{ opacity: applyOpacity }}
      >
        APPLY
      </motion.div>
      <motion.div
        className="pointer-events-none absolute right-4 top-4 z-20 rounded-lg border-2 border-destructive bg-destructive/10 px-3 py-1 text-sm font-bold text-destructive"
        style={{ opacity: passOpacity }}
      >
        PASS
      </motion.div>

      <JobCard card={card} />
    </motion.div>
  );
}

function JobCard({ card, isPreview }: { card: DayworkCard; isPreview?: boolean }) {
  return (
    <div
      className={`h-full w-full rounded-2xl border border-border bg-background shadow-lg ${
        isPreview ? 'scale-[0.97] opacity-60' : ''
      }`}
    >
      <div className="flex h-full flex-col p-5">
        {/* Role + vessel */}
        <div className="mb-3">
          <h3 className="text-lg font-bold">{card.yacht_roles?.name ?? 'Unknown role'}</h3>
          <p className="text-sm text-muted-foreground">
            {card.vessels?.nda_flag ? 'NDA Vessel' : (card.vessels?.name ?? 'Unknown vessel')}
            {card.vessels?.vessel_size_bands?.label && ` · ${card.vessels.vessel_size_bands.label}`}
          </p>
        </div>

        {/* Details */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              {card.ports?.name ?? 'Unknown'}
              {card.ports?.cities?.name && `, ${card.ports.cities.name}`}
              {card.ports?.cities?.regions?.name && ` · ${card.ports.cities.regions.name}`}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              {card.start_date} — {card.end_date} ({card.working_days} working day
              {card.working_days !== 1 ? 's' : ''})
            </span>
          </div>

          {card.day_rate && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-medium">&euro;{card.day_rate}/day</span>
            </div>
          )}

          {card.experience_brackets?.label && (
            <div className="flex items-center gap-2 text-sm">
              <Award className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{card.experience_brackets.label}</span>
            </div>
          )}
        </div>

        {/* Meals + badges */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.meals &&
            card.meals.length > 0 &&
            card.meals.map((meal) => (
              <Badge key={meal} variant="secondary" className="text-xs capitalize">
                {meal}
              </Badge>
            ))}
        </div>

        {/* Notes */}
        {card.notes && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{card.notes}</p>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Posted date */}
        <p className="mt-2 text-xs text-muted-foreground/60">
          Posted {new Date(card.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
