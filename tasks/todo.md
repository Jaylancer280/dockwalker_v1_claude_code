# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

### Qualifications V1 — expand canonical cert list + shared picker

> Spec: `tasks/qualifications-v1.md` (17 → ~265 canonical certs, 8 categories with drill-down sub-cats, shared `CertificationPicker` component). Expiry-date tracking deferred to V1.1.

**Phase A — Schema & canonical data**

- [x] Write migration `supabase/migrations/00100_certifications_v1_expansion.sql`
- [x] Write rollback `supabase/rollbacks/00100_certifications_v1_expansion.down.sql`
- [x] Apply: `npx supabase db push`
- [x] Verify via Supabase SQL editor (migration applied cleanly; canonical seed reflects V1 taxonomy)
- [x] Update `supabase/seed/001_canonical_data.sql` CERTIFICATIONS block

**Phase B — Shared types & grouping**

- [x] Extend `CertLookup` type with `subcategory` (use-lookups.tsx + mobile stub not touched)
- [x] `packages/shared/src/grouping.ts`: add `groupCertsByCategoryAndSubcategory(certs)`
- [x] `packages/shared/src/cert-labels.ts` (new): display labels for category + subcategory keys
- [x] Unit tests covering flat + drill-down paths

**Phase C — Shared CertificationPicker component**

- [x] Create `apps/web/src/components/certification-picker.tsx`
- [x] Component test `apps/web/__tests__/components/certification-picker.test.tsx`

**Phase D — Wire the picker into every surface**

- [x] `app/onboarding/_components/profile-step.tsx`
- [x] `app/(app)/profile/_components/profile-edit-form.tsx`
- [x] `app/(app)/daywork/post/page.tsx`
- [x] `app/(app)/daywork/post/_components/permanent-form-sections.tsx`
- [x] `app/(admin)/admin/canonical/page.tsx` — add `subcategory` input
- [x] Discover filter (daywork-browse) — left as-is; single-select cert filter semantics diverge from multi-select picker. Noted for V1.1.

**Phase E — Verify & document**

- [x] `turbo run type-check lint` — 0 errors
- [x] `cd apps/web && npx vitest run` — 1072 tests pass
- [x] Update `packages/shared/README.md`
- [x] Update `supabase/README.md` — append migration 00100
- [x] Update `BUILD_STATE.md` — stage entry, schema version bump to 100, deferred decision (expiry V1.1)

---

### Imagery rollout — maritime feel + empty-state completeness (deferred — returning after V1 batch)

> From Stage 214 session. Full audit of imagery opportunities across the app. Work item-by-item; confirm surface, copy, and photo choice with user before each commit. Assets: `apps/web/public/images/{empty-states,onboarding,departments,brand}/` plus stock in top-level `assets/images/`.

**Already wired — do not touch unless copy changes**

- `discover.jpg` → `daywork-browse.tsx` "No jobs found" empty state
- `docky.jpg` → `docky/page.tsx` pre-first-message state (direct `<Image>`, bypasses `EmptyState`)
- `messages.jpg` → `messages/page.tsx` Active tab "No active messages" empty state
- `vessels.jpg` → `vessels/page.tsx` "No vessels yet" empty state
- `departments/*.jpg` → job card backgrounds (Stage 174)
- Onboarding welcome (`hero-lounge`), hat selection (`crew-rope` + `vessel-helm-chair` inline)

---

#### A. Empty-state wire-ups

- [ ] **Profile orphan — `profile.jpg` has no home.** Decide spot with user, then wire in: (a) `profile/view/[personId]/page.tsx` for deactivated / data-scrubbed users, (b) own-profile view when Experience + Shore Experience + About are all empty, or (c) a new "profile not found" state.
- [ ] **Applied tab** → swap icon for `/images/empty-states/discover.jpg`. File: `apps/web/src/app/(app)/discover/_components/applied-tab.tsx` ~line 107. `imageSrc` supersedes the `ClipboardList` icon automatically.
- [ ] **Permanent job feed** → swap icon for `/images/empty-states/discover.jpg`. File: `apps/web/src/app/(app)/discover/_components/permanent-job-feed.tsx` ~line 357.
- [ ] **Invitations tab** → swap icon for `/images/empty-states/messages.jpg` (mood match — waiting for contact). File: `apps/web/src/app/(app)/discover/_components/invitations-tab.tsx` ~line 67. Skip if `messages.jpg` feels off-brief.

