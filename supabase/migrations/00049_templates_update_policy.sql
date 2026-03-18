-- =============================================================================
-- Migration 00049: daywork_templates UPDATE policy
-- =============================================================================

create policy "Owner can update own templates"
  on public.daywork_templates for update
  to authenticated
  using (person_id = auth.uid())
  with check (person_id = auth.uid());
