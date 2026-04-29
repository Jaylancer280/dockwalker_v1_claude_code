import { NextResponse } from 'next/server';
import { appendEvent } from '@dockwalker/db';
import { requireAdmin } from '@/lib/auth/require-admin';
import { mintHandle, MintHandleError } from '@/lib/cv/mint-handle';

/**
 * POST /api/admin/cv/mint-handle/[personId]
 *
 * Stage-1 operational route. Mints a fresh `cv_handle` for the target
 * crew person if their handle is null, then fires `CV.HANDLE_REGENERATED`
 * with `old_handle = null` so the event ledger records the first-mint.
 *
 * Used by:
 *   - Stage-1 QA: the QR-landing surface and hire-from-QR wizards are
 *     wired but unreachable via natural user flows until Stage 2's PDF
 *     generator mints handles. This route lets internal QA + the Phase
 *     7 stress test seed handles for testing.
 *   - Post-Stage-2 operational tool: rare cases where a user's mint
 *     failed mid-flight and they need a manual rescue.
 *
 * Returns:
 *   - 201 { handle } when a new handle is minted
 *   - 409 { error, handle } when the target already has a cv_handle
 *     (use the regenerate endpoint instead — Stage 2)
 *   - 403 admin-only
 *   - 404 if the target person has no profile row
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient, person: adminPerson } = guard.value;
  const { personId } = await params;

  try {
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('person_id, cv_handle')
      .eq('person_id', personId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found for person' }, { status: 404 });
    }

    if (profile.cv_handle) {
      return NextResponse.json(
        {
          error: 'cv_handle already exists',
          handle: profile.cv_handle,
        },
        { status: 409 },
      );
    }

    // Mint via the shared helper (5-retry on Postgres unique_violation).
    // The helper writes cv_handle + cv_handle_updated_at directly; we
    // then fire the event so the ledger has an audit row.
    const handle = await mintHandle(serviceClient, personId);

    await appendEvent(serviceClient, {
      eventType: 'CV.HANDLE_REGENERATED',
      aggregateId: personId,
      aggregateType: 'person',
      roleContext: 'crew',
      payload: {
        old_handle: null,
        new_handle: handle,
      },
      personId: adminPerson.id,
    });

    return NextResponse.json({ handle }, { status: 201 });
  } catch (err) {
    if (err instanceof MintHandleError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
