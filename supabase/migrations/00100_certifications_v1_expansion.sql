-- Qualifications V1: expand canonical certifications from 17 → ~265
--
-- Spec: tasks/qualifications-v1.md
-- Strategy: preserve all 17 existing UUIDs (referenced by profiles.certification_ids
-- and dayworks.required_certification_ids as uuid[]). Rename the 17 to their V1
-- equivalent, migrate them to the new category/subcategory taxonomy, then INSERT
-- the ~248 new canonical rows.
--
-- New category domain: basic, deck_bridge, engineering, interior, galley,
-- watersports, helideck, other. Subcategory populated only for the three
-- drill-down categories (deck_bridge, engineering, interior); NULL otherwise.

alter table public.certifications
  add column if not exists subcategory text null;

-- =====================================================================
-- Step 1: UPDATE the 17 preserved rows (rename + recategorise)
-- =====================================================================

update public.certifications set name = 'STCW 95 (STCW 2010)',                                                                category = 'basic',       subcategory = null,                  sort_order = 1   where id = 'e0000000-0000-0000-0000-000000000001';
update public.certifications set name = 'ENG1 Medical Certificate',                                                           category = 'basic',       subcategory = null,                  sort_order = 2   where id = 'e0000000-0000-0000-0000-000000000005';
update public.certifications set name = 'Food Hygiene (HABC Level 2)',                                                        category = 'galley',      subcategory = null,                  sort_order = 10  where id = 'e0000000-0000-0000-0000-000000000006';
update public.certifications set name = 'RYA Powerboat Level 2',                                                              category = 'deck_bridge', subcategory = 'rya_powerboat_nav',   sort_order = 3   where id = 'e0000000-0000-0000-0000-000000000007';
update public.certifications set name = 'MCA Yacht Rating Certificate',                                                       category = 'deck_bridge', subcategory = 'master_skipper',      sort_order = 8   where id = 'e0000000-0000-0000-0000-000000000008';
update public.certifications set name = 'G.U.E.S.T I Introduction CoC Yacht Junior Steward(ess)',                             category = 'interior',    subcategory = 'guest_core',          sort_order = 1   where id = 'e0000000-0000-0000-0000-000000000009';
update public.certifications set name = 'Ship Security Officer (SSO) (A-VI/5)',                                               category = 'basic',       subcategory = null,                  sort_order = 23  where id = 'e0000000-0000-0000-0000-000000000010';
update public.certifications set name = 'HELM (Operational)',                                                                 category = 'basic',       subcategory = null,                  sort_order = 15  where id = 'e0000000-0000-0000-0000-000000000011';
update public.certifications set name = 'MCA Master <200gt / OOW <500gt / USCG Master <200gt',                                category = 'deck_bridge', subcategory = 'master_skipper',      sort_order = 14  where id = 'e0000000-0000-0000-0000-000000000012';
update public.certifications set name = 'MCA CoC Master <500gt / Class 5',                                                    category = 'deck_bridge', subcategory = 'master_skipper',      sort_order = 18  where id = 'e0000000-0000-0000-0000-000000000013';
update public.certifications set name = 'MCA CoC Master <3000gt / Class 4 / USCG Master <1600gt',                             category = 'deck_bridge', subcategory = 'master_skipper',      sort_order = 19  where id = 'e0000000-0000-0000-0000-000000000014';
update public.certifications set name = 'MCA Approved Engine Course (AEC 1 & 2) Certificate',                                 category = 'engineering', subcategory = 'core',                sort_order = 2   where id = 'e0000000-0000-0000-0000-000000000015';
update public.certifications set name = 'RIII/3 Y4 Chief Engineer (<200gt <1500kW) / EOOW III/1 (SV) (<3000gt <9000kW)',      category = 'engineering', subcategory = 'core',                sort_order = 5   where id = 'e0000000-0000-0000-0000-000000000016';
update public.certifications set name = 'RIII/3 Y3 Chief Engineer (<500gt <3000kW) / Chief Engineer (SV) (<500gt 3000kW)',    category = 'engineering', subcategory = 'core',                sort_order = 7   where id = 'e0000000-0000-0000-0000-000000000017';
update public.certifications set name = 'WSET Award in Wines Level 2',                                                        category = 'interior',    subcategory = 'wine_spirits',        sort_order = 7   where id = 'e0000000-0000-0000-0000-000000000018';
update public.certifications set name = 'RYA Personal Watercraft Proficiency (PWC)',                                          category = 'deck_bridge', subcategory = 'rya_powerboat_nav',   sort_order = 8   where id = 'e0000000-0000-0000-0000-000000000019';
update public.certifications set name = 'PADI Divemaster',                                                                    category = 'watersports', subcategory = null,                  sort_order = 6   where id = 'e0000000-0000-0000-0000-000000000020';

-- =====================================================================
-- Step 2: INSERT new canonical rows
-- =====================================================================

-- ---------- Basic (flat, 19 new — 4 preserved above) ----------

