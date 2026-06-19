-- =============================================================================
-- Templates: partial-save support (B-005)
--
-- Two related changes:
--
-- 1) Drop NOT NULL on the partial-fields of `permanent_templates`. Until now
--    every column was NOT NULL, which meant `POST /api/permanent/templates`
--    crashed on a DB constraint when the user tried to save a "Deckhand
--    €2500" minimal template. The intent of templates is to capture
--    arbitrary partial configurations for later reuse — they are not
--    postings and shouldn't share posting validation. The CHECK
--    constraints on salary_currency / salary_period stay; Postgres
--    CHECK treats NULL as unknown so the constraints still hold.
--
--    `template_name` and `employer_person_id` remain NOT NULL — those
--    are the irreducible identity of a template.
--
-- 2) Add the missing owner UPDATE RLS policy on `daywork_templates`. The
--    table has had SELECT/INSERT/DELETE policies since 00006 but no
--    UPDATE — meaning even after we add a PATCH route, owners couldn't
--    edit their own rows. The permanent side already has this policy
--    (00059) so this brings daywork to parity.
--
-- See `tasks/todo.md` § B-005 for the full fix plan.
-- =============================================================================

-- 1) permanent_templates: relax NOT NULLs on partial-save columns
alter table public.permanent_templates alter column vessel_id drop not null;
alter table public.permanent_templates alter column role_id drop not null;
alter table public.permanent_templates alter column port_id drop not null;
alter table public.permanent_templates alter column start_date drop not null;
alter table public.permanent_templates alter column salary_min drop not null;
alter table public.permanent_templates alter column salary_max drop not null;
alter table public.permanent_templates alter column salary_currency drop not null;
alter table public.permanent_templates alter column salary_period drop not null;
alter table public.permanent_templates alter column live_aboard drop not null;
alter table public.permanent_templates alter column required_certification_ids drop not null;
alter table public.permanent_templates alter column shortlist_cap drop not null;

-- 2) daywork_templates: add owner UPDATE policy (parity with permanent_templates)
create policy "Users can update own templates"
  on public.daywork_templates for update
  to authenticated
  using (person_id = auth.uid())
  with check (person_id = auth.uid());