#### B. Ambient / hero / side imagery (desktop-only, reuses existing assets)

- [ ] **Auth ambient background** — low-opacity overlay of `hero-bow` or `crew-rope` behind the centered card on all four auth pages. Files: `auth/login/page.tsx`, `auth/signup/page.tsx`, `auth/forgot-password/page.tsx`, `auth/reset-password/page.tsx`. Replace (or layer under) the current radial gradient. Use single photo across all four for consistency; darken overlay so form contrast is preserved. Mobile: no change — keep current solid/radial treatment.
- [ ] **Landing hero side illustration** — 180–240px `hero-bow` or `vessel-helm` inserted into the right side of the md+ flex-row in `apps/web/src/app/page.tsx`. First verify what's currently there — earlier exploration reported a 2x crew/vessel image row in "how it works"; audit whether the hero zone itself has dead space before adding.
- [ ] **Messages list hero strip** — 60px `messages.jpg` (reuse existing empty-state asset) above the page header on md+. File: `apps/web/src/app/(app)/messages/page.tsx`. Pairs visually with the already-wired empty state when list is populated.
- [ ] **Permanent feed + Invitations tab hero strip** — 60px `discover.jpg` above the tab section on md+. Files: `discover/_components/permanent-job-feed.tsx`, `discover/_components/invitations-tab.tsx`. Currently text-only headers with desktop whitespace.
- [ ] **Profile desktop side illustration** — `crew-rope` or `vessel-helm-chair` beside the QuickStats sidebar on lg+. File: `apps/web/src/app/(app)/profile/page.tsx`. Medium density risk — sketch placement and review with user before committing.

#### C. Optional lower-priority spots (flagged for later)

- [ ] **404 page** ambient background — sparse centred page is a good ambient-overlay candidate. File: `apps/web/src/app/not-found.tsx`.
- [ ] **Billing page** — subtle ambient behind the tier cards on md+. File: `apps/web/src/app/(app)/billing/page.tsx`.
- [ ] **Vessels page** hero strip — 60px `vessel-helm` above the vessel list on md+. File: `apps/web/src/app/(app)/vessels/page.tsx`.
- [ ] **Notifications page** hero strip — 60px, desktop-only. File: `apps/web/src/app/(app)/notifications/page.tsx`.

#### D. Consistency / refactor note

- [ ] `docky/page.tsx` uses a hand-rolled `<Image>` because `EmptyState` doesn't support the usage pill + suggestion chips. Only worth extending `EmptyState` if we add more bespoke empty states later.

#### Explicit do-not-touch (information-dense surfaces)

- Chat page (`messages/[engagementId]`)
- All forms: daywork post, permanent post, profile edit, settings, vessel form, experience form
- Legal pages `/privacy`, `/terms`
- Filter panels
- Job cards within scrollable lists
- Permanent job detail modal / overlay
- Notifications list rows
- Daywork mine (active / in-progress / completed / templates sections — employer workflow, icon conveys state faster)
- Market feed (agent) — functional tool
- Messages History tab empty state — terminal state, icon is fine

#### Verification per item

- [ ] Reload affected page in dev; confirm image renders (not 404, no layout shift)
- [ ] Confirm copy still fits in the 400×180 image block (for empty states) or doesn't collide with content (for hero strips)
- [ ] Check both mobile and desktop breakpoints — desktop-only additions must not render on `<md`
- [ ] Run `npm run test` + `turbo run type-check lint` before commit

---

## Queue

### Locations V1 — global marina dataset + scaling LocationPicker

> Spec: `tasks/marina-locations-prompt.md` (OSM extraction pipeline → ~15-25K marinas imported into `regions`/`cities`/`ports` with UUID preservation). Ship certs first (simpler) then use its implementation as a reference for parts of this work.

**Coupling warning:** Phase D (data import) must not merge to production before Phase E (picker scaling) is live. Importing 20K ports without a scaled picker will break every location-selection surface on first page load (multi-MB eager-fetch fails). Plan the merge order accordingly.

