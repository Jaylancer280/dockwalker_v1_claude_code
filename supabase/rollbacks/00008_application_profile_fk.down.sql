alter table public.applications
  drop constraint applications_crew_person_id_profiles_fkey;

alter table public.active_engagements
  drop constraint active_engagements_crew_person_id_profiles_fkey;

alter table public.active_engagements
  drop constraint active_engagements_employer_person_id_profiles_fkey;
