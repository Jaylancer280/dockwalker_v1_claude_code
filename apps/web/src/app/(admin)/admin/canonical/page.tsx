'use client';

import { useState } from 'react';
import { safeFetch } from '@/lib/safe-fetch';
import { useSafeFetch } from '@/hooks/use-safe-fetch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

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
}

function VesselsTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set('search', search);

  const { data, isLoading } = useSafeFetch<{ vessels: VesselRow[]; total: number }>(
    `/api/admin/vessels?${params}`,
  );

  const vessels = data?.vessels ?? [];
  const total = data?.total ?? 0;

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
    </>
  );
}

export default function AdminCanonicalPage() {
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>('yacht_roles');
  const [newLabel, setNewLabel] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const isVessels = activeTab === 'vessels';
  const canonicalTable = isVessels ? null : activeTab;

  const { data, isLoading, mutate } = useSafeFetch<{ rows: Row[] }>(
    canonicalTable ? `/api/admin/canonical/${canonicalTable}` : null,
  );

  const rows = data?.rows ?? [];

  async function handleAdd() {
    if (!newLabel.trim() || !canonicalTable) return;
    const res = await safeFetch(`/api/admin/canonical/${canonicalTable}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel.trim() }),
    });
    if (res.ok) {
      showSuccess('Added');
      setNewLabel('');
      mutate();
    } else {
      showError('Failed to add');
    }
  }

  async function handleEdit(id: string) {
    if (!editLabel.trim() || !canonicalTable) return;
    const res = await safeFetch(`/api/admin/canonical/${canonicalTable}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, label: editLabel.trim() }),
    });
    if (res.ok) {
      showSuccess('Updated');
      setEditId(null);
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
          <div className="mb-4 flex gap-2">
            <Input
              placeholder={`New ${activeTab.replace(/_/g, ' ')} label...`}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="max-w-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd} disabled={!newLabel.trim()}>
              Add
            </Button>
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
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleEdit(row.id)}
                        className="h-8"
                      />
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
        </>
      )}
    </div>
  );
}
