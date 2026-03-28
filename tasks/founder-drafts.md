# Founder Drafts — Copy & Content for Review

> AI-drafted content for founder review. Nothing here is live — it all needs your approval
> before the implementation agent uses it. Edit freely, or reject and rewrite.
>
> Generated: 2026-03-26

---

## 1. Terms of Service (Draft)

> Have a lawyer review before publishing. This covers the key areas but is not legal advice.

**DOCKWALKER TERMS OF SERVICE**

Last updated: [DATE]

**1. What DockWalker Is**

DockWalker is a hiring platform for the superyacht industry. It connects crew seeking daywork and permanent positions with employers and agencies posting roles. It is not an employment agency and does not employ crew or guarantee placements.

**2. Eligibility**

You must be at least 18 years old to use DockWalker. By creating an account, you confirm you are legally permitted to work in the maritime industry in the jurisdictions where you seek employment.

**3. Accounts**

- One account per person. Duplicate accounts may be deactivated.
- You are responsible for keeping your login credentials secure.
- You may switch between crew and employer roles using the hat switcher. Agency agents cannot switch roles.
- Providing false information (including certifications you do not hold) is grounds for immediate account deactivation.

**4. Certification Declarations**

DockWalker does not verify certifications. Crew self-declare which certifications they hold. Misrepresentation of certifications is a serious breach of these terms and may result in permanent account deactivation. Employers should independently verify certifications before engagement.

**5. NDA Vessels**

Employers may mark vessels as NDA. Vessel identity (including IMO number) is hidden from crew until the crew member accepts a daywork engagement or is selected for a permanent role. Once revealed, crew must treat vessel identity as confidential.

**6. Messaging**

Messages sent through DockWalker are retained on our servers. Messages cannot be deleted by users. Do not share sensitive personal information (bank details, passport numbers) through in-app messaging.

**7. Payments & Subscriptions**

DockWalker may offer paid subscription tiers. Subscriptions are processed through Stripe. Recurring charges continue until cancelled. You may cancel at any time; access continues until the end of the billing period. Refunds are handled on a case-by-case basis.

DockWalker does not process payments between crew and employers. Day rates and salaries displayed on postings are informational. Payment for work performed is a matter between the crew member and the employer.

**8. Content & Conduct**

You must not:

- Post fraudulent job listings
- Harass, threaten, or abuse other users
- Use the platform for any purpose other than legitimate superyacht hiring
- Attempt to circumvent platform mechanics (e.g., automated applications)
- Scrape, crawl, or extract data from DockWalker

**9. Account Deactivation & Data**

You may deactivate your account at any time from the Settings page. After deactivation:

- Your profile is hidden from other users immediately
- Your data is retained for 30 days (for fraud prevention and dispute resolution)
- After 30 days, personal data is scrubbed (PERSON.DATA_SCRUBBED)
- Event structure is retained for audit integrity, but all personally identifiable information is removed

You may request a full export of your data at any time from Settings (GDPR data portability).

**10. Privacy**

See our Privacy Policy for details on data collection, storage, and your rights.

**11. Limitation of Liability**

DockWalker is provided "as is." We do not guarantee:

- That any posting will receive applications
- That any application will result in employment
- The accuracy of information provided by other users
- Continuous, uninterrupted access to the platform

To the maximum extent permitted by law, DockWalker's liability is limited to the amount you paid for your subscription in the 12 months preceding the claim.

**12. Changes to These Terms**

We may update these terms. Continued use after changes constitutes acceptance. Material changes will be communicated via email or in-app notification.

**13. Governing Law**

These terms are governed by the laws of [JURISDICTION — e.g., England and Wales]. Disputes will be resolved in the courts of [JURISDICTION].

**14. Contact**

[SUPPORT EMAIL]

---

## 2. Privacy Policy (Draft)

> Have a lawyer review. Designed for GDPR compliance.

**DOCKWALKER PRIVACY POLICY**

Last updated: [DATE]

**1. Who We Are**

DockWalker is operated by [COMPANY NAME], [REGISTERED ADDRESS]. We are the data controller for the personal information collected through the DockWalker application and website.

**2. What We Collect**

