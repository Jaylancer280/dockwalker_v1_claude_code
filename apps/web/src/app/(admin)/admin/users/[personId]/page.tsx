'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { safeFetch } from '@/lib/safe-fetch';
import { useSafeFetch } from '@/hooks/use-safe-fetch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AdminActionDialog } from '@/components/admin/admin-action-dialog';

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
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showUnblockDialog, setShowUnblockDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [unblocking, setUnblocking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
    if (res.ok) {
      setShowBlockDialog(false);
      setBlockReason('');
      showSuccess('User blocked');
      mutate();
      router.refresh();
    } else {
      showError('Failed to block user');
    }
  }

  async function handleUnblock() {
    setUnblocking(true);
    const res = await safeFetch(`/api/admin/users/${personId}/unblock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason_text: 'Admin unblock' }),
    });
    setUnblocking(false);
    if (res.ok) {
      setShowUnblockDialog(false);
      showSuccess('User unblocked');
      mutate();
      router.refresh();
    } else {
      showError('Failed to unblock');
    }
  }

  async function handleRestore() {
    setRestoring(true);
    const res = await safeFetch(`/api/admin/users/${personId}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason_text: 'Admin restore' }),
    });
    setRestoring(false);
    if (res.ok) {
      setShowRestoreDialog(false);
      showSuccess(
        'User restored. On next sign-in they will be routed through onboarding to refill their profile.',
      );
      mutate();
      router.refresh();
    } else {
      showError('Failed to restore user');
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await safeFetch(`/api/admin/users/${personId}`, { method: 'DELETE' });
    setDeleting(false);
    if (res.ok) {
      setShowDeleteDialog(false);
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
            <Button variant="default" onClick={() => setShowRestoreDialog(true)}>
              Restore
            </Button>
          )}
          {isBlocked ? (
            <Button variant="outline" onClick={() => setShowUnblockDialog(true)}>
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

      <AdminActionDialog
        open={showBlockDialog}
        onOpenChange={(open) => {
          setShowBlockDialog(open);
          if (!open) setBlockReason('');
        }}
        title="Block this user?"
        description={
          <div className="flex flex-col gap-2">
            <p>This immediately:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Signs the user out and prevents re-login until unblocked.</li>
              <li>Cancels every active engagement they are part of.</li>
              <li>Hides every posting they authored.</li>
              <li>Expires their availability windows.</li>
              <li>Clears their unread notifications.</li>
            </ul>
            <p>Profile data is preserved. This action can be reversed via Unblock or Restore.</p>
          </div>
        }
        confirmLabel="Block user"
        variant="destructive"
        loading={blocking}
        confirmDisabled={!blockReason.trim()}
        onConfirm={handleBlock}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Reason category</span>
          <select
            value={blockCategory}
            onChange={(e) => setBlockCategory(e.target.value)}
            className="rounded border p-2 text-sm"
          >
            <option value="harassment">Harassment</option>
            <option value="fraud">Fraud</option>
            <option value="safety_concern">Safety concern</option>
            <option value="spam">Spam</option>
            <option value="impersonation">Impersonation</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Internal reason</span>
          <textarea
            placeholder="Context for the moderation log..."
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            className="rounded border p-2 text-sm"
            rows={3}
          />
        </label>
      </AdminActionDialog>

      <AdminActionDialog
        open={showUnblockDialog}
        onOpenChange={setShowUnblockDialog}
        title="Unblock this user?"
        description={
          <div className="flex flex-col gap-2">
            <p>
              Lifts the block flag only — the user can log in again immediately with their existing
              credentials.
            </p>
            <p>
              <strong>What Unblock does not do:</strong> cancelled engagements, hidden postings,
              expired availability, and cleared notifications are <em>not</em> restored.
            </p>
            <p>
              If this user was also Deleted (account deactivated and profile scrubbed), use{' '}
              <strong>Restore</strong> instead — Unblock will leave them unable to log in.
            </p>
          </div>
        }
        confirmLabel="Unblock user"
        variant="default"
        loading={unblocking}
        onConfirm={handleUnblock}
      />

      <AdminActionDialog
        open={showRestoreDialog}
        onOpenChange={setShowRestoreDialog}
        title="Restore this account?"
        description={
          <div className="flex flex-col gap-2">
            <p>
              Reactivates the account by clearing both the block and deactivation flags and lifting
              the login ban.
            </p>
            {isDeactivated && (
              <p>
                <strong>This account was previously Deleted.</strong> All profile data (role, certs,
                experience, languages, location, avatar, bio, nationality, etc.) was wiped — Restore
                cannot bring any of that back.
              </p>
            )}
            <p>
              On their next sign-in the user will be routed through onboarding to fill in a fresh
              profile. Existing engagements, postings, and notifications remain cancelled/hidden.
            </p>
          </div>
        }
        confirmLabel="Restore account"
        variant="default"
        loading={restoring}
        onConfirm={handleRestore}
      />

      <AdminActionDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete this user's profile?"
        description={
          <div className="flex flex-col gap-2">
            <p>This is the strongest moderation action. It:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Wipes every profile field</strong> — role, certifications, experience,
                languages, location, avatar, bio, nationality, deck name, agency, visas, and so on.
                Crew and shore experience entries are deleted.
              </li>
              <li>Cancels active engagements, hides postings, expires availability.</li>
              <li>Deletes Docky chats, WhatsApp channels, placement cities, and admin notes.</li>
              <li>Bans the login for ~100 years.</li>
            </ul>
            <p>
              The event ledger is retained for audit. Display name becomes &quot;Deleted User&quot;;
              the email address in auth stays reserved (the user cannot sign up again with that
              email unless the auth record is cleared manually in Supabase).
            </p>
            <p>
              Use <strong>Restore</strong> later to revive the account to an empty profile — the
              user will then re-onboard from scratch.
            </p>
          </div>
        }
        confirmLabel="Delete profile"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />

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
