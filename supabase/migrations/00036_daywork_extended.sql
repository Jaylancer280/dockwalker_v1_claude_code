-- =============================================================================
-- Migration 00036: DAYWORK.EXTENDED event handler
--
-- Allows employer to extend an active daywork posting's end_date
-- (and optionally update working_days / working_day_dates).
-- =============================================================================

-- Add DAYWORK.EXTENDED handler via trigger (same pattern as 00035)
create or replace function public.apply_daywork_extended()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.event_type = 'DAYWORK.EXTENDED' then
    update public.dayworks set
      end_date = coalesce((new.payload->>'end_date')::date, end_date),
      working_days = coalesce((new.payload->>'working_days')::int, working_days),
      working_day_dates = case
        when new.payload ? 'working_day_dates' then (
          select array_agg(d::date)
          from jsonb_array_elements_text(new.payload->'working_day_dates') d
        )
        else working_day_dates
      end
    where id = (new.payload->>'daywork_id')::uuid;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_apply_daywork_extended on public.events;
create trigger trg_apply_daywork_extended
  after insert on public.events
  for each row
  execute function public.apply_daywork_extended();
