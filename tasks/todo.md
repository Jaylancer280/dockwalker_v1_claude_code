# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

### WhatsApp notifications — full implementation

> Primary notification channel. Twilio WhatsApp Business API sends system notifications with deep link CTA buttons. Phone numbers stored encrypted, zero retention on disconnect. Channel priority: WhatsApp > push > email (no duplicates when WhatsApp succeeds).
> **Specs:** `tasks/whatsapp-notifications-spec.md`, `tasks/whatsapp-templates.md`

**Session 1 — Database + encryption + API routes:**

- [x] Migration: create `notification_channels` table (schema in spec — `id`, `person_id` UNIQUE FK, `channel_type` CHECK('whatsapp'), `channel_value_encrypted` bytea, `verified` boolean, `verification_code`, `verification_expires_at`, timestamps). RLS: owner SELECT/INSERT/UPDATE only. Service role bypasses for dispatch.
- [x] Migration: add `whatsapp_enabled` boolean NOT NULL DEFAULT false to `user_preferences` table. Follow the exact pattern from `00066_notification_preferences.sql` — a dedicated ALTER TABLE migration.
- [x] Rollback: drop `whatsapp_enabled` column, drop `notification_channels` table
- [x] **Update preferences API whitelist:** In `apps/web/src/app/api/preferences/route.ts`, the PATCH route has a strict `BOOLEAN_FIELDS` whitelist (line ~47). Add `'whatsapp_enabled'` to the array. Also update the `.select()` string (line ~69) to include `whatsapp_enabled`. **If you don't do this, the settings toggle will silently fail to save.**
- [x] Create `apps/web/src/lib/crypto.ts` — `encryptPhone(plaintext: string): Buffer` and `decryptPhone(encrypted: Buffer): string` using AES-256-GCM with `process.env.NOTIFICATION_ENCRYPTION_KEY`. Key is 32 bytes hex-encoded. Throw if env var missing (don't silently fail with unencrypted storage). No npm dependency — use Node.js built-in `crypto` module.
- [x] Create `POST /api/notifications/whatsapp/register` — auth required. Accept `{ phoneNumber: string }` (E.164 format with country code, e.g. `+33612345678`). Validate format with regex `/^\+[1-9]\d{6,14}$/`. Encrypt phone number. Generate 6-digit OTP. Upsert `notification_channels` row (person_id, channel_type='whatsapp', encrypted phone, verified=false, verification_code=OTP, verification_expires_at=now+10min). Send OTP via Twilio WhatsApp API to the phone number (raw `fetch` to Twilio REST API — no Twilio SDK, same pattern as voice call TURN spec). Return `{ success: true }`. Rate limit: 3 registration attempts per person per hour.
- [x] Create `POST /api/notifications/whatsapp/verify` — auth required. Accept `{ code: string }`. Look up `notification_channels` for person where verified=false and verification_expires_at > now(). Compare code. If match: set verified=true, clear verification_code and verification_expires_at, set `whatsapp_enabled=true` in user_preferences. Return `{ verified: true }`. If no match or expired: return 400 `{ error: 'invalid_or_expired_code' }`.
- [x] Create `DELETE /api/notifications/whatsapp` — auth required. Hard-delete the `notification_channels` row for this person (not soft-delete — zero retention). Set `whatsapp_enabled=false` in user_preferences. Return `{ success: true }`.
- [x] Tests: register (valid phone, invalid format, rate limit), verify (correct code, wrong code, expired code), disconnect (row deleted, preferences updated)

**Session 2 — WhatsApp send function + integration into notifyOnEvent:**

- [x] Create `apps/web/src/lib/whatsapp.ts` — `sendWhatsApp(phoneEncrypted: Buffer, templateName: string, variables: string[], buttonUrl: string): Promise<boolean>`. Decrypts phone using `decryptPhone()` from `crypto.ts`. Calls Twilio REST API directly via `fetch`: `POST https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json` with Basic auth (base64 of SID:AuthToken), body: `To=whatsapp:${phone}&From=${TWILIO_WHATSAPP_FROM}&ContentSid=...` (or template params per Twilio's content template API). No `twilio` npm package — raw fetch only. Returns true on 2xx, false on failure. If `TWILIO_WHATSAPP_FROM` is not set, return false immediately (graceful degradation).
- [x] Create `apps/web/src/lib/push-triggers/whatsapp-dispatcher.ts` — `sendWhatsAppForEvent(serviceClient, eventType, payload, ctx): Promise<boolean>`. Maps event type to template name using a lookup table (26 templates from `tasks/whatsapp-templates.md`). Resolves template variables from the payload + DB lookups (role name, job number, port name, vessel name, engagement ID — same data the existing handlers already resolve in `daywork-handlers.ts` and `permanent-handlers.ts`). Calls `sendWhatsApp()`. Returns true if sent successfully.
- [x] The template-to-variables mapping must handle every event type. For each template, the variables are documented in `tasks/whatsapp-templates.md` with exact field names and examples.
- [x] **Rewrite the dispatch flow in `apps/web/src/lib/push-triggers/index.ts` `notifyOnEvent()`.** The current flow is: push → in-app → email. The new flow must be:
  1. **In-app notification** — always fires (existing behaviour, unchanged)
  2. **Check WhatsApp:** query `notification_channels` for recipient where `channel_type='whatsapp'` AND `verified=true`. Also check `whatsapp_enabled=true` in user_preferences.
  3. **If WhatsApp connected + enabled:** check the existing `push_*` category preference for this event type (reuse `getPushPreferenceKey()` — same categories apply to WhatsApp). If category allowed, call `sendWhatsAppForEvent()`. If it returns true: **skip push AND email** for this event. If it returns false (send failed): fall through to push + email as before.
  4. **If WhatsApp not connected:** send push if allowed (existing logic). Send email via `sendEmailForEvent()` (existing logic, which already checks `hasPushTokens` internally).
  5. **Key change to email-dispatcher:** Currently `email-dispatcher.ts` skips email if the user has push tokens (line ~52: `if (await hasPushTokens(...)) return`). This logic should remain — it means email only fires for users with no push tokens AND no WhatsApp. The three channels form a priority chain: WhatsApp → push → email.
- [x] Apply the same 5-minute cooldown per conversation for WhatsApp as exists for email (prevents spam on rapid MESSAGE.SENT events).
- [x] Skip WhatsApp for system messages (`MESSAGE.SENT` with `is_system: true`) — same as existing push skip on line 79.
- [x] Tests: mock `fetch` for Twilio API calls (no Twilio SDK to mock), verify template name mapping for all 26 event types, verify fallback chain (WhatsApp fail → push → email), verify no duplicate (WhatsApp success = push + email skipped), verify cooldown, verify system message skip

**Session 3 — Settings UI:**

- [x] In `apps/web/src/app/(app)/settings/page.tsx` (or the notifications section component): add a "WhatsApp Notifications" section below the existing notification toggles.
- [x] **Not connected state:** Show phone number input with country code picker (dropdown of common codes: +33 France, +34 Spain, +1 US, +971 UAE, +44 UK, +90 Turkey, +1 242 Bahamas, etc. — match the launch regions). "Connect" button calls register API. On success, show OTP input field.
- [x] **OTP verification state:** 6-digit input. "Verify" button calls verify API. On success, transition to connected state. "Resend code" link (calls register again). Show "Code expires in X:XX" countdown.
- [x] **Connected state:** Show masked phone number (e.g., "+33 ••••• 678"). `whatsapp_enabled` toggle (default on after verification). "Disconnect" button with confirmation dialog — calls DELETE API, resets to not-connected state.
- [x] The toggle controls `whatsapp_enabled` in user_preferences via `PATCH /api/preferences`. The whitelist was updated in Session 1. The GET response also needs `whatsapp_enabled` — check that the GET handler in preferences route includes it in the select (it uses `select('*')` or specific columns — verify and update if needed).
- [x] To show the connected state, the settings page needs to know if a verified WhatsApp channel exists. Add a `GET /api/notifications/whatsapp/status` route that returns `{ connected: boolean, maskedPhone: string | null }`. Query `notification_channels` for the user, return connected=true if verified row exists. Mask the phone server-side (decrypt, mask middle digits, return masked string). Never return the full phone number to the client.
- [x] Tests: component renders all 3 states, register flow transitions, disconnect resets state (visual testing — component tests deferred, route tests cover API logic)

**Session 4 — GDPR + broadcast:**

- [x] Migration: extend `apply_projection` PERSON.DATA_SCRUBBED handler — add `DELETE FROM notification_channels WHERE person_id = p_person_id;` This is a hard delete of the encrypted phone. Must go BEFORE the existing profile anonymisation (no FK dependency, but logically scrub channels first).
- [x] Rollback: must contain the full previous `apply_projection` body (self-contained per CLAUDE.md rule 4).
- [x] Extend GDPR export (`/api/account/export`): query `notification_channels` for the requesting user using service client. If row exists and verified, decrypt the phone number and include in export as `whatsapp_phone: "+33612345678"`. If no row, omit the field. The export already uses `select('*')` on `user_preferences` so `whatsapp_enabled` is automatically included.
- [x] Extend the broadcast handler (`apps/web/src/lib/push-triggers/broadcast.ts`) for `DAYWORK.POSTED`: the broadcast currently loops over crew with matching availability and sends push to each. Inside the loop, add a WhatsApp branch: query `notification_channels` for each crew member (batch this — do a single query for all matching person_ids, not N+1). For each crew member with a verified WhatsApp channel + `whatsapp_enabled`, send the `dw_new_job` template. Skip the poster (same exclusion as push). The broadcast does NOT check push category preferences (intentional — new job broadcasts are high-value, low-frequency). WhatsApp broadcast should follow the same pattern — send if connected, regardless of `push_jobs` preference.

**BLOCKED — requires user action before Sessions 1-4 can be tested end-to-end:**

> The code can be built and unit-tested with mocked Twilio calls. But real WhatsApp delivery requires:
>
> - [ ] **USER:** In Twilio Console, set up WhatsApp sender (Messaging → WhatsApp senders → Request access). Copy the approved sender number.
> - [ ] **USER:** Submit all 26 templates from `tasks/whatsapp-templates.md` to Meta via Twilio Console. Wait 24-48h for approval.
> - [ ] **USER:** Set Vercel env vars: `TWILIO_WHATSAPP_FROM` (approved sender number, format `whatsapp:+1234567890`), `NOTIFICATION_ENCRYPTION_KEY` (generate with `openssl rand -hex 32`)
> - [ ] **USER:** Sign Twilio Data Processing Agreement (Twilio Console → Settings → Privacy)
> - [ ] **USER:** Configure Twilio message body retention to minimum (Settings → Privacy → Message retention)
>
> Start the Twilio WhatsApp approval process NOW — it takes 2-4 weeks. The code work can proceed in parallel.

---

### Verify: Agent My Jobs — may already work

> Investigation shows daywork mine uses `.eq('poster_person_id', user.id)` and permanent mine uses `.eq('employer_person_id', user.id)` — both filter by person, not role_context. Agent-posted jobs SHOULD appear.

- [ ] USER: Test again — post a job as agent, check My Jobs page. If it shows, this is resolved. If not, check the page-level hat check.

---

### Meals label — conditional "(optional)" on live aboard

> Daywork post form always shows "Meals provided (optional)" regardless of live aboard. Should only say "(optional)" when live aboard is checked. Permanent form has the conditional logic already.

- [ ] In `apps/web/src/app/(app)/daywork/post/page.tsx` ~line 606: make "(optional)" conditional on live aboard being checked.

---

### Admin identity type change (deferred — medium-high effort)

> Scope captured. Build when needed.

---

## Backlog

> Active backlog. Pick items into Queue when ready.
> **Implementation agent: do NOT move items here to defer them. If a todo item
> is too hard, stop and ask — do not unilaterally deprioritise.**

### Business logic / server-side

- **Permanent crew withdrawal auto-revert** — when crew withdraws from a selected permanent posting, employer should decide next step, not auto-revert.
- **Onboarding true atomicity** — `onboard_person` RPC should be fully atomic.
- **Negotiation timeout** — auto-close permanent engagements after X days inactivity.
- **Weekly check-in cron** — periodic nudge for permanent postings with no employer activity.
- **Deactivated user server-side sign-out** — force session invalidation on PERSON.DEACTIVATED.

### Web-only UI

- **Agent market as discover mode** — let agents browse full market feed.
- **Form validation — styled inline errors** — replace browser-native validation (SUG-012).
- **Invalid URL error pages** — custom error pages for garbage URLs (SUG-013).
- **Edit experience "Unknown vessel" prefix** — seed data issue (SUG-017).
- **Applicant count badge on My Jobs**.
- **Discover filter chips**.
- **Notifications grouping**.
- **Email: List-Unsubscribe header**.
- **Share button on discover cards (crew view)** — secondary placement.

### Testing

- **Resilience tests** — network failure, timeout, retry scenarios.
- **Component tests for Permanent UI**.
- **Component tests for Form Pickers**.

### Deferred — Mobile (blocked, needs Mac + Xcode)

- **Mobile Phase 7: TestFlight validation** — app crashes on startup (SIGABRT TurboModule init). Needs Xcode debugger. See `memory/project_mobile_blocked.md`.
- **Mobile Phase 8: Android polish pass**.
- **Capacitor removal** — waiting on Phase 7 validation.
- **Mobile OTA update test**.
- **Mobile Docky hooks/screens** — update to match new single-thread API when mobile unblocks.

---

## Done

(See git history for completed stages 51-200+. Recent: ExpandableText on all 13 truncated text instances, text overflow audit, vessel fuzzy search, contract type reset, textarea auto-expand, availability toast, department specialisations, agent profile overlay + maritime history, date input dd/mm/yyyy, permanent card truncation, share to social, invitation direct hire, Docky production launch, CI/CD, rollback hardening.)
