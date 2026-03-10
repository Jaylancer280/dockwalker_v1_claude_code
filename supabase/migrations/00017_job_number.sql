-- Add sequential job number to dayworks for human-readable reference
-- This is a projection column (derived display data), not a new entity.

-- Add the column with a sequence
alter table public.dayworks
  add column job_number serial not null;

-- Backfill existing rows in creation order so numbers are consistent
-- Reset the sequence after backfill
do $$
declare
  r record;
  seq int := 0;
begin
  for r in select id from public.dayworks order by created_at asc
  loop
    seq := seq + 1;
    update public.dayworks set job_number = seq where id = r.id;
  end loop;
  -- Set sequence to continue from the last assigned number (skip if no rows)
  if seq > 0 then
    perform setval('dayworks_job_number_seq', seq);
  end if;
end $$;

-- Add unique constraint
alter table public.dayworks
  add constraint dayworks_job_number_unique unique (job_number);
