-- Add deck_name to profiles — the informal name crew are known by on deck
alter table public.profiles add column deck_name varchar(50);

-- Supplementary trigger to write deck_name from PROFILE event payloads
create or replace function apply_deck_name_from_event()
returns trigger as $$
begin
  if new.payload ? 'deck_name' then
    update public.profiles set
      deck_name = new.payload->>'deck_name'
    where person_id = new.person_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_deck_name_from_event
  after insert on public.events
  for each row
  when (new.event_type in ('PROFILE.CREATED', 'PROFILE.UPDATED'))
  execute function apply_deck_name_from_event();
