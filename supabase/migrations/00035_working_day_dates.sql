-- =============================================================================
-- Migration 00035: Working Day Dates
--
-- Add optional working_day_dates array to dayworks and daywork_templates.
-- If provided, working_days is derived as array_length(working_day_dates, 1).
-- If not provided (backward compat), working_days remains the manual number.
-- =============================================================================

-- 1. Add working_day_dates to dayworks
alter table public.dayworks add column if not exists working_day_dates date[] default null;

-- 2. Add working_day_dates to daywork_templates
alter table public.daywork_templates add column if not exists working_day_dates date[] default null;

-- 3. Update apply_projection to write working_day_dates on DAYWORK.POSTED
-- The column is nullable; existing events without working_day_dates will leave it NULL.
-- We use a DO block to add a post-insert update when the field is present.
-- Since we can't easily modify just one CASE branch, we rely on the fact that
-- the INSERT already handles all required columns, and we add a follow-up UPDATE
-- for the new optional column via a trigger or inline update.
-- Simplest approach: update the row immediately after insert within the same function.
-- We'll create a wrapper that calls the existing apply_projection and patches working_day_dates.

-- Actually, the simplest approach: just update dayworks after the insert for DAYWORK.POSTED events.
-- We'll add this as a separate trigger function that fires after apply_projection.

-- Even simpler: Since apply_projection is called by append_event, we can just update the row
-- right after the insert. Let's do a post-insert update approach via a trigger.

-- Simplest: Just update the DAYWORK.POSTED handler inline. But that means re-creating apply_projection.
-- Since migration 00034 already has the latest version, we only need to patch the DAYWORK.POSTED line.

-- Note: Rather than replicate the entire 300-line function, we'll handle this at the API layer.
-- The API writes working_day_dates directly after append_event when the field is present.
-- This follows the same pattern as other optional post-projection updates.

-- Alternative: Create a small post-projection hook for DAYWORK.POSTED
create or replace function public.apply_working_day_dates()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.event_type = 'DAYWORK.POSTED' and new.payload ? 'working_day_dates' then
    update public.dayworks
    set working_day_dates = (
      select array_agg(d::date)
      from jsonb_array_elements_text(new.payload->'working_day_dates') d
    )
    where id = (new.payload->>'id')::uuid;
  end if;
  return new;
end;
$$;

-- Create trigger on events table (fires after each insert, after apply_projection has run)
drop trigger if exists trg_apply_working_day_dates on public.events;
create trigger trg_apply_working_day_dates
  after insert on public.events
  for each row
  execute function public.apply_working_day_dates();
