import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/notifications
 * List notifications for the current user.
 *
 * Query params:
 * - `unread_only=true` — filter to unread only (ungrouped path only)
 * - `grouped=true`     — return the grouped RPC output instead of raw rows.
 *                        Each group collapses notifications that share the
 *                        same `(type, deep_link)` into one card with a
 *                        total_count + unread_count for the UI badge.
 */
export async function GET(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread_only') === 'true';
    const grouped = searchParams.get('grouped') === 'true';

    if (grouped) {
      const { data: groups, error: groupErr } = await supabase.rpc('grouped_notifications');
      if (groupErr) {
        return NextResponse.json({ error: groupErr.message }, { status: 500 });
      }
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('person_id', user.id)
        .eq('read', false);
      return NextResponse.json({
        groups: groups ?? [],
        unread_count: count ?? 0,
      });
    }

    let query = supabase
      .from('notifications')
      .select('id, type, title, body, deep_link, read, created_at')
      .eq('person_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get unread count
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', user.id)
      .eq('read', false);

    return NextResponse.json({
      notifications: notifications ?? [],
      unread_count: count ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load notifications';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
