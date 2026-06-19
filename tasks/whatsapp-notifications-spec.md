# WhatsApp Business API Notifications — Feature Spec

> **Status:** DEFERRED — post-launch enhancement. Not a launch blocker but a significant engagement lever.
> **Priority:** High post-launch. The target user base lives on WhatsApp. Email open rates for transactional notifications in this demographic are low.
> **Decision date:** 2026-04-05.

---

## Why This Matters

DockWalker's crew are dockwalkers. They check WhatsApp 50 times a day. They check email once. The current notification channels — email, web push, in-app bell — miss the primary attention surface.

A WhatsApp notification that says "You've been accepted for Deckhand on M/Y Serenity — open DockWalker" lands in the same app the crew member is already looking at. The tap-to-action distance is one link. Compare: an email notification requires opening the email app, reading the email, tapping the link, waiting for the browser to load. That's 4 steps and 15 seconds vs 1 step and 2 seconds.

This is not WhatsApp messaging between users. DockWalker sends system notifications to users via WhatsApp. No user-to-user contact information is exchanged. No phone numbers are revealed to the other party. The WhatsApp channel replaces email as the primary notification delivery mechanism for users who opt in.

---

## How It Works

### From the User's Perspective

1. During onboarding or in Settings → Notifications, the user sees: "Get notifications on WhatsApp"
2. User enters their phone number (with country code picker)
3. WhatsApp Business API sends a verification message to that number
4. User confirms (taps a button in the WhatsApp message or enters an OTP)
5. From now on, DockWalker notifications arrive as WhatsApp messages from "DockWalker" (verified business account, green checkmark)

Example notifications:

```
DockWalker
You've been accepted for Deckhand — DW-00312.
Chat is now open.
→ Open DockWalker [link]

DockWalker
Sophie shared 3 documents — download within 48 hours.
→ Open conversation [link]

DockWalker
New daywork posted: Deckhand in Antibes, €250/day, starts Monday.
→ View job [link to public job page]
```

### What Users Never See

- The employer never sees the crew member's phone number
- The crew member never sees the employer's phone number
- No user-to-user WhatsApp communication is facilitated or enabled
- The phone number is stored encrypted, used solely for DockWalker system notifications
- Users can disconnect WhatsApp at any time in Settings (number deleted from system)

---

## Privacy Architecture

### Phone Number Isolation

The phone number is **never** exposed in any API response, profile view, chat message, admin tool, or GDPR export of another user. It is strictly first-party data:

- Stored in a dedicated `notification_channels` table (not on the `profiles` table)
- Encrypted at rest (application-level encryption, not just database-level)
- Accessible only by the notification dispatch system (service role)
- Not included in view-only profile API responses
- Not included in applicant review data
- Not included in chat context
- Not visible to admin users (admin sees "WhatsApp: connected" but not the number)
- GDPR export includes the user's own phone number (it's their data) but never another user's

### Data Flow

```
User enters phone number
  → Stored encrypted in notification_channels table
  → WhatsApp Business API verification sent
  → User confirms on WhatsApp
  → Channel marked as verified

Event occurs (e.g., DAYWORK.ACCEPTED)
  → notifyOnEvent() fires (existing system)
  → Checks notification_channels for recipient
  → If WhatsApp verified: sends via WhatsApp Business API
  → If not: falls back to email / web push (existing behaviour)

User disconnects WhatsApp in Settings
  → Phone number deleted from notification_channels
  → Channel marked as disconnected
  → Notifications fall back to email / web push
```

The phone number never enters the event ledger, the messages table, the profiles table, or any table that other users can query. It exists in one place, for one purpose, accessible by one system.

---

## WhatsApp Business API Setup

### Provider Options

| Provider            | Pricing                                                                                      | Notes                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Meta (direct)**   | Free for first 1,000 conversations/month, then ~$0.005-0.08/conversation depending on region | Requires Facebook Business Manager, business verification, WhatsApp Business Account approval. 2-4 week approval process. |
| **Twilio WhatsApp** | ~$0.005-0.08/message depending on region + Twilio markup                                     | Already have a Twilio account (for TURN). Faster setup. Acts as BSP (Business Solution Provider).                         |
| **MessageBird**     | Similar pricing to Twilio                                                                    | Alternative BSP.                                                                                                          |

**Recommendation: Twilio WhatsApp.** You already have a Twilio account for voice call TURN credentials. Adding WhatsApp is a configuration step, not a new vendor relationship. Twilio handles the Meta approval process on your behalf.

### Setup Steps

1. In Twilio Console → Messaging → WhatsApp senders → Request access
2. Submit business verification (company name, website, use case)
3. Create message templates (pre-approved by Meta — required for outbound notifications)
4. Get approved WhatsApp sender number (Twilio provides or you bring your own)
5. Configure webhook for incoming messages (for OTP verification replies)

### Vercel Environment Variables

| Variable               | Value                  | Where to find it                                         |
| ---------------------- | ---------------------- | -------------------------------------------------------- |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+1234567890` | Twilio Console → WhatsApp senders (your approved number) |

`TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are already set (from voice call TURN setup).

