import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Fire-and-forget admin notification when a user submits a manual
 * location request. Mirrors the `notifyAdminsOfSupport` pattern from
 * Fix 231: insert one in-app notification per active admin pointing
 * at `/admin/locations/pending`. Admins are expected to triage from
 * the dashboard rather than via push / email / WhatsApp / Telegram.
 *
 * Failures are swallowed so the user-facing `/api/locations/request`
 * route can still succeed even if the notification fan-out fails.
 */
export async function notifyAdminsOfLocationRequest(
  sc: SupabaseClient,
  params: {
    submitterName: string;
    cityName: string;
    portName?: string | null;
    countryName?: string | null;
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

    const what = params.portName ? `${params.portName} (${params.cityName})` : params.cityName;
    const where = params.countryName ? ` in ${params.countryName}` : '';
    const title = 'New location request';
    const body = `${params.submitterName} added ${what}${where}`;

    const rows = admins.map((a) => ({
      person_id: a.id as string,
      type: 'admin_location_pending',
      title,
      body,
      deep_link: '/admin/locations/pending',
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
