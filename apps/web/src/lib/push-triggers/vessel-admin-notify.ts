import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Fire-and-forget admin notification when a user submits a manual
 * vessel request. Mirrors `notifyAdminsOfLocationRequest` (Wave D of
 * Locations V2): one in-app notification per active admin, deep-linked
 * to `/admin/vessels/pending`. Admins triage from the dashboard.
 *
 * Failures are swallowed so the user-facing `/api/vessels/request`
 * route can still succeed even if the notification fan-out fails.
 */
export async function notifyAdminsOfVesselRequest(
  sc: SupabaseClient,
  params: {
    submitterName: string;
    vesselName: string;
    imoNumber: string;
    flagStateName?: string | null;
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

    const flagBit = params.flagStateName ? `, ${params.flagStateName} flag` : '';
    const title = 'New vessel request';
    const body = `${params.submitterName} added ${params.vesselName} (IMO ${params.imoNumber}${flagBit})`;

    const rows = admins.map((a) => ({
      person_id: a.id as string,
      type: 'admin_vessel_pending',
      title,
      body,
      deep_link: '/admin/vessels/pending',
      role_context: ((a.current_hat as string | null) ?? 'employer') as
        | 'crew'
        | 'employer'
        | 'agent',
    }));

    await sc.from('notifications').insert(rows);
  } catch {
    // Swallow — admin notification miss is recoverable, must not block user route.
  }
}
