import type { SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';

export type AdminAction =
  | 'block_user'
  | 'unblock_user'
  | 'delete_user'
  | 'restore_user'
  | 'cancel_engagement'
  | 'hide_posting'
  | 'resolve_report'
  | 'close_thread'
  | 'discard_incomplete_signup';

export interface LogAdminActionParams {
  adminPersonId: string;
  action: AdminAction;
  /** Person targeted by the action (block / delete / restore / unblock_user / report subject). Null for posting / thread / engagement targets that don't tie back to a person directly via this column. */
  targetPersonId?: string | null;
  /** Polymorphic id — engagement_id, posting_id, report_id, thread_id, etc. Null for actions where the target is fully captured by `targetPersonId`. */
  targetId?: string | null;
  /** Free-text reason supplied by the admin. */
  reason?: string | null;
  /** Action-specific structured fields. Keys vary by action — e.g. `posting_type` for hide_posting, `reason_category` for cancel_engagement. */
  metadata?: Record<string, unknown>;
}

/**
 * Insert a row into admin_action_log (migration 00133).
 *
 * Best-effort: failures here are logged to Sentry but don't fail the
 * caller's mutation, since the canonical record is the ledger event
 * (already appended). The log is an indexed projection for ops review,
 * not the source of truth.
 *
 * Call this AFTER the event has been appended successfully — if
 * `appendEvent` throws, the log row would be misleading.
 */
export async function logAdminAction(
  serviceClient: SupabaseClient,
  params: LogAdminActionParams,
): Promise<void> {
  const { error } = await serviceClient.from('admin_action_log').insert({
    admin_person_id: params.adminPersonId,
    action: params.action,
    target_person_id: params.targetPersonId ?? null,
    target_id: params.targetId ?? null,
    reason: params.reason ?? null,
    metadata: params.metadata ?? {},
  });

  if (error) {
    Sentry.captureException(error, {
      tags: { module: 'admin.log-action', action: params.action },
      extra: { params },
    });
  }
}
