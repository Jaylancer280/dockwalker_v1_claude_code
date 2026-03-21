# Founder Todo — External Blockers & Manual Config

> **Human-only file.** This is NOT for Claude Code — it tracks things that require YOUR action
> outside the codebase: account creation, credential setup, dashboard config, app store submissions.
> Claude Code cannot do any of these. They block production launch regardless of code completeness.
>
> Last reviewed: 2026-03-18 (Stage 107 baseline)

---

## Pre-Launch Critical (Nothing works in production without these)

### Supabase Production Instance

- [ ] Create Supabase production project (or promote existing)
- [ ] Run migrations against production database
- [ ] Set environment variables in Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Verify RLS policies are active on all 29 tables

### Supabase SMTP (Auth Emails)

- [ ] Choose SMTP provider — recommended: **Resend** (resend.com)
- [ ] Create Resend account, verify sender domain
- [ ] Configure DNS records: SPF, DKIM, DMARC for your sending domain
- [ ] In Supabase Dashboard → Project Settings → Auth → SMTP Settings:
  - Enter Resend SMTP credentials (host: `smtp.resend.com`, port: 465, user: `resend`, pass: your API key)
- [ ] In Supabase Dashboard → Auth → Email Templates:
  - Copy contents of `supabase/templates/confirmation.html` into Confirmation template
  - Copy contents of `supabase/templates/recovery.html` into Recovery template
  - Copy contents of `supabase/templates/email_change.html` into Email Change template
  - Set subject lines to match `supabase/config.toml` template config

### Vercel Deployment

- [ ] Create Vercel project linked to this repo
- [ ] Set all environment variables (see `apps/web/.env.example` for full list)
- [ ] Set `CRON_SECRET` for Vercel Cron authentication
- [ ] Configure custom domain (this becomes PRODUCTION_DOMAIN below)
- [ ] Verify `vercel.json` security headers are active after first deploy

---

## Pre-Launch Important (Core features degraded without these)

### Resend (Transactional Email)

- [ ] If not already created above, create Resend account
- [ ] Generate API key
- [ ] Set in Vercel environment variables:
  - `RESEND_API_KEY=re_xxx`
  - `RESEND_FROM_EMAIL=DockWalker <noreply@yourdomain.com>`
- [ ] Verify domain matches the DKIM/SPF records from SMTP setup above

### Stripe (Subscriptions)

- [ ] Create Stripe account (or use existing)
- [ ] Create subscription products and prices in Stripe Dashboard:
  - `crew_pro` plan — set price, interval
  - `crew_unlimited` plan — set price, interval
- [ ] Note the price IDs and set in Vercel:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_CREW_PRO`
  - `STRIPE_PRICE_CREW_UNLIMITED`
- [ ] Configure Stripe webhook endpoint: `https://PRODUCTION_DOMAIN/api/webhooks/stripe`
  - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

### Push Notifications — FCM (Android)

- [ ] Create Firebase project (or use existing)
- [ ] Enable Cloud Messaging in Firebase Console
- [ ] Generate service account key (JSON)
- [ ] Set in Vercel:
  - `FCM_PROJECT_ID`
  - `FCM_SERVICE_ACCOUNT_KEY` (paste the JSON string)

### Push Notifications — APNs (iOS)

- [ ] Log into Apple Developer account
- [ ] Create APNs authentication key (.p8 file) under Certificates, Identifiers & Profiles → Keys
- [ ] Note the Key ID and Team ID
- [ ] Set in Vercel:
  - `APNS_KEY_ID`
  - `APNS_TEAM_ID`
  - `APNS_BUNDLE_ID=com.dockwalker.app`
  - `APNS_KEY_PATH` (or store .p8 contents as env var — check push-delivery.ts for expected format)

### Upstash Redis (Rate Limiting)

- [ ] Create Upstash Redis instance (free tier is sufficient for launch)
- [ ] Set in Vercel:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

---

## Pre-Launch Nice-to-Have (App works without, but you'll want them)

### Sentry (Error Tracking)

- [ ] Create Sentry account and project (Next.js platform)
- [ ] Note the DSN from Project Settings → Client Keys
- [ ] Set in Vercel:
  - `NEXT_PUBLIC_SENTRY_DSN`
  - `SENTRY_ORG` (optional, for source map upload)
  - `SENTRY_PROJECT` (optional)
  - `SENTRY_AUTH_TOKEN` (optional, for source map upload in CI)

### Anthropic + OpenAI (Docky AI Advisor)

- [ ] Create Anthropic account, generate API key
- [ ] Create OpenAI account, generate API key
- [ ] Set in Vercel:
  - `ANTHROPIC_API_KEY`
  - `OPENAI_API_KEY`
  - `DOCKY_MODEL=claude-haiku-4-5-20251001` (optional, has default)
- [ ] Bulk-index MCA documentation chunks into `mca_document_chunks` table (manual SQL insert or script)

### Deep Link Verification (Mobile App Links)

These files exist with placeholders. Replace with real values before submitting to app stores:

- [ ] Get your **Apple Developer Team ID** from Apple Developer account → Membership
  - Update `apps/web/public/.well-known/apple-app-site-association`: replace `TEAM_ID` with real value
  - Update `apps/web/ios/App/App/App.entitlements`: replace `PRODUCTION_DOMAIN` with your domain
- [ ] Get your **Android signing key SHA256 fingerprint**: `keytool -list -v -keystore your.keystore`
  - Update `apps/web/public/.well-known/assetlinks.json`: replace `PLACEHOLDER_SHA256_FINGERPRINT`
  - Update `apps/web/android/app/src/main/AndroidManifest.xml`: replace `PRODUCTION_DOMAIN`
- [ ] After deploying, verify:
  - iOS: `https://app-site-association.cdn-apple.com/a/v1/YOURDOMAIN`
  - Android: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://YOURDOMAIN`

### App Store Submissions

- [ ] iOS: Create App Store Connect listing, screenshots, description, privacy policy URL
- [ ] iOS: Configure signing certificate and provisioning profile in Xcode
- [ ] iOS: Build with `npm run build:ios` from `apps/web/`, archive in Xcode, submit for review
- [ ] Android: Create Google Play Console listing, screenshots, description, privacy policy URL
- [ ] Android: Sign release APK/AAB with your keystore
- [ ] Android: Build with `npm run build:android` from `apps/web/`, upload to Play Console

---

## Post-Launch

- [ ] Monitor Sentry for first-week errors
- [ ] Monitor Vercel Analytics for usage patterns
- [ ] Check Supabase Dashboard for database performance
- [ ] Review Stripe webhook logs for payment issues
- [ ] Set up Stripe production webhook (test mode → live mode)
- [ ] Consider adding CSP header once you've catalogued all inline scripts and external origins (complex with Next.js — defer until stable)

---

## Quick Reference: All Environment Variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_CREW_PRO=
STRIPE_PRICE_CREW_UNLIMITED=

# Push — Android
FCM_PROJECT_ID=
FCM_SERVICE_ACCOUNT_KEY=

# Push — iOS
APNS_KEY_ID=
APNS_TEAM_ID=
APNS_BUNDLE_ID=com.dockwalker.app
APNS_KEY_PATH=

# Rate Limiting
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Transactional Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# Error Tracking
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=

# AI Advisor
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
DOCKY_MODEL=claude-haiku-4-5-20251001

# Cron
CRON_SECRET=
```
