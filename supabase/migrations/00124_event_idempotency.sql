-- Event idempotency (Risk D-1).
--
-- The events table has no uniqueness constraint preventing the same
-- event from being appended twice. If a route handler is retried
-- (network blip, mobile app's auto-retry, a Vercel function timeout
-- the client retries), `append_event` runs twice. The second call
-- inserts a duplicate event row and `apply_projection` runs the
-- handler a second time. Most events are protected by either:
--   (a) a payload UUID that hits a primary-key constraint on insert
--       (DAYWORK.POSTED, VESSEL.CREATED, EXPERIENCE.ADDED, etc.), or
--   (b) a WHERE-clause guard in the projection that makes the second
--       run a no-op (state-transition events like ACCEPTED that check
--       `status in (...)` before transitioning).
--
-- But several events have neither shield and increment counters or
-- INSERT without ON CONFLICT:
--   - DAYWORK.ACCEPTED            increments dayworks.positions_filled
--   - DAYWORK.INVITATION_ACCEPTED increments dayworks.positions_filled
--   - ENGAGEMENT.RATED_BY_CREW    INSERTs into engagement_ratings
--   - ENGAGEMENT.RATED_BY_EMPLOYER INSERTs into engagement_ratings
--   - ENGAGEMENT.CANCELLATION_RATED_BY_CREW    INSERTs into engagement_ratings
--   - ENGAGEMENT.CANCELLATION_RATED_BY_EMPLOYER INSERTs into engagement_ratings
--
-- A retry on any of these can over-fill a multi-crew posting or
-- record a duplicate rating row. This migration adds an optional
-- idempotency-key mechanism the API layer can opt into per-route.
--
-- Schema changes:
--   1. New `events.idempotency_key text` column (nullable).
--   2. Partial unique index on (person_id, idempotency_key) WHERE
--      idempotency_key IS NOT NULL — events without a key skip the
--      uniqueness check (preserves backwards-compatibility with the
--      ~25 routes that don't yet pass a key, and with all existing
--      historical events which have NULL keys).
--
-- RPC changes:
--   `append_event` gains an optional `p_idempotency_key text default
--   null` parameter. On unique-violation (a duplicate key from the
--   same person), the function catches the error, looks up the
--   existing event_id by (person_id, idempotency_key), and returns
--   it WITHOUT re-running `apply_projection`. The retry resolves to
--   the original event silently — same UX as if the network had
--   succeeded the first time.
--
-- Routes that opt in derive a deterministic key from request
-- context (typical pattern: `${eventType}:${aggregateId}` for events
-- with a unique aggregate, or include a UUID generated client-side
-- for retry-safe operations). Six high-risk routes are wired in the
-- same Fix 257; the remaining ~25 state-mutating routes are
-- protected by PK constraints or WHERE-clause guards and can opt in
-- later as needed.

-- 1. Add the column.
alter table public.events add column if not exists idempotency_key text;

-- 2. Partial unique index. Allows existing rows + future routes that
-- don't pass a key to coexist; only enforces uniqueness when the key
-- is set. The (person_id, idempotency_key) shape scopes the dedup to
-- a single user — two different users can't accidentally collide on
-- the same key (e.g., if a client library uses crypto.randomUUID()
-- and a UUID happens to repeat across users).
create unique index if not exists idx_events_idempotency_key
  on public.events (person_id, idempotency_key)
  where idempotency_key is not null;

-- 3. Drop the previous 6-arg signature, then create the new 7-arg
-- version. PostgreSQL allows function overloading by signature, so a
-- bare CREATE OR REPLACE with a different argument list creates a
-- second function rather than replacing the first — and any subsequent
-- caller using the original 6-arg shape becomes ambiguous and fails
-- with `Could not choose the best candidate function`. Drop first to
-- ensure exactly one append_event signature exists going forward.
drop function if exists public.append_event(text, text, text, text, jsonb, uuid);

-- 4. Create the new 7-arg version with the optional idempotency key.
create or replace function public.append_event(
  p_event_type text,
  p_aggregate_id text,
  p_aggregate_type text,
  p_role_context text,
  p_payload jsonb,
  p_person_id uuid,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_event_id uuid;
  v_existing_id uuid;
begin
  -- Insert the event. If an idempotency key is supplied and a
  -- previous event from the same person used the same key, catch
  -- the unique-violation and return the existing event id without
  -- re-running the projection.
  begin
    insert into public.events (event_type, aggregate_id, aggregate_type, role_context, payload, person_id, idempotency_key)
    values (p_event_type, p_aggregate_id, p_aggregate_type, p_role_context, p_payload, p_person_id, p_idempotency_key)
    returning id into v_event_id;
  exception when unique_violation then
    -- Look up the original event. The partial index on
    -- (person_id, idempotency_key) guarantees at most one match.
    select id into v_existing_id
    from public.events
    where person_id = p_person_id
      and idempotency_key = p_idempotency_key;
    if v_existing_id is null then
      -- Defensive: should never happen given the unique index, but
      -- if it does, surface loudly rather than silently swallow.
      raise exception 'append_event: unique_violation but no matching event found for person % key %', p_person_id, p_idempotency_key;
    end if;
    return v_existing_id;
  end;

  -- Fresh event — apply the projection.
  perform public.apply_projection(p_event_type, p_aggregate_id, p_aggregate_type, p_role_context, p_payload, p_person_id);

  return v_event_id;
end;
$$;
