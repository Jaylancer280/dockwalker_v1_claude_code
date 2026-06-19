-- Certification Bundles V1 — bundle/component model for cert matching
--
-- Real-world maritime training is sometimes sold as a single bundled
-- certificate covering multiple individual STCW competencies. Examples:
--   * AEC 1+2 — single MCA cert covering both AEC 1 and AEC 2 modules
--   * STCW 95 / STCW 2010 — single basic safety cert covering five
--     individual competencies (PST, FPFF, EFA, PSSR, Medical First Aid)
--
-- Without bundle awareness, a candidate who holds AEC 1+2 cannot apply
-- to a job that lists AEC 1 and AEC 2 as separate requirements — the
-- direct UUID intersection fails. Forcing them to add all three certs
-- to their profile (the bundle PLUS each component) inflates cert
-- count and duplicates truth.
--
-- This migration introduces a junction table mapping bundle certs to
-- their component certs, and seeds the two bundles above. Application
-- code reads this table to expand a candidate's bundles into their
-- covered components when matching against a posting's required certs.
--
-- Direction: bundle → components (one-way). A candidate with the bundle
-- satisfies any required component. A candidate holding only components
-- does NOT automatically satisfy a required bundle (strict v1; symmetric
-- expansion may be added later if real users complain).

create table if not exists public.certification_components (
  bundle_cert_id    uuid not null references public.certifications(id) on delete cascade,
  component_cert_id uuid not null references public.certifications(id) on delete cascade,
  primary key (bundle_cert_id, component_cert_id),
  check (bundle_cert_id != component_cert_id)
);

alter table public.certification_components enable row level security;

create policy "Anyone authenticated can read certification_components"
  on public.certification_components for select
  using (auth.role() = 'authenticated');

-- No INSERT/UPDATE/DELETE policies for authenticated users. Admin
-- writes go through the canonical CRUD admin route using the service
-- role client, same pattern as other lookup tables.

-- ============================================================================
-- Seeds
-- ============================================================================

-- AEC 1+2 bundle — covers AEC 1 and AEC 2 individually.
-- Bundle:    e0000000-0000-0000-0000-000000000015 = "MCA Approved Engine Course (AEC 1 & 2) Certificate"
-- Component: e0000000-0000-0000-0000-000000000321 = "MCA Approved Engine Course (AEC 1)"
-- Component: e0000000-0000-0000-0000-000000000322 = "MCA Approved Engine Course (AEC 2)"
--
-- Existence-guarded inserts: skip the row if either cert is absent (e.g.
-- on CI Database Checks, which runs migrations on a fresh DB without
-- the canonical-data seeds). Live + staging both have the seed loaded,
-- so the rows insert normally there.
insert into public.certification_components (bundle_cert_id, component_cert_id)
select b.id, c.id
from public.certifications b, public.certifications c
where b.id = 'e0000000-0000-0000-0000-000000000015'
  and c.id in (
    'e0000000-0000-0000-0000-000000000321',
    'e0000000-0000-0000-0000-000000000322'
  )
on conflict (bundle_cert_id, component_cert_id) do nothing;

-- STCW 95 / STCW 2010 bundle — covers five individual basic competencies.
-- Bundle:    e0000000-0000-0000-0000-000000000001 = "STCW 95 (STCW 2010)"
-- Components per A-VI:
--   103 = Personal Survival Techniques (A-VI/1-1)
--   104 = Fire Prevention & Fire Fighting (A-VI/1-2)
--   105 = Elementary First Aid (A-VI/1-3)
--   106 = Personal Safety & Social Responsibilities (A-VI/1-4)
--   110 = Proficiency in Medical First Aid (A-VI/4 1-3)
insert into public.certification_components (bundle_cert_id, component_cert_id)
select b.id, c.id
from public.certifications b, public.certifications c
where b.id = 'e0000000-0000-0000-0000-000000000001'
  and c.id in (
    'e0000000-0000-0000-0000-000000000103',
    'e0000000-0000-0000-0000-000000000104',
    'e0000000-0000-0000-0000-000000000105',
    'e0000000-0000-0000-0000-000000000106',
    'e0000000-0000-0000-0000-000000000110'
  )
on conflict (bundle_cert_id, component_cert_id) do nothing;
