# V1 Launch Feature Tracker

> **Created:** 2026-04-05. **Updated:** 2026-04-07 (voice calling Sessions 1-2 complete).
> **Authority:** Master tracker for all v1 launch features. Individual specs in their own files. `tasks/todo.md` has the current implementation queue.
> **Rule:** Everything in this file must be completed before launch. No intermittent releases.

---

## Progress Summary

| Category               | Total  | Done   | Not Started |
| ---------------------- | ------ | ------ | ----------- |
| Subscription & billing | 11     | 11     | 0           |
| Share to social        | 6      | 6      | 0           |
| Voice calling          | 8      | 6      | 2           |
| Document exchange      | 9      | 9      | 0           |
| WhatsApp notifications | 10     | 10     | 0           |
| External setup         | 12     | 2      | 10          |
| Deferred (post-launch) | 6      | 0      | 6           |
| **Total**              | **62** | **44** | **18**      |

### Completed

- ~~Gate Docky profile reading behind Crew Pro~~ (Stage 197)
- ~~Tighten Docky system prompt — hallucination guard~~ (Stage 197)
- ~~Docky UI free vs pro tier messaging~~ (Stage 198)
- ~~Fix Docky usage pill not updating~~ (Stage 196)
- ~~Fix Docky auto-scroll during streaming~~ (Stage 197)
- ~~Invitation = direct hire~~ (Stage 199)
- ~~Gate Available Crew tab behind Crew Pro~~ (Stage 198)
- ~~Crew-side visibility upsell~~ (Stage 198)
- ~~Fix experience private fields~~ (Stage 196)
- ~~Replace engineering epaulette icon~~ (Stage 196)
- ~~Show smoker + tattoos to employers~~ (Stage 198)
- ~~Share Job to Social (full: API, page, OG tags, share button, middleware, OG image)~~ (Stage 200)
- ~~Subscription plan cleanup (remove crew_unlimited, add employer_pro)~~ (migration 00089)
- ~~Hat-aware billing page~~
- ~~Template cap enforcement~~
- ~~Shortlist cap enforcement~~
- ~~Docky free limit 15→10~~
- ~~WhatsApp notifications (full: migration, API, encryption, dispatch, UI, GDPR)~~ (migrations 00087-00088)
- ~~Ephemeral document exchange (full: migration, upload/download/delete, cron, chat UI, GDPR)~~ (migrations 00090-00091)
- ~~Agent profile enhancements, department specialisations, placement cities~~
- ~~Date input, ExpandableText, textarea auto-expand, text overflow audit~~
- ~~Contract type drill-down, vessel fuzzy search~~
- ~~Voice calling Sessions 1-2 (TURN credentials, WebRTC hook, call bar, incoming call listener, chat integration, system message, VoiceCallContext)~~

---

## 1. Subscription & Billing Infrastructure — DONE (10/11)

| #    | Feature                                                        | Status                                                                                       |
| ---- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1.1  | Remove `crew_unlimited` + add `employer_pro` (migration 00089) | DONE                                                                                         |
| 1.2  | Update `require-subscription.ts`                               | DONE                                                                                         |
| 1.3  | Remove `crew_unlimited` from billing + checkout + webhook      | DONE                                                                                         |
| 1.4  | Add `employer_pro` to CHECK                                    | DONE                                                                                         |
| 1.5  | Add `employer_pro` to checkout + webhook                       | DONE                                                                                         |
| 1.6  | Docky free limit 15→10                                         | DONE                                                                                         |
| 1.7  | Hat-aware billing page                                         | DONE                                                                                         |
| 1.8  | Template cap (crew)                                            | DONE                                                                                         |
| 1.9  | Template cap (employer/agent)                                  | DONE                                                                                         |
| 1.10 | Shortlist cap                                                  | DONE                                                                                         |
| 1.11 | ~~Email-first notification pivot~~                             | SUPERSEDED — WhatsApp dispatch (section 5) replaced this. Priority: WhatsApp > push > email. |

---

