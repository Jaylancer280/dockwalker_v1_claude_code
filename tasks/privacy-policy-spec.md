# Privacy Policy Spec — DockWalker

> Technical specification for the privacy policy page. Maps every data flow in the codebase
> to a disclosure. A lawyer MUST review before publication.
>
> Base: `tasks/founder-drafts.md` Section 2 (2026-03-26 draft).
> Updated: 2026-04-12 to cover features added since the original draft.

## Status

- [ ] Lawyer review
- [ ] Fill in placeholders in `apps/web/src/lib/legal-placeholders.ts`: companyName (Nautalink Technologies, Inc. — confirm), registeredAddress, jurisdiction, supportEmail, dpoEmail, supabaseRegion
- [x] Create `/privacy` page (Stage 214)
- [x] Create `/terms` page (Stage 214)

---

## 1. Identity

**Data controller:** Nautalink Technologies, Inc., [REGISTERED ADDRESS]

**Application:** DockWalker (web at dockwalker.io, iOS and Android apps planned)

---

## 2. Data Collected

| Data                                     | Where collected              | DB table/column                                                | Purpose                                              | Legal basis         |
| ---------------------------------------- | ---------------------------- | -------------------------------------------------------------- | ---------------------------------------------------- | ------------------- |
| Email, password                          | Signup                       | `auth.users`                                                   | Authentication                                       | Contract            |
| Display name, deck name                  | Onboarding, profile          | `profiles.display_name`, `profiles.deck_name`                  | Identity in app                                      | Contract            |
| Nationality, visa types                  | Profile                      | `profiles.nationality_id`, `profiles.visa_type_ids`            | Employer review                                      | Consent             |
| Profile photo                            | Profile                      | `avatars` storage bucket, `profiles.avatar_url`                | Identity                                             | Consent             |
| Certifications declared                  | Profile                      | `profiles.certification_ids`                                   | Job matching, cert-gating permanent applications     | Consent             |
| Role, department                         | Profile, onboarding          | `profiles.role_id`                                             | Job matching                                         | Consent             |
| Vessel experience history                | Profile                      | `experiences` (via events)                                     | Employer review                                      | Consent             |
| Sea time (days at sea, nautical miles)   | Profile                      | `profiles.total_days_at_sea`, `profiles.total_nautical_miles`  | Experience display                                   | Consent             |
| Location preference (region, city, port) | Availability, posting        | `availability_windows`, `dayworks`, `permanent_postings`       | Job matching                                         | Consent             |
| Availability dates                       | Availability                 | `availability_windows`                                         | Daywork matching (rolling 14-day)                    | Consent             |
| Permanent availability status            | Profile                      | `profiles.permanent_availability`                              | Permanent job matching                               | Consent             |
| Application history                      | Apply actions                | `applications`                                                 | Service operation                                    | Contract            |
| Engagement history                       | Accept/select actions        | `active_engagements`                                           | Service operation, dispute resolution                | Contract            |
| Chat messages                            | In-app messaging             | `messages`                                                     | Communication between parties                        | Contract            |
| Shared documents                         | Document upload in chat      | `engagement_documents` + `engagement-documents` storage bucket | Document exchange (48h expiry)                       | Contract            |
| Voice call metadata                      | Voice calls (permanent only) | System message in `messages` (duration only)                   | Call record                                          | Contract            |
| Engagement ratings                       | Post-engagement              | `engagement_ratings`                                           | Internal quality signal (NEVER shown to other users) | Legitimate interest |
| Device token (push)                      | Push registration            | `device_tokens`                                                | Push notifications                                   | Consent             |
| Device fingerprint (one-way hash)        | Account creation             | `persons.device_hash`                                          | Abuse detection after deletion                       | Legitimate interest |
| Notification preferences                 | Settings                     | `notification_preferences`                                     | Channel control                                      | Consent             |
| WhatsApp number (optional)               | Settings                     | `whatsapp_registrations`                                       | WhatsApp notification opt-in                         | Consent             |
| Subscription data                        | Billing                      | `subscriptions`                                                | Billing (via Stripe)                                 | Contract            |
| Docky AI conversations                   | Docky tab                    | `advisor_conversations`, `advisor_messages`                    | AI career guidance                                   | Consent             |
| Docky usage count                        | Docky tab                    | `advisor_usage`                                                | Free tier enforcement                                | Contract            |
| Browser theme preference                 | Settings                     | `localStorage: dw-theme`                                       | UI preference                                        | Legitimate interest |
| Lookups cache                            | Automatic                    | `localStorage: dw-lookups`                                     | Performance (24h cache of canonical data)            | Legitimate interest |

---

## 3. Data NOT Collected

