-- Supplementary trigger to write career status fields from PROFILE event payloads.
-- Columns already exist on profiles (Stage 130 / migration 00059).
-- The main apply_projection PROFILE.CREATED handler does not include these fields,
-- so this trigger ensures they are written during onboarding (PROFILE.CREATED)
-- as well as profile edits (PROFILE.UPDATED).

create or replace function apply_career_status_from_event()
returns trigger as $$
begin
  if new.payload ? 'permanent_availability' then
    update public.profiles set
      permanent_availability = new.payload->>'permanent_availability',
      notice_period_days = (new.payload->>'notice_period_days')::int,
      currently_employed = coalesce((new.payload->>'currently_employed')::boolean, false)
    where person_id = new.person_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_career_status_from_event
  after insert on public.events
  for each row
  when (new.event_type in ('PROFILE.CREATED', 'PROFILE.UPDATED'))
  execute function apply_career_status_from_event();