**Phase A — Python extraction pipeline**

- [ ] Create `scripts/marina-extraction/` directory with the four Python scripts, `README.md`, `requirements.txt` (per spec § Directory layout)
- [ ] Add `scripts/marina-extraction/data/` to root `.gitignore`
- [ ] Implement Stage 1 (`1_extract_marinas.py`): Overpass queries across the 30 bounding-box regions with mirror rotation, retries, resumability, `--regions X,Y` flag
- [ ] Implement Stage 2 (`2_enrich_locations.py`): Nominatim reverse geocoding with `accept-language=en`, tags-first fallback, disk cache flushed every 50 records, town priority `city → town → village → municipality → county → suburb`, non-Latin name acceptance
- [ ] Implement Stage 3 (`3_finalize.py`): dedup on `(country_code, town, name)` normalised, richness-scored keep, ISO-3166-1 English country canonicalization, hub sanity table in `report.txt`
- [ ] Implement Stage 4 (`4_generate_migration.py`): live-DB snapshot helper, hardcoded baselines (ORIGINAL_REGIONS/CITIES/PORTS + CARIBBEAN_CITY_TO_COUNTRY), region UUID regeneration via `uuid5(NS_REGIONS, country_code.upper())`, city/port match-then-enrich, alphabetical `sort_order` defaults, idempotency guard
- [ ] All four scripts parse clean: `python -m py_compile scripts/marina-extraction/*.py`
- [ ] Stage 1 smoke test: run with `--regions europe_west` only, confirm `data/regions/europe_west.json` populated

**Phase B — Preparatory schema migration**

- [ ] Write migration `supabase/migrations/NNNNN_locations_v1_preparatory.sql`:
  - `alter table public.regions add column country_code char(2) null`
  - `alter table public.ports add column latitude numeric(9,6), longitude numeric(9,6), osm_type text check (osm_type in ('node','way','relation')), osm_id bigint, website text, phone text, capacity text, vhf text` — all null
  - `create index idx_ports_lat_lon on public.ports (latitude, longitude) where latitude is not null`
  - `create unique index idx_ports_osm on public.ports (osm_type, osm_id) where osm_id is not null`
- [ ] Write rollback `supabase/rollbacks/NNNNN_locations_v1_preparatory.down.sql` — drop indexes then columns in reverse order
- [ ] Apply: `npx supabase db push`
- [ ] Verify existing RLS policies still cover new columns (they should — authenticated-read is table-level, not column-level)

**Phase C — Execute extraction (external runtime, not CI)**

- [ ] Run Stage 1: `python 1_extract_marinas.py` (expect 20-40 min across 30 regions)
- [ ] Run Stage 2: `python 2_enrich_locations.py` (expect several hours on first run; subsequent re-runs are cached and fast)
- [ ] Run Stage 3: `python 3_finalize.py` (seconds)
- [ ] Inspect `data/report.txt`: hub sanity table must show Monaco ≥1, Antibes ≥3, Palma ≥5, Fort Lauderdale ≥20, Göcek ≥3, Antigua ≥3. If any fails: stop and investigate before proceeding.
- [ ] Spot-check the CSV: `grep -i "port vauban\|atlantis\|yacht haven" data/marinas.csv` — confirm existing curated ports found in OSM

**Phase D — Data import migration**

- [ ] Pull live DB snapshot: run Stage 4's snapshot helper against the linked Supabase project → `data/existing_state.json`
- [ ] Run Stage 4: `python 4_generate_migration.py` → `data/migration/NNNNN_marinas_v1_expansion.sql` + `.down.sql`
- [ ] Review generated SQL manually: confirm (1) 7 original region UUIDs deleted after cities re-parented, (2) 29 city UUIDs preserved with updated `region_id`, (3) 67 port UUIDs preserved with enriched metadata, (4) new rows use UUIDv5
- [ ] Copy SQL files to `supabase/migrations/` and `supabase/rollbacks/` with correct sequential number
- [ ] Apply: `npx supabase db push`
- [ ] Verify via SQL editor: `select count(*) from regions`, `select count(*) from cities`, `select count(*) from ports` match Stage 4's printed summary
- [ ] Verify UUID preservation: `select id from ports where id in (<original 67 port UUIDs>)` returns exactly 67 rows
- [ ] **Idempotency check:** re-run Stage 4 → generated migration must contain zero INSERTs and only unchanged UPDATEs (or empty file with comment). Blocker if re-run produces real deltas.