insert into public.certifications (id, name, category, subcategory, sort_order) values
  ('e0000000-0000-0000-0000-000000000100', 'ENG1 Medical Certificate (with Limitation/Restrictions)',              'basic', null, 3),
  ('e0000000-0000-0000-0000-000000000101', 'Proficiency in Security Awareness (A-VI/6)',                           'basic', null, 4),
  ('e0000000-0000-0000-0000-000000000102', 'Proficiency in Designated Security Duties (A-VI/6-2)',                 'basic', null, 5),
  ('e0000000-0000-0000-0000-000000000103', 'Personal Survival Techniques (A-VI/1-1)',                              'basic', null, 6),
  ('e0000000-0000-0000-0000-000000000104', 'Fire Prevention & Fire Fighting (A-VI/1-2)',                           'basic', null, 7),
  ('e0000000-0000-0000-0000-000000000105', 'Elementary First Aid (A-VI/1-3)',                                      'basic', null, 8),
  ('e0000000-0000-0000-0000-000000000106', 'Personal Safety & Social Responsibilities (A-VI/1-4)',                 'basic', null, 9),
  ('e0000000-0000-0000-0000-000000000107', 'Proficiency in Survival Craft & Rescue Boats (PSCRB) (A-VI/2 1-4)',    'basic', null, 10),
  ('e0000000-0000-0000-0000-000000000108', 'Fast Rescue Boat (FRB) Training',                                      'basic', null, 11),
  ('e0000000-0000-0000-0000-000000000109', 'Advanced Fire Fighting (A-VI/3)',                                      'basic', null, 12),
  ('e0000000-0000-0000-0000-000000000110', 'Proficiency in Medical First Aid (A-VI/4 1-3)',                        'basic', null, 13),
  ('e0000000-0000-0000-0000-000000000111', 'Proficiency in Medical Care',                                          'basic', null, 14),
  ('e0000000-0000-0000-0000-000000000112', 'HELM (Management)',                                                    'basic', null, 16),
  ('e0000000-0000-0000-0000-000000000113', 'GMDSS Restricted Operators Certificate (ROC)',                         'basic', null, 17),
  ('e0000000-0000-0000-0000-000000000114', 'GMDSS General Operators Certificate (GOC)',                            'basic', null, 18),
  ('e0000000-0000-0000-0000-000000000115', 'GMDSS Long Range Certificate (LRC)',                                   'basic', null, 19),
  ('e0000000-0000-0000-0000-000000000116', 'Electronic Chart Display (ECDIS)',                                     'basic', null, 20),
  ('e0000000-0000-0000-0000-000000000117', 'Helicopter Underwater Escape Training (HUET)',                         'basic', null, 21),
  ('e0000000-0000-0000-0000-000000000118', 'Entry Into Enclosed Spaces',                                           'basic', null, 22);

-- ---------- Deck / Bridge — Master/Skipper (23 total; 6 preserved: 007=PB2→rya_pb, 008=YR, 012=M200, 013=M500, 014=M3000, 019=PWC→rya_pb) ----------
-- Preserved in master_skipper: 008, 012, 013, 014. (007+019 are in rya_powerboat_nav.)
-- 19 new master_skipper rows

insert into public.certifications (id, name, category, subcategory, sort_order) values
  ('e0000000-0000-0000-0000-000000000200', 'RYA Start Yachting',                                                             'deck_bridge', 'master_skipper', 1),
  ('e0000000-0000-0000-0000-000000000201', 'RYA Competent Crew',                                                             'deck_bridge', 'master_skipper', 2),
  ('e0000000-0000-0000-0000-000000000202', 'RYA Day Skipper Theory',                                                         'deck_bridge', 'master_skipper', 3),
  ('e0000000-0000-0000-0000-000000000203', 'RYA Day Skipper',                                                                'deck_bridge', 'master_skipper', 4),
  ('e0000000-0000-0000-0000-000000000204', 'RYA Coastal Skipper',                                                            'deck_bridge', 'master_skipper', 5),
  ('e0000000-0000-0000-0000-000000000205', 'RYA Yachtmaster Coastal Skipper',                                                'deck_bridge', 'master_skipper', 6),
  ('e0000000-0000-0000-0000-000000000206', 'MCA Navigational Watch Rating (NWR) Certificate',                                'deck_bridge', 'master_skipper', 7),
  ('e0000000-0000-0000-0000-000000000207', 'MCA Able Seafarer Deck Certificate',                                             'deck_bridge', 'master_skipper', 9),
  ('e0000000-0000-0000-0000-000000000208', 'RYA Coastal Skipper/Yachtmaster Offshore Theory',                                'deck_bridge', 'master_skipper', 10),
  ('e0000000-0000-0000-0000-000000000209', 'RYA Yachtmaster Offshore',                                                       'deck_bridge', 'master_skipper', 11),
  ('e0000000-0000-0000-0000-000000000210', 'RYA Yachtmaster Ocean Theory',                                                   'deck_bridge', 'master_skipper', 12),
  ('e0000000-0000-0000-0000-000000000211', 'RYA Yachtmaster Ocean',                                                          'deck_bridge', 'master_skipper', 13),
  ('e0000000-0000-0000-0000-000000000212', 'MCA CoC Master Workboats <500gt / USCG Master <500gt',                           'deck_bridge', 'master_skipper', 15),
  ('e0000000-0000-0000-0000-000000000213', 'MCA CoC Officer of the Watch <3000gt',                                           'deck_bridge', 'master_skipper', 16),
  ('e0000000-0000-0000-0000-000000000214', 'MCA CoC Chief Mate <3000gt',                                                     'deck_bridge', 'master_skipper', 17),
  ('e0000000-0000-0000-0000-000000000215', 'RMI II/2 Certificate of Competency Master Yachts (Unlimited)',                   'deck_bridge', 'master_skipper', 20),
  ('e0000000-0000-0000-0000-000000000216', 'Reg II/1 CoC Officer of the Watch (Unlimited)',                                  'deck_bridge', 'master_skipper', 21),
  ('e0000000-0000-0000-0000-000000000217', 'Reg II/2 CoC Chief Mate (Unlimited) / Master <3000gt / USCG Chief Mate (Unlimited)', 'deck_bridge', 'master_skipper', 22),
  ('e0000000-0000-0000-0000-000000000218', 'Reg II/2 CoC Master (Unlimited) / Class 1 / USCG Master (Unlimited)',            'deck_bridge', 'master_skipper', 23);

-- ---------- Deck / Bridge — Specialised Deck (14 new) ----------

