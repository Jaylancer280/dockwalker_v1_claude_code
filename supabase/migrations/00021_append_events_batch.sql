-- Migration 00021: Batch event append for atomicity
-- Creates append_events_batch RPC that processes multiple events in a single transaction.
-- All events succeed or none do — no partial state from mid-flight failures.

create or replace function public.append_events_batch(
  p_events jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_event jsonb;
  v_event_id uuid;
  v_ids jsonb := '[]'::jsonb;
begin
  for v_event in select * from jsonb_array_elements(p_events)
  loop
    insert into public.events (
      event_type, aggregate_id, aggregate_type, role_context, payload, person_id
    )
    values (
      v_event->>'event_type',
      v_event->>'aggregate_id',
      v_event->>'aggregate_type',
      v_event->>'role_context',
      v_event->'payload',
      (v_event->>'person_id')::uuid
    )
    returning id into v_event_id;

    perform public.apply_projection(
      v_event->>'event_type',
      v_event->>'aggregate_id',
      v_event->>'aggregate_type',
      v_event->>'role_context',
      v_event->'payload',
      (v_event->>'person_id')::uuid
    );

    v_ids := v_ids || to_jsonb(v_event_id);
  end loop;

  return v_ids;
end;
$$;
