# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

### Shore-Based Experience — Structured entries for green crew differentiation

**Goal:** Green crew can add structured shore-based experience entries (category, employer, job title, dates, description). Employers see category pills on crew cards and profiles. NOT calculated in maritime experience brackets.

#### Phase 1 — Database + Types

- [ ] Migration 00099: `shore_experience_categories` lookup table (30 categories, seeded), `shore_experiences` table (id, person_id, category_id, employer_name, job_title, start_date, end_date, is_current, description, created_at, updated_at), RLS (owner SELECT + authenticated SELECT for active persons — writes via service client through events), 3 new handlers in `apply_projection` (68 total), aggregate_type CHECK updated to include `shore_experience`. SHORE_EXPERIENCE handlers must NOT call `derive_experience_profile`. PERSON.DATA_SCRUBBED handler updated to `DELETE FROM shore_experiences`. Admin delete function updated to include `DELETE FROM shore_experiences WHERE person_id = target_id`
- [ ] Rollback 00099: self-contained, drops tables, restores 65-handler `apply_projection` from 00098, restores CHECK without `shore_experience`, restores DATA_SCRUBBED and admin delete without shore_experiences cleanup
- [ ] Add event types to `packages/types/src/events.ts`: `SHORE_EXPERIENCE.ADDED`, `SHORE_EXPERIENCE.UPDATED`, `SHORE_EXPERIENCE.REMOVED`
- [ ] Add `ShoreExperience` model to `packages/types/src/models.ts` (id, person_id, category_id, employer_name, job_title, start_date, end_date, is_current, description, created_at, updated_at)
- [ ] Add `ShoreExperienceCategory` interface to models (id, name, sort_order)
- [ ] `npx supabase db push` — apply migration

#### Phase 2 — API Routes

- [ ] `GET /api/shore-experiences` — list user's shore experiences with category join, ordered by start_date DESC
- [ ] `POST /api/shore-experiences` — validate required fields (categoryId, employerName, jobTitle, startDate), max 250 chars description, append `SHORE_EXPERIENCE.ADDED` event with aggregateType `shore_experience`
- [ ] `PATCH /api/shore-experiences/[id]` — owner-only partial update, append `SHORE_EXPERIENCE.UPDATED`
- [ ] `DELETE /api/shore-experiences/[id]` — owner-only, append `SHORE_EXPERIENCE.REMOVED`
- [ ] `GET /api/shore-experience-categories` — public list of all categories for the picker
- [ ] Update `GET /api/profile/[personId]` (view-only) — query `shore_experiences` joined with `shore_experience_categories`, return in crew profile response

#### Phase 3 — UI: Add/Edit Forms

- [ ] Split "Add experience" entry point on profile page into two options: "Add maritime experience" / "Add shore-based experience" (bottom sheet or inline choice)
- [ ] New page `/profile/add-shore-experience` — category picker (searchable list of 30 categories), employer name input, job title input, start/end date, is_current toggle, description textarea (250 chars)
- [ ] New page `/profile/edit-shore-experience/[id]` — same form, pre-populated

#### Phase 4 — UI: Profile Display

- [ ] New `ProfileShoreExperienceSection` component — collapsible section below maritime experience, category-coloured icon instead of Ship, employer name + job title instead of vessel name + role, expandable details with dates + description
- [ ] Wire into profile page with expand/collapse, edit, delete (reuse confirmation dialog pattern)
- [ ] Add shore experience category pills to `ProfileSummarySection` — row of pills below experience bracket (only shown when shore experiences exist)

#### Phase 5 — UI: Crew Cards + Profile Overlay

**Daywork review feed:**

- [ ] Update `GET /api/daywork/[id]/applicants` — add subquery for distinct shore_experience category names per crew_person_id
- [ ] Update `ApplicantProfile` type in `daywork/[id]/review/_components/types.ts` — add `shore_experience_categories: string[]`
- [ ] Add category pills to applicant cards in `applicants-tab.tsx` (below badges section, max 3 with "+N" overflow)

**Available crew:**

- [ ] Update `GET /api/daywork/[id]/available-crew` — add shore category subquery
- [ ] Update `AvailableCrew` type in `types.ts` — add `shore_experience_categories: string[]`
- [ ] Add category pills to available crew cards in `available-crew-tab.tsx`

**Permanent review:**

- [ ] Update `GET /api/permanent/[id]/review` — add shore category subquery
- [ ] Update inline `Applicant` type in `permanent/[id]/review/page.tsx` — add `shore_experience_categories: string[]`
- [ ] Add category pills to permanent applicant cards