insert into public.certifications (id, name, category, subcategory, sort_order) values
  ('e0000000-0000-0000-0000-000000000220', 'IYT Master of Yachts Coastal / Mate 200 Tons (Power or Sail)',                   'deck_bridge', 'specialised_deck', 1),
  ('e0000000-0000-0000-0000-000000000221', 'IYT Master of Yachts Limited (Power or Sail)',                                   'deck_bridge', 'specialised_deck', 2),
  ('e0000000-0000-0000-0000-000000000222', 'IYT Master of Yachts Unlimited',                                                 'deck_bridge', 'specialised_deck', 3),
  ('e0000000-0000-0000-0000-000000000223', 'IYT Small Powerboat and Rib Master (MCA Approved)',                              'deck_bridge', 'specialised_deck', 4),
  ('e0000000-0000-0000-0000-000000000224', 'IYT Superyacht Deck Crew Course',                                                'deck_bridge', 'specialised_deck', 5),
  ('e0000000-0000-0000-0000-000000000225', 'IYT Marine Communications (VHF-SRC)',                                            'deck_bridge', 'specialised_deck', 6),
  ('e0000000-0000-0000-0000-000000000226', 'Dynamic Positioning Induction Course',                                           'deck_bridge', 'specialised_deck', 7),
  ('e0000000-0000-0000-0000-000000000227', 'Dynamic Positioning Simulator (Advanced) Course',                                'deck_bridge', 'specialised_deck', 8),
  ('e0000000-0000-0000-0000-000000000228', 'Lithium-Ion Battery Safety Awareness',                                           'deck_bridge', 'specialised_deck', 9),
  ('e0000000-0000-0000-0000-000000000229', 'Professional Carpentry Course / Diploma',                                        'deck_bridge', 'specialised_deck', 10),
  ('e0000000-0000-0000-0000-000000000230', 'Professional Painting Course (e.g. Pinmar)',                                     'deck_bridge', 'specialised_deck', 11),
  ('e0000000-0000-0000-0000-000000000231', 'Qualified Photographer',                                                         'deck_bridge', 'specialised_deck', 12),
  ('e0000000-0000-0000-0000-000000000232', 'Qualified Videographer',                                                         'deck_bridge', 'specialised_deck', 13),
  ('e0000000-0000-0000-0000-000000000233', 'Qualified Drone Pilot (Operator)',                                               'deck_bridge', 'specialised_deck', 14);

-- ---------- Deck / Bridge — Deck Modules & Oral Preps (29 new) ----------

insert into public.certifications (id, name, category, subcategory, sort_order) values
  ('e0000000-0000-0000-0000-000000000240', 'MCA Training Record Book (TRB)',                                                 'deck_bridge', 'deck_modules', 1),
  ('e0000000-0000-0000-0000-000000000241', 'MCA Signals Certificate',                                                        'deck_bridge', 'deck_modules', 2),
  ('e0000000-0000-0000-0000-000000000242', 'MCA/MNTB Small Ships Navigation & Radar',                                        'deck_bridge', 'deck_modules', 3),
  ('e0000000-0000-0000-0000-000000000243', 'Navigation & Radar (OOW Yachts)',                                                'deck_bridge', 'deck_modules', 4),
  ('e0000000-0000-0000-0000-000000000244', 'General Ship Knowledge (OOW Yachts)',                                            'deck_bridge', 'deck_modules', 5),
  ('e0000000-0000-0000-0000-000000000245', 'Seamanship & Meteorology (Master Yachts)',                                       'deck_bridge', 'deck_modules', 6),
  ('e0000000-0000-0000-0000-000000000246', 'Celestial Navigation (Master Yachts)',                                           'deck_bridge', 'deck_modules', 7),
  ('e0000000-0000-0000-0000-000000000247', 'Stability (Master Yachts)',                                                      'deck_bridge', 'deck_modules', 8),
  ('e0000000-0000-0000-0000-000000000248', 'Business & Law (Master Yachts)',                                                 'deck_bridge', 'deck_modules', 9),
  ('e0000000-0000-0000-0000-000000000249', 'Navigation, Radar and ARPA (Master Yachts)',                                     'deck_bridge', 'deck_modules', 10),
  ('e0000000-0000-0000-0000-000000000250', 'Navigation Aids, Equipment and Simulator Training — Operational (NAEST-O)',      'deck_bridge', 'deck_modules', 11),
  ('e0000000-0000-0000-0000-000000000251', 'Navigation Aids, Equipment and Simulator Training — Management (NAEST-M)',      'deck_bridge', 'deck_modules', 12),
  ('e0000000-0000-0000-0000-000000000252', 'Deck Cadet Foundation Degree Programme',                                         'deck_bridge', 'deck_modules', 13),
  ('e0000000-0000-0000-0000-000000000253', 'Deck Cadet Higher National Diploma Programme',                                   'deck_bridge', 'deck_modules', 14),
  ('e0000000-0000-0000-0000-000000000254', 'Deck Cadet Higher National Certificate Programme',                               'deck_bridge', 'deck_modules', 15),
  ('e0000000-0000-0000-0000-000000000255', 'Officer of the Watch (HNC/SQA/Exam Route)',                                      'deck_bridge', 'deck_modules', 16),
  ('e0000000-0000-0000-0000-000000000256', 'Chief Mate (Post Foundation Degree Route)',                                      'deck_bridge', 'deck_modules', 17),
  ('e0000000-0000-0000-0000-000000000257', 'Chief Mate (Post HND Examination Route)',                                        'deck_bridge', 'deck_modules', 18),
  ('e0000000-0000-0000-0000-000000000258', 'Chief Mate & Master (SQA Examination Route)',                                    'deck_bridge', 'deck_modules', 19),
  ('e0000000-0000-0000-0000-000000000259', 'Yachtmaster Coastal — 5 Day Prep/Exam',                                          'deck_bridge', 'deck_modules', 20),
  ('e0000000-0000-0000-0000-000000000260', 'Yachtmaster Offshore — 5 Day Prep/Exam',                                         'deck_bridge', 'deck_modules', 21),
  ('e0000000-0000-0000-0000-000000000261', 'Yachtmaster Ocean — Oral Preparation',                                           'deck_bridge', 'deck_modules', 22),
  ('e0000000-0000-0000-0000-000000000262', 'MCA Master <200gt / OOW <500gt — Oral Preparation',                              'deck_bridge', 'deck_modules', 23),
  ('e0000000-0000-0000-0000-000000000263', 'MCA CoC OOW <3000gt — Oral Prep',                                                'deck_bridge', 'deck_modules', 24),
  ('e0000000-0000-0000-0000-000000000264', 'MCA CoC Master <500gt / Class 5 — Oral Preparation',                             'deck_bridge', 'deck_modules', 25),
  ('e0000000-0000-0000-0000-000000000265', 'MCA CoC Master <3000gt / Class 4 — Oral Preparation',                            'deck_bridge', 'deck_modules', 26),
  ('e0000000-0000-0000-0000-000000000266', 'MCA CoC OOW (Unlimited) — Oral Prep',                                            'deck_bridge', 'deck_modules', 27),
  ('e0000000-0000-0000-0000-000000000267', 'MCA CoC Chief Mate (Unlimited) — Oral Preparation',                              'deck_bridge', 'deck_modules', 28),
  ('e0000000-0000-0000-0000-000000000268', 'MCA CoC Master (Unlimited) / Class 1 — Oral Prep',                               'deck_bridge', 'deck_modules', 29);

