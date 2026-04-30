import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logAdminAction } from '@/lib/admin/log-action';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { serviceClient, person: adminPerson } = guard.value;
    const { threadId } = await params;

    const { error } = await serviceClient
      .from('support_threads')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', threadId)
      .eq('status', 'open');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logAdminAction(serviceClient, {
      adminPersonId: adminPerson.id,
      action: 'close_thread',
      targetId: threadId,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to close support thread';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
