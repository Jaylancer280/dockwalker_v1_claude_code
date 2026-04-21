'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { safeFetch } from '@/lib/safe-fetch';
import { useSafeFetch } from '@/hooks/use-safe-fetch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface UserDetail {
  person: {
    id: string;
    identity_type: string;
    current_hat: string;
    is_admin: boolean;
    blocked_at: string | null;
    deactivated_at: string | null;
    last_event_at: string | null;
    created_at: string;
  };
  profile: {
    display_name: string;
    deck_name: string | null;
    bio: string | null;
    agency_name: string | null;
    avatar_url: string | null;
    permanent_availability: string | null;
    languages: string[];
  } | null;
  subscription: { plan: string; status: string } | null;
  eventCount: number;
}

interface EventRow {
  id: string;
  event_type: string;
  aggregate_type: string;
  created_at: string;
  payload: Record<string, unknown>;
}

interface UserNote {
  id: string;
  admin_person_id: string | null;
  admin_display_name: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

interface ReportSummaryRow {
  id: string;
  reporter_person_id: string;
  reporter_name: string | null;
  reported_person_id: string;
  reported_name: string | null;
  reason_category: string;
  status: string;
  created_at: string;
}

export default function AdminUserDetailPage() {
  const { personId } = useParams<{ personId: string }>();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [blocking, setBlocking] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [blockCategory, setBlockCategory] = useState('other');
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteDraft, setEditNoteDraft] = useState('');

  const {
    data: user,
    isLoading,
    mutate,
  } = useSafeFetch<UserDetail>(`/api/admin/users/${personId}`);
  const { data: eventsData } = useSafeFetch<{ events: EventRow[] }>(
    `/api/admin/events?person_id=${personId}&limit=50`,
  );
  const { data: notesData, mutate: mutateNotes } = useSafeFetch<{ notes: UserNote[] }>(
    `/api/admin/users/${personId}/notes`,
  );
  const { data: reportsAgainstData } = useSafeFetch<{ reports: ReportSummaryRow[] }>(
    `/api/admin/reports?filed_against=${personId}&status=open,reviewing,dismissed,actioned`,
  );
  const { data: reportsByData } = useSafeFetch<{ reports: ReportSummaryRow[] }>(
    `/api/admin/reports?filed_by=${personId}&status=open,reviewing,dismissed,actioned`,
  );

  const events = eventsData?.events ?? [];
  const notes = notesData?.notes ?? [];
  const reportsAgainst = reportsAgainstData?.reports ?? [];
  const reportsBy = reportsByData?.reports ?? [];

  async function handleAddNote() {
    const content = noteDraft.trim();
    if (!content) return;
    setNoteSaving(true);
    const res = await safeFetch(`/api/admin/users/${personId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    setNoteSaving(false);
    if (res.ok) {
      setNoteDraft('');
      mutateNotes();
    } else {
      showError(res.error ?? 'Failed to add note');
    }
  }

  async function handleSaveEdit(noteId: string) {
    const content = editNoteDraft.trim();
    if (!content) return;
    const res = await safeFetch(`/api/admin/users/${personId}/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      setEditingNoteId(null);
      setEditNoteDraft('');
      mutateNotes();
    } else {
      showError(res.error ?? 'Failed to save note');
    }
  }

