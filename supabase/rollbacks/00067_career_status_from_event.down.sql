-- Rollback: drop the supplementary trigger and function for career status
drop trigger if exists trg_career_status_from_event on public.events;
drop function if exists apply_career_status_from_event();