### Message Templates

WhatsApp Business API requires pre-approved templates for outbound notifications. Each template is submitted to Meta for review (24-48h approval). Templates use variable placeholders.

**Required templates:**

Each template uses Meta's CTA button format — up to 2 URL buttons per template. The button links deep-link to the specific page in DockWalker, not a generic homepage. This is functionally equivalent to native push notification deep linking — one tap from WhatsApp to the relevant screen.

```
Template: dw_accepted
Body: "You've been accepted for {{1}} — {{2}}. Chat is now open."
Button 1: [Open conversation] → /messages/{{engagementId}}
Variables: role name, job number

Template: dw_applied
Body: "New application for {{1}} — {{2}}. {{3}} applicants so far."
Button 1: [Review applicants] → /daywork/{{dayworkId}}/review
Button 2: [View my jobs] → /daywork/mine
Variables: role name, job number, count

Template: dw_invited
Body: "You've been invited to {{1}} — {{2}}. Accept or decline within the app."
Button 1: [View invitation] → /discover (Invitations tab)
Variables: role name, job number

Template: dw_invitation_accepted
Body: "Invitation accepted for {{1}} — {{2}}. Chat is now open."
Button 1: [Open conversation] → /messages/{{engagementId}}
Variables: role name, job number

Template: dw_documents
Body: "{{1}} shared {{2}} documents. Download within 48 hours."
Button 1: [Open conversation] → /messages/{{engagementId}}
Variables: first name only, count

Template: dw_message
Body: "New message in your conversation about {{1}} — {{2}}."
Button 1: [Open conversation] → /messages/{{engagementId}}
Variables: role name, job number

Template: pm_selected
Body: "You've been selected for {{1}} — {{2}}. Chat is now open to discuss next steps."
Button 1: [Open conversation] → /messages/{{engagementId}}
Variables: role name, job number

Template: pm_shortlisted
Body: "You've been shortlisted for {{1}} — {{2}}."
Button 1: [View application] → /discover (Applied tab)
Variables: role name, job number

Template: pm_placement_confirmed
Body: "Placement confirmed for {{1}} — {{2}}. Congratulations!"
Button 1: [Open conversation] → /messages/{{engagementId}}
Variables: role name, job number

Template: engagement_starts
Body: "Your engagement for {{1}} starts tomorrow."
Button 1: [View details] → /messages/{{engagementId}}
Variables: role name

Template: availability_expiry
Body: "Your availability expires in 24 hours. Refresh to stay visible to employers."
Button 1: [Update availability] → /profile
```

**Button URL format:** All buttons link to `https://www.dockwalker.io/{{path}}`. Meta requires the base URL to be fixed in the template — only one dynamic path segment is allowed per button. This means the deep link path must be a single variable (e.g., `/messages/{{1}}`), not a constructed URL with multiple variables.

**What templates must NOT contain:**

- The other party's full name (first name only in document notifications — "Sophie shared documents", not "Sophie Laurent")
- Phone numbers, email addresses, or any contact information
- Specific salary/rate amounts (some Meta template reviewers reject financial specifics)
- Anything that could identify the employer to a third party reading the crew's WhatsApp (WhatsApp messages can be seen on lock screens — keep content vague enough that a glance doesn't reveal private hiring details)

---

## Database Schema

### `notification_channels` table

```sql
create table public.notification_channels (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) unique,
  channel_type text not null check (channel_type in ('whatsapp')),
  channel_value_encrypted bytea not null,      -- encrypted phone number
  verified boolean not null default false,
  verification_code text,                       -- OTP, cleared after verification
  verification_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

**RLS:** Owner read/write only. Service role for notification dispatch.

**Encryption:** `channel_value_encrypted` uses AES-256-GCM with a key stored in environment variables (`NOTIFICATION_ENCRYPTION_KEY`). The phone number is never stored in plaintext in the database. Decryption happens only in the notification dispatch function, server-side, at send time.

**Zero retention on disconnect:** When a user disconnects WhatsApp in Settings, the phone number is hard-deleted from the database immediately. Not soft-deleted. Not retained for a grace period. The encryption key is not involved — the row is deleted. The number existed for one purpose, the purpose ended, the data is gone.

**Why a separate table, not a column on profiles?**

- Profiles are read by other users (view-only profile API, applicant review). A phone number column on profiles — even if excluded from SELECT — is one query mistake away from exposure.
- A separate table with strict RLS (owner-only) creates a physical access boundary. The notification dispatch uses the service role. No user-facing API route ever queries this table.
- Future channels (SMS, Telegram) are additional rows, not additional columns.

**Twilio as data processor:**

- Sign Twilio's Data Processing Agreement during account setup
- Configure message body retention to minimum (0 days if available, otherwise Twilio's 30-day default)
- Message metadata (timestamp, delivery status, template used) retained by Twilio per their standard policy — this contains no personal content, only the phone number and delivery status
- On `PERSON.DATA_SCRUBBED`: the notification_channels row is already deleted (zero retention on disconnect or account deletion). Twilio's retention settings handle their side automatically.

---

## Integration with Existing Notification System

The current `notifyOnEvent()` function in `apps/web/src/lib/push-triggers/` dispatches to three channels: in-app notification, push (device tokens), and email. WhatsApp becomes the fourth channel, slotted in alongside email.

```
notifyOnEvent()
  → Insert in-app notification (always)
  → Send push if device tokens exist and preference enabled
  → Send email if email_enabled preference and has email
  → Send WhatsApp if channel verified and preference enabled   ← NEW
