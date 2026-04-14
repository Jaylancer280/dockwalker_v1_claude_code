'use client';

import { useState } from 'react';
import { safeFetch } from '@/lib/safe-fetch';
import { useSafeFetch } from '@/hooks/use-safe-fetch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const TABLES = [
  'regions',
  'cities',
  'ports',
  'yacht_roles',
  'certifications',
  'experience_brackets',
  'vessel_size_bands',
] as const;

type TableName = (typeof TABLES)[number];

interface Row {
  id: string;
  label?: string;
  name?: string;
  [key: string]: unknown;
}

export default function AdminCanonicalPage() {
  const { showSuccess, showError } = useToast();
  const [activeTable, setActiveTable] = useState<TableName>('yacht_roles');
  const [newLabel, setNewLabel] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const { data, isLoading, mutate } = useSafeFetch<{ rows: Row[] }>(
    `/api/admin/canonical/${activeTable}`,
  );

  const rows = data?.rows ?? [];

  async function handleAdd() {
    if (!newLabel.trim()) return;
    const res = await safeFetch(`/api/admin/canonical/${activeTable}`, {
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
    if (!editLabel.trim()) return;
    const res = await safeFetch(`/api/admin/canonical/${activeTable}`, {
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

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Canonical Data</h1>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABLES.map((t) => (
          <button
            key={t}
            onClick={() => {
              setActiveTable(t);
              setEditId(null);
              setNewLabel('');
            }}
            className={`rounded border px-3 py-1 text-sm ${activeTable === t ? 'bg-primary text-primary-foreground' : ''}`}
          >
            {t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <>
          <div className="mb-4 flex gap-2">
            <Input
              placeholder={`New ${activeTable.replace(/_/g, ' ')} label...`}
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
