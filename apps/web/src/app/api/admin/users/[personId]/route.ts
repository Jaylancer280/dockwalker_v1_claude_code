import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

/**
 * DELETE /api/admin/users/:personId
 * Hard-delete a user and all their data. Calls admin_delete_person RPC
 * (cleans child rows in FK order), then deletes the auth.users record.
 * Irreversible. Admin-only.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient, person: adminPerson } = guard.value;
  const { personId } = await params;

  // Prevent self-deletion
  if (personId === adminPerson.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  try {
    // Verify user exists
    const { data: target } = await serviceClient
      .from('persons')
      .select('id')
      .eq('id', personId)
      .single();

    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 1. Delete all child data in FK dependency order
    const { error: rpcError } = await serviceClient.rpc('admin_delete_person', {
      target_id: personId,
    });
    if (rpcError) {
      return NextResponse.json(
        { error: `Failed to delete user data: ${rpcError.message}` },
        { status: 500 },
      );
    }

    // 2. Delete the auth.users record
    const { error: authError } = await serviceClient.auth.admin.deleteUser(personId);
    if (authError) {
      return NextResponse.json(
        { error: `User data deleted but auth record removal failed: ${authError.message}` },
        { status: 500 },
      );
    }

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
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
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
