-- =============================================================================
-- Migration 00061: Atomic advisor usage increment
--
-- Creates increment_advisor_usage RPC for atomic check-and-increment of
-- free-tier question count. Prevents concurrent requests from bypassing limit.
-- =============================================================================

create or replace function public.increment_advisor_usage(
  p_person_id uuid,
  p_month text,
  p_limit integer
)
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  -- Atomic upsert with conditional increment
  insert into public.advisor_usage (person_id, month, question_count)
  values (p_person_id, p_month, 1)
  on conflict (person_id, month) do update
    set question_count = advisor_usage.question_count + 1
    where advisor_usage.question_count < p_limit
  returning question_count into v_count;

  -- If no row returned (limit reached, UPDATE WHERE didn't match), return null
  return v_count;
end;
$$;
