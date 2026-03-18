# Launch Readiness Assessment

> Created: 2026-03-18 | Baseline: Stage 94b (assumes Stage 95 fixes applied)
> Mark items `[x]` as they're completed. Add stage number in parentheses.

---

## The Obvious (Acknowledged, Deferred)

These are known gaps that are either configuration tasks, third-party setup, or intentionally deferred:

- [ ] Stripe subscription plans — create real products/prices in Stripe dashboard
- [ ] Supabase Realtime — not wired (messages use polling; only messages benefit meaningfully)
- [ ] Forgot-password UI — Supabase handles externally, no in-app flow
- [ ] pg_cron — no background jobs (expiry computed at query time, acceptable at launch scale)
- [ ] MCA RAG bulk indexing pipeline — document chunks inserted manually

---

## P0 — Must Fix Before Any Real User

| #   | Gap                                                    | Detail                                                                                                                                                                                                                                                                                                           | Status | Stage |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| 1   | **Email templates + SMTP provider**                    | Supabase default signup confirmation emails look like spam. Need branded sender domain (Resend/Postmark) + custom templates for: signup confirmation, password reset, email change. Users on marina WiFi with aggressive spam filters won't complete signup.                                                     | [x]    | 99    |
| 2   | **Offline / network error handling**                   | Zero `navigator.onLine` checks, zero retry logic, zero service workers. When fetch hangs on network drop, apply button stays disabled indefinitely with no error shown. User sees frozen UI, doesn't know if action succeeded. #1 UX risk for target demographic (crew on docks with intermittent connectivity). | [x]    | 97    |
| 3   | **Inconsistent error feedback on destructive actions** | Discover apply failure: silent (no error shown). Review accept: `alert()`. Review reject: no error handling at all. Messages cancel: toast. Three different patterns across three critical flows. Needs unified error feedback — toast on all failures, with retry affordance.                                   | [x]    | 97    |
| 4   | **Landing page**                                       | Root `/` shows design system preview for unauthenticated visitors. Need a product page explaining what DockWalker is before signup. Doesn't need to be elaborate — hero, value props, download/signup CTA.                                                                                                       | [x]    | 98    |
| 5   | **Security headers**                                   | No CSP, HSTS, X-Frame-Options, X-Content-Type-Options. No `vercel.json` with headers config. Vercel provides HTTPS by default but app is vulnerable to clickjacking and content-type sniffing. Add `vercel.json` headers array.                                                                                  | [x]    | 96    |

---

## P1 — Will Cause Pain Within First Week

| #   | Gap                              | Detail                                                                                                                                                                                                                                                                                                     | Status | Stage |
| --- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| 6   | **Email notification fallback**  | Push works, but web-only users or users who denied push permission get nothing when accepted, messaged, or engagement starts tomorrow. No email sending code exists anywhere. Need transactional emails for: acceptance, new message, engagement reminder, job posted (optional).                          | [x]    | 101   |
| 7   | **Availability expiry reminder** | 7-day windows auto-expire silently. No "your availability expires tomorrow" notification. Crew disappear from discover results without knowing. Need push/in-app notification 24h before expiry.                                                                                                           | [ ]    |       |
| 8   | **Admin tooling**                | No way to view all users, moderate content, investigate disputes, manually complete stuck engagements, or manage canonical data (add port/cert/role) without raw SQL. Need at minimum: admin RPCs for user lookup, engagement override, canonical data management. Supabase Studio covers read-only needs. | [ ]    |       |
| 9   | **Error tracking**               | No Sentry or equivalent. Vercel logs exist but aren't structured, alertable, or searchable. When something breaks in production, won't know until user reports. Add `@sentry/nextjs` or equivalent.                                                                                                        | [x]    | 100   |
| 10  | **Message polling lag**          | After acceptance, crew/employer coordinate logistics via chat. Polling interval makes this feel sluggish. This is the one place Supabase Realtime genuinely matters for UX. Not a blocker but noticeable.                                                                                                  | [ ]    |       |

---

## P2 — Should Fix Before Scaling Past Early Adopters

| #   | Gap                                          | Detail                                                                                                                                                                                                                            | Status | Stage |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| 11  | **Deep links (Universal Links / App Links)** | Capacitor configured, push notifications resolve deep links client-side, but iOS Universal Links and Android App Links need domain verification files at `/.well-known/`. Without this, push taps may not open the app correctly. | [ ]    |       |
| 12  | **Analytics**                                | No way to measure: signups, job posts, apply-to-accept conversion, time-to-hire, DAU. Can't tell if the product is working. Add Vercel Analytics (built-in) or PostHog.                                                           | [ ]    |       |
| 13  | **Push retry / delivery resilience**         | Push delivery is fire-and-forget. If FCM/APNs returns transient error (rate limit, 503), notification is lost. No retry queue. Acceptable at launch scale but will lose notifications under load.                                 | [ ]    |       |
| 14  | **Avatar storage bucket (production)**       | Upload code works against local dev Supabase Storage. Production needs configured bucket with proper RLS policies and CDN-fronted URL.                                                                                            | [ ]    |       |
| 15  | **Verify multi-event transactionality**      | Some routes use `append_events_batch` (transactional). Verify ALL multi-event routes (cancel, relist, postponement) use batch version — sequential `appendEvent` calls risk partial state on network drop.                        | [x]    | 96    |

---

## What's Complete (No Action Needed)

| Area                                    | Readiness | Notes                                                       |
| --------------------------------------- | --------- | ----------------------------------------------------------- |
| Database & event architecture           | 95%       | Stage 95 fixes are the last known issues                    |
| API routes & auth (65 routes)           | 90%       | Complete, tested, RLS-enforced on all 29 tables             |
| Push notifications (FCM + APNs)         | 90%       | Built and tested, just needs credentials configured         |
| UI/UX (21 pages, swipe, chat, calendar) | 85%       | All flows exist, polish gaps in error handling              |
| CI/CD & testing (4-job pipeline)        | 90%       | Comprehensive, 6 pre-commit hooks                           |
| Rate limiting (Upstash Redis)           | 90%       | 100 req/60s global, 30 req/60s writes, graceful degradation |
| Capacitor (iOS + Android)               | 85%       | Projects generated, build scripts working                   |
| Docky AI advisor                        | 90%       | RAG pipeline, usage gating, conversation persistence        |
| Billing (Stripe)                        | 85%       | Checkout, portal, webhooks — needs real product config      |
| GDPR (export + soft delete)             | 95%       | PERSON.DEACTIVATED → DATA_SCRUBBED pipeline                 |

---

## Effort Estimates (Rough)

- **P0 items (1-5):** ~4-5 focused sessions
- **P1 items (6-10):** ~4-5 focused sessions
- **P2 items (11-15):** ~2-3 focused sessions
- **After P0+P1:** Soft launch in one port is viable

---

## How to Use This Document

1. Before starting a session, check which items are still open
2. When completing an item, mark `[x]` and add the stage number
3. If an item turns out to be unnecessary, strike it through with `~~` and add a note
4. If new gaps are discovered, add them to the appropriate priority section
5. This document is a planning artifact — implementation details go in `BUILD_STATE.md`
