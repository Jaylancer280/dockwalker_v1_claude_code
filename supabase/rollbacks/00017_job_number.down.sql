-- Rollback: remove job_number from dayworks
alter table public.dayworks drop constraint if exists dayworks_job_number_unique;
alter table public.dayworks drop column if exists job_number;
drop sequence if exists dayworks_job_number_seq;
