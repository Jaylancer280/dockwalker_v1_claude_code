-- =============================================================================
-- Rollback 00105: restore custom_access_token_hook to its 00078 body
--
-- Removes the is_admin + blocked claim injection. Existing claims remain.
-- Verbatim copy of the function body from 00078_custom_access_token_hook.sql.
--
-- The function is recreated (not dropped) so that a partial roll-back to v104
-- leaves the hook working. A further roll-back past 00078 will drop the
-- function via 00078_custom_access_token_hook.down.sql.
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

  select id, current_hat, identity_type, deactivated_at
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
  end if;

  return jsonb_build_object('claims', claims);
end;
$$;