## 2. Share Job to Social — DONE (6/6)

| #       | Feature   | Status |
| ------- | --------- | ------ |
| 2.1-2.6 | All items | DONE   |

---

## 3. Ephemeral Document Exchange — DONE (9/9)

| #       | Feature   | Status |
| ------- | --------- | ------ |
| 3.1-3.9 | All items | DONE   |

---

## 4. Voice Calling — IN PROGRESS (6/8)

| #   | Feature                                  | Status                                  |
| --- | ---------------------------------------- | --------------------------------------- |
| 4.1 | TURN credentials API route               | DONE                                    |
| 4.2 | Voice call hook (`use-voice-call.ts`)    | DONE                                    |
| 4.3 | Incoming call listener (global)          | DONE                                    |
| 4.4 | Call bar component                       | DONE                                    |
| 4.5 | Chat header call button (permanent only) | DONE                                    |
| 4.6 | System message on call end               | DONE                                    |
| 4.7 | Vercel env vars: Twilio                  | NOT STARTED (user action)               |
| 4.8 | Browser testing                          | NOT STARTED (manual, needs two devices) |

---

## 5. WhatsApp Notifications — DONE (10/10)

| #        | Feature   | Status |
| -------- | --------- | ------ |
| 5.1-5.10 | All items | DONE   |

---

## 6. External Setup (non-code tasks)

| #    | Task                                       | Status      | Notes                              |
| ---- | ------------------------------------------ | ----------- | ---------------------------------- |
| 6.1  | Create Stripe "Crew Pro" product           | NOT STARTED | Stripe Dashboard                   |
| 6.2  | Create Stripe "Employer/Agent Pro" product | NOT STARTED | Stripe Dashboard                   |
| 6.3  | Set up Stripe webhook endpoint             | NOT STARTED | Stripe Dashboard                   |
| 6.4  | Set Vercel env vars (Stripe)               | NOT STARTED | 4 vars                             |
| 6.5  | Sign up Twilio + copy credentials          | DONE        | Account created                    |
| 6.6  | Set Vercel env vars (Twilio)               | NOT STARTED | SID, auth token                    |
| 6.7  | Request Twilio WhatsApp sender access      | NOT STARTED | 2-4 weeks. START NOW.              |
| 6.8  | Submit WhatsApp message templates to Meta  | NOT STARTED | 24-48h per template                |
| 6.9  | Generate `NOTIFICATION_ENCRYPTION_KEY`     | NOT STARTED | `openssl rand -hex 32`             |
| 6.10 | Sign Twilio DPA (GDPR)                     | NOT STARTED | Required                           |
| 6.11 | Privacy policy update                      | DONE        | In code                            |
| 6.12 | Static OG image                            | DONE        | `public/images/brand/og-image.png` |

---

## 7. Deferred (post-launch, specced)

| Feature                         | Spec                               | Prerequisite                   |
| ------------------------------- | ---------------------------------- | ------------------------------ |
| Docky job matching              | `tasks/docky-job-matching-spec.md` | 20+ active postings per region |
| Structured candidate match view | `tasks/stripe-setup.md`            | Employer Pro live + volume     |
| Annual billing                  | `tasks/stripe-setup.md`            | Subscription stable            |
| Free trial period               | `tasks/stripe-setup.md`            | Subscription stable            |
| Dunning emails                  | `tasks/stripe-setup.md`            | Real subscribers               |
| Usage analytics                 | `tasks/stripe-setup.md`            | Meaningful subscriber count    |

---

## Remaining Work

**All code is complete.** Only manual testing + external setup remain.

**Manual testing (2 items):**

1. Voice calling browser testing (4.8) — needs two devices
2. Twilio env vars for TURN (4.7) — user sets in Vercel

**External setup (8 items):** 3. Stripe products + webhook + env vars (6.1-6.4) 4. Twilio env vars + WhatsApp approval + templates + encryption key + DPA (6.6-6.10)

**44 of 62 items complete (71%). All remaining items are user actions or manual testing — zero code work left.**
