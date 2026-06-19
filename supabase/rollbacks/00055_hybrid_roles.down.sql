-- Rollback 00055: Remove hybrid roles and restore original department CHECK

delete from public.yacht_roles where id in (
  'd0000000-0000-0000-0000-000000000021',
  'd0000000-0000-0000-0000-000000000022',
  'd0000000-0000-0000-0000-000000000023'
);

alter table public.yacht_roles drop constraint if exists yacht_roles_department_check;
alter table public.yacht_roles add constraint yacht_roles_department_check
  check (department in ('deck', 'interior', 'engineering', 'galley', 'bridge'));
