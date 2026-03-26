-- Rollback: remove placement_confirmed status, restore previous apply_projection

-- 1. Revert any placement_confirmed applications back to selected
update public.applications set status = 'selected' where status = 'placement_confirmed';

-- 2. Restore previous CHECK constraint
alter table public.applications drop constraint applications_status_check;
alter table public.applications add constraint applications_status_check
  check (status in ('applied', 'viewed', 'shortlisted', 'accepted', 'rejected',
    'withdrawn', 'superseded', 'completed', 'cancelled_by_crew', 'cancelled_by_employer',
    'selected', 'not_selected'));

-- 3. apply_projection will be restored by running the previous migration's version
-- (00073_availability_date_expiry.sql contains the full function)
