import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RoleContext } from '@dockwalker/types';

export interface DomainUser {
  user: { id: string };
  person: { id: string; identity_type: string; current_hat: RoleContext };
  profile: { person_id: string };
  supabase: SupabaseClient;
  serviceClient: SupabaseClient;
}

type GuardResult = { ok: true; value: DomainUser } | { ok: false; response: NextResponse };

export async function requireDomainUser(): Promise<GuardResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { data: personRow } = await supabase
    .from('persons')
    .select('id, identity_type, current_hat')
    .eq('id', user.id)
    .single();

  if (!personRow) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Complete onboarding before using this feature' },
        { status: 409 },
      ),
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('person_id')
    .eq('person_id', user.id)
    .single();

  if (!profile) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Complete onboarding before using this feature' },
        { status: 409 },
      ),
    };
  }

  const serviceClient = await createServiceClient();

  const person = {
    ...personRow,
    current_hat: personRow.current_hat as RoleContext,
  };

  return {
    ok: true,
    value: { user, person, profile, supabase, serviceClient },
  };
}
