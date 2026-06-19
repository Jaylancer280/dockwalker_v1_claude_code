-- Re-insert the 3 removed STCW certifications
INSERT INTO certifications (id, name, category, sort_order) VALUES
  ('e0000000-0000-0000-0000-000000000002', 'STCW Proficiency in Survival Craft', 'safety', 2),
  ('e0000000-0000-0000-0000-000000000003', 'STCW Advanced Fire Fighting', 'safety', 3),
  ('e0000000-0000-0000-0000-000000000004', 'STCW Medical First Aid', 'safety', 4);