-- ---------- Deck / Bridge — RYA Powerboat & Nav (20 total; 2 preserved: 007=RYA PB2, 019=PWC) ----------
-- 18 new rows

insert into public.certifications (id, name, category, subcategory, sort_order) values
  ('e0000000-0000-0000-0000-000000000280', 'ICC International Certificate of Competence',                                    'deck_bridge', 'rya_powerboat_nav', 1),
  ('e0000000-0000-0000-0000-000000000281', 'RYA Powerboat Level 1',                                                          'deck_bridge', 'rya_powerboat_nav', 2),
  ('e0000000-0000-0000-0000-000000000282', 'RYA Intermediate Powerboat',                                                     'deck_bridge', 'rya_powerboat_nav', 4),
  ('e0000000-0000-0000-0000-000000000283', 'RYA Advanced Powerboat',                                                         'deck_bridge', 'rya_powerboat_nav', 5),
  ('e0000000-0000-0000-0000-000000000284', 'RYA Safety Boat',                                                                'deck_bridge', 'rya_powerboat_nav', 6),
  ('e0000000-0000-0000-0000-000000000285', 'RYA Tender Operator Course',                                                     'deck_bridge', 'rya_powerboat_nav', 7),
  ('e0000000-0000-0000-0000-000000000286', 'BWSF Ski Boat Driver Award',                                                     'deck_bridge', 'rya_powerboat_nav', 9),
  ('e0000000-0000-0000-0000-000000000287', 'CEVNI Waterways Test / Assessment',                                              'deck_bridge', 'rya_powerboat_nav', 10),
  ('e0000000-0000-0000-0000-000000000288', 'RYA Start Motor Cruising',                                                       'deck_bridge', 'rya_powerboat_nav', 11),
  ('e0000000-0000-0000-0000-000000000289', 'RYA Helmsman''s Course',                                                         'deck_bridge', 'rya_powerboat_nav', 12),
  ('e0000000-0000-0000-0000-000000000290', 'RYA Advanced Pilotage',                                                          'deck_bridge', 'rya_powerboat_nav', 13),
  ('e0000000-0000-0000-0000-000000000291', 'RYA Essential Navigation & Seamanship',                                          'deck_bridge', 'rya_powerboat_nav', 14),
  ('e0000000-0000-0000-0000-000000000292', 'RYA VHF Marine Radio (SRC)',                                                     'deck_bridge', 'rya_powerboat_nav', 15),
  ('e0000000-0000-0000-0000-000000000293', 'RYA Radar',                                                                      'deck_bridge', 'rya_powerboat_nav', 16),
  ('e0000000-0000-0000-0000-000000000294', 'RYA Sea Survival',                                                               'deck_bridge', 'rya_powerboat_nav', 17),
  ('e0000000-0000-0000-0000-000000000295', 'RYA Offshore Safety (ISAF)',                                                     'deck_bridge', 'rya_powerboat_nav', 18),
  ('e0000000-0000-0000-0000-000000000296', 'RYA First Aid',                                                                  'deck_bridge', 'rya_powerboat_nav', 19),
  ('e0000000-0000-0000-0000-000000000297', 'RYA Professional Practices & Responsibilities',                                  'deck_bridge', 'rya_powerboat_nav', 20);

-- ---------- Engineering — Core (12 total; 3 preserved: 015=AEC1&2, 016=Y4, 017=Y3) ----------
-- 9 new rows

insert into public.certifications (id, name, category, subcategory, sort_order) values
  ('e0000000-0000-0000-0000-000000000300', 'RYA Diesel Engine Course',                                                       'engineering', 'core', 1),
  ('e0000000-0000-0000-0000-000000000301', 'MCA Engine Watch Rating Certificate',                                            'engineering', 'core', 3),
  ('e0000000-0000-0000-0000-000000000302', 'MCA Marine Engine Operator License (Y)',                                         'engineering', 'core', 4),
  ('e0000000-0000-0000-0000-000000000303', '2nd Engineer III/2 (SV) (<3000gt <9000kW)',                                      'engineering', 'core', 6),
  ('e0000000-0000-0000-0000-000000000304', 'RIII/2 Y2 Chief Engineer (<3000gt <3000kW) / Chief Engineer (SV) (<3000gt <9000kW)', 'engineering', 'core', 8),
  ('e0000000-0000-0000-0000-000000000305', 'RIII/2 Y1 Chief Engineer (<3000gt <9000kW) / Chief Engineer (SV) (<3000gt <9000kW)', 'engineering', 'core', 9),
  ('e0000000-0000-0000-0000-000000000306', 'RIII/1 Engineer Officer of the Watch (Unlimited)',                               'engineering', 'core', 10),
  ('e0000000-0000-0000-0000-000000000307', 'RIII/2 2nd Engineer (Unlimited)',                                                'engineering', 'core', 11),
  ('e0000000-0000-0000-0000-000000000308', 'RIII/2 Chief Engineer (Unlimited) / Class 1',                                    'engineering', 'core', 12);

