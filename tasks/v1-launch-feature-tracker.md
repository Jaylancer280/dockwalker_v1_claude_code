# V1 Launch Feature Tracker

> **Created:** 2026-04-05. **Updated:** 2026-04-05 (post-Stage 199).
> **Authority:** Master tracker for all v1 launch features. Individual specs in their own files. `tasks/todo.md` has the current implementation queue.
> **Rule:** Everything in this file must be completed before launch. No intermittent releases. Features are ordered by dependency and priority.

---

## Progress Summary

| Category               | Total  | Done  | Not Started |
| ---------------------- | ------ | ----- | ----------- |
| Subscription & billing | 11     | 0     | 11          |
| Share to social        | 6      | 0     | 6           |
| Voice calling          | 8      | 0     | 8           |
| Document exchange      | 9      | 0     | 9           |
| WhatsApp notifications | 10     | 0     | 10          |
| External setup         | 12     | 0     | 12          |
| Deferred (post-launch) | 6      | 0     | 6           |
| **Total remaining**    | **62** | **0** | **62**      |

### Already completed (Stages 185-199)

These were in the original tracker and have been implemented. Removed from the active list:

- ~~Gate Docky profile reading behind Crew Pro~~ (Stage 197)
- ~~Tighten Docky system prompt — hallucination guard~~ (Stage 197)
- ~~Docky UI free vs pro tier messaging~~ (Stage 198)
- ~~Fix Docky usage pill not updating~~ (Stage 196)
- ~~Fix Docky auto-scroll during streaming~~ (Stage 197)
- ~~Invitation = direct hire (full rework: migration, API, projection, types, tests)~~ (Stage 199)
- ~~Gate Available Crew tab behind Crew Pro~~ (Stage 198 + tests)
- ~~Crew-side visibility upsell in availability overlay~~ (Stage 198)
- ~~Fix experience private fields (sea time + salary in GET)~~ (Stage 196)
- ~~Replace engineering epaulette icon (wrench → gear)~~ (Stage 196)
- ~~Show smoker + tattoos to employers (review cards + profile overlay)~~ (Stage 198)

---

## 1. Subscription & Billing Infrastructure

> Must be done before any paywall is active. Stripe products must be created first (see External Setup).
> **Spec:** `tasks/stripe-setup.md`

| #    | Feature                                                                                                              | Status      | Notes                                                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| 1.1  | Remove `crew_unlimited` from subscriptions CHECK constraint                                                          | NOT STARTED | Migration: update CHECK to allow only `free`, `crew_pro`, `employer_pro` |
| 1.2  | Remove `crew_unlimited` from `require-subscription.ts`                                                               | NOT STARTED | Remove from PLAN_RANK, update types                                      |
| 1.3  | Remove `crew_unlimited` from billing page + checkout route + webhook                                                 | NOT STARTED | All UI and API references                                                |
| 1.4  | Add `employer_pro` to subscriptions CHECK constraint                                                                 | NOT STARTED | Same migration as 1.1                                                    |
| 1.5  | Add `employer_pro` to `require-subscription.ts` + checkout + webhook                                                 | NOT STARTED | PLAN_RANK, price mapping, validation                                     |
| 1.6  | Change Docky free limit from 15 to 10/month                                                                          | NOT STARTED | In `advisor/thread/messages/route.ts` usageLimit + usage route           |
| 1.7  | Billing page: crew hat sees Crew Pro (€4.99), employer/agent hat sees Employer/Agent Pro (€14.99)                    | NOT STARTED | Hat-aware display, two Stripe checkout flows                             |
| 1.8  | Template cap enforcement (crew: 3 DW + 1 PM free, 5 DW + 2 PM pro)                                                   | NOT STARTED | Count at API layer on template POST routes. Reject with 402.             |
| 1.9  | Template cap enforcement (employer/agent: 3 DW + 1 PM free, unlimited pro)                                           | NOT STARTED | Same pattern, different caps                                             |
| 1.10 | Shortlist cap enforcement (3 free, 8 pro)                                                                            | NOT STARTED | Permanent shortlist API route + projection layer                         |
| 1.11 | Email-first notification pivot — rename "push" settings to "notification", master toggle, send emails for all events | NOT STARTED | See product decisions in stripe-setup.md                                 |

---

## 2. Share Job to Social

> Primary organic acquisition channel. No dependencies — can start immediately.
> **Spec:** `tasks/share-job-to-social-spec.md`
> **Priority:** HIGH — every day without this is organic growth left on the table.

