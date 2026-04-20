# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

### Locations V1 — global marina dataset + scaling LocationPicker

> Spec: `tasks/marina-locations-prompt.md`. Ship order: Phase B (prep schema) → Phase A scripts → Phase C extraction run (external) → Phase D data-import migration → Phase F admin CRUD → Phase E picker scaling (can run in parallel while extraction pipeline is busy).
>
> **Coupling warning:** Phase D data import must not go live before Phase E picker scaling — eager-loading ~20K ports crashes every location surface on first page load.

**Phase A — Python extraction pipeline**

- [x] `scripts/marina-extraction/` created with 4 scripts, README, requirements.txt
- [x] `scripts/marina-extraction/data/` added to root `.gitignore`
- [x] Stage 1 `1_extract_marinas.py` implemented
- [x] Stage 2 `2_enrich_locations.py` implemented
- [x] Stage 3 `3_finalize.py` implemented
- [x] Stage 4 `4_generate_migration.py` implemented with baselines + idempotent UUIDv5

**Phase B — Preparatory schema migration**

- [x] Migration `supabase/migrations/00101_locations_v1_preparatory.sql`
- [x] Rollback `supabase/rollbacks/00101_locations_v1_preparatory.down.sql`
- [x] Applied via `npx supabase db push`

**Phase C — Execute extraction (external runtime)**

- [x] Stage 1 running in background (Overpass, 30 regions, 20-40 min)
- [ ] Stage 2 Nominatim enrichment (several hours; resumable)
- [ ] Stage 3 dedup + `data/report.txt` hub sanity check
- [ ] Spot-check: `grep -i "port vauban\|atlantis\|yacht haven" data/marinas.csv`

**Phase D — Data import migration**

- [ ] Run Stage 4 → `data/migration/NNNNN_marinas_v1_expansion.{sql,down.sql}`
- [ ] Review generated SQL (UUID preservation, re-parenting, sort orders)
- [ ] Copy to `supabase/migrations/` + `supabase/rollbacks/` as `00102_*`
- [ ] Apply via `npx supabase db push`
- [ ] Verify counts + UUID preservation
- [ ] Idempotency check (re-run Stage 4 → empty delta)

**Phase E — LocationPicker scaling + fuzzy search (blocks D production merge)**

- [x] Migration `00102_pg_trgm_location_search.sql` — extensions + `immutable_unaccent` + trigram indexes + `search_locations` / `get_locations_by_ids` / `top_locations` RPCs
- [x] `apps/web/src/app/api/locations/search/route.ts` — top-50 fuzzy match via `search_locations` RPC
- [x] `apps/web/src/app/api/locations/top/route.ts` — top-N ports ranked by usage count + sort_order
- [x] `apps/web/src/app/api/locations/by-ids/route.ts` — batch label resolver
- [x] Refactor `location-picker.tsx` — top-N on open, debounced search after 2 chars, diacritic-insensitive, ODbL attribution
- [x] Remove `ports` + `cities` from `useLookups` (cache key bumped to `dw-lookups-v2`)
- [x] `CitiesPicker` component for agent placement cities (multi-select backed by /search)
- [x] Rewired: daywork/mine port filter (LocationPicker), profile placement cities display (/by-ids), onboarding + profile-edit agent placement cities (CitiesPicker)
- [x] 10 new location API tests; 1082 tests pass
- [x] Helper copy: "Can't find your port? Pick the closest one." / No-results: "No match — try the nearest city or port instead."

**Phase F — Admin canonical CRUD adjustments**

- [ ] Region form gains `country_code` input (required, ISO-3166-1 alpha-2)
- [ ] Port form gains `latitude/longitude/osm_type/osm_id/website/phone/capacity/vhf` (all optional)
- [ ] City form gains country dropdown sourced from `regions`

**Phase G — Verify & document**

- [ ] `turbo run type-check lint`, `npx vitest run`
- [ ] Update `apps/web/README.md` (new `/api/locations/*` routes + pg_trgm/unaccent requirement)
- [ ] Update `packages/types/README.md` (region `country_code`, port geo/OSM columns)
- [ ] Update `supabase/README.md` (2 new migrations + extensions)
- [ ] Update `BUILD_STATE.md` (new stage, schema version, migration table, deferred decisions)

**Out of scope / explicitly deferred (V1.1)**

- `location_collections` editorial-groupings table
- Admin OSM-ID pre-fill button (`/api/locations/osm-lookup`)
- Proximity sort on daywork discover using new lat/lon
- OSM re-sync cadence automation
- Mobile (`apps/mobile/` blocked)
- Free-text "request a port" flow — explicitly rejected

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