-- ---------- Engineering — ETO (4 new) ----------

insert into public.certifications (id, name, category, subcategory, sort_order) values
  ('e0000000-0000-0000-0000-000000000310', 'Electro-Technical Trainee (ETT)',                                                'engineering', 'eto', 1),
  ('e0000000-0000-0000-0000-000000000311', 'RIII/7 Electro-Technical Rating (ETR)',                                          'engineering', 'eto', 2),
  ('e0000000-0000-0000-0000-000000000312', 'RIII/6 Electro-Technical Officer (ETO)',                                         'engineering', 'eto', 3),
  ('e0000000-0000-0000-0000-000000000313', 'RIII/6 Electro-Technical Officer (ETO) (Unlimited)',                             'engineering', 'eto', 4);

-- ---------- Engineering — Modules & Short Courses (35 new) ----------

insert into public.certifications (id, name, category, subcategory, sort_order) values
  ('e0000000-0000-0000-0000-000000000320', 'Training Record Book (MNTB/OTRB)',                                               'engineering', 'eng_modules', 1),
  ('e0000000-0000-0000-0000-000000000321', 'MCA Approved Engine Course (AEC 1)',                                             'engineering', 'eng_modules', 2),
  ('e0000000-0000-0000-0000-000000000322', 'MCA Approved Engine Course (AEC 2)',                                             'engineering', 'eng_modules', 3),
  ('e0000000-0000-0000-0000-000000000323', 'Workshop Skills Training',                                                       'engineering', 'eng_modules', 4),
  ('e0000000-0000-0000-0000-000000000324', 'Chief Engineer (SV) Marine Diesel Engineering',                                  'engineering', 'eng_modules', 5),
  ('e0000000-0000-0000-0000-000000000325', 'Chief Engineer (SV) Auxiliary Equipment (Part 1)',                               'engineering', 'eng_modules', 6),
  ('e0000000-0000-0000-0000-000000000326', 'Chief Engineer (SV) Operational Procedures, Basic Hotel Services and Ship Construction', 'engineering', 'eng_modules', 7),
  ('e0000000-0000-0000-0000-000000000327', 'Chief Engineer (SV) Statutory & Operational Requirements',                       'engineering', 'eng_modules', 8),
  ('e0000000-0000-0000-0000-000000000328', 'Chief Engineer (SV) Auxiliary Equipment (Part 2)',                               'engineering', 'eng_modules', 9),
  ('e0000000-0000-0000-0000-000000000329', 'Chief Engineer (SV) Applied Marine Engineering',                                 'engineering', 'eng_modules', 10),
  ('e0000000-0000-0000-0000-000000000330', 'Chief Engineer (SV) General Engineering Science I',                              'engineering', 'eng_modules', 11),
  ('e0000000-0000-0000-0000-000000000331', 'Chief Engineer (SV) General Engineering Science II',                             'engineering', 'eng_modules', 12),
  ('e0000000-0000-0000-0000-000000000332', 'MTU 2000 Series — Approved Operator Course',                                     'engineering', 'eng_modules', 13),
  ('e0000000-0000-0000-0000-000000000333', 'MTU 4000 Series — Approved Operator Course',                                     'engineering', 'eng_modules', 14),
  ('e0000000-0000-0000-0000-000000000334', 'MTU 8000 Series — Approved Operator Course',                                     'engineering', 'eng_modules', 15),
  ('e0000000-0000-0000-0000-000000000335', 'MTU Series — Electronics Course',                                                'engineering', 'eng_modules', 16),
  ('e0000000-0000-0000-0000-000000000336', 'Caterpillar Series — Approved Operator Course',                                  'engineering', 'eng_modules', 17),
  ('e0000000-0000-0000-0000-000000000337', 'RIII/1 EOOW — Foundation Degree',                                                'engineering', 'eng_modules', 18),
  ('e0000000-0000-0000-0000-000000000338', 'RIII/1 EOOW — Higher National Diploma',                                          'engineering', 'eng_modules', 19),
  ('e0000000-0000-0000-0000-000000000339', 'RIII/1 EOOW — Higher National Certificate',                                      'engineering', 'eng_modules', 20),
  ('e0000000-0000-0000-0000-000000000340', 'RIII/1 EOOW — Specialised Route',                                                'engineering', 'eng_modules', 21),
  ('e0000000-0000-0000-0000-000000000341', 'RIII/1 EOOW — IAMI Exam Route',                                                  'engineering', 'eng_modules', 22),
  ('e0000000-0000-0000-0000-000000000342', 'RIII/6 METO — MNTB Workshop Skills Training',                                    'engineering', 'eng_modules', 23),
  ('e0000000-0000-0000-0000-000000000343', 'RIII/1 EOOW — High Voltage (Operational)',                                       'engineering', 'eng_modules', 24),
  ('e0000000-0000-0000-0000-000000000344', 'RIII/1 METO — Foundation Degree Programme',                                      'engineering', 'eng_modules', 25),
  ('e0000000-0000-0000-0000-000000000345', 'RIII/1 EOOW — MNTB Workshop Skills Training',                                    'engineering', 'eng_modules', 26),
  ('e0000000-0000-0000-0000-000000000346', 'RIII/2 2nd Engineer — Engineering Knowledge (G & M)',                            'engineering', 'eng_modules', 27),
  ('e0000000-0000-0000-0000-000000000347', 'RIII/2 2nd Engineer — Engineering Knowledge (G & S)',                            'engineering', 'eng_modules', 28),
  ('e0000000-0000-0000-0000-000000000348', 'RIII/2 2nd Engineer — High Voltage (Management)',                                'engineering', 'eng_modules', 29),
  ('e0000000-0000-0000-0000-000000000349', 'RIII/2 Chief Eng — Engineering Knowledge (G & M)',                               'engineering', 'eng_modules', 30),
  ('e0000000-0000-0000-0000-000000000350', 'RIII/2 Chief Eng — Engineering Knowledge (G & S)',                               'engineering', 'eng_modules', 31),
  ('e0000000-0000-0000-0000-000000000351', 'RIII/1 EOOW — Oral Preparation',                                                 'engineering', 'eng_modules', 32),
  ('e0000000-0000-0000-0000-000000000352', 'RIII/2 2nd Engineer — Oral Preparation',                                         'engineering', 'eng_modules', 33),
  ('e0000000-0000-0000-0000-000000000353', 'RIII/2 Chief Eng — Oral Preparation',                                            'engineering', 'eng_modules', 34),
  ('e0000000-0000-0000-0000-000000000354', 'RIII/7 Marine Electro-Technical Rating (Unlimited)',                             'engineering', 'eng_modules', 35);

