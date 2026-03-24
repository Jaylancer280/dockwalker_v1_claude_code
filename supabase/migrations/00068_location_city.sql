-- Add location_city_id to profiles — the crew's actual city-level location
-- Separate from location_port_id which is the preferred daywork port/marina
alter table public.profiles add column location_city_id uuid references public.cities(id);

-- Supplementary trigger to write location_city_id from PROFILE event payloads
create or replace function apply_location_city_from_event()
returns trigger as $$
begin
  if new.payload ? 'location_city_id' then
    update public.profiles set
      location_city_id = (new.payload->>'location_city_id')::uuid
    where person_id = new.person_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_location_city_from_event
  after insert on public.events
  for each row
  when (new.event_type in ('PROFILE.CREATED', 'PROFILE.UPDATED'))
  execute function apply_location_city_from_event();
