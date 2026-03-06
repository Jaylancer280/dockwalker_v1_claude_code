-- =============================================================================
-- Row Level Security policies for all projection tables
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Persons
-- -----------------------------------------------------------------------------
alter table public.persons enable row level security;

create policy "Users can read own person record"
  on public.persons for select
  using (id = auth.uid());

create policy "Users can read other persons (public profiles)"
  on public.persons for select
  using (deactivated_at is null);

-- Insert/update via append_event function only (service role)

-- -----------------------------------------------------------------------------
-- Profiles
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "Users can read any active profile"
  on public.profiles for select
  using (
    exists (
      select 1 from public.persons
      where persons.id = profiles.person_id
      and persons.deactivated_at is null
    )
  );

-- -----------------------------------------------------------------------------
-- Vessels: NDA-critical RLS
-- IMO number must NEVER be visible to non-owner, non-admin when nda_flag = true
-- -----------------------------------------------------------------------------
alter table public.vessels enable row level security;

-- Vessel owners see everything including IMO
create policy "Vessel owners can read their vessels fully"
  on public.vessels for select
  using (owner_person_id = auth.uid());

-- Non-owners: create a secure view instead (see below)
-- We block direct non-owner access and route through a function

-- For daywork posting: employers need to see their own vessels
-- For crew viewing jobs: they go through the secure daywork view, not vessels directly

-- -----------------------------------------------------------------------------
-- Secure vessel view for non-owners (strips IMO on NDA vessels)
-- -----------------------------------------------------------------------------
create or replace function public.get_vessel_public(p_vessel_id uuid)
returns table (
  id uuid,
  imo_number text,
  name text,
  vessel_type text,
  size_band_id uuid,
  nda_flag boolean,
  owner_person_id uuid
)
language sql
security definer
stable
as $$
  select
    v.id,
    case
      when v.nda_flag = true and v.owner_person_id != auth.uid()
      then null
      else v.imo_number
    end as imo_number,
    case
      when v.nda_flag = true and v.owner_person_id != auth.uid()
      then 'NDA Vessel'
      else v.name
    end as name,
    v.vessel_type,
    v.size_band_id,
    v.nda_flag,
    v.owner_person_id
  from public.vessels v
  where v.id = p_vessel_id;
$$;

-- -----------------------------------------------------------------------------
-- Dayworks
-- -----------------------------------------------------------------------------
alter table public.dayworks enable row level security;

create policy "Anyone can read active daywork postings"
  on public.dayworks for select
  using (status = 'active');

create policy "Posters can read all their own dayworks"
  on public.dayworks for select
  using (poster_person_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Applications
-- -----------------------------------------------------------------------------
alter table public.applications enable row level security;

-- Crew can see their own applications
create policy "Crew can read own applications"
  on public.applications for select
  using (crew_person_id = auth.uid());

-- Employers can see applications to their dayworks
create policy "Employers can read applications to their dayworks"
  on public.applications for select
  using (
    exists (
      select 1 from public.dayworks
      where dayworks.id = applications.daywork_id
      and dayworks.poster_person_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- Active engagements
-- -----------------------------------------------------------------------------
alter table public.active_engagements enable row level security;

create policy "Participants can read their engagements"
  on public.active_engagements for select
  using (
    crew_person_id = auth.uid()
    or employer_person_id = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- Availability windows
-- -----------------------------------------------------------------------------
alter table public.availability_windows enable row level security;

-- Crew can read their own availability
create policy "Crew can read own availability"
  on public.availability_windows for select
  using (person_id = auth.uid());

-- Employers can read availability of crew who applied to their dayworks
create policy "Employers can read applicant availability"
  on public.availability_windows for select
  using (
    exists (
      select 1 from public.applications a
      join public.dayworks d on d.id = a.daywork_id
      where a.crew_person_id = availability_windows.person_id
      and d.poster_person_id = auth.uid()
      and a.status in ('applied', 'viewed', 'accepted')
    )
  );

-- -----------------------------------------------------------------------------
-- Messages
-- -----------------------------------------------------------------------------
alter table public.messages enable row level security;

create policy "Engagement participants can read messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.active_engagements e
      where e.id = messages.engagement_id
      and (e.crew_person_id = auth.uid() or e.employer_person_id = auth.uid())
    )
    and not (auth.uid() = any(hidden_by))
  );
