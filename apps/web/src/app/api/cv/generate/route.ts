import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * POST /api/cv/generate
 *
 * Stage-1 stub. Returns 503 with a Coming-Soon message. Stage 2 (Phase 8)
 * swaps the body for the real PDF generator: lazy-mints `cv_handle` if
 * null, fires `CV.GENERATED`, returns the PDF blob with
 * `Content-Type: application/pdf`. Pro adds the QR code; Free omits.
 *
 * Auth + crew-hat gate live here so the route surface contract is
 * stable across the Stage 1 → Stage 2 transition — only the body
 * changes.
 */
export async function POST() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { person } = guard.value;

    if (person.current_hat !== 'crew') {
      return NextResponse.json({ error: 'Crew hat required' }, { status: 403 });
    }

    return NextResponse.json(
      {
        error: 'DockWalker CV — Coming Soon',
        message:
          'CV generation will launch in the next release. Configure your CV settings now in Settings → CV Builder so your first download reflects them.',
      },
      { status: 503 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
