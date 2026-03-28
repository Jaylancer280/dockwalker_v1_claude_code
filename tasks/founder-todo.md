# Founder Todo — Launch Checklist

> Single source of truth for getting DockWalker to production.
> Structured by environment. Work top-to-bottom.
>
> **Key principle:** API keys and secrets NEVER go in the codebase.
> They live in Vercel environment variables (scoped per environment)
> and Supabase project settings. The codebase reads them from `process.env`.
>
> Last reviewed: 2026-03-28

---

## Phase 0 — Code Fixes Before Any Deployment

~~These were blocking bugs found by the testing agent. All resolved:~~

- [x] **SUG-001 + SUG-013:** Crew review page role gate — client-side hat guard + middleware regex for both daywork and permanent review routes (Stage 157)
- [x] **SUG-016:** Employer redirect from `/discover` — middleware checks `current_hat === 'employer'` and redirects to `/daywork/mine` (Stage 157)
- [x] **SUG-011:** Cancel posting confirmation dialog — added to daywork mine page (Fix 160)

---

## Phase 1 — Staging Environment (Current State)

### 1a. Supabase Staging Project

- [x] Create Supabase project `dockwalker-staging` (EU Central)
  - Project ref: `hwpcuehqawullzqbmcdv`
  - URL: `https://hwpcuehqawullzqbmcdv.supabase.co`
- [x] 77 migrations pushed (through 00077)
- [x] Canonical data seeded (ports, roles, certs)
- [x] Avatars storage bucket created
- [x] RLS active (auto-enabled + migration policies)
- [ ] Push migration 00076 (experience brackets) + 00077 (permanent post fields) to staging

### 1b. Supabase SMTP (Staging Auth Emails)

- [ ] Supabase Dashboard → Project Settings → Auth → SMTP Settings
- [ ] For staging, Supabase's built-in email works (ugly but functional). Skip custom SMTP for now.
- [ ] OR: Set up Resend (resend.com) if you want branded emails from day one:
  - Create Resend account
  - Add and verify your domain (DNS: SPF, DKIM, DMARC records)
  - Get API key
  - In Supabase SMTP Settings: host `smtp.resend.com`, port 465, user `resend`, pass = API key
  - Copy `supabase/templates/*.html` into Supabase Dashboard → Auth → Email Templates

### 1c. Vercel Staging Deployment

- [x] Vercel project created, linked to GitHub repo
- [x] Environment variables set (Supabase URL, anon key, service role key)
- [x] Deployed to `https://dockwalker-staging.vercel.app/`
- [x] Signup + login verified working
- [ ] Verify `NEXT_PUBLIC_SITE_URL` is set correctly in Vercel Preview env (should be staging URL, not production domain — Codemagic uses `dockwalker.io` which may cause email link mismatch)

### 1d. Minimal Services for Staging

- [x] Upstash Redis — `dockwalker-staging` (EU West, eviction enabled)
- [x] Sentry — `dockwalker` project (Next.js, alert on every new issue)
- [x] Cron secret generated and set
- [x] All env vars added to Vercel, redeployment triggered

**Skip for staging (add later):**

- Stripe — billing is deferred
- Anthropic/OpenAI — Docky works but costs money; defer until production
- Resend transactional emails — auth emails work via Supabase built-in

### 1e. Mobile App (Architecture Split)

> **Capacitor webview wrapper is being replaced with a native Expo/React Native app.**
> See `tasks/` for the mobile architecture planning doc (forthcoming).
> The current Codemagic pipeline (remote webview to Vercel) continues working for
> existing testers until the Expo app replaces it.

- [x] Codemagic CI/CD pipeline — auto-builds iOS on push to main, submits to TestFlight
- [x] Bundle ID: `io.dockwalker.app`
- [x] Signing configured in Codemagic
- [ ] **NEW:** Expo/React Native app (`apps/mobile/`) — planning in progress, replaces Capacitor

### 1f. Web App Testing Checklist

Flows to verify on staging with real users:

- [ ] Sign up with email → receive confirmation → confirm → onboard
- [ ] Set availability (crew) or post a daywork job (employer)
- [ ] Apply to a daywork job → employer reviews → accepts
- [ ] Message thread opens after acceptance
- [ ] Post a permanent job → crew applies → shortlist → select → negotiate
- [ ] Profile: add experience, upload avatar, view "how employers see you"
- [ ] Hat switch: crew → employer → post a job → switch back
- [ ] Docky: ask a question about STCW (if AI keys configured)

---

## Phase 2 — Production Environment

Only set this up after staging is validated. Your real users go here.

### 2a. Supabase Production Project

- [ ] Create a new Supabase project:
  - Region: EU (Frankfurt)
  - Name: `dockwalker-production`
- [ ] Note down credentials (same 3 keys as staging)
- [ ] Push migrations:
  ```bash
  npx supabase db push --project-ref YOUR_PRODUCTION_REF
  ```
- [ ] Do NOT seed production with test data. Real users onboard fresh.
- [ ] Verify RLS active on all tables
- [ ] Create `avatars` storage bucket (public)

### 2b. Vercel Production

