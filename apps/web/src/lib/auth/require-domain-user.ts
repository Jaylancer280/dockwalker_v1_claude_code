import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RoleContext } from '@dockwalker/types';

export interface DomainUser {
  user: { id: string };
  person: { id: string; identity_type: string; current_hat: RoleContext; is_admin: boolean };
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

  // Try JWT custom claims first (injected by custom_access_token_hook — zero DB queries)
  const appMeta = user.app_metadata as
    | {
        person_id?: string;
        current_hat?: string;
        identity_type?: string;
        onboarded?: boolean;
        deactivated?: boolean;
      }
    | undefined;

  const hasClaims = !!(
    appMeta?.person_id &&
    appMeta?.current_hat &&
    appMeta?.identity_type &&
    appMeta?.onboarded !== undefined
  );

  if (hasClaims) {
    // Fast path: read identity from JWT claims
    if (appMeta!.deactivated) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Account deactivated' }, { status: 403 }),
      };
    }

    if (!appMeta!.onboarded) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Complete onboarding before using this feature' },
          { status: 409 },
        ),
      };
    }

    const serviceClient = await createServiceClient();

    // is_admin is not in claims (rare, security-sensitive) — default to false
    // Admin routes query the DB themselves via the admin guard
    const person = {
      id: appMeta!.person_id!,
      identity_type: appMeta!.identity_type!,
      current_hat: appMeta!.current_hat! as RoleContext,
      is_admin: false,
    };

    return {
      ok: true,
      value: {
        user,
        person,
        profile: { person_id: appMeta!.person_id! },
        supabase,
        serviceClient,
      },
    };
  }

  // Fallback: DB queries (pre-hook sessions or claims missing)
  const { data: personRow } = await supabase
    .from('persons')
    .select('id, identity_type, current_hat, is_admin, deactivated_at')
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

  if (personRow.deactivated_at !== null) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Account deactivated' }, { status: 403 }),
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
