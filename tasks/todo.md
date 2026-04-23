# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

### Google Sign-In — robust launch-quality integration

> User-facing goal: crew + employers can sign up or sign in with one tap via
> Google, land in the same onboarding flow, and the rest of the app (password
> reset, change password, settings) behaves correctly for users who have
> only the Google identity. Prefills `display_name` from Google metadata on
> first onboarding (NOT `deck_name` — that's a per-vessel nickname, user-set).

#### Chunk 1 — Code wiring

- [x] Create `apps/web/src/components/google-auth-button.tsx` — shared "Continue with Google" button with inline Google logo SVG + brand-compliant styling. Calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '${origin}/auth/callback?next=/onboarding' } })`.
- [x] Create `apps/web/src/lib/auth/has-password-identity.ts` — client-side helper `hasPasswordIdentity(user)` that returns true if the auth.users row has an `email`/`password` identity (as opposed to `google`-only). Used to gate password-related UI.
- [x] Wire `GoogleAuthButton` into `apps/web/src/app/auth/login/page.tsx` — "or" divider + button, visually consistent with email/password card.
- [x] Wire `GoogleAuthButton` into `apps/web/src/app/auth/signup/page.tsx`. (OAuth signups never hit the "Check your email" success state — `signInWithOAuth` navigates the browser away before it would render.)
- [x] Prefill `displayName` in `apps/web/src/app/onboarding/page.tsx` profile step from `user.user_metadata.full_name` / `user.user_metadata.name` when the field is empty on mount. `deck_name` NOT prefilled.
- [x] Update `apps/web/src/app/auth/forgot-password/page.tsx` — inline note + `GoogleAuthButton` above the reset form.
- [x] Update change-password section in `AccountSection` — hide the password form + show guidance linking to Google Account Security when `hasPasswordIdentity(user) === false`.
- [x] Update `apps/web/src/app/privacy/page.tsx` third-party table with a Google (OAuth) row.

#### Chunk 2 — Tests + docs

- [x] `google-auth-button.test.tsx` — renders + fires `signInWithOAuth` with correct provider + redirect on click (6 cases).
- [x] `has-password-identity.test.ts` — returns true for email, false for google-only, true for linked email+google (5 cases).
- [x] `apps/web/README.md` — OAuth section added under Architectural Notes.

#### Chunk 3 — User-side setup (NOT code — blocked on user)

- [ ] **Google Cloud Console**: create an OAuth 2.0 Client ID (Web application). Authorized redirect URI: `https://<your-supabase-project>.supabase.co/auth/v1/callback` — exact URL shown in Supabase Dashboard → Auth → Providers → Google → "Redirect URL". Save client ID + client secret.
- [ ] **Supabase Dashboard → Auth → Providers → Google**: paste client ID + client secret, toggle Enable.
- [ ] **Supabase Dashboard → Auth → Settings → "Enable manual linking" / "Link identities"**: enable so a user who signs up with email first and later uses Google (or vice versa) merges into one user rather than creating duplicates. Also confirm the email domain auto-confirmation setting matches your policy (Google-provided emails are verified at the provider).
- [ ] **Both Vercel projects** — no new env vars needed; OAuth config lives entirely in Supabase. But verify `NEXT_PUBLIC_SITE_URL` is correct on the prod project (used by `signInWithOAuth` to construct the absolute callback URL).

#### Chunk 4 — Verify end-to-end

- [ ] After Supabase provider is enabled in staging: full flow test — Sign up with Google → complete onboarding → sign out → Sign in with Google → lands on /discover.
- [ ] Verify forgot-password for an OAuth-only user gracefully directs them to the Google button (no confusing error).
- [ ] Verify settings change-password is hidden for OAuth-only user.
- [ ] Same on production after provider is enabled there.

### Imagery rollout — DONE

---

## Queue

### Locations V1 — remaining follow-ups

> Original Stage 217 audit list; C1-C3 shipped this session (3e45a3c / 6623a93 / 89d0d4c). Remaining items:

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

### Google Sign-In — provider enable + verify

> Code is shipped. Buttons are live on `/auth/login`, `/auth/signup`,
> `/auth/forgot-password`. Until the provider is enabled in Supabase they'll
> return "Provider not enabled". Do this once — config lives entirely in
> Supabase, so the single Supabase project covers both Vercel environments.

**Google Cloud Console**

- [ ] Open [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → Create credentials → OAuth 2.0 Client ID → Application type: **Web application**. Name it `DockWalker`.
- [ ] Under "Authorized redirect URIs" add the exact URL shown in Supabase Dashboard → Authentication → Providers → Google → "Callback URL (for OAuth)" — this is `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`. Copy from the Supabase UI; don't hand-type.
- [ ] Save. Copy the **Client ID** and **Client secret**.
- [ ] (Optional but recommended) OAuth consent screen → set app name `DockWalker`, support email `admin@nautalink.io`, developer email `admin@nautalink.io`, app logo (DockWalker icon), authorised domains: `dockwalker.io` + `supabase.co`. Submit for verification if you want the "unverified app" warning to go away on launch.

**Supabase Dashboard**

- [ ] Authentication → Providers → Google → toggle **Enabled** → paste Client ID + Client secret → Save.
- [ ] Authentication → Settings → **"Allow manual linking"** (a.k.a. "Link identities") → Enable. This merges `email+password` and `google` into the same `auth.users` row when the email matches — without it, a user who signed up by email and later tries Google (or vice versa) gets a duplicate account.
- [ ] Sanity check: Authentication → Settings → Site URL is `https://www.dockwalker.io` (production) — the OAuth redirect will append `?next=/onboarding` to this.

**Verify end-to-end (do after Vercel prod deploy carries the new code)**

- [ ] Staging: Sign up with Google → completes onboarding (display name prefilled from Google) → sign out → Sign in with Google → lands on `/discover`.
- [ ] Forgot-password page shows "Signed up with Google?" guidance + Google button above the reset form.
- [ ] Settings → Account → Password section hides the form for an OAuth-only user and shows the "manage your password at Google" link.
- [ ] Production: repeat the sign-up/sign-in flow once `www.dockwalker.io` is live.

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
