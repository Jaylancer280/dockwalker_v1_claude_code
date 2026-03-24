-- Add required_languages to job postings and templates
alter table public.dayworks add column required_languages text[] not null default '{}';
alter table public.permanent_postings add column required_languages text[] not null default '{}';
alter table public.daywork_templates add column required_languages text[] not null default '{}';
alter table public.permanent_templates add column required_languages text[] not null default '{}';

-- Supplementary trigger to write required_languages from posting event payloads
create or replace function apply_required_languages_from_event()
returns trigger as $$
begin
  if new.payload ? 'required_languages' then
    if new.event_type = 'DAYWORK.POSTED' then
      update public.dayworks set
        required_languages = coalesce(
          (select array_agg(x::text) from jsonb_array_elements_text(new.payload->'required_languages') x),
          '{}'
        )
      where id = new.aggregate_id::uuid;
    elsif new.event_type = 'PERMANENT.POSTED' then
      update public.permanent_postings set
        required_languages = coalesce(
          (select array_agg(x::text) from jsonb_array_elements_text(new.payload->'required_languages') x),
          '{}'
        )
      where id = new.aggregate_id::uuid;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_required_languages_from_event
  after insert on public.events
  for each row
  when (new.event_type in ('DAYWORK.POSTED', 'PERMANENT.POSTED'))
  execute function apply_required_languages_from_event();
