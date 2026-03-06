-- Rollback: 00003_projection_tables.sql
-- Drops all projection tables and indexes in reverse dependency order

drop index if exists idx_messages_engagement;
drop index if exists idx_availability_expires;
drop index if exists idx_availability_person;
drop index if exists idx_engagements_dates;
drop index if exists idx_engagements_employer;
drop index if exists idx_engagements_crew;
drop index if exists idx_applications_status;
drop index if exists idx_applications_daywork;
drop index if exists idx_applications_crew;
drop index if exists idx_dayworks_role;
drop index if exists idx_dayworks_dates;
drop index if exists idx_dayworks_port;
drop index if exists idx_dayworks_poster;
drop index if exists idx_dayworks_status;
drop index if exists idx_vessels_owner;
drop index if exists idx_profiles_location;
drop index if exists idx_profiles_role;
drop index if exists idx_profiles_identity;

drop table if exists public.messages;
drop table if exists public.availability_windows;
drop table if exists public.active_engagements;
drop table if exists public.applications;
drop table if exists public.dayworks;
drop table if exists public.vessels;
drop table if exists public.profiles;
drop table if exists public.persons;