**Profile overlay:**

- [ ] Update `CrewProfile` interface in `profile-overlay.tsx` — add `shore_experiences` array
- [ ] Add shore experience section to `CrewProfileView` (below maritime experience, before bio)
- [ ] Update `buildCrewProfile` in view-only API to return shore experiences

#### Phase 6 — Onboarding Hint

- [ ] Replace green crew `shore_experience` textarea in `profile-step.tsx` with a static hint: "You can add detailed shore-based experience from your profile after sign-up"
- [ ] Remove `shoreExperience` state from `onboarding/page.tsx` and `shore_experience` from the PROFILE.CREATED payload in `api/onboarding/route.ts`
- [ ] Leave existing `profiles.shore_experience` column in place (no data migration — column is legacy, never displayed, minimal data)

#### Phase 7 — Tests + Cleanup

- [ ] API tests for shore-experiences routes: CRUD happy paths, 401 unauth, 400 invalid input (missing required fields), owner-only PATCH/DELETE enforcement
- [ ] API test: view-only profile includes shore experiences
- [ ] Component test: `ProfileShoreExperienceSection` renders entries correctly
- [ ] Verify `turbo run type-check` passes (zero errors)
- [ ] Verify `turbo run lint` passes (zero warnings)
- [ ] Pre-commit passes (no console.log, no TODO, rollback exists, schema version matches)

---

## Queue

### BUG: Permanent withdrawal has no rating path

**Root cause:** `PERMANENT.WITHDRAWN` sets engagement status to `'closed'` (migration 00059 line 697), but `canRate` in `page.tsx` line 528-532 only checks for `'completed'` and `'cancelled'`. Daywork cancellations use `'cancelled'` status which IS ratable — permanent withdrawals use `'closed'` which is NOT.

- [ ] Decide: should `'closed'` engagements with outcome `'withdrew'` be ratable? If yes:
  - Add `(context?.status === 'closed' && context.outcome === 'withdrew' && !context.has_rated)` to `canRate` in `page.tsx`
  - Add a banner for closed-with-withdrawal in `chat-footer.tsx` (like CancellationBanner but simpler)
  - Verify the rating API (`/api/engagements/[id]/rate`) accepts `'closed'` status — currently only allows `'completed'` and `'cancelled'`

### BUG: DateInput transparent overlay may block interaction on some devices

**Symptom:** Permanent post form start date reported as "unclickable." Same `DateInput` component used by daywork (which works).

**Possible cause:** The `opacity-0` native date input now sits on top and captures taps, but on some Android browsers/webviews the native picker doesn't open from a transparent input — the tap is absorbed silently.

- [ ] Test on the same device after deployment lands — may already be fixed
- [ ] If still broken: add explicit calendar icon button next to the date input that calls `showPicker()` on tap (visual affordance + programmatic trigger)
- [ ] Alternative: reverse stacking — put text input on top (for typing), keep native input behind with `pointer-events-none`, and rely solely on `showPicker()` with a fallback message "type date manually"

---

## BLOCKED — user action required

### Stripe setup

- [x] Test mode: products, prices, test webhook (`https://www.dockwalker.io/api/webhooks/stripe`), and test env vars all configured. Full checkout → webhook → DB upsert → Crew Pro entitlement unlock verified end-to-end against real Vercel deployment.
- [ ] Live mode go-live: (1) toggle Stripe Workbench to live mode, (2) recreate Crew Pro + Employer Pro products + prices, (3) point the existing live webhook at `https://www.dockwalker.io/api/webhooks/stripe` (the live one was created against the apex and will 307), (4) swap `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_CREW_PRO`, `STRIPE_PRICE_EMPLOYER_PRO` in Vercel Production env vars for live values, (5) redeploy.
- [ ] Set `NEXT_PUBLIC_APP_URL=https://www.dockwalker.io` in Vercel Production env vars (currently falls back to `http://localhost:3000` — checkout still works because the apex-to-www redirect absorbs the broken URL, but it's one extra hop and masks future bugs).

### WhatsApp setup

- [ ] Get dedicated number (prepaid SIM or Google Voice for Workspace)
- [ ] Register with Meta Cloud API directly (not Twilio)
- [ ] Swap Twilio dispatcher for Meta Graph API calls
- [ ] Submit templates for Meta approval

### User testing

### Voice calling Session 3 — Browser testing (manual)

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
