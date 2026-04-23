import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * POST /api/notifications/read-group
 *
 * Marks every unread notification belonging to the current user that matches
 * `(type, deep_link)` as read in a single UPDATE. Used by the grouped
 * notifications UI so tapping a collapsed group clears the whole set rather
 * than only the latest member.
 *
 * Body: `{ type: string, deep_link: string | null }`
 *
 * `deep_link=null` matches the null-deep-link group (e.g. system notices).
 * Pass an explicit `null` in JSON to hit that bucket; omitted/undefined is
 * rejected with 400 to avoid accidentally clearing every notification of a
 * given type across all resources.
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;
    const body = await request.json().catch(() => ({}));
    const { type, deep_link } = body as { type?: unknown; deep_link?: unknown };

    if (typeof type !== 'string' || type.length === 0 || type.length > 128) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    if (!('deep_link' in (body as object))) {
      return NextResponse.json(
        { error: 'deep_link field is required (use null for empty-link group)' },
        { status: 400 },
      );
    }
    if (deep_link !== null && (typeof deep_link !== 'string' || deep_link.length > 2048)) {
      return NextResponse.json({ error: 'Invalid deep_link' }, { status: 400 });
    }

    let query = supabase
      .from('notifications')
      .update({ read: true })
      .eq('person_id', user.id)
      .eq('type', type)
      .eq('read', false);

    query = deep_link === null ? query.is('deep_link', null) : query.eq('deep_link', deep_link);

    const { error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