-- ---------- Interior — G.U.E.S.T Core (4 total; 1 preserved: 009) ----------
-- 3 new rows

insert into public.certifications (id, name, category, subcategory, sort_order) values
  ('e0000000-0000-0000-0000-000000000400', 'G.U.E.S.T II Advanced CoC Yacht Senior Steward(ess)',                            'interior', 'guest_core', 2),
  ('e0000000-0000-0000-0000-000000000401', 'G.U.E.S.T III Management CoC Yacht Chief Steward(ess)',                          'interior', 'guest_core', 3),
  ('e0000000-0000-0000-0000-000000000402', 'G.U.E.S.T IV Purser CoC Yacht Chief Steward(ess)',                               'interior', 'guest_core', 4);

-- ---------- Interior — G.U.E.S.T Modules (14 new) ----------

insert into public.certifications (id, name, category, subcategory, sort_order) values
  ('e0000000-0000-0000-0000-000000000410', 'G.U.E.S.T Yacht Interior Introduction (unit 01)',                                'interior', 'guest_modules', 1),
  ('e0000000-0000-0000-0000-000000000411', 'G.U.E.S.T Yacht Interior Basic Food Service (unit 02)',                          'interior', 'guest_modules', 2),
  ('e0000000-0000-0000-0000-000000000412', 'G.U.E.S.T Yacht Interior Administration and HR (unit 04)',                       'interior', 'guest_modules', 3),
  ('e0000000-0000-0000-0000-000000000413', 'G.U.E.S.T Advanced Food & Beverage Service (unit 05)',                           'interior', 'guest_modules', 4),
  ('e0000000-0000-0000-0000-000000000414', 'G.U.E.S.T Cigar Service (unit 06)',                                              'interior', 'guest_modules', 5),
  ('e0000000-0000-0000-0000-000000000415', 'G.U.E.S.T Advanced Laundry Service (unit 07)',                                   'interior', 'guest_modules', 6),
  ('e0000000-0000-0000-0000-000000000416', 'G.U.E.S.T Advanced Housekeeping (unit 08)',                                      'interior', 'guest_modules', 7),
  ('e0000000-0000-0000-0000-000000000417', 'G.U.E.S.T Advanced Valet Services (unit 09)',                                    'interior', 'guest_modules', 8),
  ('e0000000-0000-0000-0000-000000000418', 'G.U.E.S.T Floristry and Plant Maintenance (unit 10)',                            'interior', 'guest_modules', 9),
  ('e0000000-0000-0000-0000-000000000419', 'G.U.E.S.T Barista and Hot Beverages (unit 11)',                                  'interior', 'guest_modules', 10),
  ('e0000000-0000-0000-0000-000000000420', 'G.U.E.S.T Advanced Interior & Destination Management (unit 16)',                 'interior', 'guest_modules', 11),
  ('e0000000-0000-0000-0000-000000000421', 'G.U.E.S.T / IAMI Foundation Leadership (unit 17)',                               'interior', 'guest_modules', 12),
  ('e0000000-0000-0000-0000-000000000422', 'G.U.E.S.T Purser Programme (units 18-21)',                                       'interior', 'guest_modules', 13),
  ('e0000000-0000-0000-0000-000000000423', 'G.U.E.S.T / IAMI Advanced Leadership (unit 22)',                                 'interior', 'guest_modules', 14);

-- ---------- Interior — Wine & Spirits (15 total; 1 preserved: 018=WSET Wines L2) ----------
-- 5 G.U.E.S.T W&S + 9 new WSET rows (14 new)

insert into public.certifications (id, name, category, subcategory, sort_order) values
  ('e0000000-0000-0000-0000-000000000430', 'G.U.E.S.T Basic Wine Bartending & Mixology',                                     'interior', 'wine_spirits', 1),
  ('e0000000-0000-0000-0000-000000000431', 'G.U.E.S.T Advanced Wine Appreciation 1 (unit 12)',                               'interior', 'wine_spirits', 2),
  ('e0000000-0000-0000-0000-000000000432', 'G.U.E.S.T Advanced Wine Appreciation 2 (unit 13)',                               'interior', 'wine_spirits', 3),
  ('e0000000-0000-0000-0000-000000000433', 'G.U.E.S.T Advanced Bartending and Mixology 1 (unit 14)',                         'interior', 'wine_spirits', 4),
  ('e0000000-0000-0000-0000-000000000434', 'G.U.E.S.T Advanced Bartending and Mixology 2 (unit 15)',                         'interior', 'wine_spirits', 5),
  ('e0000000-0000-0000-0000-000000000435', 'WSET Award in Wines Level 1',                                                    'interior', 'wine_spirits', 6),
  ('e0000000-0000-0000-0000-000000000436', 'WSET Award in Wines Level 3',                                                    'interior', 'wine_spirits', 8),
  ('e0000000-0000-0000-0000-000000000437', 'WSET Diploma in Wines Level 4',                                                  'interior', 'wine_spirits', 9),
  ('e0000000-0000-0000-0000-000000000438', 'WSET Award in Spirits Level 1',                                                  'interior', 'wine_spirits', 10),
  ('e0000000-0000-0000-0000-000000000439', 'WSET Award in Spirits Level 2',                                                  'interior', 'wine_spirits', 11),
  ('e0000000-0000-0000-0000-000000000440', 'WSET Award in Spirits Level 3',                                                  'interior', 'wine_spirits', 12),
  ('e0000000-0000-0000-0000-000000000441', 'WSET Award in Sake Level 1',                                                     'interior', 'wine_spirits', 13),
  ('e0000000-0000-0000-0000-000000000442', 'WSET Award in Sake Level 2',                                                     'interior', 'wine_spirits', 14),
  ('e0000000-0000-0000-0000-000000000443', 'Master Sommelier',                                                               'interior', 'wine_spirits', 15);