| #   | Feature                                                       | Status      | Notes                                                                  |
| --- | ------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------- |
| 2.1 | Public job API route (`GET /api/jobs/[jobNumber]`)            | NOT STARTED | No auth, service role, NDA-safe, active jobs only                      |
| 2.2 | Public job detail page (`/jobs/[jobNumber]`)                  | NOT STARTED | Outside `(app)` layout, server-rendered, <1s load                      |
| 2.3 | Dynamic OG meta tags (`generateMetadata()`)                   | NOT STARTED | "Deckhand — Antibes, €250/day — DockWalker"                            |
| 2.4 | Share button component + placement                            | NOT STARTED | Web Share API + clipboard fallback. My Jobs, discover, public page.    |
| 2.5 | Middleware: add `/jobs/*` + `/api/jobs/*` to public allowlist | NOT STARTED | —                                                                      |
| 2.6 | Static OG image                                               | NOT STARTED | 1200x630, dark navy, logo, tagline. See `tasks/founder-drafts.md` § 7. |

---

## 3. Ephemeral Document Exchange

> 48-hour file sharing in engagement chat threads. Certs, contracts, visas.
> **Spec:** `tasks/ephemeral-document-exchange-spec.md`
> **Priority:** HIGH — closes the last platform exit point (WhatsApp for document sharing).

| #   | Feature                                                  | Status      | Notes                                                       |
| --- | -------------------------------------------------------- | ----------- | ----------------------------------------------------------- |
| 3.1 | Migration: `engagement_documents` table + storage bucket | NOT STARTED | Private bucket, service role, RLS on metadata               |
| 3.2 | Upload API route (`POST /api/messages/[id]/documents`)   | NOT STARTED | Magic byte validation, 10MB, 10 files, 20/engagement/24h    |
| 3.3 | Download API route (signed URL, 15min)                   | NOT STARTED | `Content-Disposition: attachment`, expiry check             |
| 3.4 | Delete API route (uploader only)                         | NOT STARTED | Hard-delete storage, soft-delete metadata                   |
| 3.5 | Cleanup cron (every 6 hours)                             | NOT STARTED | Delete expired files (48h)                                  |
| 3.6 | Chat UI: paperclip button + document message card        | NOT STARTED | Upload progress, download/expired/deleted states, countdown |
| 3.7 | Notifications on document upload                         | NOT STARTED | In-app + email: "{name} shared {n} documents"               |
| 3.8 | GDPR: extend data scrub + export                         | NOT STARTED | Delete storage on scrub. Export metadata for own uploads.   |
| 3.9 | Privacy policy update                                    | NOT STARTED | Document retention, deletion rights                         |

---

## 4. Voice Calling (Permanent Interviews)

> In-app WebRTC voice calls in permanent engagement chat threads.
> **Spec:** `tasks/permanent-voice-call-spec.md`
> **External setup:** Twilio account (NTS for TURN credentials)

