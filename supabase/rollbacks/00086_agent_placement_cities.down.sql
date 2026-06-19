-- Rollback: drop agent_placement_cities table and its RLS policies
drop policy if exists "Authenticated users can read placement cities" on public.agent_placement_cities;
drop policy if exists "Owner can manage own placement cities" on public.agent_placement_cities;
drop table if exists public.agent_placement_cities;
