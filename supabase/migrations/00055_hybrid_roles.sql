-- =============================================================================
-- Migration 00055: Hybrid Roles
--
-- 1. Expand department CHECK constraint to include compound departments
-- 2. Insert 3 hybrid roles: Deck/Engineer, Deck/Stew, Cook/Stew
-- =============================================================================

-- 1. Drop and recreate CHECK constraint with new department values
alter table public.yacht_roles drop constraint if exists yacht_roles_department_check;
alter table public.yacht_roles add constraint yacht_roles_department_check
  check (department in ('deck', 'interior', 'engineering', 'galley', 'bridge', 'deck_engineering', 'deck_interior', 'galley_interior'));

-- 2. Insert hybrid roles
insert into public.yacht_roles (id, name, department, sort_order) values
  ('d0000000-0000-0000-0000-000000000021', 'Deck/Engineer', 'deck_engineering', 21),
  ('d0000000-0000-0000-0000-000000000022', 'Deck/Stew', 'deck_interior', 22),
  ('d0000000-0000-0000-0000-000000000023', 'Cook/Stew', 'galley_interior', 23)
on conflict (id) do nothing;