**Phase E — LocationPicker scaling + fuzzy search (P0, blocks D's production deploy)**

- [ ] Enable PostgreSQL extensions in Supabase: `create extension if not exists unaccent; create extension if not exists pg_trgm;` (new migration or preparatory addendum)
- [ ] Create `apps/web/src/app/api/locations/search/route.ts`: accepts `?q=<query>`, returns top-50 ranked fuzzy matches across regions/cities/ports. Query: `similarity(unaccent(lower(name)), unaccent(lower($1))) > 0.3` ranked by score DESC, limit 50
- [ ] Create `apps/web/src/app/api/locations/top/route.ts`: returns top-N most-used ports by count of references in `profiles.location_port_id`, `dayworks.location_port_id`, `permanent_postings.port_id`. Used for the picker's empty-state list
- [ ] Refactor `apps/web/src/components/location-picker.tsx`:
  - Remove eager load of all `regions`/`cities`/`ports`
  - Load top-N ports via `/api/locations/top` on open
  - Typeahead hits `/api/locations/search` after 2 chars (debounce 200ms)
  - Diacritic-insensitive rendering: show "Göcek" as matched when user typed "Gocek"
  - Helper text under picker: _"Can't find your port? Pick the closest one."_
  - No-results state: _"No match — try the nearest city or port instead."_
  - Keep `port-required` / `port-optional` modes unchanged
  - ODbL attribution: add info tooltip/hint "© OpenStreetMap contributors" at the bottom of the popover
- [ ] Remove `ports` + `cities` from `apps/web/src/hooks/use-lookups.tsx` context and cache
- [ ] Find every consumer that reads `useLookups().ports` or `.cities` (grep): refactor to use picker props or a direct fetch. Label resolution (given a `port_id`, display "Port Vauban — Antibes, France") goes through a server endpoint or an added `/api/locations/by-ids` route
- [ ] Component test: renders top ports on focus, typing filters via API, no-results shows the helper copy, diacritic query matches
- [ ] Integration test: `/api/locations/search?q=gocek` returns Göcek results

**Phase F — Admin canonical CRUD adjustments**

- [ ] `apps/web/src/app/(admin)/admin/canonical/page.tsx`:
  - Region form: add `country_code` input (required, char(2), validate against ISO-3166-1 alpha-2 list)
  - Port form: add `latitude`/`longitude` numeric inputs, `osm_type` select (node/way/relation), `osm_id` number, `website`/`phone`/`capacity`/`vhf` text — all optional
  - City form: add country dropdown sourced from `regions` (replaces raw region_id typing)

**Phase G — Verify & document**

- [ ] `turbo run type-check lint` — zero errors
- [ ] `cd apps/web && npx vitest run` — all pass
- [ ] `cd apps/web && npm run test:integration` — all pass
- [ ] Manual smoke test (per `tasks/lessons.md` post-migration procedure): onboarding with new marina selection, daywork post, permanent post, availability set, agent placement cities, profile edit — every surface works with new picker
- [ ] Update `apps/web/README.md` — new `/api/locations/search`, `/api/locations/top` routes, PostgreSQL extension requirements
- [ ] Update `packages/types/README.md` — region gains `country_code`, port gains `latitude/longitude/osm_type/osm_id/website/phone/capacity/vhf`
- [ ] Update `supabase/README.md` — two new migrations (preparatory + marinas), new extensions
- [ ] Update `BUILD_STATE.md` — new stage entry, schema version bump, migration table, any new deferred decisions

**Out of scope / explicitly deferred (V1.1)**

- `location_collections` editorial-groupings table (spec § Follow-up #2)
- Admin OSM-ID pre-fill button (spec § Follow-up #3)
- Proximity sort on daywork discover using new `latitude`/`longitude` (spec § Follow-up #4)
- OSM re-sync cadence automation (spec § Follow-up #5) — manual for now
- Mobile (`apps/mobile/` blocked)
- Free-text "request a port" user flow — **explicitly rejected**, admin-adds-via-canonical-CRUD is the only path

---

### Entry Rights V1 — replace `visa_types` with citizenship/residence/visa model

> Spec: `tasks/country-entry-rights-visas.md` (10 mixed-scope visa rows → 24 canonical entry rights in 3 categories). Profile-side only at launch — **no job-side requirement field**. Scope is much smaller than certs and locations; likely a single PR.

**Phase A — Schema & canonical data**

- [ ] Write migration `supabase/migrations/NNNNN_entry_rights.sql`:
  - Before any rename: `UPDATE public.profiles SET visa_ids = <cleaned array>` stripping the 5 deleted visa UUIDs (UK Work Visa, Canadian Work Permit, Bahamian Work Permit, Thai Work Permit, Other)
  - `alter table public.visa_types rename to entry_rights`
  - `alter table public.entry_rights add column category text not null default 'visa' check (category in ('citizenship', 'residence', 'visa'))`
  - `alter table public.entry_rights drop column region`
  - UPDATE 5 preserved rows: rename + set correct category (Schengen→visa, US B1/B2→visa, US C1/D→visa, Australian MCV→visa, UAE Residence Visa→residence)
  - DELETE 5 work-permit/Other rows (UUIDs explicit)
  - INSERT 19 new rows with fresh UUIDs, correct category, alphabetical sort_order within category
  - `alter table public.profiles rename column visa_ids to entry_right_ids`
  - `create index idx_entry_rights_category on public.entry_rights (category, sort_order)`
  - `drop policy "Authenticated users can read visa_types" on public.entry_rights; create policy "Authenticated users can read entry_rights" on public.entry_rights for select to authenticated using (true)`
  - Update `apply_projection` PROFILE.CREATED + PROFILE.UPDATED handlers to `coalesce(payload->'entry_right_ids', payload->'visa_ids')`, with deleted-UUID filter applied inside the coalesce so replays of pre-migration events don't reintroduce dropped rows

- [ ] Write rollback `supabase/rollbacks/NNNNN_entry_rights.down.sql`:
  - Rename column back to `visa_ids`
  - Rename table back to `visa_types`
  - Drop category + drop index
  - Re-add `region` column (text, nullable)
  - DELETE the 19 new rows
  - UPDATE the 5 preserved rows back to original names (Schengen, B1/B2 (US), C1/D (US), Australian Work Visa, UAE Residence Visa)
  - INSERT the 5 deleted rows with their original UUIDs (UK Work Visa, Canadian Work Permit, Bahamian Work Permit, Thai Work Permit, Other) — hardcoded baseline
  - Restore original RLS policy name
  - Restore `apply_projection` to original (fallback to `visa_ids` only)
  - Note: profile arrays that had dropped UUIDs stripped cannot be restored — surface as a known one-way data loss in the rollback header comment

- [ ] Apply: `npx supabase db push`
- [ ] Verify: `select category, count(*) from entry_rights group by 1` returns `{citizenship: 6, residence: 7, visa: 11}`
- [ ] Verify: `select id from entry_rights where id in (<5 preserved UUIDs>)` returns exactly 5 rows

**Phase B — Shared types & picker**

- [ ] Update `apps/web/src/hooks/use-lookups.tsx`:
  - Rename `VisaTypeLookup` → `EntryRightLookup` (fields: `id, name, category`)
  - Rename `visaTypes` context field → `entryRights`
  - Update Supabase query: `supabase.from('entry_rights').select('id, name, category').order('category').order('sort_order')`
  - Update cache structure (localStorage key bumps automatically on new cache shape due to stale-check)
- [ ] Create `apps/web/src/components/entry-right-picker.tsx`:
  - Props: `selectedIds: string[]`, `onChange: (ids: string[]) => void`
  - Renders dropdown with 3 category headers (Citizenship / Residence / Visa), pills under each
  - Fuzzy search identical to cert picker — case + punctuation insensitive substring match
  - Selected entries as removable pills above the picker
  - Helper copy: _"Select all that apply — more entries means you can enter more hubs."_
  - Disclaimer line at bottom of popover: _"Self-declared. DockWalker does not verify documents."_
- [ ] Component test `apps/web/__tests__/components/entry-right-picker.test.tsx`:
  - Renders three category sections
  - Typing filters across categories
  - Click toggles selection
  - Punctuation-insensitive: query "us b1b2" finds "US B1/B2"

**Phase C — Wire into every surface that read `visa_ids` / `visaTypes`**

- [ ] `apps/web/src/app/onboarding/_components/profile-step.tsx` — replace inline visa pills with `<EntryRightPicker>`, rename `visaIds` state → `entryRightIds`
- [ ] `apps/web/src/app/onboarding/page.tsx` — rename field references, payload key `visa_ids` → `entry_right_ids` on POST
- [ ] `apps/web/src/app/(app)/profile/page.tsx` — same rename
- [ ] `apps/web/src/app/(app)/profile/_components/profile-edit-form.tsx` — replace inline picker with `<EntryRightPicker>`
- [ ] `apps/web/src/app/(app)/profile/_components/profile-summary-section.tsx` — display renamed field, group pills by category
- [ ] `apps/web/src/app/(app)/profile/_components/profile-about-section.tsx` — display renamed field
- [ ] `apps/web/src/app/(app)/profile/_components/agent-profile-section.tsx` — rename `visa_ids`/`visaTypes` props and display
- [ ] `apps/web/src/components/profile-overlay.tsx` — rename display field
- [ ] `apps/web/src/app/api/onboarding/route.ts` — accept `entry_right_ids` in request body, emit `entry_right_ids` in PROFILE.CREATED payload
- [ ] `apps/web/src/app/api/profile/route.ts` — accept + emit renamed field on PROFILE.UPDATED
- [ ] `apps/web/src/app/api/profile/[personId]/route.ts` — return renamed field in response
- [ ] `apps/web/src/app/api/permanent/[id]/review/route.ts` — return renamed field in applicant payload
- [ ] `apps/web/src/app/(admin)/admin/canonical/page.tsx` — update TABLES constant: replace `'visa_types'` with `'entry_rights'`; ensure the CRUD form handles the new `category` column (required dropdown: citizenship/residence/visa)
- [ ] `apps/web/src/app/privacy/page.tsx` — update visa-reference copy to entry-rights framing; add self-declaration disclaimer
- [ ] Grep sweep: `grep -r "visa_ids\|visaTypes\|visa_types" apps/web/src supabase/migrations` — every hit must be accounted for (active = renamed, historical migrations = left alone)

**Phase D — Verify & document**

- [ ] `turbo run type-check lint` — zero errors across web + packages
- [ ] `cd apps/web && npx vitest run` — all tests pass (update any tests referencing `visa_types` / `visa_ids` / `visaTypes`)
- [ ] `cd apps/web && npm run test:integration` — all pass
- [ ] Post-migration smoke test (per `tasks/lessons.md` procedure):
  - `npx supabase db reset` → onboarding creates a crew with 3 entry-rights across all 3 categories → profile edit reorders and removes one → profile summary shows correct grouping → admin canonical page shows entry_rights CRUD
  - Verify historical event replay: after reset, existing seeded events flow through the coalesce handler correctly; any pre-migration `visa_ids` payload with a dropped UUID does NOT reintroduce that UUID
- [ ] Update `packages/types/README.md` if shared types referenced `VisaType` (likely not — visa types only lived in `use-lookups.tsx`)
- [ ] Update `apps/web/README.md` — mention entry_rights table in the canonical lookups section
- [ ] Update `supabase/README.md` — new migration entry
- [ ] Update `BUILD_STATE.md` — new stage entry, schema version bump, migration table

**Out of scope / explicitly deferred (V1.1+)**

- Job-side requirement field (`required_entry_right_ids` on dayworks + permanent_postings + templates) — **per user's launch scope**
- Hub → entry-rights auto-suggest
- Multiple nationality support (keep `nationality_id` singular)
- Document upload / verification workflow
- Expiry-date tracking per entry right (parallel to cert expiry V1.1 item)
- Mobile (`apps/mobile/` blocked)

---

## BLOCKED — user action required

### Legal pages go-live (Stage 214)

`/privacy` and `/terms` pages are built and live but rendering placeholders. Before public launch:

- [ ] Lawyer review of `/privacy` and `/terms` (source drafts: `tasks/privacy-policy-spec.md` + `tasks/founder-drafts.md` §1)
- [ ] Fill `apps/web/src/lib/legal-placeholders.ts`:
  - `companyName` — confirm legal entity (currently "Nautalink Technologies, Inc." — provisional)
  - `registeredAddress` — registered office address
  - `jurisdiction` — governing law, e.g. "England and Wales"
  - `supportEmail` — confirm inbox (currently `support@dockwalker.io`)
  - `dpoEmail` — confirm DPO inbox (currently `privacy@dockwalker.io`)
  - `supabaseRegion` — primary DB region, e.g. "EU (Frankfurt)"
- [ ] Decide: cookie consent banner needed for target jurisdictions? (Functional cookies only — likely not required under GDPR, but check local law)

### Stripe setup

- [x] Test mode: products, prices, test webhook (`https://www.dockwalker.io/api/webhooks/stripe`), and test env vars all configured. Full checkout → webhook → DB upsert → Crew Pro entitlement unlock verified end-to-end against real Vercel deployment.
- [ ] Live mode go-live: (1) toggle Stripe Workbench to live mode, (2) recreate Crew Pro + Employer Pro products + prices, (3) point the existing live webhook at `https://www.dockwalker.io/api/webhooks/stripe` (the live one was created against the apex and will 307), (4) swap `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_CREW_PRO`, `STRIPE_PRICE_EMPLOYER_PRO` in Vercel Production env vars for live values, (5) redeploy.
- [ ] Set `NEXT_PUBLIC_APP_URL=https://www.dockwalker.io` in Vercel Production env vars (currently falls back to `http://localhost:3000` — checkout still works because the apex-to-www redirect absorbs the broken URL, but it's one extra hop and masks future bugs).

### WhatsApp setup

- [ ] Get dedicated number (prepaid SIM or Google Voice for Workspace)
- [ ] Register with Meta Cloud API directly (not Twilio)
- [ ] Swap Twilio dispatcher for Meta Graph API calls
- [ ] Submit templates for Meta approval

### Voice calling — browser testing (manual)

- [ ] Chrome desktop + Android
- [ ] Firefox
- [ ] Safari macOS + iOS
- [ ] Glare resolution, network drop, background tab, multi-tab, offline user, busy signal, hangup during navigation

---

## Backlog

> Active backlog. Pick items into Queue when ready.

### Business logic / server-side

- **Permanent crew withdrawal auto-revert** — employer should decide next step, not auto-revert.
- **Onboarding true atomicity** — `onboard_person` RPC should be fully atomic.
- **Negotiation timeout** — auto-close permanent engagements after X days inactivity.
- **Weekly check-in cron** — periodic nudge for permanent postings with no employer activity.
- **Deactivated user server-side sign-out** — force session invalidation on PERSON.DEACTIVATED.
- **CSRF origin validation** — add origin check middleware for POST/PATCH/DELETE routes (defense-in-depth, mitigated by SameSite cookies).

### Web-only UI

- **Agent market as discover mode** — let agents browse full market feed.
- **Form validation — styled inline errors** — replace browser-native validation (SUG-012). (Partially addressed by P1-A inline validation.)
- **Invalid URL error pages** — custom error pages for garbage URLs (SUG-013).
- **Edit experience "Unknown vessel" prefix** — seed data issue (SUG-017).
- **Applicant count badge on My Jobs**.
- **Discover filter chips**.
- **Notifications grouping**.
- **Email: List-Unsubscribe header**.
- **Share button on discover cards (crew view)** — secondary placement.
- **Admin identity type change** — deferred, medium-high effort, admin-only.
- **Chat page server-rendering** — stream context/messages server-side instead of client-side spinners.
- **Scroll position restoration** — restore scroll on back navigation from detail views.

### Testing

- **Resilience tests** — network failure, timeout, retry scenarios.
- **Component tests for Permanent UI**.
- **Component tests for Form Pickers**.
