-- =============================================================================
-- Rollback 00083: Restore get_vessel_public + batch without name masking
-- (restores versions from 00060 + 00079)
-- =============================================================================

drop function if exists public.get_vessel_public(uuid);

create or replace function public.get_vessel_public(p_vessel_id uuid)
returns table (
  id uuid,
  imo_number text,
  name text,
  vessel_type text,
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
      when exists (
        select 1 from public.active_engagements ae
        join public.permanent_postings pp on pp.id = ae.permanent_posting_id
        where pp.vessel_id = v.id
          and ae.crew_person_id = auth.uid()
          and ae.status = 'active'
      ) then v.imo_number
      else null
    end,
    v.name,
    v.vessel_type,
    v.size_band_id,
    vsb.label,
    v.loa_meters,
    v.nda_flag,
    v.owner_person_id
  from public.vessels v
  left join public.vessel_size_bands vsb on vsb.id = v.size_band_id
  where v.id = p_vessel_id;
$$;

drop function if exists public.get_vessels_public_batch(uuid[]);

create or replace function public.get_vessels_public_batch(p_vessel_ids uuid[])
returns table (
  id uuid,
  imo_number text,
  name text,
  vessel_type text,
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
      when exists (
        select 1 from public.active_engagements ae
        join public.permanent_postings pp on pp.id = ae.permanent_posting_id
        where pp.vessel_id = v.id
          and ae.crew_person_id = auth.uid()
          and ae.status = 'active'
      ) then v.imo_number
      else null
    end,
    v.name,
    v.vessel_type,
    v.size_band_id,
    vsb.label,
    v.loa_meters,
    v.nda_flag,
    v.owner_person_id
  from public.vessels v
  left join public.vessel_size_bands vsb on vsb.id = v.size_band_id
  where v.id = any(p_vessel_ids);
$$;