  async function handleBlock() {
    if (!blockReason.trim()) return;
    setBlocking(true);
    const res = await safeFetch(`/api/admin/users/${personId}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason_category: blockCategory, reason_text: blockReason }),
    });
    setBlocking(false);
    setShowBlockDialog(false);
    if (res.ok) {
      showSuccess('User blocked');
      mutate();
    } else {
      showError('Failed to block user');
    }
  }

  async function handleUnblock() {
    const res = await safeFetch(`/api/admin/users/${personId}/unblock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason_text: 'Admin unblock' }),
    });
    if (res.ok) {
      showSuccess('User unblocked');
      mutate();
    } else {
      showError('Failed to unblock');
    }
  }

  async function handleRestore() {
    const res = await safeFetch(`/api/admin/users/${personId}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason_text: 'Admin restore' }),
    });
    if (res.ok) {
      showSuccess('User restored — they can log in again and will need to re-enter profile data');
      mutate();
    } else {
      showError('Failed to restore user');
    }
  }

  async function handleDelete() {
    const res = await safeFetch(`/api/admin/users/${personId}`, { method: 'DELETE' });
    setShowDeleteDialog(false);
    if (res.ok) {
      showSuccess('User deleted');
      router.push('/admin/users');
    } else {
      showError('Failed to delete user');
    }
  }

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (!user) return <p className="text-destructive">User not found</p>;

  const { person, profile, subscription, eventCount } = user;
  const isBlocked = !!person.blocked_at;
  const isDeactivated = !!person.deactivated_at;

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{profile?.display_name ?? 'Unknown User'}</h1>
          <p className="text-sm text-muted-foreground">
            {person.identity_type} · {person.current_hat} · Created{' '}
            {new Date(person.created_at).toLocaleDateString()}
          </p>
          <div className="mt-1 flex gap-2">
            {isBlocked && <Badge variant="destructive">Blocked</Badge>}
            {isDeactivated && <Badge variant="secondary">Deactivated</Badge>}
            {person.is_admin && <Badge>Admin</Badge>}
            {subscription && (
              <Badge variant="outline">
                {subscription.plan} ({subscription.status})
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {(isBlocked || isDeactivated) && (
            <Button variant="default" onClick={handleRestore}>
              Restore
            </Button>
          )}
          {isBlocked ? (
            <Button variant="outline" onClick={handleUnblock}>
              Unblock
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => setShowBlockDialog(true)}
              disabled={person.is_admin}
            >
              Block
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowDeleteDialog(true)}
            disabled={person.is_admin}
          >
            Delete
          </Button>
        </div>
      </div>

      {showBlockDialog && (
        <div className="mb-6 rounded-lg border border-destructive p-4">
          <h3 className="mb-2 font-semibold">Block User</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            This will cancel all active engagements, postings, and applications.
          </p>
          <select
            value={blockCategory}
            onChange={(e) => setBlockCategory(e.target.value)}
            className="mb-2 w-full rounded border p-2 text-sm"
          >
            <option value="harassment">Harassment</option>
            <option value="fraud">Fraud</option>
            <option value="safety_concern">Safety Concern</option>
            <option value="spam">Spam</option>
            <option value="impersonation">Impersonation</option>
            <option value="other">Other</option>
          </select>
          <textarea
            placeholder="Reason for blocking..."
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            className="mb-2 w-full rounded border p-2 text-sm"
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={handleBlock}
              disabled={blocking || !blockReason.trim()}
            >
              {blocking ? 'Blocking...' : 'Confirm Block'}
            </Button>
            <Button variant="outline" onClick={() => setShowBlockDialog(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {showDeleteDialog && (
        <div className="mb-6 rounded-lg border border-destructive p-4">
          <h3 className="mb-2 font-semibold">Delete User</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            This will remove PII, close the account, and ban login. Event history is retained for
            audit. This cannot be undone from the UI.
          </p>
          <div className="flex gap-2">
            <Button variant="destructive" onClick={handleDelete}>
              Confirm Delete
            </Button>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Profile</h2>
        {profile ? (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Display Name:</span> {profile.display_name}
            </div>
            {profile.deck_name && (
              <div>
                <span className="text-muted-foreground">Deck Name:</span> {profile.deck_name}
              </div>
            )}
            {profile.agency_name && (
              <div>
                <span className="text-muted-foreground">Agency:</span> {profile.agency_name}
              </div>
            )}
            {profile.permanent_availability && (
              <div>
                <span className="text-muted-foreground">Availability:</span>{' '}
                {profile.permanent_availability}
              </div>
            )}
            {profile.languages?.length > 0 && (
              <div>
                <span className="text-muted-foreground">Languages:</span>{' '}
                {profile.languages.join(', ')}
              </div>
            )}
            {profile.bio && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Bio:</span> {profile.bio}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No profile</p>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Admin Notes</h2>
        {notes.length === 0 ? (
          <p className="mb-3 text-sm text-muted-foreground">No notes</p>
        ) : (
          <ul className="mb-3 flex flex-col gap-2">
            {notes.map((note) => {
              const isEditing = editingNoteId === note.id;
              return (
                <li key={note.id} className="rounded border p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {note.admin_display_name ?? '[unknown admin]'} ·{' '}
                      {new Date(note.created_at).toLocaleString()}
                      {note.updated_at !== note.created_at && ' · edited'}
                    </span>
                    {!isEditing && note.admin_person_id && (
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          setEditingNoteId(note.id);
                          setEditNoteDraft(note.content);
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {isEditing ? (
                    <>
                      <textarea
                        value={editNoteDraft}
                        onChange={(e) => setEditNoteDraft(e.target.value)}
                        rows={3}
                        maxLength={4000}
                        className="mb-2 w-full rounded border p-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSaveEdit(note.id)}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingNoteId(null);
                            setEditNoteDraft('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="whitespace-pre-wrap">{note.content}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="Add a note about this user..."
            className="mb-2 w-full rounded border p-2 text-sm"
          />
          <Button size="sm" onClick={handleAddNote} disabled={noteSaving || !noteDraft.trim()}>
            {noteSaving ? 'Saving...' : 'Add note'}
          </Button>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Reports</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <ReportMiniList
            title={`Filed against (${reportsAgainst.length})`}
            rows={reportsAgainst}
          />
          <ReportMiniList title={`Filed by (${reportsBy.length})`} rows={reportsBy} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Event Timeline ({eventCount} total)</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Time</th>
                <th className="pb-2">Event</th>
                <th className="pb-2">Aggregate</th>
                <th className="pb-2">Payload</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt) => (
                <tr key={evt.id} className="border-b">
                  <td className="py-1 whitespace-nowrap">
                    {new Date(evt.created_at).toLocaleString()}
                  </td>
                  <td className="py-1 font-mono text-xs">{evt.event_type}</td>
                  <td className="py-1">{evt.aggregate_type}</td>
                  <td className="py-1 max-w-xs truncate text-xs text-muted-foreground">
                    {JSON.stringify(evt.payload)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function ReportMiniList({ title, rows }: { title: string; rows: ReportSummaryRow[] }) {
  return (
    <div className="rounded border p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">None</p>
      ) : (
        <ul className="flex flex-col gap-1 text-xs">
          {rows.slice(0, 5).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2">
              <Link href="/admin/reports" className="text-primary hover:underline">
                <span className="capitalize">{r.reason_category.replace(/_/g, ' ')}</span>
                <span className="ml-2 text-muted-foreground">· {r.status}</span>
              </Link>
              <span className="text-[10px] text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 5 && (
        <Link
          href="/admin/reports"
          className="mt-2 inline-block text-[11px] text-primary hover:underline"
        >
          + {rows.length - 5} more
        </Link>
      )}
    </div>
  );
}
