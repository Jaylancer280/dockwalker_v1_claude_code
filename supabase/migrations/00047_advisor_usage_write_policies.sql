-- =============================================================================
-- Migration 00047: advisor_usage write policies
-- =============================================================================

create policy "Owner can insert own usage"
  on public.advisor_usage for insert
  to authenticated
  with check (person_id = auth.uid());

create policy "Owner can update own usage"
  on public.advisor_usage for update
  to authenticated
  using (person_id = auth.uid())
  with check (person_id = auth.uid());