```

**Channel priority order:**

1. **WhatsApp** — primary channel (if verified and enabled). This is where the target users live.
2. **Web push** — secondary (if device tokens exist and preference enabled). Immediate for users with the app open.
3. **Email** — backup (if email_enabled preference). For users who haven't connected WhatsApp or when WhatsApp delivery fails.
4. **In-app notification bell** — always fires regardless of other channels.

WhatsApp replaces email as the primary outbound channel. Email becomes the fallback for users who don't opt into WhatsApp. The notification preference model extends with a `whatsapp_enabled` boolean in `user_preferences` (default false — opt-in only, not opt-out). When WhatsApp is connected and enabled, email notifications are suppressed for events that were successfully delivered via WhatsApp (no duplicate alerts).

Rate limiting: same 5-minute cooldown per conversation as email (prevents WhatsApp spam on rapid message exchanges).

---

## What It Is NOT

- **NOT user-to-user WhatsApp messaging.** DockWalker sends system notifications FROM a DockWalker business number TO individual users. Users never message each other on WhatsApp through DockWalker. The platform does not facilitate, enable, or suggest WhatsApp communication between parties.

- **NOT a replacement for in-app messaging.** The WhatsApp notification says "you have a message" and links to DockWalker. The actual conversation happens inside DockWalker. WhatsApp is the alert channel, not the conversation channel.

- **NOT a phone number collection mechanism.** The phone number is used for one purpose: sending DockWalker notifications via WhatsApp. It is not used for SMS, not shared with other users, not used for marketing, not sold, not included in analytics. The user can remove it at any time.

- **NOT mandatory.** WhatsApp notifications are opt-in. Users who don't provide a phone number continue to receive email and web push notifications as before. No feature is gated behind WhatsApp signup.

- **NOT a contact information system. This is an architectural invariant.** The phone number is used for one purpose: DockWalker system notifications via WhatsApp. It must NEVER be used to: let users find each other by phone number, reveal a phone number to the other party after acceptance/selection, enable SMS communication, build a contact graph, or serve as a login identifier. If any future feature requires sharing contact information between users, it must use a separate mechanism with separate consent. The notification phone number is single-purpose and inviolable — same class of rule as IMO immutability and the append-only ledger.

---

## Implementation Checklist

**Migration:**

- [ ] Create `notification_channels` table with RLS
- [ ] Add `whatsapp_enabled` boolean to `user_preferences` (default false)
- [ ] Rollback: drop column, drop table

**API routes:**

- [ ] `POST /api/notifications/whatsapp/register` — accept phone number, encrypt, store, send verification OTP
- [ ] `POST /api/notifications/whatsapp/verify` — validate OTP, mark channel as verified
- [ ] `DELETE /api/notifications/whatsapp` — disconnect WhatsApp, delete encrypted phone number

**Notification dispatch:**

- [ ] Extend `notifyOnEvent()` to check for verified WhatsApp channel
- [ ] WhatsApp send function: decrypt phone number, call Twilio WhatsApp API with appropriate template
- [ ] Rate limiting: 5-minute cooldown per conversation (same as email)
- [ ] Fallback: if WhatsApp send fails, fall through to email

**Settings UI:**

- [ ] WhatsApp section in Settings → Notifications
- [ ] Phone number input with country code picker
- [ ] Verification flow (enter number → receive WhatsApp OTP → enter OTP)
- [ ] "Connected" / "Not connected" status indicator
- [ ] Disconnect button
- [ ] `whatsapp_enabled` toggle (only visible when connected)

**Onboarding (optional):**

- [ ] "Get notifications on WhatsApp" prompt after onboarding completes (not during — don't add friction to signup)

**Environment variables (Vercel):**

- [ ] `TWILIO_WHATSAPP_FROM` — approved WhatsApp sender number
- [ ] `NOTIFICATION_ENCRYPTION_KEY` — AES-256-GCM key for phone number encryption

**WhatsApp Business setup (Twilio):**

- [ ] Request WhatsApp sender access in Twilio Console
- [ ] Submit business verification
- [ ] Submit all message templates for Meta approval
- [ ] Test in Twilio sandbox before going live

**GDPR:**

- [ ] Extend GDPR export: include own phone number (decrypted) from notification_channels
- [ ] Extend `PERSON.DATA_SCRUBBED`: delete notification_channels row, revoke Twilio consent
- [ ] Privacy policy update: WhatsApp notification opt-in, phone number encryption, single-purpose use
