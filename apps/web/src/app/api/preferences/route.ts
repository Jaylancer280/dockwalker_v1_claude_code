import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

const BOOLEAN_FIELDS = [
  'email_enabled',
  'push_jobs',
  'push_applications',
  'push_messages',
  'push_reminders',
  'whatsapp_enabled',
  'telegram_enabled',
] as const;

/**
 * GET /api/preferences
 * Returns current user's notification preferences, upserting a row if none exists.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase } = guard.value;

  try {
    // Upsert to ensure row exists
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({ person_id: user.id }, { onConflict: 'person_id', ignoreDuplicates: true })
      .select(
        'email_enabled, push_jobs, push_applications, push_messages, push_reminders, whatsapp_enabled, telegram_enabled',
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ preferences: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/preferences
 * Partial update of notification preference fields. All fields must be booleans.
 */
export async function PATCH(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase } = guard.value;

  try {
    const body = await request.json();

    const updates: Record<string, boolean> = {};
    for (const field of BOOLEAN_FIELDS) {
      if (field in body) {
        if (typeof body[field] !== 'boolean') {
          return NextResponse.json({ error: `${field} must be a boolean` }, { status: 400 });
        }
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({ person_id: user.id, ...updates }, { onConflict: 'person_id' })
      .select(
        'email_enabled, push_jobs, push_applications, push_messages, push_reminders, whatsapp_enabled, telegram_enabled',
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ preferences: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
