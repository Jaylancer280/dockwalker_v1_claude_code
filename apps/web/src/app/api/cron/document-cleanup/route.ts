import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/cron/document-cleanup
 * Runs every 6 hours. Deletes expired documents from storage and soft-deletes metadata.
 * Also cleans up storage for previously soft-deleted documents.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sc = await createServiceClient();
    let cleaned = 0;
    let stragglers = 0;

    // 1. Expired documents — delete from storage, soft-delete metadata
    const { data: expired } = await sc
      .from('engagement_documents')
      .select('id, storage_path')
      .lt('expires_at', new Date().toISOString())
      .is('deleted_at', null);

    for (const doc of expired ?? []) {
      if (doc.storage_path) {
        await sc.storage.from('engagement-documents').remove([doc.storage_path]);
      }
      await sc
        .from('engagement_documents')
        .update({ deleted_at: new Date().toISOString(), storage_path: null })
        .eq('id', doc.id);
      cleaned++;
    }

    // 2. Soft-deleted documents that still have storage files (GDPR scrub, manual delete)
    const { data: orphans } = await sc
      .from('engagement_documents')
      .select('id, storage_path')
      .not('deleted_at', 'is', null)
      .not('storage_path', 'is', null);

    for (const doc of orphans ?? []) {
      if (doc.storage_path) {
        await sc.storage.from('engagement-documents').remove([doc.storage_path]);
        await sc.from('engagement_documents').update({ storage_path: null }).eq('id', doc.id);
      }
    }

    // 3. Monitoring: count stale documents (expired 6+ hours ago, not yet cleaned)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { count: staleCount } = await sc
      .from('engagement_documents')
      .select('id', { count: 'exact', head: true })
      .lt('expires_at', sixHoursAgo)
      .is('deleted_at', null);

    stragglers = staleCount ?? 0;
    if (stragglers > 0) {
      console.error(`Document cleanup: ${stragglers} stale documents older than 6 hours`);
    }

    return NextResponse.json({ cleaned, orphans: (orphans ?? []).length, stragglers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cron failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
