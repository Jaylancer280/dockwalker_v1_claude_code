'use client';

import { useState } from 'react';
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

export default function AdminUserDetailPage() {
  const { personId } = useParams<{ personId: string }>();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [blocking, setBlocking] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [blockCategory, setBlockCategory] = useState('other');

  const {
    data: user,
    isLoading,
    mutate,
  } = useSafeFetch<UserDetail>(`/api/admin/users/${personId}`);
  const { data: eventsData } = useSafeFetch<{ events: EventRow[] }>(
    `/api/admin/events?person_id=${personId}&limit=50`,
  );

  const events = eventsData?.events ?? [];

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
