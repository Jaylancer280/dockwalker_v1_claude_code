-- =============================================================================
-- Rollback for 00134: re-assert NOT NULLs + drop daywork UPDATE policy
--
-- Self-contained per the project rollback rule. Any permanent_templates
-- rows saved with the relaxed schema (post-00134) that hold NULLs in the
-- formerly-NOT-NULL columns CANNOT survive the rollback — the SET NOT
-- NULL re-assertion would fail. We DELETE those rows up front so the
-- rollback reaches a consistent prior state without manual steps.
--
-- Tradeoff: rolling back this feature destroys partial-saved templates.
-- That is the inherent cost of reverting B-005's product intent (partial
-- templates are the feature). Documented here for the operator.
-- =============================================================================

-- 1) Drop the daywork_templates UPDATE policy added by 00134
drop policy if exists "Users can update own templates" on public.daywork_templates;

-- 2) Delete any permanent_templates rows with NULLs in the formerly-NOT-NULL
--    columns so the NOT NULL re-assertion below succeeds.
delete from public.permanent_templates
 where vessel_id is null
    or role_id is null
    or port_id is null
    or start_date is null
    or salary_min is null
    or salary_max is null
    or salary_currency is null
    or salary_period is null
    or live_aboard is null
    or required_certification_ids is null
    or shortlist_cap is null;

-- 3) Re-assert NOT NULL on permanent_templates partial-fields
alter table public.permanent_templates alter column vessel_id set not null;
alter table public.permanent_templates alter column role_id set not null;
alter table public.permanent_templates alter column port_id set not null;
alter table public.permanent_templates alter column start_date set not null;
alter table public.permanent_templates alter column salary_min set not null;
alter table public.permanent_templates alter column salary_max set not null;
alter table public.permanent_templates alter column salary_currency set not null;
alter table public.permanent_templates alter column salary_period set not null;
alter table public.permanent_templates alter column live_aboard set not null;
alter table public.permanent_templates alter column required_certification_ids set not null;
alter table public.permanent_templates alter column shortlist_cap set not null;
