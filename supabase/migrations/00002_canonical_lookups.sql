-- =============================================================================
-- Canonical lookup tables: regions, ports, roles, certs, experience, vessels
-- =============================================================================

-- Geographic hierarchy: region → city → port/marina
create table public.regions (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  sort_order int not null default 0
);

create table public.cities (
  id uuid primary key default uuid_generate_v4(),
  region_id uuid not null references public.regions(id),
  name text not null,
  sort_order int not null default 0,
  unique (region_id, name)
);

create table public.ports (
  id uuid primary key default uuid_generate_v4(),
  city_id uuid not null references public.cities(id),
  name text not null,
  sort_order int not null default 0,
  unique (city_id, name)
);

-- Yacht roles
create table public.yacht_roles (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  department text not null check (department in ('deck', 'interior', 'engineering', 'galley', 'bridge')),
  sort_order int not null default 0
);

-- Certifications
create table public.certifications (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  category text not null,
  sort_order int not null default 0
);

-- Experience brackets
create table public.experience_brackets (
  id uuid primary key default uuid_generate_v4(),
  label text not null unique,
  min_months int not null,
  max_months int,  -- null = no upper limit
  sort_order int not null default 0
);

-- Vessel size bands
create table public.vessel_size_bands (
  id uuid primary key default uuid_generate_v4(),
  label text not null unique,
  min_meters int not null,
  max_meters int,  -- null = no upper limit
  sort_order int not null default 0
);

-- All lookup tables are publicly readable, no write access for users
alter table public.regions enable row level security;
alter table public.cities enable row level security;
alter table public.ports enable row level security;
alter table public.yacht_roles enable row level security;
alter table public.certifications enable row level security;
alter table public.experience_brackets enable row level security;
alter table public.vessel_size_bands enable row level security;

-- Read-only policies for authenticated users
create policy "Authenticated users can read regions" on public.regions for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read cities" on public.cities for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read ports" on public.ports for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read yacht_roles" on public.yacht_roles for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read certifications" on public.certifications for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read experience_brackets" on public.experience_brackets for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read vessel_size_bands" on public.vessel_size_bands for select using (auth.role() = 'authenticated');
