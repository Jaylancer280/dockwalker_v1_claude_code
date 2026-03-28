-- Seed experience brackets into production (seed file only runs locally).
-- Uses ON CONFLICT to be idempotent.
INSERT INTO public.experience_brackets (id, label, min_months, max_months, sort_order) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'Green (0-6 months)', 0, 6, 1),
  ('f0000000-0000-0000-0000-000000000002', '6-12 months', 6, 12, 2),
  ('f0000000-0000-0000-0000-000000000003', '1-2 years', 12, 24, 3),
  ('f0000000-0000-0000-0000-000000000004', '2-5 years', 24, 60, 4),
  ('f0000000-0000-0000-0000-000000000005', '5+ years', 60, NULL, 5)
ON CONFLICT (id) DO NOTHING;