| #   | Feature                                                     | Status      | Notes                                                                    |
| --- | ----------------------------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| 4.1 | TURN credentials API route                                  | NOT STARTED | `GET /api/calls/turn-credentials`. Twilio NTS. STUN fallback.            |
| 4.2 | Voice call hook (`use-voice-call.ts`)                       | NOT STARTED | RTCPeerConnection, getUserMedia, Realtime signaling, mute, cleanup       |
| 4.3 | Incoming call listener (global)                             | NOT STARTED | In app layout. Subscribes to `calls:{personId}`. Accept/decline overlay. |
| 4.4 | Call bar component                                          | NOT STARTED | Sticky top bar during call. Timer, mute, end.                            |
| 4.5 | Chat header call button (permanent only)                    | NOT STARTED | Phone icon, permanent engagements with active status only                |
| 4.6 | System message on call end                                  | NOT STARTED | "Voice call — {duration}"                                                |
| 4.7 | Vercel env vars: Twilio credentials                         | NOT STARTED | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`                                |
| 4.8 | Browser testing (Chrome, Firefox, Safari macOS, Safari iOS) | NOT STARTED | WebRTC quirks + background tab                                           |

---

## 5. WhatsApp Notifications

> Primary notification channel replacing email. Twilio WhatsApp Business API.
> **Spec:** `tasks/whatsapp-notifications-spec.md`
> **External setup:** Twilio WhatsApp sender access + Meta template approval (2-4 weeks lead time — start early).

| #    | Feature                                                                  | Status      | Notes                                                            |
| ---- | ------------------------------------------------------------------------ | ----------- | ---------------------------------------------------------------- |
| 5.1  | Migration: `notification_channels` table + `whatsapp_enabled` preference | NOT STARTED | Encrypted phone, owner-only RLS                                  |
| 5.2  | Register API route (accept phone, encrypt, send OTP)                     | NOT STARTED | —                                                                |
| 5.3  | Verify API route (validate OTP, mark verified)                           | NOT STARTED | —                                                                |
| 5.4  | Disconnect API route (hard-delete phone immediately)                     | NOT STARTED | Zero retention                                                   |
| 5.5  | Extend `notifyOnEvent()` with WhatsApp channel                           | NOT STARTED | Priority: WhatsApp > push > email. No duplicates. 5min cooldown. |
| 5.6  | WhatsApp send function (decrypt + Twilio API)                            | NOT STARTED | Fallback to email on failure                                     |
| 5.7  | Settings UI: WhatsApp section                                            | NOT STARTED | Phone input, verification flow, toggle                           |
| 5.8  | Vercel env vars: Twilio WhatsApp                                         | NOT STARTED | `TWILIO_WHATSAPP_FROM`, `NOTIFICATION_ENCRYPTION_KEY`            |
| 5.9  | GDPR: extend data scrub + export                                         | NOT STARTED | Delete channels row. Export own phone in DSAR.                   |
| 5.10 | Privacy policy update (WhatsApp opt-in, phone encryption)                | NOT STARTED | —                                                                |

---

## 6. External Setup (non-code tasks)

> Dashboard and account setup. Some have lead times (WhatsApp approval: 2-4 weeks).

| #    | Task                                                      | Status      | Where            | Notes                                                        |
| ---- | --------------------------------------------------------- | ----------- | ---------------- | ------------------------------------------------------------ |
| 6.1  | Create Stripe "Crew Pro" product (€4.99/month)            | NOT STARTED | Stripe Dashboard | Copy Price ID → `STRIPE_PRICE_CREW_PRO`                      |
| 6.2  | Create Stripe "Employer/Agent Pro" product (€14.99/month) | NOT STARTED | Stripe Dashboard | Copy Price ID → `STRIPE_PRICE_EMPLOYER_PRO`                  |
| 6.3  | Set up Stripe webhook endpoint                            | NOT STARTED | Stripe Dashboard | URL: `dockwalker.io/api/webhooks/stripe`                     |
| 6.4  | Set Vercel env vars (Stripe)                              | NOT STARTED | Vercel Dashboard | 4 vars: secret key, webhook secret, 2 price IDs              |
| 6.5  | Sign up Twilio + copy credentials                         | NOT STARTED | Twilio Console   | For voice calling + WhatsApp                                 |
| 6.6  | Set Vercel env vars (Twilio)                              | NOT STARTED | Vercel Dashboard | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`                    |
| 6.7  | Request Twilio WhatsApp sender access                     | NOT STARTED | Twilio Console   | Business verification. 2-4 week process. START EARLY.        |
| 6.8  | Submit 11 WhatsApp message templates to Meta              | NOT STARTED | Twilio Console   | 24-48h approval per template                                 |
| 6.9  | Generate `NOTIFICATION_ENCRYPTION_KEY`                    | NOT STARTED | Local            | AES-256-GCM key → Vercel env vars                            |
| 6.10 | Sign Twilio DPA (GDPR)                                    | NOT STARTED | Twilio Console   | Required for phone number processing                         |
| 6.11 | Update privacy policy (documents + WhatsApp)              | NOT STARTED | —                | Document retention, WhatsApp opt-in, encryption              |
| 6.12 | Create static OG image (1200x630)                         | NOT STARTED | Design           | Dark navy, logo, tagline. See `tasks/founder-drafts.md` § 7. |

---

## 7. Deferred (post-launch, specced)

> Complete specs exist but prerequisites not met. Do not build until criteria are satisfied.

| Feature                                        | Spec                               | Prerequisite                                |
| ---------------------------------------------- | ---------------------------------- | ------------------------------------------- |
| Docky job matching                             | `tasks/docky-job-matching-spec.md` | 20+ active postings per region per role     |
| Structured candidate match view                | `tasks/stripe-setup.md`            | Employer Pro live + applicant volume        |
| Annual billing (€39.99 crew, €119.99 employer) | `tasks/stripe-setup.md`            | Subscription infrastructure stable          |
| Free trial period                              | `tasks/stripe-setup.md`            | Subscription infrastructure stable          |
| Dunning emails                                 | `tasks/stripe-setup.md`            | Stripe subscriptions active with real users |
| Usage analytics (conversion, churn)            | `tasks/stripe-setup.md`            | Meaningful subscriber count                 |

---

## Recommended Build Order

Everything ships before launch. This order optimises for dependency resolution and impact:

**1. Share to Social (2.1-2.6)** — no dependencies, highest acquisition impact. Ship first.

**2. Subscription infrastructure (1.1-1.7)** — foundation for all paywalls. External setup (6.1-6.4) must happen in parallel.

**3. Template + shortlist caps (1.8-1.10)** — completes the paywall feature set.

**4. Notification pivot (1.11)** — email-first, rename push labels. Needed before WhatsApp work.

**5. Ephemeral documents (3.1-3.9)** — closes the "send docs via WhatsApp" exit.

**6. Voice calling (4.1-4.8)** — keeps permanent interviews in-app. Twilio setup (6.5-6.6) in parallel.

**7. WhatsApp notifications (5.1-5.10)** — Twilio approval (6.7-6.10) takes 2-4 weeks. Start 6.7 NOW even if code work is later.
