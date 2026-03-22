-- Add desired_role_id to profiles for career aspiration (separate from auto-derived primary_role_id)
alter table public.profiles add column desired_role_id uuid references public.yacht_roles(id);

-- Update derive_experience_profile to also auto-derive primary_role_id from most recent experience
create or replace function public.derive_experience_profile(p_person_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_total_days numeric;
  v_total_months numeric;
  v_bracket_id uuid;
  v_size_ids uuid[];
  v_latest_role_id uuid;
begin
  -- Sum total days across all experiences (is_current uses today as end date)
  select coalesce(sum(
    coalesce(ce.end_date, current_date) - ce.start_date
  ), 0)
  into v_total_days
  from public.crew_experiences ce
  where ce.person_id = p_person_id;

  -- Convert to months (30.44 days/month average)
  v_total_months := v_total_days / 30.44;

  -- Find matching experience bracket
  if v_total_days = 0 then
    v_bracket_id := null;
  else
    select eb.id into v_bracket_id
    from public.experience_brackets eb
    where eb.min_months <= v_total_months
      and (eb.max_months is null or eb.max_months >= v_total_months)
    order by eb.sort_order desc
    limit 1;
  end if;

  -- Collect distinct vessel size band IDs from experience vessels
  select coalesce(array_agg(distinct v.size_band_id), '{}')
  into v_size_ids
  from public.crew_experiences ce
  join public.vessels v on v.id = ce.vessel_id
  where ce.person_id = p_person_id
    and v.size_band_id is not null;

  -- Auto-derive primary_role_id from most recent experience
  -- Priority: is_current entries first (by start_date DESC), then by end_date DESC
  select ce.role_id into v_latest_role_id
  from public.crew_experiences ce
  where ce.person_id = p_person_id
  order by ce.is_current desc, coalesce(ce.end_date, '9999-12-31'::date) desc, ce.start_date desc
  limit 1;

  -- Update profile (only set primary_role_id if experiences exist)
  update public.profiles set
    experience_bracket_id = v_bracket_id,
    vessel_size_exposure_ids = v_size_ids,
    primary_role_id = coalesce(v_latest_role_id, primary_role_id)
  where person_id = p_person_id;
end;
$$;

-- Supplementary trigger to write desired_role_id from PROFILE event payloads
create or replace function apply_desired_role_from_event()
returns trigger as $$
begin
  if new.payload ? 'desired_role_id' then
    update public.profiles set
      desired_role_id = (new.payload->>'desired_role_id')::uuid
    where person_id = new.person_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_desired_role_from_event
  after insert on public.events
  for each row
  when (new.event_type in ('PROFILE.CREATED', 'PROFILE.UPDATED'))
  execute function apply_desired_role_from_event();
