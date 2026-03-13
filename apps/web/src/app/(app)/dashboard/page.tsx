import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Dashboard page — fallback redirect for bookmarks and stale links.
 * The proxy normally intercepts /dashboard and redirects by hat,
 * but if it doesn't (e.g. cookie timing), this server component
 * performs the same hat-routed redirect.
 */
export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data: person } = await supabase
    .from('persons')
    .select('id, current_hat')
    .eq('id', user.id)
    .single();

  if (!person) redirect('/onboarding');

  redirect(person.current_hat === 'crew' ? '/discover' : '/daywork/mine');
}
