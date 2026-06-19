-- =============================================================================
-- Fix: Vessels RLS too restrictive — add SELECT policies for non-owners
-- =============================================================================
-- Problem: Only owner_person_id = auth.uid() SELECT policy exists.
-- PostgREST embedded joins (vessels(...) in .select()) return null for non-owners,
-- silently breaking message context, crew experiences, profile views, and discover.
--
-- Solution: Add targeted SELECT policies for legitimate non-owner access:
-- 1. Non-NDA vessels readable by any authenticated user
-- 2. NDA vessels readable by users with active engagements on that vessel
-- 3. NDA vessels readable by crew who reference them in experiences
-- =============================================================================

-- 1. Authenticated users can read non-NDA vessels
create policy "Authenticated users can read non-NDA vessels"
  on public.vessels for select
  using (
    auth.uid() is not null
    and (nda_flag = false or nda_flag is null)
  );

-- 2. Users with active engagements can read the engagement's vessel (including NDA)
create policy "Engaged users can read engagement vessels"
  on public.vessels for select
  using (
    exists (
      select 1 from public.active_engagements ae
      where (ae.crew_person_id = auth.uid() or ae.employer_person_id = auth.uid())
        and ae.status = 'active'
        and (
          -- Daywork engagement on this vessel
          exists (
            select 1 from public.dayworks d
            where d.id = ae.daywork_id
              and d.vessel_id = vessels.id
          )
          or
          -- Permanent engagement on this vessel
          exists (
            select 1 from public.permanent_postings pp
            where pp.id = ae.permanent_posting_id
              and pp.vessel_id = vessels.id
          )
        )
    )
  );

-- 3. Crew can read vessels they reference in their experience entries
create policy "Crew can read their experience vessels"
  on public.vessels for select
  using (
    exists (
      select 1 from public.crew_experiences ce
      where ce.vessel_id = vessels.id
        and ce.person_id = auth.uid()
    )
  );
