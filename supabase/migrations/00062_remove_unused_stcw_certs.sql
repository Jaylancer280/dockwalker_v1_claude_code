-- Remove 3 unused STCW certifications, keeping only Basic Safety Training
DELETE FROM certifications WHERE id IN (
  'e0000000-0000-0000-0000-000000000002',
  'e0000000-0000-0000-0000-000000000003',
  'e0000000-0000-0000-0000-000000000004'
);
