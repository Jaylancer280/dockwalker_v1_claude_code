-- =============================================================================
-- Rollback 00032: Revert get_vessel_public to v31 state (00029 version)
-- =============================================================================

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
    case when v.nda_flag and v.owner_person_id != auth.uid() then null else v.imo_number end,
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
