-- =============================================================================
-- Projection tables: materialized state derived from events
-- =============================================================================

-- Persons: auth-linked identity
create table public.persons (
  id uuid primary key references auth.users(id),
  identity_type text not null check (identity_type in ('crew', 'agent')),
  current_hat text not null check (current_hat in ('crew', 'employer', 'agent')),
  created_at timestamptz not null default now(),
  deactivated_at timestamptz
);

-- Profiles: crew or agent data
create table public.profiles (
  person_id uuid primary key references public.persons(id),
  display_name text not null,
  identity_type text not null check (identity_type in ('crew', 'agent')),

  -- Crew-specific fields (null for agents)
  primary_role_id uuid references public.yacht_roles(id),
  certification_ids uuid[] default '{}',
  experience_bracket_id uuid references public.experience_brackets(id),
  vessel_size_exposure_ids uuid[] default '{}',
  bio text,

  -- Agent-specific fields (null for crew)
  agency_name text,
  role_specialization_ids uuid[] default '{}',

  -- Shared
  location_port_id uuid references public.ports(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Vessels: IMO is the immutable identity anchor
create table public.vessels (
  id uuid primary key default uuid_generate_v4(),
  imo_number text not null unique,
  name text not null,
  vessel_type text not null check (vessel_type in ('private', 'charter')),
  size_band_id uuid not null references public.vessel_size_bands(id),
  nda_flag boolean not null default false,
  owner_person_id uuid not null references public.persons(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Daywork postings
create table public.dayworks (
  id uuid primary key default uuid_generate_v4(),
  poster_person_id uuid not null references public.persons(id),
  role_context text not null check (role_context in ('employer', 'agent')),
  vessel_id uuid not null references public.vessels(id),
  role_id uuid not null references public.yacht_roles(id),
  location_port_id uuid not null references public.ports(id),
  start_date date not null,
  end_date date not null,
  working_days int not null check (working_days > 0),
  required_certification_ids uuid[] default '{}',
  experience_bracket_id uuid references public.experience_brackets(id),
  day_rate numeric(10, 2),
  meals text[] default '{}',
  notes text,
  status text not null default 'active' check (status in ('active', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  constraint valid_date_range check (end_date >= start_date)
);

-- Applications: crew + daywork pair
create table public.applications (
  id uuid primary key default uuid_generate_v4(),
  crew_person_id uuid not null references public.persons(id),
  daywork_id uuid not null references public.dayworks(id),
  status text not null default 'applied' check (status in (
    'applied', 'viewed', 'accepted', 'rejected',
    'withdrawn', 'superseded',
    'completed', 'cancelled_by_crew', 'cancelled_by_employer'
  )),
  message text check (char_length(message) <= 250),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (crew_person_id, daywork_id)
);

-- Active engagements: materialized view for messaging eligibility
create table public.active_engagements (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null unique references public.applications(id),
  crew_person_id uuid not null references public.persons(id),
  employer_person_id uuid not null references public.persons(id),
  daywork_id uuid not null references public.dayworks(id),
  start_date date not null,
  end_date date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

-- Availability windows: crew daily availability with expiry
create table public.availability_windows (
  id uuid primary key default uuid_generate_v4(),
  person_id uuid not null references public.persons(id),
  date date not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (person_id, date)
);

-- Messages
create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  engagement_id uuid not null references public.active_engagements(id),
  sender_person_id uuid not null references public.persons(id),
  content text not null,
  created_at timestamptz not null default now(),
  hidden_by uuid[] default '{}'
);

-- =============================================================================
-- Indexes
-- =============================================================================

create index idx_profiles_identity on public.profiles (identity_type);
create index idx_profiles_role on public.profiles (primary_role_id);
create index idx_profiles_location on public.profiles (location_port_id);
create index idx_vessels_owner on public.vessels (owner_person_id);
create index idx_dayworks_status on public.dayworks (status);
create index idx_dayworks_poster on public.dayworks (poster_person_id);
create index idx_dayworks_port on public.dayworks (location_port_id);
create index idx_dayworks_dates on public.dayworks (start_date, end_date);
create index idx_dayworks_role on public.dayworks (role_id);
create index idx_applications_crew on public.applications (crew_person_id);
create index idx_applications_daywork on public.applications (daywork_id);
create index idx_applications_status on public.applications (status);
create index idx_engagements_crew on public.active_engagements (crew_person_id);
create index idx_engagements_employer on public.active_engagements (employer_person_id);
create index idx_engagements_dates on public.active_engagements (start_date, end_date);
create index idx_availability_person on public.availability_windows (person_id, date);
create index idx_availability_expires on public.availability_windows (expires_at);
create index idx_messages_engagement on public.messages (engagement_id);