-- ---------- Interior — Specialised Interior (32 new) ----------

insert into public.certifications (id, name, category, subcategory, sort_order) values
  ('e0000000-0000-0000-0000-000000000450', 'Superyacht Induction (Operations) Course',                                       'interior', 'specialised_interior', 1),
  ('e0000000-0000-0000-0000-000000000451', 'Superyacht Interior Course',                                                     'interior', 'specialised_interior', 2),
  ('e0000000-0000-0000-0000-000000000452', 'Introduction to International Safety Management (ISM)',                          'interior', 'specialised_interior', 3),
  ('e0000000-0000-0000-0000-000000000453', 'Crisis Management & Human Behaviour',                                            'interior', 'specialised_interior', 4),
  ('e0000000-0000-0000-0000-000000000454', 'Crowd Management on Passenger Ships',                                            'interior', 'specialised_interior', 5),
  ('e0000000-0000-0000-0000-000000000455', 'Leadership & Management Course',                                                 'interior', 'specialised_interior', 6),
  ('e0000000-0000-0000-0000-000000000456', 'Purser Course (inc accountancy, budgeting)',                                     'interior', 'specialised_interior', 7),
  ('e0000000-0000-0000-0000-000000000457', 'Certified Accountant',                                                           'interior', 'specialised_interior', 8),
  ('e0000000-0000-0000-0000-000000000458', 'Hotel Management (Operations) Course',                                           'interior', 'specialised_interior', 9),
  ('e0000000-0000-0000-0000-000000000459', 'Hospitality Course (hotel, estates, resorts & luxury yachts)',                   'interior', 'specialised_interior', 10),
  ('e0000000-0000-0000-0000-000000000460', 'Etiquette Protocol / Hospitality Training',                                      'interior', 'specialised_interior', 11),
  ('e0000000-0000-0000-0000-000000000461', 'Formal Butler & Valet Training',                                                 'interior', 'specialised_interior', 12),
  ('e0000000-0000-0000-0000-000000000462', 'Silver Service Course',                                                          'interior', 'specialised_interior', 13),
  ('e0000000-0000-0000-0000-000000000463', 'Barista & Hot Beverages Course',                                                 'interior', 'specialised_interior', 14),
  ('e0000000-0000-0000-0000-000000000464', 'Cocktails & Mixology Course',                                                    'interior', 'specialised_interior', 15),
  ('e0000000-0000-0000-0000-000000000465', 'Certified Sommelier Course',                                                     'interior', 'specialised_interior', 16),
  ('e0000000-0000-0000-0000-000000000466', 'Qualified Private Tutor / Governess',                                            'interior', 'specialised_interior', 17),
  ('e0000000-0000-0000-0000-000000000467', 'Qualified Nanny',                                                                'interior', 'specialised_interior', 18),
  ('e0000000-0000-0000-0000-000000000468', 'Early Childhood Development Studies',                                            'interior', 'specialised_interior', 19),
  ('e0000000-0000-0000-0000-000000000469', 'Child Care & Early Years Course',                                                'interior', 'specialised_interior', 20),
  ('e0000000-0000-0000-0000-000000000470', 'Intensive Floristry Course',                                                     'interior', 'specialised_interior', 21),
  ('e0000000-0000-0000-0000-000000000471', 'Hairdressing Diploma / Course',                                                  'interior', 'specialised_interior', 22),
  ('e0000000-0000-0000-0000-000000000472', 'Beautician / Nail Technician',                                                   'interior', 'specialised_interior', 23),
  ('e0000000-0000-0000-0000-000000000473', 'Registered Doctor',                                                              'interior', 'specialised_interior', 24),
  ('e0000000-0000-0000-0000-000000000474', 'Registered Paramedic',                                                           'interior', 'specialised_interior', 25),
  ('e0000000-0000-0000-0000-000000000475', 'Registered Nurse',                                                               'interior', 'specialised_interior', 26),
  ('e0000000-0000-0000-0000-000000000476', 'Professional Superyacht Hospitality (International Yacht Training)',             'interior', 'specialised_interior', 27),
  ('e0000000-0000-0000-0000-000000000477', 'Yacht Interior Service (YIS) — Level 1 (Bluewater Training)',                    'interior', 'specialised_interior', 28),
  ('e0000000-0000-0000-0000-000000000478', 'Yacht Interior Service (YIS) — Level 2 (Bluewater Training)',                    'interior', 'specialised_interior', 29),
  ('e0000000-0000-0000-0000-000000000479', 'Interior Excellence (TCA)',                                                      'interior', 'specialised_interior', 30),
  ('e0000000-0000-0000-0000-000000000480', 'Pure Service Excellence (TCA)',                                                  'interior', 'specialised_interior', 31),
  ('e0000000-0000-0000-0000-000000000481', 'Introductory Relaxing Massage Course (Bluewater Training)',                      'interior', 'specialised_interior', 32);

-- ---------- Galley (16 total, flat; 1 preserved: 006=HABC L2) ----------
-- 15 new rows