| Data                                   | Purpose                                | Legal Basis                        |
| -------------------------------------- | -------------------------------------- | ---------------------------------- |
| Email address, password                | Account authentication                 | Contract performance               |
| Display name, nationality, visa status | Profile visible to other users         | Consent (you choose what to share) |
| Certifications declared                | Job matching, eligibility gating       | Legitimate interest                |
| Vessel experience history              | Profile, employer review               | Consent                            |
| Location (region, city, port)          | Job matching, availability             | Consent                            |
| Availability dates                     | Daywork matching                       | Consent                            |
| Application and engagement history     | Service operation, dispute resolution  | Contract performance               |
| Messages sent in-app                   | Communication between parties          | Contract performance               |
| Device token (push notifications)      | Delivering notifications               | Consent                            |
| Device fingerprint (one-way hash)      | Abuse detection after account deletion | Legitimate interest                |
| Avatar photo                           | Profile display                        | Consent                            |
| Subscription and payment data          | Billing (processed by Stripe)          | Contract performance               |

**3. What We Do NOT Collect**

- We do not collect precise GPS location
- We do not track browsing activity outside DockWalker
- We do not sell personal data to third parties
- We do not use personal data for advertising

**4. How We Store Data**

- All data is stored in Supabase (PostgreSQL) with Row Level Security
- Domain state is derived from an append-only event ledger — events are never deleted or mutated
- Messages are retained server-side and cannot be deleted by users
- Data is hosted in [SUPABASE REGION — e.g., EU (Frankfurt) / US (Virginia)]

**5. Who Can See Your Data**

- **Your profile:** Visible to authenticated users (crew, employers, agents)
- **Your applications:** Visible only to you and the posting employer
- **Your messages:** Visible only to you and the other party in the engagement
- **Your certifications:** Visible on your profile to all authenticated users
- **NDA vessel details:** Hidden until engagement acceptance/selection
- **Ratings:** Private — visible only to DockWalker internally, never surfaced to other users

**6. Third-Party Services**

| Service                 | Purpose                      | Data Shared                                                       |
| ----------------------- | ---------------------------- | ----------------------------------------------------------------- |
| Supabase                | Database, auth, file storage | All application data                                              |
| Stripe                  | Payment processing           | Email, subscription plan                                          |
| Resend                  | Transactional email          | Email address, notification content                               |
| Anthropic (Claude)      | AI advisor (Docky)           | Conversation messages (not stored by Anthropic beyond processing) |
| OpenAI                  | Document embeddings          | MCA document chunks (no personal data)                            |
| Apple APNs / Google FCM | Push notifications           | Device token, notification title/body                             |
| Sentry                  | Error tracking               | Error context (may include user ID, not PII)                      |
| Vercel                  | Hosting                      | HTTP request logs                                                 |

**7. Your Rights (GDPR)**

You have the right to:

- **Access** your data — use the "Export my data" feature in Settings
- **Rectify** your data — edit your profile at any time
- **Delete** your data — use "Delete account" in Settings (30-day retention, then scrub)
- **Port** your data — the export feature provides a JSON file with all your data
- **Object** to processing — contact us at [SUPPORT EMAIL]
- **Withdraw consent** — deactivate your account or adjust notification preferences

**8. Data Retention**

- Active accounts: data retained for the life of the account
- Deactivated accounts: personal data scrubbed after 30 days
- Event structure (anonymised): retained indefinitely for audit integrity
- Device fingerprint hash: retained for 12 months after account deletion (abuse prevention)

**9. Children**

DockWalker is not intended for anyone under 18. We do not knowingly collect data from minors.

**10. Changes**

We will notify you of material changes via email or in-app notification.

**11. Contact**

Data protection inquiries: [DPO EMAIL]
General: [SUPPORT EMAIL]

---

## 3. Subscription Email Copy (Draft)

> Subject line and body for the email sent when user taps "Email me" on a tier.
> Tier names are placeholders — replace when decided.

**Subject:** Your DockWalker upgrade link

**Body:**

Hi {displayName},

You requested info about **{tierName}** on DockWalker.

Tap below to complete your upgrade:

[**Upgrade now** → {webPurchaseUrl}]

This link expires in 24 hours. If it expires, just tap "Email me" again in the app.

What you get with {tierName}:
{featureBullets — dynamically inserted from tier config}

After purchase, open the DockWalker app — your subscription will be active immediately.

Questions? Reply to this email.

— The DockWalker Team

[Manage notifications → {settingsUrl}]

---

## 4. Billing Page Tier Copy (Draft)

> Placeholder tier structure. Replace names, descriptions, and features when decided.
> No prices shown (IAP bypass).

