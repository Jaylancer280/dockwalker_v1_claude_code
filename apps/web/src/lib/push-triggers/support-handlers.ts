import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotifyContext } from './types';

// SUPPORT handlers fire ONLY for the admin → user direction (admin opens
// thread, admin sends reply). User → admin notifications are inserted
// directly in the user-side support routes since admins only need in-app
// alerts (no Telegram/email/push for admin recipients).

async function getRecipientHat(
  sc: SupabaseClient,
  personId: string,
): Promise<'crew' | 'employer' | 'agent'> {
  const { data } = await sc.from('persons').select('current_hat').eq('id', personId).single();
  const hat = data?.current_hat as string | undefined;
  if (hat === 'crew' || hat === 'employer' || hat === 'agent') return hat;
  return 'crew';
}

export async function handleSupportThreadOpened(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const isAdminInitiated = payload.is_admin_initiated === true;
  if (!isAdminInitiated) return [];

  const personId = payload.person_id as string;
  const threadId = payload.thread_id as string;
  if (!personId || !threadId) return [];

  const hat = await getRecipientHat(sc, personId);
  const subject = (payload.subject as string | null) || 'Message from DockWalker';
  const contentPreview = payload.content_preview as string | undefined;
  const body = contentPreview
    ? contentPreview.length > 100
      ? `${contentPreview.slice(0, 100)}…`
      : contentPreview
    : subject;

  return [
    {
      recipientPersonId: personId,
      roleContext: hat,
      notification: {
        title: 'Message from DockWalker',
        body,
        data: { screen: 'support', threadId },
      },
    },
  ];
}

export async function handleSupportMessageSent(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  // is_platform=true means admin sent. User-sent (is_platform=false) goes
  // directly to admins via INSERT in the user route, not through this path.
  const isPlatform = payload.is_platform === true;
  if (!isPlatform) return [];

  const threadId = payload.thread_id as string;
  if (!threadId) return [];

  const { data: thread } = await sc
    .from('support_threads')
    .select('person_id, subject')
    .eq('id', threadId)
    .single();
  if (!thread?.person_id) return [];

  const contentPreview = payload.content_preview as string | undefined;
  const preview = contentPreview
    ? contentPreview.length > 100
      ? `${contentPreview.slice(0, 100)}…`
      : contentPreview
    : thread.subject || 'New reply from DockWalker';

  const hat = await getRecipientHat(sc, thread.person_id as string);

  return [
    {
      recipientPersonId: thread.person_id as string,
      roleContext: hat,
      notification: {
        title: 'New reply from DockWalker',
        body: preview,
        data: { screen: 'support', threadId },
      },
    },
  ];
}
