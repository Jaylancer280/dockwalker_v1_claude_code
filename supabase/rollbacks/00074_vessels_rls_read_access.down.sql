-- Rollback: Drop the three new SELECT policies, restoring owner-only access
drop policy if exists "Authenticated users can read non-NDA vessels" on public.vessels;
drop policy if exists "Engaged users can read engagement vessels" on public.vessels;
drop policy if exists "Crew can read their experience vessels" on public.vessels;
