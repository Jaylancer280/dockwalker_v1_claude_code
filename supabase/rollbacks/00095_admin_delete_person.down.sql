-- Rollback: remove admin_delete_person function
drop function if exists public.admin_delete_person(uuid);
