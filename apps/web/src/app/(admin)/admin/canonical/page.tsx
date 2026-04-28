'use client';

import { useState, useEffect } from 'react';
import { safeFetch } from '@/lib/safe-fetch';
import { useSafeFetch } from '@/hooks/use-safe-fetch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { FlagStatePicker } from '@/components/flag-state-picker';

const CANONICAL_TABLES = [
  'regions',
  'cities',
  'ports',
  'yacht_roles',
  'certifications',
  'experience_brackets',
  'vessel_size_bands',
] as const;

type CanonicalTable = (typeof CANONICAL_TABLES)[number];
type ActiveTab = CanonicalTable | 'vessels';

interface Row {
  id: string;
  label?: string;
  name?: string;
  [key: string]: unknown;
}

interface VesselRow {
  id: string;
  imo_number: string;
  name: string;
  vessel_type: string;
  loa_meters: number | null;
  nda_flag: boolean;
  owner_name: string;
  created_at: string;
  source: string;
  flag_state_id: string | null;
  flag_state_name: string | null;
  year_built: number | null;
  builder: string | null;
  gross_tonnage: number | null;
  beam_meters: number | null;
}

interface VesselPatchBody {
  name?: string;
  vessel_type?: 'motor' | 'sail';
  loa_meters?: number;
  flag_state_id?: string | null;
  year_built?: number | null;
  builder?: string | null;
  gross_tonnage?: number | null;
  beam_meters?: number | null;
  nda_flag?: boolean;
}

function VesselsTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<VesselRow | null>(null);
  const { showError, showSuccess } = useToast();

  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set('search', search);

  const { data, isLoading, mutate } = useSafeFetch<{ vessels: VesselRow[]; total: number }>(
    `/api/admin/vessels?${params}`,
  );

  const vessels = data?.vessels ?? [];
  const total = data?.total ?? 0;

  async function handleSaveEdit(payload: VesselPatchBody) {
    if (!editTarget) return;
    if (Object.keys(payload).length === 0) {
      // No changes — close without round-trip.
      setEditTarget(null);
      return;
    }
    const res = await safeFetch<{ ok: boolean }>(`/api/admin/vessels/${editTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      showError(res.error ?? 'Edit failed. Try again.');
      return;
    }
    showSuccess(`Saved ${payload.name ?? editTarget.name}`);
    setEditTarget(null);
    mutate();
  }

  return (
    <>
      <Input
        placeholder="Search by name or IMO..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="mb-4 max-w-sm"
      />
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground">{total} vessels</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Name</th>
                <th className="pb-2">IMO</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">LOA</th>
                <th className="pb-2">NDA</th>
                <th className="pb-2">Owner</th>
                <th className="pb-2">Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {vessels.map((v) => (
                <tr key={v.id} className="border-b">
                  <td className="py-2">{v.name}</td>
                  <td className="py-2 font-mono text-xs">{v.imo_number}</td>
                  <td className="py-2">{v.vessel_type === 'motor' ? 'M/Y' : 'S/Y'}</td>
                  <td className="py-2">{v.loa_meters ? `${v.loa_meters}m` : '—'}</td>
                  <td className="py-2">{v.nda_flag ? 'Yes' : '—'}</td>
                  <td className="py-2">{v.owner_name}</td>
                  <td className="py-2">{new Date(v.created_at).toLocaleDateString()}</td>
                  <td className="py-2 text-right">
                    {v.source === 'pending' ? (
                      <span
                        className="text-xs text-muted-foreground"
                        title="Pending vessels are edited via the Pending Vessels queue Approve action."
                      >
                        pending
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditTarget(v)}
                      >
                        Edit
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-2 py-1 text-sm text-muted-foreground">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={vessels.length < 50}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}

      {editTarget && (
        <EditVesselDialog
          row={editTarget}
          onCancel={() => setEditTarget(null)}
          onSave={handleSaveEdit}
        />
      )}
    </>
  );
}

interface FlagState {
  id: string;
  name: string;
}

function EditVesselDialog({
  row,
  onCancel,
  onSave,
}: {
  row: VesselRow;
  onCancel: () => void;
  onSave: (payload: VesselPatchBody) => void;
}) {
  const [name, setName] = useState(row.name);
  const [vesselType, setVesselType] = useState<'motor' | 'sail'>(
    row.vessel_type === 'sail' ? 'sail' : 'motor',
  );
  const [loa, setLoa] = useState<string>(row.loa_meters != null ? String(row.loa_meters) : '');
  const [flagStateId, setFlagStateId] = useState<string>(row.flag_state_id ?? '');
  const [yearBuilt, setYearBuilt] = useState<string>(
    row.year_built != null ? String(row.year_built) : '',
  );
  const [builder, setBuilder] = useState(row.builder ?? '');
  const [grossTonnage, setGrossTonnage] = useState<string>(
    row.gross_tonnage != null ? String(row.gross_tonnage) : '',
  );
  const [beam, setBeam] = useState<string>(row.beam_meters != null ? String(row.beam_meters) : '');
  const [ndaFlag, setNdaFlag] = useState(row.nda_flag);
  const [flagStates, setFlagStates] = useState<FlagState[]>([]);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data } = await supabase.from('flag_states').select('id, name').order('sort_order');
      if (data) setFlagStates(data as FlagState[]);
    })();
  }, []);

  function buildPayload(): VesselPatchBody {
    const payload: VesselPatchBody = {};
    const trimmedName = name.trim();
    if (trimmedName !== row.name) payload.name = trimmedName;
    if (vesselType !== row.vessel_type) payload.vessel_type = vesselType;
    const loaNum = loa === '' ? NaN : Number(loa);
    if (Number.isFinite(loaNum) && loaNum !== row.loa_meters) payload.loa_meters = loaNum;
    if (flagStateId !== (row.flag_state_id ?? '')) {
      payload.flag_state_id = flagStateId === '' ? null : flagStateId;
    }
    const yearNum = yearBuilt === '' ? null : Number(yearBuilt);
    if (yearNum !== (row.year_built ?? null)) payload.year_built = yearNum;
    const trimmedBuilder = builder.trim();
    if (trimmedBuilder !== (row.builder ?? '')) {
      payload.builder = trimmedBuilder === '' ? null : trimmedBuilder;
    }
    const gtNum = grossTonnage === '' ? null : Number(grossTonnage);
    if (gtNum !== (row.gross_tonnage ?? null)) payload.gross_tonnage = gtNum;
    const beamNum = beam === '' ? null : Number(beam);
    if (beamNum !== (row.beam_meters ?? null)) payload.beam_meters = beamNum;
    if (ndaFlag !== row.nda_flag) payload.nda_flag = ndaFlag;
    return payload;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(buildPayload());
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b px-4 pt-4 pb-3">
          <h2 className="text-sm font-semibold">Edit canonical vessel</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            IMO {row.imo_number}. Direct edit on a curated vessel — typo / mistake recovery from a
            previous Approve. Changes apply immediately to every user&apos;s view.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Type</label>
              <div className="flex gap-2">
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    name="edit-vessel-type"
                    checked={vesselType === 'motor'}
                    onChange={() => setVesselType('motor')}
                  />
                  Motor (M/Y)
                </label>
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    name="edit-vessel-type"
                    checked={vesselType === 'sail'}
                    onChange={() => setVesselType('sail')}
                  />
                  Sail (S/Y)
                </label>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">LOA (m) — band auto-derives</label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={loa}
                onChange={(e) => setLoa(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Flag state</label>
            <FlagStatePicker
              flagStates={flagStates}
              value={flagStateId}
              onValueChange={setFlagStateId}
              placeholder="Pick a flag state…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Year built</label>
              <input
                type="number"
                min="1900"
                max={new Date().getFullYear()}
                value={yearBuilt}
                onChange={(e) => setYearBuilt(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Gross tonnage (GT)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={grossTonnage}
                onChange={(e) => setGrossTonnage(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Beam (m)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={beam}
                onChange={(e) => setBeam(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Builder</label>
              <input
                type="text"
                value={builder}
                onChange={(e) => setBuilder(e.target.value)}
                placeholder="e.g. Lürssen"
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ndaFlag}
              onChange={(e) => setNdaFlag(e.target.checked)}
            />
            NDA vessel (IMO hidden from non-engaged crew)
          </label>
        </form>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onSave(buildPayload())}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

const CERT_CATEGORIES = [
  'basic',
  'deck_bridge',
  'engineering',
  'interior',
  'galley',
  'watersports',
  'helideck',
  'other',
] as const;

interface PortFields {
  latitude: string;
  longitude: string;
  osm_type: string;
  osm_id: string;
  website: string;
  phone: string;
  capacity: string;
  vhf: string;
}

const EMPTY_PORT_FIELDS: PortFields = {
  latitude: '',
  longitude: '',
  osm_type: '',
  osm_id: '',
  website: '',
  phone: '',
  capacity: '',
  vhf: '',
};

function portFieldsToPayload(pf: PortFields): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (pf.latitude.trim()) out.latitude = Number(pf.latitude);
  if (pf.longitude.trim()) out.longitude = Number(pf.longitude);
  if (pf.osm_type.trim()) out.osm_type = pf.osm_type.trim();
  if (pf.osm_id.trim()) out.osm_id = Number(pf.osm_id);
  if (pf.website.trim()) out.website = pf.website.trim();
  if (pf.phone.trim()) out.phone = pf.phone.trim();
  if (pf.capacity.trim()) out.capacity = pf.capacity.trim();
  if (pf.vhf.trim()) out.vhf = pf.vhf.trim();
  return out;
}

export default function AdminCanonicalPage() {
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>('yacht_roles');
  const [newLabel, setNewLabel] = useState('');
  const [newCertCategory, setNewCertCategory] = useState<string>('basic');
  const [newCertSubcategory, setNewCertSubcategory] = useState('');
  const [newRegionCountryCode, setNewRegionCountryCode] = useState('');
  const [newPortCityId, setNewPortCityId] = useState('');
  const [newPortFields, setNewPortFields] = useState<PortFields>(EMPTY_PORT_FIELDS);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editCertCategory, setEditCertCategory] = useState<string>('basic');
  const [editCertSubcategory, setEditCertSubcategory] = useState('');
  const [editRegionCountryCode, setEditRegionCountryCode] = useState('');
  const [editPortFields, setEditPortFields] = useState<PortFields>(EMPTY_PORT_FIELDS);

  const isVessels = activeTab === 'vessels';
  const canonicalTable = isVessels ? null : activeTab;

  // Ports (~6k rows) + cities (~3.4k rows) are paginated + searchable.
  // Other canonical tables (yacht_roles, certifications, regions, brackets,
  // size bands) are small and load all rows at once.
  const isLargeTable = canonicalTable === 'ports' || canonicalTable === 'cities';
  const [canonicalPage, setCanonicalPage] = useState(1);
  const [canonicalSearch, setCanonicalSearch] = useState('');

  // Pagination + search reset lives in the tab-switch click handler below;
  // avoids the set-state-in-effect lint rule.

  const canonicalFetchUrl = (() => {
    if (!canonicalTable) return null;
    if (!isLargeTable) {
      // Small tables: no pagination; include ?q= if user searched
      const params = new URLSearchParams();
      if (canonicalSearch.trim()) params.set('q', canonicalSearch.trim());
      const qs = params.toString();
      return `/api/admin/canonical/${canonicalTable}${qs ? `?${qs}` : ''}`;
    }
    // Large tables: always paginate
    const params = new URLSearchParams({
      page: String(canonicalPage),
      pageSize: '50',
    });
    if (canonicalSearch.trim()) params.set('q', canonicalSearch.trim());
    return `/api/admin/canonical/${canonicalTable}?${params.toString()}`;
  })();

  const { data, isLoading, mutate } = useSafeFetch<{
    rows: Row[];
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
  }>(canonicalFetchUrl);

  const rows = data?.rows ?? [];
  const canonicalTotal = data?.total ?? rows.length;
  const canonicalTotalPages = data?.totalPages ?? 1;

  async function handleAdd() {
    if (!newLabel.trim() || !canonicalTable) return;
    let payload: Record<string, unknown>;
    if (canonicalTable === 'certifications') {
      payload = {
        name: newLabel.trim(),
        category: newCertCategory,
        subcategory: newCertSubcategory.trim() || null,
      };
    } else if (canonicalTable === 'regions') {
      const cc = newRegionCountryCode.trim().toUpperCase();
      if (cc && !/^[A-Z]{2}$/.test(cc)) {
        showError('country_code must be ISO-3166-1 alpha-2 (2 letters)');
        return;
      }
      payload = { name: newLabel.trim(), country_code: cc || null };
    } else if (canonicalTable === 'ports') {
      if (!newPortCityId.trim()) {
        showError('city_id is required for ports');
        return;
      }
      payload = {
        name: newLabel.trim(),
        city_id: newPortCityId.trim(),
        ...portFieldsToPayload(newPortFields),
      };
    } else {
      payload = { label: newLabel.trim() };
    }
    const res = await safeFetch(`/api/admin/canonical/${canonicalTable}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      showSuccess('Added');
      setNewLabel('');
      setNewCertSubcategory('');
      setNewRegionCountryCode('');
      setNewPortCityId('');
      setNewPortFields(EMPTY_PORT_FIELDS);
      mutate();
    } else {
      showError('Failed to add');
    }
  }

  async function handleEdit(id: string) {
    if (!editLabel.trim() || !canonicalTable) return;
    let payload: Record<string, unknown>;
    if (canonicalTable === 'certifications') {
      payload = {
        id,
        name: editLabel.trim(),
        category: editCertCategory,
        subcategory: editCertSubcategory.trim() || null,
      };
    } else if (canonicalTable === 'regions') {
      const cc = editRegionCountryCode.trim().toUpperCase();
      if (cc && !/^[A-Z]{2}$/.test(cc)) {
        showError('country_code must be ISO-3166-1 alpha-2 (2 letters)');
        return;
      }
      payload = { id, name: editLabel.trim(), country_code: cc || null };
    } else if (canonicalTable === 'ports') {
      payload = {
        id,
        name: editLabel.trim(),
        ...portFieldsToPayload(editPortFields),
      };
    } else {
      payload = { id, label: editLabel.trim() };
    }
    const res = await safeFetch(`/api/admin/canonical/${canonicalTable}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      showSuccess('Updated');
      setEditId(null);
      setEditPortFields(EMPTY_PORT_FIELDS);
      setEditRegionCountryCode('');
      mutate();
    } else {
      showError('Failed to update');
    }
  }

  function displayName(row: Row) {
    return row.label ?? row.name ?? row.id;
  }

  const allTabs: { key: ActiveTab; label: string }[] = [
    ...CANONICAL_TABLES.map((t) => ({ key: t as ActiveTab, label: t.replace(/_/g, ' ') })),
    { key: 'vessels', label: 'vessels' },
  ];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Canonical Data</h1>
      <div className="mb-4 flex flex-wrap gap-2">
        {allTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setActiveTab(t.key);
              setEditId(null);
              setNewLabel('');
              setCanonicalPage(1);
              setCanonicalSearch('');
            }}
            className={`rounded border px-3 py-1 text-sm ${activeTab === t.key ? 'bg-primary text-primary-foreground' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isVessels ? (
        <VesselsTab />
      ) : isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <Input
              placeholder={`New ${activeTab.replace(/_/g, ' ')} ${activeTab === 'certifications' ? 'name' : 'label'}...`}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="max-w-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            {activeTab === 'certifications' && (
              <>
                <select
                  value={newCertCategory}
                  onChange={(e) => setNewCertCategory(e.target.value)}
                  className="rounded border bg-background px-2 text-sm"
                  aria-label="Category"
                >
                  {CERT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Subcategory (optional)"
                  value={newCertSubcategory}
                  onChange={(e) => setNewCertSubcategory(e.target.value)}
                  className="max-w-xs"
                />
              </>
            )}
            {activeTab === 'regions' && (
              <Input
                placeholder="Country code (2 letters, e.g. FR)"
                value={newRegionCountryCode}
                onChange={(e) => setNewRegionCountryCode(e.target.value.toUpperCase())}
                maxLength={2}
                className="w-24 uppercase"
                aria-label="Country code"
              />
            )}
            <Button onClick={handleAdd} disabled={!newLabel.trim()}>
              Add
            </Button>
          </div>

          {activeTab === 'ports' && (
            <div className="mb-4 grid gap-2 rounded border p-3 md:grid-cols-2">
              <Input
                placeholder="City UUID (required)"
                value={newPortCityId}
                onChange={(e) => setNewPortCityId(e.target.value)}
                aria-label="City UUID"
              />
              <Input
                placeholder="Latitude (optional)"
                value={newPortFields.latitude}
                onChange={(e) => setNewPortFields({ ...newPortFields, latitude: e.target.value })}
                inputMode="decimal"
              />
              <Input
                placeholder="Longitude (optional)"
                value={newPortFields.longitude}
                onChange={(e) => setNewPortFields({ ...newPortFields, longitude: e.target.value })}
                inputMode="decimal"
              />
              <select
                value={newPortFields.osm_type}
                onChange={(e) => setNewPortFields({ ...newPortFields, osm_type: e.target.value })}
                className="rounded border bg-background px-2 text-sm"
                aria-label="OSM type"
              >
                <option value="">osm_type (optional)</option>
                <option value="node">node</option>
                <option value="way">way</option>
                <option value="relation">relation</option>
              </select>
              <Input
                placeholder="OSM id (optional)"
                value={newPortFields.osm_id}
                onChange={(e) => setNewPortFields({ ...newPortFields, osm_id: e.target.value })}
                inputMode="numeric"
              />
              <Input
                placeholder="Website (optional)"
                value={newPortFields.website}
                onChange={(e) => setNewPortFields({ ...newPortFields, website: e.target.value })}
              />
              <Input
                placeholder="Phone (optional)"
                value={newPortFields.phone}
                onChange={(e) => setNewPortFields({ ...newPortFields, phone: e.target.value })}
              />
              <Input
                placeholder="Capacity (optional)"
                value={newPortFields.capacity}
                onChange={(e) => setNewPortFields({ ...newPortFields, capacity: e.target.value })}
              />
              <Input
                placeholder="VHF channel (optional)"
                value={newPortFields.vhf}
                onChange={(e) => setNewPortFields({ ...newPortFields, vhf: e.target.value })}
              />
            </div>
          )}
          <div className="mb-3 flex items-center gap-3">
            <Input
              placeholder={isLargeTable ? `Search ${activeTab}...` : `Filter ${activeTab}...`}
              value={canonicalSearch}
              onChange={(e) => {
                setCanonicalSearch(e.target.value);
                setCanonicalPage(1);
              }}
              className="max-w-sm"
            />
            <span className="text-xs text-muted-foreground">
              {canonicalTotal} {canonicalTotal === 1 ? 'row' : 'rows'}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Label</th>
                <th className="pb-2">ID</th>
                <th className="pb-2 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2">
                    {editId === row.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleEdit(row.id)}
                          className="h-8 max-w-sm"
                        />
                        {activeTab === 'certifications' && (
                          <>
                            <select
                              value={editCertCategory}
                              onChange={(e) => setEditCertCategory(e.target.value)}
                              className="rounded border bg-background px-2 text-sm"
                              aria-label="Category"
                            >
                              {CERT_CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                            <Input
                              placeholder="Subcategory (optional)"
                              value={editCertSubcategory}
                              onChange={(e) => setEditCertSubcategory(e.target.value)}
                              className="h-8 max-w-xs"
                            />
                          </>
                        )}
                        {activeTab === 'regions' && (
                          <Input
                            placeholder="Country code"
                            value={editRegionCountryCode}
                            onChange={(e) => setEditRegionCountryCode(e.target.value.toUpperCase())}
                            maxLength={2}
                            className="h-8 w-24 uppercase"
                            aria-label="Country code"
                          />
                        )}
                        {activeTab === 'ports' && (
                          <div className="grid w-full gap-1 md:grid-cols-2">
                            <Input
                              placeholder="Latitude"
                              value={editPortFields.latitude}
                              onChange={(e) =>
                                setEditPortFields({ ...editPortFields, latitude: e.target.value })
                              }
                              inputMode="decimal"
                              className="h-8"
                            />
                            <Input
                              placeholder="Longitude"
                              value={editPortFields.longitude}
                              onChange={(e) =>
                                setEditPortFields({ ...editPortFields, longitude: e.target.value })
                              }
                              inputMode="decimal"
                              className="h-8"
                            />
                            <select
                              value={editPortFields.osm_type}
                              onChange={(e) =>
                                setEditPortFields({ ...editPortFields, osm_type: e.target.value })
                              }
                              className="h-8 rounded border bg-background px-2 text-sm"
                              aria-label="OSM type"
                            >
                              <option value="">osm_type</option>
                              <option value="node">node</option>
                              <option value="way">way</option>
                              <option value="relation">relation</option>
                            </select>
                            <Input
                              placeholder="OSM id"
                              value={editPortFields.osm_id}
                              onChange={(e) =>
                                setEditPortFields({ ...editPortFields, osm_id: e.target.value })
                              }
                              inputMode="numeric"
                              className="h-8"
                            />
                            <Input
                              placeholder="Website"
                              value={editPortFields.website}
                              onChange={(e) =>
                                setEditPortFields({ ...editPortFields, website: e.target.value })
                              }
                              className="h-8"
                            />
                            <Input
                              placeholder="Phone"
                              value={editPortFields.phone}
                              onChange={(e) =>
                                setEditPortFields({ ...editPortFields, phone: e.target.value })
                              }
                              className="h-8"
                            />
                            <Input
                              placeholder="Capacity"
                              value={editPortFields.capacity}
                              onChange={(e) =>
                                setEditPortFields({ ...editPortFields, capacity: e.target.value })
                              }
                              className="h-8"
                            />
                            <Input
                              placeholder="VHF"
                              value={editPortFields.vhf}
                              onChange={(e) =>
                                setEditPortFields({ ...editPortFields, vhf: e.target.value })
                              }
                              className="h-8"
                            />
                          </div>
                        )}
                      </div>
                    ) : activeTab === 'certifications' ? (
                      <span>
                        {displayName(row)}
                        <span className="ml-2 text-xs text-muted-foreground">
                          [{String(row.category ?? '—')}
                          {row.subcategory ? ` / ${row.subcategory}` : ''}]
                        </span>
                      </span>
                    ) : activeTab === 'regions' ? (
                      <span>
                        {displayName(row)}
                        {Boolean(row.country_code) && (
                          <span className="ml-2 text-xs font-mono text-muted-foreground">
                            [{String(row.country_code)}]
                          </span>
                        )}
                      </span>
                    ) : (
                      displayName(row)
                    )}
                  </td>
                  <td className="py-2 font-mono text-xs text-muted-foreground">
                    {row.id.slice(0, 8)}
                  </td>
                  <td className="py-2">
                    {editId === row.id ? (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => handleEdit(row.id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditId(row.id);
                          setEditLabel(String(displayName(row)));
                          if (activeTab === 'certifications') {
                            setEditCertCategory(String(row.category ?? 'basic'));
                            setEditCertSubcategory(String(row.subcategory ?? ''));
                          } else if (activeTab === 'regions') {
                            setEditRegionCountryCode(String(row.country_code ?? ''));
                          } else if (activeTab === 'ports') {
                            setEditPortFields({
                              latitude: row.latitude != null ? String(row.latitude) : '',
                              longitude: row.longitude != null ? String(row.longitude) : '',
                              osm_type: row.osm_type != null ? String(row.osm_type) : '',
                              osm_id: row.osm_id != null ? String(row.osm_id) : '',
                              website: row.website != null ? String(row.website) : '',
                              phone: row.phone != null ? String(row.phone) : '',
                              capacity: row.capacity != null ? String(row.capacity) : '',
                              vhf: row.vhf != null ? String(row.vhf) : '',
                            });
                          }
                        }}
                      >
                        Edit
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {isLargeTable && canonicalTotalPages > 1 && (
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCanonicalPage((p) => Math.max(1, p - 1))}
                disabled={canonicalPage <= 1}
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-2 py-1 text-sm text-muted-foreground">
                Page {canonicalPage} of {canonicalTotalPages}
              </span>
              <button
                type="button"
                onClick={() => setCanonicalPage((p) => Math.min(canonicalTotalPages, p + 1))}
                disabled={canonicalPage >= canonicalTotalPages}
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
