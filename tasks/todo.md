# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

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

### Vercel env var split — staging vs production

> Two Vercel projects exist: `dockwalker-staging` (preview URL only) and the
> repo-named project (intended to host `www.dockwalker.io`). Current state
> per user: staging has live-grade keys for most services (Anthropic,
> OpenAI, etc.). Launch-safe split focuses only on what MUST differ.

**Confirm which project is which**

- [ ] Identify which Vercel project has `www.dockwalker.io` attached as a custom domain — that's production. Screenshot its Settings → Domains.
- [ ] Confirm the other project is `dockwalker-staging.vercel.app` only (no custom domain).

**Per-project env var plan**

Variables that MUST differ between staging and prod:

| Variable                            | Staging value                           | Production value                                     |
| ----------------------------------- | --------------------------------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`              | `https://dockwalker-staging.vercel.app` | `https://www.dockwalker.io`                          |
| `NEXT_PUBLIC_APP_URL`               | `https://dockwalker-staging.vercel.app` | `https://www.dockwalker.io`                          |
| `STRIPE_SECRET_KEY`                 | `sk_test_…`                             | `sk_live_…`                                          |
| `STRIPE_WEBHOOK_SECRET`             | from the test-mode webhook in Stripe    | from the live-mode webhook                           |
| `STRIPE_PRICE_CREW_PRO`             | test price ID                           | live price ID                                        |
| `STRIPE_PRICE_EMPLOYER_PRO`         | test price ID                           | live price ID                                        |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | staging Redis DB                        | separate prod Redis DB (free tier lets you create 2) |

Variables to COPY IDENTICALLY to both (paste same value into each project):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DOCKY_MODEL`, `DOCKY_CORPUS_READY`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (when set up)
- `NEXT_PUBLIC_SENTRY_DSN` (single DSN; `VERCEL_ENV` tags events per environment)
- `CRON_SECRET` (same string or different — doesn't matter; each project's Vercel Cron UI references the matching secret)

**Still "Needs Attention" across both projects — fill in order of criticality**

- [ ] `SUPABASE_SERVICE_ROLE_KEY` (both projects) — every server-side write path depends on this. Copy from Supabase Dashboard → Project Settings → API → `service_role secret`.
- [ ] `CRON_SECRET` (both projects) — any random string; Vercel Cron sends it as Bearer token. Generate once.
- [ ] `UPSTASH_REDIS_REST_URL` + `_TOKEN` (both projects, DIFFERENT DBs) — sign up at upstash.com, create 2 databases (`dockwalker-prod`, `dockwalker-staging`), paste each project's URL + token into the matching Vercel project.
- [ ] `ANTHROPIC_API_KEY` + `OPENAI_API_KEY` (both projects, same value) — enables Docky.
- [ ] `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — **different per project per the split table above.** Make sure live keys go on prod, test keys on staging. Mixed modes = `No such price` errors.
- [ ] `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (both projects, same value) — pending Resend DNS verification.

**Non-env-var production setup**

- [ ] Attach `www.dockwalker.io` (and `dockwalker.io` apex → 301 to www) to the PROD Vercel project only. Remove any custom domain from the staging project.
- [ ] Create a **live-mode** Stripe webhook pointed at `https://www.dockwalker.io/api/webhooks/stripe` with the 3 events (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`).
- [ ] Verify Resend sending domain `dockwalker.io` — SPF + DKIM (3 CNAME records) + DMARC (1 TXT) at DNS host. Resend dashboard walks you through.
- [ ] Configure Vercel Cron on the PROD project only (not staging — staging shouldn't send real reminder emails). Three jobs: `engagement-starts` daily 07:00 UTC, `availability-expiry` daily 08:00 UTC, `document-cleanup` every 6h.

**Known constraint (not launch-blocking)**

- Single Supabase project serves both environments. Staging writes to the same DB as production, so destructive migration tests or seed resets would affect real users. Acceptable for launch given the user volume; revisit with a separate staging Supabase project once there are paying customers.

### Legal pages go-live (Stage 214)

`/privacy` and `/terms` pages render with provisional values wired in Fix 222h. Before public launch:

- [ ] Lawyer review of `/privacy` and `/terms` wording (source drafts: `tasks/privacy-policy-spec.md` + `tasks/founder-drafts.md` §1) — placeholder VALUES are correct; the POLICY TEXT still needs legal review.
- [x] Fill `apps/web/src/lib/legal-placeholders.ts` — Delaware incorporation details wired: Nautalink Technologies Inc., Stable mailing address, Delaware jurisdiction, admin@nautalink.io for support + DPO, EU (Frankfurt) Supabase region. Commit `3073380`.
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

---

## Backlog

> Active backlog. Pick items into Queue when ready.

### Deferred post-launch

- **Voice calling — replace Twilio + browser QA before unmute.** Phone button in chat header is gated behind a "Coming soon" toast (Fix 222d); `IncomingCallListener` unmounted from the app layout. `use-voice-call.ts`, `voice-call-context.tsx`, `call-bar.tsx`, `incoming-call-listener.tsx`, `turn-credentials` route, `call-ended` route all retained as dead code. When unmuting: (1) decide on managed RTC provider — LiveKit Cloud is the preferred replacement over Twilio TURN+Supabase-Realtime-signaling (SFU routing, call history, recording capability); (2) swap the hand-rolled `RTCPeerConnection` stack in `use-voice-call.ts` for the provider's SDK; (3) restore phone button's real `onClick` wiring to `voiceCall.startCall` + gate on `isPermanent && status === 'active'`; (4) re-mount `IncomingCallListener` in `(app)/layout.tsx`; (5) run browser QA matrix (Chrome/Firefox/Safari × desktop+mobile, glare resolution, network drops, backgrounded tab, multi-tab, offline user). Audit-trail gap: currently only `MESSAGE.SENT` records a call; add `CALL.STARTED`/`CALL.ENDED` events in the ledger at the same time.

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
