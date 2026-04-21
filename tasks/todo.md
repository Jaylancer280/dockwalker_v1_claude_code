# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

### Admin Phase 1 — Blocking + user moderation

> Already shipped (Stage 218 and in-flight work): migration 00097 schema + projection handlers, `/api/admin/users/:id/block|unblock|restore|DELETE` routes, `cascadeBlock` helper, `/blocked` page, middleware admin/blocked guards, admin user detail UI (uncommitted). Remaining work breaks into 4 chunks — each must commit cleanly and pass CI before the next.

#### Chunk 1 — API-layer blocked enforcement + commit the admin UI

- [ ] Add `blocked_at` check to `apps/web/src/lib/auth/require-domain-user.ts` across all 3 paths (header fast path, JWT claims path, DB fallback) — return `403 'Account suspended. Contact support.'` when blocked.
- [ ] Add optional `{ allowBlocked?: boolean }` parameter so support-facing routes can explicitly admit blocked users.
- [ ] Middleware: set `x-blocked: true` header on API requests when `appMeta.blocked === true` so the header fast path can read it without a DB query.
- [ ] Write tests: blocked user rejected (all three paths), blocked user admitted with `allowBlocked: true`, deactivated + allowBlocked still rejected.
- [ ] Commit + push + wait for CI green.
- [ ] Second commit: the already-working admin user detail page (`apps/web/src/app/(admin)/admin/users/[personId]/page.tsx`) now that the backend it consumes is stable. Commit + push.

#### Chunk 2 — `user_notes` table + API + scrub extension

- [ ] Migration `00106_user_notes.sql` — table with RLS (admin-only), FKs per §3.11, INDEX on person_id, extend `PERSON.DATA_SCRUBBED` to rewrite content of notes **about** the scrubbed user to `'[content scrubbed]'`.
- [ ] Rollback `00106_user_notes.down.sql` — drop table, restore prior `PERSON.DATA_SCRUBBED` body verbatim.
- [ ] `GET /api/admin/users/:personId/notes` — chronological list with admin display names.
- [ ] `POST /api/admin/users/:personId/notes` — body `{ content }`, sets `admin_person_id = guard.value.person.id`.
- [ ] `PATCH /api/admin/users/:personId/notes/:noteId` — author-only edit (check `admin_person_id`).
- [ ] Tests: list, create, edit by author succeeds, edit by other admin rejected, content max-length enforced, scrub rewrites target's notes.
- [ ] Admin UI: Notes section on user detail page (read, add, edit-own).
- [ ] `npx supabase db push`, commit + push + CI green.

#### Chunk 3 — Messages RLS tightening [SKIPPED]

Spec §3.9 assumed a permissive `messages` INSERT RLS policy that needs tightening. In this codebase no such policy exists — all INSERTs flow through `apply_projection` (SECURITY DEFINER, RLS-bypassing). The API route at `apps/web/src/app/api/messages/[engagementId]/route.ts:85-87` already rejects when `engagement.status !== 'active'`. No migration needed.

#### Chunk 4 — Admin force-cancel engagement + hide posting routes

- [ ] `POST /api/admin/engagements/:id/cancel` — body `{ reason_category, reason_text }`, emits `ADMIN.ENGAGEMENT_CANCELLED` (handler already in 00097).
- [ ] `POST /api/admin/postings/:id/hide` — body `{ posting_type, reason }`, emits `ADMIN.POSTING_HIDDEN` (handler already in 00097).
- [ ] Tests: happy path, non-active engagement rejection, invalid reason rejection.
- [ ] Update `tasks/admin-dashboard-spec.md` Progress Tracker — Phase 1 → DONE.
- [ ] Commit + push + CI green.

### Imagery rollout — maritime feel + empty-state completeness

> From Stage 214 session. Full audit of imagery opportunities across the app. Work item-by-item; confirm surface, copy, and photo choice with user before each commit. Assets: `apps/web/public/images/{empty-states,onboarding,departments,brand}/` plus stock in top-level `assets/images/`.

**Already wired — do not touch unless copy changes**

- `discover.jpg` → `daywork-browse.tsx` "No jobs found" empty state
- `docky.jpg` → `docky/page.tsx` pre-first-message state (direct `<Image>`, bypasses `EmptyState`)
- `messages.jpg` → `messages/page.tsx` Active tab "No active messages" empty state
- `vessels.jpg` → `vessels/page.tsx` "No vessels yet" empty state
- `departments/*.jpg` → job card backgrounds (Stage 174)
- Onboarding welcome (`hero-lounge`), hat selection (`crew-rope` + `vessel-helm-chair` inline)

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

### Locations V1 — post-implementation follow-ups

> Gaps flagged in the Stage 217 audit and recorded in `tasks/marina-locations-prompt.md` § "Post-implementation audit". Prioritized for effort.

- [ ] `CHECK (country_code ~ '^[A-Z]{2}$')` constraint on `regions.country_code` — 1-line migration, prevents admin typos
- [ ] Paginate `/admin/canonical/ports` and `/cities` — returns ~6K / ~3.4K rows currently, ~30-min change
- [ ] Migration-replay integration test covering the location schema — catches regressions on the new RPCs + columns
- [ ] Live-picker UI sanity pass — spot-check 20 random non-curated ports via fuzzy search; confirm city/country context renders
- [ ] Move `TOWN_ALIASES` + `COUNTRY_CODE_FIXES` from `scripts/marina-extraction/3c_normalize.py` into a versioned JSON config under `supabase/seed/` — reduces drift when extending curated hubs
- [ ] Document admin workflow for merging OSM district near-duplicates (e.g. if users report "Muğla" marinas in multiple towns)

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
