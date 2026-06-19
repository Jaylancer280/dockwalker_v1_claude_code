-- Rollback for 00124. Restores `append_event` to the 6-arg signature
-- and removes the idempotency_key column + partial unique index.
--
-- Order matters: drop the new RPC overload first (PostgreSQL allows
-- function overloading by signature, so the 7-arg version coexists
-- with whatever was there before until explicitly dropped), then
-- recreate the original 6-arg version, then drop the index, then drop
-- the column. The index would block column drop if attempted before
-- the index is gone.

drop function if exists public.append_event(text, text, text, text, jsonb, uuid, text);

create or replace function public.append_event(
  p_event_type text,
  p_aggregate_id text,
  p_aggregate_type text,
  p_role_context text,
  p_payload jsonb,
  p_person_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_event_id uuid;
begin
  insert into public.events (event_type, aggregate_id, aggregate_type, role_context, payload, person_id)
  values (p_event_type, p_aggregate_id, p_aggregate_type, p_role_context, p_payload, p_person_id)
  returning id into v_event_id;

  perform public.apply_projection(p_event_type, p_aggregate_id, p_aggregate_type, p_role_context, p_payload, p_person_id);

  return v_event_id;
end;
$$;

drop index if exists public.idx_events_idempotency_key;

alter table public.events drop column if exists idempotency_key;