- [ ] In Vercel Project Settings → Git → Production Branch: `main`
- [ ] Set Environment Variables (scope: **Production**):

  ```
  # Supabase PRODUCTION credentials
  NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PRODUCTION_REF.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...production
  SUPABASE_SERVICE_ROLE_KEY=eyJ...production-service

  # App URL
  NEXT_PUBLIC_SITE_URL=https://yourdomain.com

  # Rate Limiting (same Upstash or new instance)
  UPSTASH_REDIS_REST_URL=...
  UPSTASH_REDIS_REST_TOKEN=...

  # Error Tracking
  NEXT_PUBLIC_SENTRY_DSN=...

  # Cron
  CRON_SECRET=...different-from-staging...

  # Transactional Email
  RESEND_API_KEY=re_...
  RESEND_FROM_EMAIL=DockWalker <noreply@yourdomain.com>
  ```

- [ ] Configure custom domain in Vercel → Domains
- [ ] Verify security headers active after first production deploy

### 2c. Production Services (Add as needed)

**Resend (transactional email) — needed for production:**

- [ ] Verify domain (same as SMTP setup if done for staging)
- [ ] Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in Vercel (Production scope)

**Docky AI — needed before public launch:**

- [ ] Set `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` in Vercel (Production)
- [ ] Bulk-index MCA document chunks into production Supabase `mca_document_chunks` table

### 2d. Deferred Services — Not Blocking Launch

**Push Notifications:**

> Push infrastructure exists in code (Stages 63-66) but is not configured for any
> deployed environment. Will be reconfigured for Expo Push when the native mobile
> app ships. No action needed for web.

**Stripe Billing:**

> Billing code exists (subscriptions table, checkout/portal routes, webhook handler).
> Not activated — no Stripe products/prices created. Intentionally deferred until
> monetisation decision and tier pricing are finalised.
> See `tasks/founder-drafts.md` § 3-4 for tier copy drafts.

- [ ] Create Stripe products/prices (when ready)
- [ ] Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` in Vercel (Production)
- [ ] Configure webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`

### 2e. Deep Links (before App Store submission)

- [ ] Replace placeholder values:
  - `apps/web/public/.well-known/apple-app-site-association` → real Team ID
  - `apps/web/public/.well-known/assetlinks.json` → real SHA256 fingerprint
  - `apps/web/ios/App/App/App.entitlements` → real domain (if still using Capacitor shell)
- [ ] Verify after deploy:
  - iOS: `https://app-site-association.cdn-apple.com/a/v1/yourdomain.com`
  - Android: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://yourdomain.com`

> **Note:** Deep link config will need updating when the Expo app replaces Capacitor.
> Expo has its own deep linking setup. These placeholder files serve the web and
> the current Capacitor shell.

### 2f. App Store Submissions

- [ ] iOS App Store Connect:
  - Create listing, screenshots (6.7" + 6.1"), description (see `founder-drafts.md` § 6)
  - Privacy policy URL (host the doc from `founder-drafts.md` § 2 on your domain)
  - Build with Expo EAS (replaces Capacitor archive)
- [ ] Google Play Console:
  - Create listing, screenshots, description
  - Sign release AAB with keystore
  - Upload

---

## Phase 3 — Branch Strategy & Deployment Flow

Once staging and production are both live:

```
feature-branch → PR (auto-deploys to staging preview) → test on staging → merge to main → auto-deploys to production
```

**Rules:**

- Never push directly to `main`
- Every change goes through a PR
- PR preview URL = staging (points to staging Supabase)
- Merging to `main` = production deploy (points to production Supabase)
- Vercel handles the environment variable scoping automatically

**Migrations:**

- Test migrations on staging first: `npx supabase db push --project-ref STAGING_REF`
- After staging validation, push to production: `npx supabase db push --project-ref PRODUCTION_REF`
- Never run untested migrations against production

---

## Legal / Content (Do Anytime)

- [ ] Review Terms of Service draft in `tasks/founder-drafts.md` § 1 — get lawyer review
- [ ] Review Privacy Policy draft in `tasks/founder-drafts.md` § 2 — get lawyer review
- [ ] Fill in placeholders: [COMPANY NAME], [JURISDICTION], [SUPPORT EMAIL], [DPO EMAIL]
- [ ] Host both documents on your domain (or as app pages)
- [ ] Wire footer links on landing page to hosted documents
- [ ] Create OG image per spec in `tasks/founder-drafts.md` § 7
- [ ] Cookie consent: determine if needed for your jurisdiction

---

## Security Principles (Read Once, Follow Always)

1. **API keys never go in the codebase.** They live in Vercel environment variables, scoped per environment. The `.env.local` file is gitignored and only used for local development.

2. **Different keys per environment.** Staging Supabase keys ≠ production Supabase keys. If staging is compromised, production is unaffected.

3. **Service role key is the nuclear key.** It bypasses RLS. Only Vercel's server-side functions use it. Never expose it to the client. Never put it in `NEXT_PUBLIC_*` variables.

4. **Rotate secrets periodically.** `CRON_SECRET`, API keys, Stripe webhook secret — rotate every 90 days or after any suspected compromise.

5. **Vercel environment variable scoping:**
   - **Production:** only used when deploying from `main` branch
   - **Preview:** used for all PR preview deployments (your staging)
   - **Development:** only used if you run `vercel dev` locally (optional — you use `.env.local` instead)

6. **If an agent asks you to put a key in a file**, that's wrong. Keys go in Vercel Dashboard → Settings → Environment Variables. The codebase reads them via `process.env.VARIABLE_NAME`. The only file that contains keys is `.env.local` which is gitignored.
