-- Rollback: 00002_canonical_lookups.sql
-- Drops all lookup tables in reverse dependency order

drop policy if exists "Authenticated users can read vessel_size_bands" on public.vessel_size_bands;
drop policy if exists "Authenticated users can read experience_brackets" on public.experience_brackets;
drop policy if exists "Authenticated users can read certifications" on public.certifications;
drop policy if exists "Authenticated users can read yacht_roles" on public.yacht_roles;
drop policy if exists "Authenticated users can read ports" on public.ports;
drop policy if exists "Authenticated users can read cities" on public.cities;
drop policy if exists "Authenticated users can read regions" on public.regions;

drop table if exists public.vessel_size_bands;
drop table if exists public.experience_brackets;
drop table if exists public.certifications;
drop table if exists public.yacht_roles;
drop table if exists public.ports;
drop table if exists public.cities;
drop table if exists public.regions;
