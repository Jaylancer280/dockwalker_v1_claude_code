import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/preferences
 * Returns the authenticated user's preferences (or defaults if none exist).
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase } = guard.value;

  const { data } = await supabase
    .from('user_preferences')
    .select('profile_visible')
    .eq('person_id', user.id)
    .single();

  return NextResponse.json({
    profile_visible: data?.profile_visible ?? true,
  });
}

/**
 * PATCH /api/preferences
 * Upserts user preferences. Only known fields are accepted.
 * Body: { profile_visible?: boolean }
 */
export async function PATCH(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase } = guard.value;

  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (typeof body.profile_visible === 'boolean') {
    updates.profile_visible = body.profile_visible;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('user_preferences')
    .upsert({ person_id: user.id, ...updates }, { onConflict: 'person_id' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
