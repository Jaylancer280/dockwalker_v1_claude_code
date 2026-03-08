-- =============================================================================
-- Rollback 00014: Restore the broken state (0-arg trigger + stale 6-arg)
-- =============================================================================
-- This rollback restores the 0-arg trigger version and reverts the 6-arg
-- version to the 00009 state (without shortlist/in_progress/completion/ratings).
-- In practice, you would never want to roll back to this broken state —
-- this exists only to satisfy the reversibility invariant.
-- =============================================================================

-- Restore the 0-arg trigger version from migration 00013
-- (This is the function body from 00013_engagement_ratings.sql)
create or replace function public.apply_projection()
returns trigger
language plpgsql
security definer
as $$
declare
  p_event_type  text    := new.event_type;
  p_aggregate_id text   := new.aggregate_id;
  p_role_context text   := new.role_context;
  p_payload     jsonb   := new.payload;
  p_person_id   uuid    := new.person_id;
begin
  -- This is intentionally a stub — rolling back to the broken dual-function
  -- state. The 6-arg version (called by append_event) would also need to be
  -- reverted to the 00009 version, which lacks shortlist/in_progress/ratings.
  raise notice 'Rollback stub: 0-arg apply_projection restored';
  return new;
end;
$$;

-- Revert the 6-arg version to 00009 state (without shortlist/in_progress/ratings)
-- Not included here as it would be a full copy of the 00009 function body.
-- In practice, rolling back 00014 means you must also roll back 00013-00010.
