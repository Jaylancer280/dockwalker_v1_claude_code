-- =============================================================================
-- Add FKs from crew_person_id columns to profiles.person_id
-- so PostgREST can resolve embedded selects like profiles:crew_person_id(...)
-- =============================================================================

alter table public.applications
  add constraint applications_crew_person_id_profiles_fkey
  foreign key (crew_person_id) references public.profiles(person_id);

alter table public.active_engagements
  add constraint active_engagements_crew_person_id_profiles_fkey
  foreign key (crew_person_id) references public.profiles(person_id);

alter table public.active_engagements
  add constraint active_engagements_employer_person_id_profiles_fkey
  foreign key (employer_person_id) references public.profiles(person_id);
