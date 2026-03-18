import { NextResponse } from 'next/server';
import { requireDomainUser, type DomainUser } from './require-domain-user';

type AdminGuardResult = { ok: true; value: DomainUser } | { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<AdminGuardResult> {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard;

  if (!guard.value.person.is_admin) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    };
  }

  return guard;
}