```
Tier 1: Free
- 3 Docky questions per month
- Browse all daywork and permanent jobs
- Apply to jobs
- Set availability
- In-app messaging after acceptance

Tier 2: [Pro / Premium / Plus — name TBD]
- Unlimited Docky questions
- Personalised career guidance
- [Additional gated features TBD]
- Priority support

Tier 3 (if needed): [name TBD]
- Everything in Tier 2
- [Additional gated features TBD]
```

---

## 5. NDA Toggle Copy Options

> Current: "Hide vessel identity from crew"
> Pick one, or write your own:

**Option A (recommended — concise):**
"Hide vessel identity from crew until they accept a position"

**Option B (two-line):**
"Hide vessel identity from crew"
"Details including IMO revealed on acceptance"

**Option C (explicit):**
"NDA — crew see vessel type and size only. Full details revealed when they accept a daywork engagement or are selected for a permanent role."

---

## 6. App Store Description (Draft)

> For both iOS App Store and Google Play Console listing.

**Title:** DockWalker — Superyacht Crew Hiring

**Subtitle:** Daywork and permanent yacht jobs

**Description:**

DockWalker is the hiring app for the superyacht industry.

**For crew:**
Find daywork fast. Swipe through available jobs, apply in one tap, and get hired for 1-14 day engagements. Set your availability, showcase your experience and certifications, and let employers come to you.

Looking for something longer? Browse permanent positions with structured applications, shortlisting, and direct messaging with employers after selection.

One profile. Both job types. No WhatsApp groups, no dockwalking chaos.

**For employers and agencies:**
Post daywork or permanent roles in under 60 seconds. Review structured crew profiles with certifications, experience, and vessel history. Accept crew with a swipe, manage engagements with in-app messaging, and use templates for repeat postings.

**Features:**

- Swipe-to-hire for daywork (1-14 day engagements)
- Structured permanent job pipeline (shortlist, select, negotiate)
- Certification-gated applications for permanent roles
- NDA vessel protection
- In-app messaging after acceptance
- Pre-arrival checklists
- Availability calendar with location
- Docky AI advisor for MCA cert guidance
- Templates for repeat posting
- Native iOS and Android app

**Built for maritime professionals in Antibes, Palma, Fort Lauderdale, Caribbean, Bahamas, Dubai, and Turkey.**

No reputation scores. No pay-to-rank. No hidden algorithms. Just structured, fair hiring.

**Keywords:** superyacht, yacht crew, daywork, maritime jobs, crew hiring, yacht jobs, deckhand, stewardess, yachting, marine recruitment

**Category:** Business (iOS) / Business (Android)

---

## 7. OG Social Sharing Image Spec

> For the implementation agent to generate. You approve the result.

**Dimensions:** 1200 x 630px
**Background:** Dark navy #0B1A2E (matches app theme)
**Content:**

- DockWalker logo centred, ~200px wide
- Below logo: "Superyacht hiring, simplified" in white, 32px, regular weight
- Below tagline: "Daywork & permanent positions" in #8B9DB8 (muted), 20px
  **File path:** `apps/web/public/images/brand/og-image.png`
  **Format:** PNG (no transparency needed — solid background)

---

## 8. Confirmation Overlay Field Labels (Draft)

> For the post confirmation overlay. Compact key:value layout.

**Daywork posting confirmation:**

- Role: {roleName}
- Vessel: {M/Y or S/Y} {vesselName} {ndaBadge}
- Location: {region} → {city} → {port}
- Dates: {startDate} – {endDate} ({workingDays} working days)
- Day rate: {currencySymbol}{dayRate}/day
- Positions: {positionsAvailable}
- Certs required: {certList or "None"}
- Languages: {languageList or "None"}
- Meals: {mealsList or "None"}
- Notes: {notesTruncated}

**Permanent posting confirmation:**

- Role: {roleName}
- Vessel: {M/Y or S/Y} {vesselName} {ndaBadge}
- Location: {region} → {city} → {port}
- Start date: {startDate or "ASAP"}
- Salary: {currencySymbol}{salaryMin}–{salaryMax} / {period}
- Live aboard: {Yes/No}
- Shortlist cap: {cap} candidates
- Certs required: {certList or "None"}
- Languages: {languageList or "None"}
- Experience: {bracketLabel or "Any"}
- Notes: {notesTruncated}
