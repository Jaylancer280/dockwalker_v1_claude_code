-- Remove desired_role trigger and column, restore original derive_experience_profile

drop trigger if exists trg_desired_role_from_event on public.events;
drop function if exists apply_desired_role_from_event();

alter table public.profiles drop column if exists desired_role_id;

-- Restore derive_experience_profile without primary_role_id derivation
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
begin
  select coalesce(sum(
    coalesce(ce.end_date, current_date) - ce.start_date
  ), 0)
  into v_total_days
  from public.crew_experiences ce
  where ce.person_id = p_person_id;

  v_total_months := v_total_days / 30.44;

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

  select coalesce(array_agg(distinct v.size_band_id), '{}')
  into v_size_ids
  from public.crew_experiences ce
  join public.vessels v on v.id = ce.vessel_id
  where ce.person_id = p_person_id
    and v.size_band_id is not null;

  update public.profiles set
    experience_bracket_id = v_bracket_id,
    vessel_size_exposure_ids = v_size_ids
  where person_id = p_person_id;
end;
$$;
