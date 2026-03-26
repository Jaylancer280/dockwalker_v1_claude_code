# Launch Readiness Assessment (ARCHIVED)

> **This file is archived.** All items merged into `tasks/founder-todo.md` on 2026-03-26.
> See `tasks/founder-todo.md` for the current launch checklist.
>
> Original: Created 2026-03-18 | Baseline: Stage 94b | Last reviewed: 2026-03-18 (post-Stage 107 audit)

---

## The Obvious (Acknowledged, Deferred)

These are known gaps that are either configuration tasks, third-party setup, or intentionally deferred:

- [ ] Stripe subscription plans — create real products/prices in Stripe dashboard (see `founder-todo.md`)
- [x] Supabase Realtime — wired for messages (Stage 104), polling fallback retained for resilience
- [x] Forgot-password UI — built in Stage 99 (forgot-password + reset-password pages)
- [ ] pg_cron — Vercel Cron used instead (Stage 102 availability expiry). No Postgres-level background jobs.
- [ ] MCA RAG bulk indexing pipeline — document chunks inserted manually

---

## P0 — Must Fix Before Any Real User

| #   | Gap                                                    | Detail                                                                                                                                                                                    | Status | Stage | Notes                                                                                                                                                                                |
| --- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Email templates + SMTP provider**                    | Supabase default signup confirmation emails look like spam. Need branded sender domain (Resend/Postmark) + custom templates for: signup confirmation, password reset, email change.       | [x]    | 99    | Templates built. Production SMTP requires manual config — see `founder-todo.md`.                                                                                                     |
| 2   | **Offline / network error handling**                   | Zero `navigator.onLine` checks, zero retry logic. When fetch hangs on network drop, apply button stays disabled indefinitely with no error shown.                                         | [x]    | 97    |                                                                                                                                                                                      |
| 3   | **Inconsistent error feedback on destructive actions** | Three different error patterns across critical flows. Needs unified error feedback — toast on all failures.                                                                               | [x]    | 97    |                                                                                                                                                                                      |
| 4   | **Landing page**                                       | Root `/` shows design system preview for unauthenticated visitors. Need a product page explaining what DockWalker is before signup.                                                       | [x]    | 98    |                                                                                                                                                                                      |
| 5   | **Security headers**                                   | No HSTS, X-Frame-Options, X-Content-Type-Options. No `vercel.json` with headers config. Vercel provides HTTPS by default but app is vulnerable to clickjacking and content-type sniffing. | [x]    | 96    | HSTS, XFO, XCTO, Referrer-Policy, Permissions-Policy added. **CSP intentionally deferred** — Next.js inline scripts and Supabase/Stripe external calls require nonce-based approach. |

---

## P1 — Will Cause Pain Within First Week

| #   | Gap                                         | Detail                                                                                                                                                                                                                                                                                          | Status | Stage    | Notes                                                                                                                                                               |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | **Email notification fallback**             | Push works, but web-only users or users who denied push permission get nothing when accepted, messaged, or engagement starts tomorrow. Need transactional emails for: acceptance, new message, engagement reminder, job posted (optional).                                                      | [x]    | 101, 108 | Sends for DAYWORK.ACCEPTED, DAYWORK.APPLIED, MESSAGE.SENT. APPLIED email payload bug fixed in Stage 108. **Gap:** engagement reminder email not built (see P2 #17). |
| 7   | **Availability expiry reminder**            | 7-day windows auto-expire silently. No "your availability expires tomorrow" notification.                                                                                                                                                                                                       | [x]    | 102      |                                                                                                                                                                     |
| 8   | **Admin tooling**                           | No way to view all users, moderate content, investigate disputes, manually complete stuck engagements, or manage canonical data without raw SQL.                                                                                                                                                | [x]    | 103      |                                                                                                                                                                     |
| 9   | **Error tracking**                          | No Sentry or equivalent. Vercel logs exist but aren't structured, alertable, or searchable.                                                                                                                                                                                                     | [x]    | 100      | DSN-gated — needs Sentry account setup, see `founder-todo.md`.                                                                                                      |
| 10  | **Message polling lag**                     | Polling interval makes chat feel sluggish. Supabase Realtime matters for UX here.                                                                                                                                                                                                               | [x]    | 104, 108 | Realtime subscription works. Fallback polling cleanup bug fixed in Stage 108.                                                                                       |
| 11  | **Hat validation on employer write routes** | Accept, reject, shortlist, view, cancel-employer, checklist/toggle routes skip hat check and hardcode roleContext. Ownership check is the real auth gate, but hat/ledger inconsistency violates architectural spec. UI hides actions from wrong hat, so exploitation requires direct API calls. | [x]    | 109      | Hat check + dynamic roleContext on all 9 routes.                                                                                                                    |
| 12b | **Accept race condition**                   | Two concurrent accepts on a single-position daywork both pass the API stale check, creating a phantom second fill. Projection-level guard needed.                                                                                                                                               | [x]    | 110      | Positions-full pre-check in apply_projection DAYWORK.ACCEPTED handler.                                                                                              |

