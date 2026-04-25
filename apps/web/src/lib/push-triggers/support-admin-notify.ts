import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Insert in-app notifications for every active admin when a user opens a
 * support thread or sends a reply. Per launch decision: admins only get
 * in-app notifications for support events — no Telegram, WhatsApp, push,
 * or email. They're expected to monitor the admin dashboard.
 *
 * Fire-and-forget: failures are swallowed to avoid breaking the user-side
 * route response. The event ledger still records SUPPORT.* for audit.
 */
export async function notifyAdminsOfSupport(
  sc: SupabaseClient,
  params: {
    threadId: string;
    isNewThread: boolean;
    senderName: string;
    contentPreview: string;
    subject?: string | null;
  },
): Promise<void> {
  try {
    const { data: admins } = await sc
      .from('persons')
      .select('id, current_hat')
      .eq('is_admin', true)
      .is('deactivated_at', null)
      .is('blocked_at', null);

    if (!admins || admins.length === 0) return;

    const title = params.isNewThread
      ? `Support thread opened by ${params.senderName}`
      : `Support reply from ${params.senderName}`;
    const preview =
      params.contentPreview.length > 120
        ? `${params.contentPreview.slice(0, 120)}…`
        : params.contentPreview;
    const body = params.isNewThread && params.subject ? `${params.subject} — ${preview}` : preview;

    const rows = admins.map((a) => ({
      person_id: a.id as string,
      type: params.isNewThread ? 'support_thread_opened_admin' : 'support_reply_admin',
      title,
      body,
      deep_link: `/admin/support/${params.threadId}`,
      role_context: ((a.current_hat as string | null) ?? 'employer') as
        | 'crew'
        | 'employer'
        | 'agent',
    }));

    await sc.from('notifications').insert(rows);
  } catch {
    // Swallow — admin notification miss is recoverable, must not break the user route.
  }
}
