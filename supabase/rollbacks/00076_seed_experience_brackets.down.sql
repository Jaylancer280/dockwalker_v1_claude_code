-- Rollback: remove seeded experience brackets
-- Must nullify FK references first (seed data populates these tables)

UPDATE public.profiles SET experience_bracket_id = NULL
  WHERE experience_bracket_id IN (
    'f0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000002',
    'f0000000-0000-0000-0000-000000000003',
    'f0000000-0000-0000-0000-000000000004',
    'f0000000-0000-0000-0000-000000000005'
  );

UPDATE public.dayworks SET experience_bracket_id = NULL
  WHERE experience_bracket_id IN (
    'f0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000002',
    'f0000000-0000-0000-0000-000000000003',
    'f0000000-0000-0000-0000-000000000004',
    'f0000000-0000-0000-0000-000000000005'
  );

UPDATE public.daywork_templates SET experience_bracket_id = NULL
  WHERE experience_bracket_id IN (
    'f0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000002',
    'f0000000-0000-0000-0000-000000000003',
    'f0000000-0000-0000-0000-000000000004',
    'f0000000-0000-0000-0000-000000000005'
  );

-- permanent_postings and permanent_templates may not exist if rollback 00059 ran first
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'permanent_postings') THEN
    UPDATE public.permanent_postings SET experience_bracket_id = NULL
      WHERE experience_bracket_id IN (
        'f0000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000002',
        'f0000000-0000-0000-0000-000000000003',
        'f0000000-0000-0000-0000-000000000004',
        'f0000000-0000-0000-0000-000000000005'
      );
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'permanent_templates') THEN
    UPDATE public.permanent_templates SET experience_bracket_id = NULL
      WHERE experience_bracket_id IN (
        'f0000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000002',
        'f0000000-0000-0000-0000-000000000003',
        'f0000000-0000-0000-0000-000000000004',
        'f0000000-0000-0000-0000-000000000005'
      );
  END IF;
END $$;

DELETE FROM public.experience_brackets WHERE id IN (
  'f0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000002',
  'f0000000-0000-0000-0000-000000000003',
  'f0000000-0000-0000-0000-000000000004',
  'f0000000-0000-0000-0000-000000000005'
);
