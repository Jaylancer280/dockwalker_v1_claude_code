-- Custom access token hook: injects person_id, current_hat, identity_type into JWT claims
-- This eliminates ~4 DB queries per API call (middleware + auth guard each queried persons + profiles)
-- Must be enabled in Supabase Dashboard: Auth → Hooks → Custom Access Token → public.custom_access_token_hook

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  person_record record;
begin
  claims := event->'claims';

  -- Look up the person row for this auth user
  select id, current_hat, identity_type, deactivated_at
  into person_record
  from public.persons
  where id = (event->>'user_id')::uuid;

  if person_record.id is not null then
    -- Inject domain identity into app_metadata
    claims := jsonb_set(
      claims,
      '{app_metadata, person_id}',
      to_jsonb(person_record.id::text)
    );
    claims := jsonb_set(
      claims,
      '{app_metadata, current_hat}',
      to_jsonb(person_record.current_hat)
    );
    claims := jsonb_set(
      claims,
      '{app_metadata, identity_type}',
      to_jsonb(person_record.identity_type)
    );
    -- Check if profile exists (onboarding complete)
    if exists (select 1 from public.profiles where person_id = person_record.id) then
      claims := jsonb_set(
        claims,
        '{app_metadata, onboarded}',
        'true'::jsonb
      );
    else
      claims := jsonb_set(
        claims,
        '{app_metadata, onboarded}',
        'false'::jsonb
      );
    end if;
    -- Deactivation flag
    if person_record.deactivated_at is not null then
      claims := jsonb_set(
        claims,
        '{app_metadata, deactivated}',
        'true'::jsonb
      );
    end if;
  end if;

  return jsonb_build_object('claims', claims);
end;
$$;

-- Grant execute to supabase_auth_admin (required for the hook to be called)
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;

-- Revoke from normal roles (security: this function reads persons table with security definer)
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
