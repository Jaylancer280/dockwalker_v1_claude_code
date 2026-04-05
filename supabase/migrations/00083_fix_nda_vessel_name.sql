-- =============================================================================
-- Migration 00083: Fix NDA vessel name leaking
--
-- Migration 00027 accidentally removed the name masking CASE WHEN logic while
-- adding loa_meters. The imo_number retained its conditional reveal, but name
-- became an unconditional v.name. Every subsequent migration copied this bug.
--
-- This fix adds name masking that mirrors the existing IMO reveal logic:
-- NDA vessel names are hidden unless the caller is the owner or has an active
-- engagement (daywork or permanent) on a posting linked to the vessel.
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
    case
      when not v.nda_flag then v.name
      when v.owner_person_id = auth.uid() then v.name
      when exists (
        select 1 from public.active_engagements ae
        join public.dayworks d on d.id = ae.daywork_id
        where d.vessel_id = v.id
          and (ae.crew_person_id = auth.uid() or ae.employer_person_id = auth.uid())
          and ae.status = 'active'
      ) then v.name
      when exists (
        select 1 from public.active_engagements ae
        join public.permanent_postings pp on pp.id = ae.permanent_posting_id
        where pp.vessel_id = v.id
          and (ae.crew_person_id = auth.uid() or ae.employer_person_id = auth.uid())
          and ae.status = 'active'
      ) then v.name
      else 'NDA Vessel'
    end,
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

-- Batch version with same name masking

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
    case
      when not v.nda_flag then v.name
      when v.owner_person_id = auth.uid() then v.name
      when exists (
        select 1 from public.active_engagements ae
        join public.dayworks d on d.id = ae.daywork_id
        where d.vessel_id = v.id
          and (ae.crew_person_id = auth.uid() or ae.employer_person_id = auth.uid())
          and ae.status = 'active'
      ) then v.name
      when exists (
        select 1 from public.active_engagements ae
        join public.permanent_postings pp on pp.id = ae.permanent_posting_id
        where pp.vessel_id = v.id
          and (ae.crew_person_id = auth.uid() or ae.employer_person_id = auth.uid())
          and ae.status = 'active'
      ) then v.name
      else 'NDA Vessel'
    end,
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