---

## P2 — Should Fix Before Scaling Past Early Adopters

| #   | Gap                                          | Detail                                                                                                                                                                            | Status | Stage | Notes                                                                                                                                               |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12  | **Deep links (Universal Links / App Links)** | iOS Universal Links and Android App Links need domain verification files at `/.well-known/`.                                                                                      | [~]    | 105   | File scaffolding complete. **Placeholders remain** for TEAM_ID, SHA256 fingerprint, PRODUCTION_DOMAIN. Needs manual config — see `founder-todo.md`. |
| 13  | **Analytics**                                | No way to measure: signups, job posts, apply-to-accept conversion, time-to-hire, DAU.                                                                                             | [x]    | 106   | Vercel Analytics + Speed Insights. Auto-configured on Vercel deployments.                                                                           |
| 14  | **Push retry / delivery resilience**         | Push delivery is fire-and-forget. If FCM/APNs returns transient error, notification is lost. No retry queue.                                                                      | [ ]    |       | Acceptable at launch scale.                                                                                                                         |
| 15  | **Avatar storage bucket (production)**       | Upload code works against local dev Supabase Storage. Production needs configured bucket with proper RLS policies.                                                                | [x]    | 107   | Migration 00039 creates bucket + RLS in all environments automatically.                                                                             |
| 16  | **Verify multi-event transactionality**      | Some routes use `append_events_batch` (transactional). Verify ALL multi-event routes use batch version.                                                                           | [x]    | 96    |                                                                                                                                                     |
| 17  | **Engagement reminder email**                | No "your engagement starts tomorrow" transactional email. Would need a cron job similar to availability expiry (Stage 102).                                                       | [ ]    |       | New item. Split from P1 #6 — separate feature requiring its own cron.                                                                               |
| 18  | **CSP header**                               | Content-Security-Policy not configured. Requires nonce-based approach for Next.js compatibility. Low risk at launch (other headers cover main vectors), higher value post-launch. | [ ]    |       | New item. Split from P0 #5.                                                                                                                         |

---

## What's Complete (No Action Needed)

| Area                                    | Readiness | Notes                                                                       |
| --------------------------------------- | --------- | --------------------------------------------------------------------------- |
| Database & event architecture           | 95%       | Stage 95 projection guards, Stage 103 admin projection                      |
| API routes & auth (70+ routes)          | 90%       | Complete, tested, RLS-enforced on all tables. Hat gap on 6 routes (P1 #11). |
| Push notifications (FCM + APNs)         | 90%       | Built and tested, needs credentials — see `founder-todo.md`                 |
| UI/UX (23 pages, swipe, chat, calendar) | 90%       | Error handling unified (Stage 97), landing page (Stage 98)                  |
| CI/CD & testing (4-job pipeline)        | 90%       | Comprehensive, 6 pre-commit hooks                                           |
| Rate limiting (Upstash Redis)           | 90%       | 100 req/60s global, 30 req/60s writes, graceful degradation                 |
| Capacitor (iOS + Android)               | 85%       | Projects generated, build scripts working, deep-link scaffolding done       |
| Docky AI advisor                        | 90%       | RAG pipeline, usage gating, conversation persistence                        |
| Billing (Stripe)                        | 85%       | Checkout, portal, webhooks — needs real product config                      |
| GDPR (export + soft delete)             | 95%       | PERSON.DEACTIVATED → DATA_SCRUBBED pipeline                                 |
| Email (auth + transactional)            | 85%       | Templates built, Resend integrated, one payload bug to fix                  |
| Error tracking (Sentry)                 | 90%       | SDK integrated, DSN-gated — needs Sentry account                            |
| Analytics (Vercel)                      | 95%       | Page views + web vitals, auto-configured on Vercel                          |

---

## Effort Estimates (Updated)

- **Remaining code fixes (Stages 108-109):** ~1-2 focused sessions
- **External config (`founder-todo.md`):** ~1-2 days of account setup, DNS, dashboard config
- **After code fixes + external config:** Soft launch in one port is viable
- **P2 items (14, 17, 18):** ~2-3 focused sessions, post-launch

---

## How to Use This Document

1. Before starting a session, check which items are still open
2. When completing an item, mark `[x]` and add the stage number
3. Items marked `[~]` are partially complete — check the Notes column
4. If an item turns out to be unnecessary, strike it through with `~~` and add a note
5. If new gaps are discovered, add them to the appropriate priority section
6. For external/config tasks, see `tasks/founder-todo.md`
7. This document is a planning artifact — implementation details go in `BUILD_STATE.md`
