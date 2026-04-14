import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { cascadeBlock } from '@/lib/admin/cascade-block';

const REASON_CATEGORIES = [
  'harassment',
  'fraud',
  'safety_concern',
  'spam',
  'impersonation',
  'other',
] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient, person: adminPerson } = guard.value;
  const { personId } = await params;

  if (personId === adminPerson.id) {
    return NextResponse.json({ error: 'Cannot block your own account' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { reason_category, reason_text } = body;

    if (!reason_category || !REASON_CATEGORIES.includes(reason_category)) {
      return NextResponse.json({ error: 'Invalid reason_category' }, { status: 400 });
    }
    if (!reason_text || typeof reason_text !== 'string') {
      return NextResponse.json({ error: 'reason_text is required' }, { status: 400 });
    }

    const { data: target } = await serviceClient
      .from('persons')
      .select('id, is_admin, blocked_at')
      .eq('id', personId)
      .single();

    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (target.is_admin) {
      return NextResponse.json(
        { error: 'Cannot block an admin — demote first via direct DB access' },
        { status: 400 },
      );
    }
    if (target.blocked_at) {
      return NextResponse.json({ error: 'User is already blocked' }, { status: 400 });
    }

    const cascade = await cascadeBlock(serviceClient, personId, adminPerson.id, {
      reasonCategory: reason_category,
      reasonText: reason_text,
    });

    return NextResponse.json({ success: true, cascade });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to block user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
