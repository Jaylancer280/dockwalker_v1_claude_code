-- Rollback: 00004_rls_policies.sql
-- Drops all RLS policies and the secure vessel view function

-- Messages
drop policy if exists "Engagement participants can read messages" on public.messages;

-- Availability windows
drop policy if exists "Employers can read applicant availability" on public.availability_windows;
drop policy if exists "Crew can read own availability" on public.availability_windows;

-- Active engagements
drop policy if exists "Participants can read their engagements" on public.active_engagements;

-- Applications
drop policy if exists "Employers can read applications to their dayworks" on public.applications;
drop policy if exists "Crew can read own applications" on public.applications;

-- Dayworks
drop policy if exists "Posters can read all their own dayworks" on public.dayworks;
drop policy if exists "Anyone can read active daywork postings" on public.dayworks;

-- Vessels
drop function if exists public.get_vessel_public(uuid);
drop policy if exists "Vessel owners can read their vessels fully" on public.vessels;

-- Profiles
drop policy if exists "Users can read any active profile" on public.profiles;

-- Persons
drop policy if exists "Users can read other persons (public profiles)" on public.persons;
drop policy if exists "Users can read own person record" on public.persons;
