import { NextResponse } from 'next/server';
import { requireDomainUser, type DomainUser } from './require-domain-user';

type AdminGuardResult = { ok: true; value: DomainUser } | { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<AdminGuardResult> {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard;

  const { data, error } = await guard.value.supabase
    .from('persons')
    .select('is_admin')
    .eq('id', guard.value.person.id)
    .single();

  if (error || !data?.is_admin) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    };
  }

  guard.value.person.is_admin = true;
  return guard;
}