insert into public.certifications (id, name, category, subcategory, sort_order) values
  ('e0000000-0000-0000-0000-000000000500', 'Culinary Certificate(s)',                                                        'galley', null, 1),
  ('e0000000-0000-0000-0000-000000000501', 'Certificate in Professional Cookery & Culinary Arts (1-6 mths)',                 'galley', null, 2),
  ('e0000000-0000-0000-0000-000000000502', 'Intermediate Culinary Diploma (6 mths+)',                                        'galley', null, 3),
  ('e0000000-0000-0000-0000-000000000503', 'Professional Culinary Diploma (6 mths - 2 years+)',                              'galley', null, 4),
  ('e0000000-0000-0000-0000-000000000504', 'Professional Culinary Degree / Master''s (1-2 years+)',                          'galley', null, 5),
  ('e0000000-0000-0000-0000-000000000505', 'Apprenticeship / Culinary School (2-5+ years)',                                  'galley', null, 6),
  ('e0000000-0000-0000-0000-000000000506', 'WorldChefs / PYA Certified Professional Chef / Chef de Partie (Yacht Chef Award Level 1)', 'galley', null, 7),
  ('e0000000-0000-0000-0000-000000000507', 'WorldChefs / PYA Certified Sous Chef (Yacht Chef Award Level 2)',                'galley', null, 8),
  ('e0000000-0000-0000-0000-000000000508', 'WorldChefs / PYA Certified Chef de Cuisine (Yacht Chef Award Level 3)',          'galley', null, 9),
  ('e0000000-0000-0000-0000-000000000509', 'Food Hygiene (HABC Level 3)',                                                    'galley', null, 11),
  ('e0000000-0000-0000-0000-000000000510', 'UKHSE Management of Food Safety in Catering',                                    'galley', null, 12),
  ('e0000000-0000-0000-0000-000000000511', 'Award Food Safety in Catering',                                                  'galley', null, 13),
  ('e0000000-0000-0000-0000-000000000512', 'Award Supervising Food Safety in Catering',                                      'galley', null, 14),
  ('e0000000-0000-0000-0000-000000000513', 'Managing Food Safety in Catering',                                               'galley', null, 15),
  ('e0000000-0000-0000-0000-000000000514', 'Ship''s Cook Certificate',                                                       'galley', null, 16);

-- ---------- Watersports & Diving (17 total, flat; 1 preserved: 020=PADI Divemaster) ----------
-- 16 new rows

insert into public.certifications (id, name, category, subcategory, sort_order) values
  ('e0000000-0000-0000-0000-000000000600', 'PADI Open Water',                                                                'watersports', null, 1),
  ('e0000000-0000-0000-0000-000000000601', 'PADI Advanced Open Water',                                                       'watersports', null, 2),
  ('e0000000-0000-0000-0000-000000000602', 'PADI Rescue Diver (Emergency First Response)',                                   'watersports', null, 3),
  ('e0000000-0000-0000-0000-000000000603', 'PADI Master Scuba Diver',                                                        'watersports', null, 4),
  ('e0000000-0000-0000-0000-000000000604', 'PADI Instructor Development Course (IDC)',                                       'watersports', null, 5),
  ('e0000000-0000-0000-0000-000000000605', 'PADI Master Instructor',                                                         'watersports', null, 7),
  ('e0000000-0000-0000-0000-000000000606', 'Train the Trainer (IMO)',                                                        'watersports', null, 8),
  ('e0000000-0000-0000-0000-000000000607', 'Watersports Instructor',                                                         'watersports', null, 9),
  ('e0000000-0000-0000-0000-000000000608', 'Waterski / Wakeboard Instructor',                                                'watersports', null, 10),
  ('e0000000-0000-0000-0000-000000000609', 'Kitesurfing Instructor',                                                         'watersports', null, 11),
  ('e0000000-0000-0000-0000-000000000610', 'Efoil Instructor',                                                               'watersports', null, 12),
  ('e0000000-0000-0000-0000-000000000611', 'Surfing Instructor',                                                             'watersports', null, 13),
  ('e0000000-0000-0000-0000-000000000612', 'Yoga / Pilates Instructor',                                                      'watersports', null, 14),
  ('e0000000-0000-0000-0000-000000000613', 'Fitness Instructor (PT)',                                                        'watersports', null, 15),
  ('e0000000-0000-0000-0000-000000000614', 'Fishing Specialist',                                                             'watersports', null, 16),
  ('e0000000-0000-0000-0000-000000000615', 'Lifeguard',                                                                      'watersports', null, 17);

-- ---------- Helideck (4 new, flat) ----------

insert into public.certifications (id, name, category, subcategory, sort_order) values
  ('e0000000-0000-0000-0000-000000000700', 'MCA Large Yacht Helideck Procedures & Emergency Response',                       'helideck', null, 1),
  ('e0000000-0000-0000-0000-000000000701', 'MCA Large Yacht Helideck Fire Fighting',                                         'helideck', null, 2),
  ('e0000000-0000-0000-0000-000000000702', 'Helicopter Landing Officer (HLO)',                                               'helideck', null, 3),
  ('e0000000-0000-0000-0000-000000000703', 'Helicopter Landing Assistant (HLA)',                                             'helideck', null, 4);

-- ---------- Other (3 new, flat) ----------

insert into public.certifications (id, name, category, subcategory, sort_order) values
  ('e0000000-0000-0000-0000-000000000800', 'Washdown Course',                                                                'other', null, 1),
  ('e0000000-0000-0000-0000-000000000801', 'Tender Operations Course',                                                       'other', null, 2),
  ('e0000000-0000-0000-0000-000000000802', 'Exterior Polishing Course',                                                      'other', null, 3);

-- =====================================================================
-- Step 3: Supporting index for picker queries
-- =====================================================================

create index if not exists idx_certifications_category_subcategory
  on public.certifications (category, subcategory, sort_order);