- Precise GPS location (we use port/marina selection only)
- Browsing activity outside DockWalker
- Voice call audio (calls are peer-to-peer WebRTC, not recorded or transcribed)
- Salary/payment between crew and employers
- Social media accounts
- Biometric data

---

## 4. Data Visibility

| Data                                    | Who can see it                                                   |
| --------------------------------------- | ---------------------------------------------------------------- |
| Profile (name, role, certs, experience) | All authenticated users (via profile overlay or review)          |
| Applications                            | Applicant + posting employer only                                |
| Chat messages                           | The two parties in the engagement only                           |
| Shared documents                        | The two parties in the engagement only (48h expiry, soft-delete) |
| NDA vessel identity (IMO, name)         | Hidden until daywork acceptance or permanent selection           |
| Engagement ratings                      | DockWalker internal only — NEVER shown to other users            |
| Availability                            | All authenticated users (discover feed filtering)                |
| Salary/rate on postings                 | All authenticated users (informational, not negotiable in-app)   |

---

## 5. Third-Party Services

| Service                     | Purpose                                    | Data shared                                                               | Data storage location                                                   |
| --------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Supabase**                | Database, auth, file storage, Realtime     | All application data                                                      | [SUPABASE REGION]                                                       |
| **Vercel**                  | Web hosting, serverless functions          | HTTP request logs, response data                                          | US/EU (Vercel edge)                                                     |
| **Stripe**                  | Subscription billing                       | Email, subscription plan, payment method (Stripe-side)                    | Stripe infrastructure                                                   |
| **Resend**                  | Transactional email                        | Email address, notification content                                       | US                                                                      |
| **Anthropic (Claude)**      | AI advisor (Docky)                         | User messages, crew profile context (role, certs, experience — no salary) | Anthropic infrastructure (not retained beyond processing per API terms) |
| **Expo Push Service**       | Push notifications (abstracts APNs + FCM)  | Device token, notification title/body                                     | Expo infrastructure                                                     |
| **Apple APNs / Google FCM** | Push delivery                              | Device token, notification payload                                        | Apple/Google infrastructure                                             |
| **Twilio**                  | WhatsApp notifications (opt-in)            | Phone number, notification content                                        | Twilio infrastructure                                                   |
| **Upstash Redis**           | Rate limiting                              | Request metadata (IP, user ID)                                            | Upstash infrastructure                                                  |
| **Sentry**                  | Error tracking (conditional, requires DSN) | Error context, user ID (not PII), stack traces                            | Sentry infrastructure                                                   |
| **Vercel Analytics**        | Usage metrics                              | Anonymous page view data                                                  | Vercel infrastructure                                                   |
| **Vercel Speed Insights**   | Performance metrics                        | Web Vitals data                                                           | Vercel infrastructure                                                   |

**Not used:** OpenAI (listed in original draft but not in current codebase — MCA chunks use Supabase pgvector + Anthropic only). Google Analytics. Advertising networks. Data brokers.

---

## 6. AI Disclosure (Docky)

Docky is an AI career advisor powered by Anthropic's Claude API. When using Docky:

- Your messages are sent to Anthropic's API for processing
- Your crew context (role, certifications, experience bracket, vessel size exposure) is included to personalise responses
- **Your salary, contact details, and private engagement data are NOT sent to the AI**
- Conversation history is stored in DockWalker's database (`advisor_conversations`, `advisor_messages`)
- Anthropic does not retain API inputs/outputs beyond processing (per their API terms)
- Free tier: 3 questions per calendar month. Pro tier: higher limits
- Docky responses are informational — DockWalker does not guarantee the accuracy of AI-generated career advice
- MCA regulatory corpus (public document) is used for retrieval-augmented generation — no personal data in the corpus

---

## 7. Voice Calls

- Available for permanent position engagements only
- Peer-to-peer WebRTC (audio travels directly between browsers, not through DockWalker servers)
- TURN relay credentials provided by DockWalker for NAT traversal (Supabase Realtime signaling)
- **No audio is recorded, stored, or transcribed by DockWalker**
- Only metadata stored: a system message in the chat thread recording call duration (e.g., "Voice call - 12m 34s")

---

## 8. Document Sharing

- Users can share documents (PDF, images) within engagement chat threads
- Documents stored in Supabase private storage bucket (`engagement-documents`)
- Documents expire after 48 hours (automatic cleanup via cron)
- Documents are soft-deleted (marked as deleted, storage object removed)
- Only the two parties in the engagement can access documents
- DockWalker does not verify, read, or process uploaded document content
- File size limit enforced, magic byte validation for file type

---

## 9. GDPR Rights

