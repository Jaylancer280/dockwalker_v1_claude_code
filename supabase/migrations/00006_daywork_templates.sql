-- =============================================================================
-- Daywork templates: plain CRUD, not event-sourced
-- UI convenience for employers to reuse common posting configurations
-- =============================================================================

create table public.daywork_templates (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id),
  name text not null,
  vessel_id uuid references public.vessels(id),
  role_id uuid references public.yacht_roles(id),
  location_port_id uuid references public.ports(id),
  working_days int,
  required_certification_ids uuid[] default '{}',
  experience_bracket_id uuid references public.experience_brackets(id),
  day_rate numeric(10,2),
  meals text[] default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: owner only
alter table public.daywork_templates enable row level security;

create policy "Users can read own templates"
  on public.daywork_templates for select
  using (person_id = auth.uid());

create policy "Users can insert own templates"
  on public.daywork_templates for insert
  with check (person_id = auth.uid());

create policy "Users can delete own templates"
  on public.daywork_templates for delete
  using (person_id = auth.uid());

create index idx_daywork_templates_person on public.daywork_templates (person_id);
