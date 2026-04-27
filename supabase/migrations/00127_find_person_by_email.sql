-- =============================================================================
-- Migration 00127: find_person_id_by_email RPC
--
-- Helper RPC for the B-6 conditional notification flow on POST /api/references.
-- Returns the persons.id whose linked auth.users.email matches (case-insensitive)
-- or NULL if no match exists. Service-role only path — privileged because
-- auth.users is not readable to authenticated users.
--
-- Used by: apps/web/src/app/api/references/route.ts (POST) — fires an in-app
-- notification to a matched person on REFERENCE.REQUESTED. Email courier is
-- never used; the share-link remains the privacy-preserving primitive when
-- there's no DockWalker account match.
-- =============================================================================

create or replace function public.find_person_id_by_email(p_email text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
begin
  select u.id
    into v_user_id
    from auth.users u
    where lower(u.email) = lower(p_email)
    limit 1;
  if v_user_id is null then return null; end if;
  -- Confirm the auth user has a corresponding persons row (i.e. completed
  -- onboarding at least to PERSON.CREATED). Returning null for accounts that
  -- exist in auth but not yet in persons keeps callers on the share-link path.
  perform 1 from public.persons where id = v_user_id;
  if not found then return null; end if;
  return v_user_id;
end;
$$;

revoke all on function public.find_person_id_by_email(text) from public;
grant execute on function public.find_person_id_by_email(text) to service_role;
