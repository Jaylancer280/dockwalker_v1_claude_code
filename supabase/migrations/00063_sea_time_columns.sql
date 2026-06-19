-- Add verified sea time fields to crew_experiences
-- Engineering Officer routes require days, Deck Officer routes require nautical miles
-- Both fields available simultaneously for dual-role crew

alter table public.crew_experiences
  add column sea_time_days integer,
  add column sea_time_nautical_miles integer;

-- Supplementary trigger to write sea_time columns from EXPERIENCE event payloads.
-- Runs AFTER apply_projection inserts/updates the row, patching the two new columns.
-- Note: ideally these would be in apply_projection itself, but adding two nullable columns
-- to a 300+ line function body risks a missed handler during the full rewrite. This trigger
-- is additive and narrowly scoped. Consolidate into apply_projection on next full rewrite.

create or replace function apply_sea_time_from_event()
returns trigger as $$
begin
  update public.crew_experiences set
    sea_time_days = coalesce((new.payload->>'sea_time_days')::integer, sea_time_days),
    sea_time_nautical_miles = coalesce((new.payload->>'sea_time_nautical_miles')::integer, sea_time_nautical_miles)
  where id = new.aggregate_id::uuid;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_sea_time_from_event
  after insert on public.events
  for each row
  when (new.event_type in ('EXPERIENCE.ADDED', 'EXPERIENCE.UPDATED'))
  execute function apply_sea_time_from_event();
