import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { requireAdmin } from '@/lib/auth/require-admin';
import { appendEvents, type AppendEventParams } from '@dockwalker/db';
import type { EventPayloadMap } from '@dockwalker/types';
import { cascadeBlock } from '@/lib/admin/cascade-block';
import { logAdminAction } from '@/lib/admin/log-action';

/**
 * DELETE /api/admin/users/:personId
 * Scrub user: emits PERSON.DATA_SCRUBBED + PERSON.DEACTIVATED, then bans auth row.
 * Event rows preserved for audit. PII removed from projections.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient, person: adminPerson } = guard.value;
  const { personId } = await params;

  if (personId === adminPerson.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  try {
    // maybeSingle (not single) so we can definitively distinguish
    // "no persons row" (data null, error null) from a transient query
    // failure (error set). The discard branch deletes the auth user
    // irreversibly — it must only fire when we're certain there's no
    // persons row, never on a flaky read (stress-test risk R8/ADMIN-1).
    const { data: target, error: targetError } = await serviceClient
      .from('persons')
      .select('id, is_admin, blocked_at')
      .eq('id', personId)
      .maybeSingle();

    if (targetError) {
      return NextResponse.json({ error: targetError.message }, { status: 500 });
    }

    if (!target) {
      // Auth-only signup: an auth.users row with no persons/profiles
      // (never finished onboarding). Nothing to scrub or cascade — the
      // only meaningful action is to remove the auth row outright.
      const { data: authLookup, error: authLookupError } =
        await serviceClient.auth.admin.getUserById(personId);
      if (authLookupError || !authLookup?.user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const { error: deleteError } = await serviceClient.auth.admin.deleteUser(personId);
      if (deleteError) {
        return NextResponse.json(
          { error: `Failed to discard signup: ${deleteError.message}` },
          { status: 500 },
        );
      }

      await logAdminAction(serviceClient, {
        adminPersonId: adminPerson.id,
        action: 'discard_incomplete_signup',
        targetPersonId: null, // no persons row — FK would reject the id
        reason: 'Incomplete signup discarded by DockWalker',
        metadata: { auth_user_id: personId, email: authLookup.user.email ?? null },
      });

      return NextResponse.json({ success: true, discarded: true });
    }

    if (target.is_admin) {
      return NextResponse.json({ error: 'Cannot delete an admin account' }, { status: 400 });
    }

    if (!target.blocked_at) {
      await cascadeBlock(serviceClient, personId, adminPerson.id, {
        reasonText: 'Account deleted by DockWalker',
      });
    }

    const events: AppendEventParams<keyof EventPayloadMap>[] = [
      {
        eventType: 'PERSON.DATA_SCRUBBED',
        aggregateId: personId,
        aggregateType: 'person',
        roleContext: 'employer',
        payload: {},
        personId,
      },
      {
        eventType: 'PERSON.DEACTIVATED',
        aggregateId: personId,
        aggregateType: 'person',
        roleContext: 'employer',
        payload: {},
        personId,
      },
    ];

    await appendEvents(serviceClient, events);

    const { error: banError } = await serviceClient.auth.admin.updateUserById(personId, {
      ban_duration: '876000h',
    });

    if (banError) {
      // Best-effort: PERSON.DEACTIVATED has already committed and middleware
      // gates login on persons.deactivated_at as the primary mechanism. The
      // auth ban is defence-in-depth — failing it shouldn't surface an
      // error to the admin for a delete that did complete (the scrub is
      // irreversible regardless). Earlier behaviour returned 500 here,
      // which left the admin dashboard stuck on a stale view of a user
      // whose profile had already been wiped server-side.
      Sentry.captureException(banError, {
        tags: { module: 'admin.delete-user', step: 'auth_ban' },
        extra: { personId },
      });
    }

    await logAdminAction(serviceClient, {
      adminPersonId: adminPerson.id,
      action: 'delete_user',
      targetPersonId: personId,
      reason: 'Account deleted by DockWalker',
      metadata: { previously_blocked: !!target.blocked_at },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/admin/users/:personId
 * Admin-only user detail view.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;
  const { personId } = await params;

  try {
    const [{ data: person }, { data: profile }, { data: subscription }, { count: eventCount }] =
      await Promise.all([
        serviceClient.from('persons').select('*').eq('id', personId).single(),
        serviceClient.from('profiles').select('*').eq('person_id', personId).single(),
        serviceClient.from('subscriptions').select('*').eq('person_id', personId).maybeSingle(),
        serviceClient
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('person_id', personId),
      ]);

    if (!person) {
      // Auth-only signup (no persons/profiles row — never finished
      // onboarding). Return a stub so the detail page can render a
      // minimal view + Discard action instead of a 404.
      const { data: authLookup, error: authLookupError } =
        await serviceClient.auth.admin.getUserById(personId);
      if (authLookupError || !authLookup?.user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      const au = authLookup.user;
      const bannedUntilRaw = (au as { banned_until?: string | null }).banned_until ?? null;
      return NextResponse.json({
        person: null,
        profile: null,
        subscription: null,
        eventCount: 0,
        auth_user: {
          id: au.id,
          email: au.email ?? null,
          created_at: au.created_at,
          email_confirmed_at: au.email_confirmed_at ?? null,
          auth_banned: bannedUntilRaw ? new Date(bannedUntilRaw).getTime() > Date.now() : false,
        },
      });
    }

    return NextResponse.json({
      person,
      profile,
      subscription: subscription ?? null,
      eventCount: eventCount ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
