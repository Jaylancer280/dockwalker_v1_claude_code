-- Rollback migration 00034: Vessel Soft Data Separation + Templates Cleanup
-- Restores vessel_operation column on vessels and vessel_id on daywork_templates

-- 1. Add vessel_operation back to vessels
alter table public.vessels add column if not exists vessel_operation text not null default 'private';
alter table public.vessels add constraint vessels_vessel_operation_check check (vessel_operation in ('private', 'charter'));

-- 2. Add vessel_id back to daywork_templates
alter table public.daywork_templates add column if not exists vessel_id uuid references public.vessels(id);

-- 3. Restore get_vessel_public with vessel_operation
drop function if exists public.get_vessel_public(uuid);

create or replace function public.get_vessel_public(p_vessel_id uuid)
returns table (
  id uuid,
  imo_number text,
  name text,
  vessel_type text,
  vessel_operation text,
  size_band_id uuid,
  size_band_label text,
  loa_meters numeric,
  nda_flag boolean,
  owner_person_id uuid
)
language sql
security definer
as $$
  select
    v.id,
    case
      when not v.nda_flag then v.imo_number
      when v.owner_person_id = auth.uid() then v.imo_number
      when exists (
        select 1 from public.active_engagements ae
        join public.dayworks d on d.id = ae.daywork_id
        where d.vessel_id = v.id
          and ae.crew_person_id = auth.uid()
          and ae.status = 'active'
      ) then v.imo_number
      else null
    end,
    v.name,
    v.vessel_type,
    v.vessel_operation,
    v.size_band_id,
    vsb.label,
    v.loa_meters,
    v.nda_flag,
    v.owner_person_id
  from public.vessels v
  left join public.vessel_size_bands vsb on vsb.id = v.size_band_id
  where v.id = p_vessel_id;
$$;

-- Note: apply_projection must be restored from migration 00031 state manually
