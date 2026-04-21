-- =============================================================================
-- Migration 00105: Extend custom_access_token_hook with is_admin and blocked claims
--
-- Adds two additional JWT claims so middleware can enforce /admin/* and /blocked
-- redirects without a per-request DB query.
--
-- Claims injected when true:
--   - is_admin  — only if persons.is_admin = true
--   - blocked   — only if persons.blocked_at is not null
--
-- Existing claims (person_id, current_hat, identity_type, onboarded, deactivated)
-- are preserved. Behaviour for non-admin, non-blocked users is unchanged.
--
-- Propagation note: new claims take effect on the next JWT refresh (up to ~1 hour
-- lag). The API layer (requireDomainUser) remains the authoritative gate; the
-- middleware claims are a UX fast path.
--
-- Schema prerequisites (already applied):
--   - persons.is_admin     from 00050_admin_role.sql
--   - persons.blocked_at   from 00097_admin_blocking.sql
-- =============================================================================

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

  select id, current_hat, identity_type, deactivated_at, is_admin, blocked_at
  into person_record
  from public.persons
  where id = (event->>'user_id')::uuid;

  if person_record.id is not null then
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

    if exists (select 1 from public.profiles where person_id = person_record.id) then
      claims := jsonb_set(claims, '{app_metadata, onboarded}', 'true'::jsonb);
    else
      claims := jsonb_set(claims, '{app_metadata, onboarded}', 'false'::jsonb);
    end if;

    if person_record.deactivated_at is not null then
      claims := jsonb_set(claims, '{app_metadata, deactivated}', 'true'::jsonb);
    end if;

    if person_record.blocked_at is not null then
      claims := jsonb_set(claims, '{app_metadata, blocked}', 'true'::jsonb);
    end if;

    if person_record.is_admin = true then
      claims := jsonb_set(claims, '{app_metadata, is_admin}', 'true'::jsonb);
    end if;
  end if;

  return jsonb_build_object('claims', claims);
end;
$$;
