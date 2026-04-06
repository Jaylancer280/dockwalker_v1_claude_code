-- Agent placement cities: cities where agents actively place crew
create table public.agent_placement_cities (
  id uuid primary key default uuid_generate_v4(),
  person_id uuid not null references public.persons(id) on delete cascade,
  city_id uuid not null references public.cities(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (person_id, city_id)
);

-- RLS: owner can CRUD their own rows, anyone authenticated can read
alter table public.agent_placement_cities enable row level security;

create policy "Owner can manage own placement cities"
  on public.agent_placement_cities
  for all
  using (person_id = auth.uid())
  with check (person_id = auth.uid());

create policy "Authenticated users can read placement cities"
  on public.agent_placement_cities
  for select
  using (auth.role() = 'authenticated');