| Right                   | How to exercise                                     | Implementation                                           |
| ----------------------- | --------------------------------------------------- | -------------------------------------------------------- |
| **Access**              | Settings > "Export my data"                         | JSON export of all personal data (`/api/account/export`) |
| **Rectification**       | Edit profile at any time                            | Direct profile editing                                   |
| **Erasure**             | Settings > "Delete account"                         | 30-day retention, then `PERSON.DATA_SCRUBBED` event      |
| **Portability**         | Settings > "Export my data"                         | Same JSON export                                         |
| **Object**              | Contact [DPO EMAIL]                                 | Manual processing                                        |
| **Restrict processing** | Contact [DPO EMAIL]                                 | Manual processing                                        |
| **Withdraw consent**    | Deactivate account, adjust notification preferences | Self-service                                             |

---

## 10. Data Retention

| Data type                | Retention period          | After deletion                                               |
| ------------------------ | ------------------------- | ------------------------------------------------------------ |
| Active account data      | Life of account           | N/A                                                          |
| Deactivated account PII  | 30 days post-deactivation | Scrubbed (`DATA_SCRUBBED` event)                             |
| Event ledger structure   | Indefinite                | Anonymised (PII removed, event structure retained for audit) |
| Device fingerprint hash  | 12 months post-deletion   | Deleted                                                      |
| Chat messages            | Indefinite (append-only)  | Anonymised on data scrub                                     |
| Shared documents         | 48 hours (auto-expiry)    | Storage object deleted, DB record soft-deleted               |
| Docky conversations      | Life of account           | Scrubbed on data scrub                                       |
| Push notification tokens | Life of account           | Deleted on deactivation                                      |

---

## 11. Cookies & Local Storage

| Item                            | Type           | Purpose                                    | Expiry           |
| ------------------------------- | -------------- | ------------------------------------------ | ---------------- |
| Supabase auth cookies           | Cookie         | Session management, JWT refresh            | Session / 1 week |
| `dw-theme`                      | localStorage   | UI theme preference (light/dark)           | Indefinite       |
| `dw-lookups`                    | localStorage   | Canonical data cache (roles, certs, ports) | 24 hours         |
| `dockwalker:messages-tab`       | sessionStorage | Remember active tab on messages page       | Session          |
| `dockwalker:daywork-post-draft` | sessionStorage | Preserve unsaved post form data            | Session          |

No tracking cookies. No third-party advertising cookies. No cookie consent banner required for functional cookies — but check jurisdiction requirements.

---

## 12. Security Measures

- Row Level Security (RLS) on every database table
- JWT authentication with automatic token refresh
- Rate limiting (100 requests/60s global, 30/60s write)
- Body size limits on API routes (1MB)
- Avatar upload: magic byte validation
- Document upload: file type + size validation
- HTTPS everywhere (Vercel enforced)
- Security headers via `vercel.json`
- Sentry error tracking (conditional, DSN-gated)
- No sensitive data in client-side error reports

---

## 13. International Transfers

Data may be processed in:

- [SUPABASE REGION] (primary database)
- United States (Vercel hosting, Stripe billing, Resend email, Anthropic AI, Expo push)
- Per-user device location (WebRTC voice calls are peer-to-peer)

Standard Contractual Clauses or equivalent safeguards apply where required by GDPR for transfers outside the EEA.

---

## 14. Age Restriction

DockWalker is intended for users aged 18 and over. Maritime employment requires adult status in virtually all jurisdictions. We do not knowingly collect data from minors.

---

## 15. Changes to Policy

Material changes communicated via email and/or in-app notification. Continued use after notification constitutes acceptance.

---

## 16. Contact

- Data Protection Officer: [DPO EMAIL]
- General support: [SUPPORT EMAIL]
- Postal: [REGISTERED ADDRESS]

---

## Implementation Checklist

- [ ] Lawyer review of this spec + the Terms of Service in `tasks/founder-drafts.md`
- [ ] Fill ALL placeholders in `apps/web/src/lib/legal-placeholders.ts`
- [ ] Decide: cookie consent banner needed for target jurisdictions? (Functional cookies only — likely not required under GDPR, but check local law)
- [x] Create `apps/web/src/app/privacy/page.tsx` — static page rendering this policy (Stage 214)
- [x] Create `apps/web/src/app/terms/page.tsx` — static page rendering the ToS (Stage 214)
- [x] Add Terms of Service link to landing page footer alongside Privacy Policy (pre-existing footer, verified live)
- [x] Add pre-signup consent line on the signup form linking to /terms + /privacy (Stage 214)
- [x] Add privacy policy + terms links to Settings page (Stage 214)
- [ ] Verify data export (`/api/account/export`) covers all data listed in Section 2
- [ ] Verify data scrub (`PERSON.DATA_SCRUBBED`) covers all PII listed in Section 2
