-- Rollback: remove new columns from permanent_postings and permanent_templates
-- Then restore apply_projection from 00075

alter table public.permanent_postings
  drop column if exists contract_type,
  drop column if exists contract_details,
  drop column if exists description,
  drop column if exists meals,
  drop column if exists positions_available,
  drop column if exists positions_filled;

alter table public.permanent_templates
  drop column if exists contract_type,
  drop column if exists contract_details,
  drop column if exists description,
  drop column if exists meals,
  drop column if exists positions_available;

-- Restore apply_projection from 00075 (full body in that migration file)
-- The only difference is the PERMANENT.POSTED handler omitting the new columns.
