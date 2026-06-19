-- Vessels V2 — Wave F (RPC half): hide pending + hidden vessels from the
-- two public-read RPCs the same way the lookup route already does.
--
-- Background. Migration 00120 added `vessels.source` (curated /
-- user_submitted / pending) and `vessels.hidden_at`. Fix 253 already
-- filtered both flags out of `/api/vessels/lookup` for non-owners. The
-- lookup route is the front door; `get_vessel_public` and
-- `get_vessels_public_batch` are the side doors — they're called from
-- daywork/permanent discover, applications, invitations to enrich
-- posting cards with vessel name + size band + LOA. Without this
-- filter, an admin hides a vessel but it still surfaces on every
-- existing posting card the moment a non-owner refreshes.
--
-- Behaviour: rows where `hidden_at IS NOT NULL OR source = 'pending'`
-- are excluded from the result set UNLESS the caller is
-- (a) the vessel's owner, OR
-- (b) on an active engagement (daywork or permanent — crew or
--     employer side) attached to a posting on that vessel.
--
-- Why preserve engagement-based reveal: a posting created on a
-- pending vessel that is later admin-hidden still has crew on the
-- engagement. They have a legitimate operational need to see the
-- vessel name to show up at the dock; we don't yank that out from
-- under them mid-engagement. Owner exception is the same submitter
-- carve-out the lookup route uses.
--
-- Consumers handle missing rows already — both functions return one
-- row per matching id, missing ids result in `vesselMap.get(id) ===
-- undefined` and the card falls back to no-vessel-info display.
-- Mirrors the existing semantics for deleted vessels.

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
  where v.id = p_vessel_id
    and (
      (v.hidden_at is null and v.source <> 'pending')
      or v.owner_person_id = auth.uid()
      or exists (
        select 1 from public.active_engagements ae
        join public.dayworks d on d.id = ae.daywork_id
        where d.vessel_id = v.id
          and (ae.crew_person_id = auth.uid() or ae.employer_person_id = auth.uid())
          and ae.status = 'active'
      )
      or exists (
        select 1 from public.active_engagements ae
        join public.permanent_postings pp on pp.id = ae.permanent_posting_id
        where pp.vessel_id = v.id
          and (ae.crew_person_id = auth.uid() or ae.employer_person_id = auth.uid())
          and ae.status = 'active'
      )
    );
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
  where v.id = any(p_vessel_ids)
    and (
      (v.hidden_at is null and v.source <> 'pending')
      or v.owner_person_id = auth.uid()
      or exists (
        select 1 from public.active_engagements ae
        join public.dayworks d on d.id = ae.daywork_id
        where d.vessel_id = v.id
          and (ae.crew_person_id = auth.uid() or ae.employer_person_id = auth.uid())
          and ae.status = 'active'
      )
      or exists (
        select 1 from public.active_engagements ae
        join public.permanent_postings pp on pp.id = ae.permanent_posting_id
        where pp.vessel_id = v.id
          and (ae.crew_person_id = auth.uid() or ae.employer_person_id = auth.uid())
          and ae.status = 'active'
      )
    );
$$;
