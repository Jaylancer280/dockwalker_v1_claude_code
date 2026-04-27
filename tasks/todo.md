# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

### Consent-based referencing system

Crew members add references (Captain, HOD, etc.) to their experiences. Referees consent in-app via a one-shot prompt routed through `/messages`, then become attached to the experience. Employers can request contact with a referee; referee accepts or declines; on accept a chat thread opens. Full audit trail in the event ledger, anchored to vessel IMO + experience snapshot. No "search for crew" surface — invitations propagate via an opaque-token share link (same primitive as the existing `<ShareJobButton>`).

**Decisions locked in (from planning conversation):**

- **Crew add caps:** 1 reference per experience for Free, up to 3 per experience for Crew Pro. No total cap either tier. Cap counts `pending + accepted` rows (so a free user can't fire 100 pending requests on one experience hoping one accepts).
- **Pay gates everywhere — no silent failures:** every cap is surfaced explicitly in the UI BEFORE it bites. (a) Add Reference dialog shows a counter ("References on this experience: 1/1 — upgrade for up to 3"); attempting to exceed opens an upgrade modal with a "Crew Pro · €4.99/mo · Adds 2 more references per experience + Docky AI access" CTA → `/billing`. (b) Settings → References shows the current tier inline. (c) Employer contact gate at the route layer returns 402 with a structured payload `{ error, gate: { reason, current, limit, upgrade_path: '/billing' }}`; the contact button opens an upgrade modal "Employer Pro · €14.99/mo · Unlimited reference contacts" → `/billing`. Free employers see the remaining count on every Contact button ("3 contact requests left this month"). NEVER let a user discover the cap by getting an error after typing.
- **Subscription degrade:** existing references are NOT deleted. View-only profile API filters to most-recent N visible (N=1 for Free, N=3 for Pro). Owner always sees all on their own profile.
- **Employer contact gate (two-tier):** Free employer = max 10 outstanding _pending_ contact requests at any time AND max 5 _accepted_ contact requests in rolling 30 days. Pro = unlimited. Credit consumed at `REFERENCE.CONTACT_ACCEPTED`. Pending budget prevents request-spam (referee inbox protection); accepted budget gates the actual outcome.
- **NDA + pending-vessel references blocked in v1:** `POST /api/references` rejects with 400 if the underlying experience's vessel has `nda_flag=true`, OR `source != 'curated'`, OR `hidden_at IS NOT NULL`. UI hides the "Add reference" button on those experience cards with an inline hint ("References available once your vessel is verified" / "References on NDA vessels aren't supported yet"). Document as a known limitation. The crew can come back and add references after admin approval.
- **Email-match enforcement on consent:** when the requester provides `claimed_referee_email`, the `/ref/[token]` Accept button is disabled unless the auth'd user's email matches. UI shows "This invitation was sent to <masked email>". If no email was provided, first-tap-wins. UI strongly recommends providing email at request time.
- **Snapshot on invitation:** vessel IMO + period-correct vessel name (resolved via `resolveHistoricalVesselNames` for the experience's start_date — same Wave F display rule), experience start_date + end_date, requester's claimed role, and referee's claimed role are frozen into the `references` row at REFERENCE.REQUESTED time. Later edits to the underlying experience do NOT mutate the reference.
- **Snapshot field edit-lock on experiences with active references (P0-A):** while any reference on an experience is `status IN ('pending', 'accepted')`, the experience's `vessel_id`, `start_date`, `end_date`, and `role_id` are frozen. Other fields (description, contract_type, flag_state, salary, sea_time, vessel_operation) remain editable. Enforced at both projection layer (`EXPERIENCE.UPDATED` handler raises if a snapshot field changed while active references exist) and route layer (`PATCH /api/experiences/[id]` returns 409 with a clear "Revoke references first" message). Edit form disables locked fields with a hint banner. Removing all references unlocks the fields.
- **B-2 — references forbidden on `is_current=true` experiences:** `POST /api/references` rejects with 400 ("Mark this experience as completed before adding a reference") if the underlying `crew_experiences.is_current = true`. References are retrospective by design — referees attest to a completed working relationship, not an ongoing one. This also keeps the `is_current` field outside the snapshot-lock list (it's now impossible for an experience to have an active reference AND `is_current=true` simultaneously, so no race between toggling is_current and the locked end_date). UI hides the "Add reference" button on currently-active experience cards with hint "Mark this experience as completed to add a reference." The Add Experience flow's "Include references? Yes/No" checkbox is disabled (greyed out) when the user ticks "I currently work here" with explainer "References available after you mark the job complete." Crew can still add the reference later by editing the experience to set is_current=false + end_date.
- **Pending invitation expiry:** pending references auto-expire 30 days after `created_at` if not yet acted on (separate from the 24-month accepted-consent expiry). Cron handles both.
- **Reference comments (in scope, v1):** referee writes an optional 2-3 sentence comment at consent acceptance OR later from settings. 500-char cap. Stored on the `references` row. Visible alongside the reference per the same subscription-visibility rules. Comment is the actual social-proof content; without it, references are weak signals. Crew can revoke the entire reference (which removes the comment) at any time, including post-acceptance — `REFERENCE.REVOKED_BY_REQUESTER` extended to allow `status IN ('pending', 'accepted')`.
- **Optional question on contact request (P1-D):** at `POST /api/references/[id]/contact` time, the employer can include an optional `question` field (1-200 chars, free-text). Pre-populates the chat as the employer's first message on accept. Surfaced to the referee on the consent prompt as "[Employer] would like to ask: \"<question>\"" so they know what they're agreeing to before opening the chat. Increases acceptance rates.
- **Decline / silence non-revealing:** requester sees "Pending response" indefinitely until referee actively accepts. REFERENCE.DECLINED never surfaces to the requester (audit trail only).
- **Pending + expired invitations have action buttons (P1-B):** in Settings → References > outbound section, every pending invitation row gets two buttons: **Resend** (revokes the existing pending invitation, fires a fresh `REFERENCE.REQUESTED` with a new token + reset `pending_expires_at`, returns the new share link for re-sharing) and **Revoke** (cancels the invitation entirely). Expired invitations get just **Resend** (creates a fresh REFERENCE.REQUESTED) and a "Hide" option (UI-only — keeps the audit row but removes from active list).
- **Routing:** all consent prompts (invitation + contact) appear as system-message pseudo-threads in `/messages`. Contact-request thread becomes a normal chat post-accept. Reuses existing `active_engagements` table via a new nullable `reference_contact_id` column. Chat layout switches: when `reference_contact_id IS NOT NULL`, render a `<ReferenceContactHeader>` and hide the daywork/permanent-specific action blocks (rate, complete, postpone, etc. — none apply).
- **Notifications IN scope:** `notifyOnEvent` fan-out fires on `REFERENCE.REQUESTED` (→ referee, **B-6 — only if `claimed_referee_email` matches an existing DockWalker person; otherwise the share-link is the sole discovery path**), `REFERENCE.ACCEPTED` (→ requester, silent on decline per UX rule), `REFERENCE.CONTACT_REQUESTED` (→ referee), `REFERENCE.CONTACT_ACCEPTED` (→ employer, silent on decline). In-app + email + WhatsApp/Telegram per existing user preferences. Plus the in-app-only `EXPERIENCE.REMOVED → affected referees` direct-insert (Fix A). **Notification deep-link targets (P1-A):** REFERENCE.REQUESTED + CONTACT_REQUESTED → `/messages` (consent pseudo-thread); REFERENCE.ACCEPTED → `/profile/settings/references` (the requester sees the new reference + the comment); REFERENCE.CONTACT_ACCEPTED → `/messages/[engagementId]` (the chat that just opened); EXPERIENCE.REMOVED → `/profile/settings/references` (audit-history view).
- **Linking primitive:** opaque-token share link (`dockwalker.io/ref/{token}`) — same `<ShareJobButton>` pattern. No email courier, no in-app search. Crew copies the link and sends it via whatever channel they use (WhatsApp / iMessage / in-person). Referee tapping the link auth-redirects to login or signup; consent stamps at end of either flow.
- **Lightweight referee signup (P1-C, hybrid):** referees who arrive at `/ref/[token]` without an account can sign up with **email + password** (or **Google OAuth**) + **display name** ONLY — no certs, no languages, no location, no experience brackets. Profile created with `referee_only=true` flag (new column on `profiles`). After signup the user lands back at `/ref/[token]` to consent explicitly. Post-consent: a non-blocking modal asks "Welcome to DockWalker — would you like to complete your crew profile so employers can find you for jobs too?" with **Yes** (→ existing `/onboarding` flow) and **Maybe later** (→ `/messages`). The full onboarding flow flips `referee_only=false` when complete (clears the limited-mode UI). **Middleware behaviour for referee_only users:** allow `/messages`, `/profile`, `/profile/settings/*`, `/ref/*`, `/auth/*`. Block `/discover`, `/daywork/*`, `/permanent/*`, `/vessels` — those routes redirect to `/profile` with a banner "Complete your DockWalker crew profile to apply for jobs and post availability." Bottom nav hides Discover + post-job tiles for referee_only users. The referee_only flag is the carrot — onboarding becomes a deliberate user choice, not a forced gate. Big captain unlock if we get this right.
- **Required "Include references?" checkbox at experience creation (P2 promotion):** the existing Add Experience form gets a new required boolean field "Include references on this experience? (Yes / No)". Validation: must be answered. Behaviour:
  - **Yes:** after the experience is saved (EXPERIENCE.ADDED fires), the UI auto-opens the `<AddReferenceDialog>` for that experience. The user can add 1-3 references inline. They can also Skip out at any point — choosing Yes then dismissing the dialog is fine; they can come back later via the experience card.
  - **No:** experience saved, nothing further happens.
  - **Onboarding extension:** a one-time hint card during the profile-setup step explains references — "References from past captains boost your hiring chances. After you add an experience, you'll get the option to invite references." Hint is dismissible; non-blocking.
- **Experience deletion (Fix A — auto-revoke + ON DELETE SET NULL + revoke_reason):** `references.experience_id` uses `ON DELETE SET NULL` (NOT NO ACTION — that would hard-block the parent DELETE in PostgreSQL before projection runs). `references.vessel_id` also uses `ON DELETE SET NULL` for the same reason (consistency + safety; vessel hard-deletes are rare but possible). The `EXPERIENCE.REMOVED` projection handler runs a **three-step sequence inside the same transaction**: (1) UPDATE references SET `status='revoked'`, `revoked_at=now()`, `revoke_reason='experience_removed'` WHERE experience_id matches AND status IN (`pending`, `accepted`); (2) UPDATE reference_contacts SET `status='declined'`, `responded_at=now()` WHERE reference_id IN (those refs) AND status='pending'; (3) DELETE crew_experiences row (existing logic). The FK auto-nulls `references.experience_id` AFTER the rows are stamped revoked, so snapshot history (vessel name, IMO, dates, comment) is preserved on the audit row. Active reference_contacts + chat threads with `status='accepted'` stay intact (chats are immutable history); the `<ReferenceContactHeader>` shows a "This reference was withdrawn" banner when the underlying reference is revoked. Other revoke handlers (REVOKED_BY_REQUESTER, REVOKED_BY_REFEREE, EXPIRED, PERSON.DATA_SCRUBBED) stamp the appropriate `revoke_reason` value so the inbound audit history can show human-readable explanations to the referee.
- **Expiry:** accepted consents auto-expire 24 months after `consented_at`; pending invitations auto-expire 30 days after `created_at`. Single daily cron handles both. Referee can revoke at any time. PERSON.DATA_SCRUBBED also wipes references (status='revoked') where the deleted person was either requester or referee.
- **GDPR export extension (P0-C):** `/api/account/export` extended to include `references` (where person is requester or referee, with full snapshot + comment if present), `reference_contacts` (where person is employer or implicit referee). Reference chat history already covered via existing engagement-export logic.
- **Chat thread lifetime:** open until either party manually closes (matches daywork engagement chat).

**Approach:** Two new tables (`references`, `reference_contacts`) + 1 column on `profiles` (`referee_only`) + 1 column on `active_engagements` (`reference_contact_id`) + Fix A's `revoke_reason` column built into the new `references` table from day one, **eleven** new event types, **twelve** new API routes (11 + 1 cron) + 2 modified existing routes (`PATCH /api/experiences/[id]` for edit-lock, `GET /api/account/export` for GDPR extension), **nine** UI surfaces, one cron, one stress test (~35-40 checks including Fix A edge cases). Approximately 35 commits' worth of work split into 6 phases below. Schema changes are first; UI is last; each phase is independently committable.

**Warning dialogs + inline hints — every consequential action gets explicit consent UX:**

References involve other people's identities and a permanent audit ledger. Every action that creates lasting visibility, locks fields, removes content, or sends a signal to another user gets a confirmation modal with explicit stakes. Action labels are deliberately specific (not "OK / Cancel"). Destructive actions use the existing `Button variant="destructive"` styling. The 11 modals below are referenced by letter (W-A through W-K) in the Phase 4 UI items.

- **W-A — Crew sends a reference invitation** (fired by `<AddReferenceDialog>` submit)
  - Title: _"Send reference request?"_
  - Body: _"We'll generate a private link for you to share with [name]. Once they accept:_
    - _Their name and role will appear on this experience on your profile._
    - _You won't be able to change the vessel, dates, or role on this experience until you revoke the reference._
    - _You can revoke the reference at any time, which removes it from your profile."_
  - Buttons: `[Cancel]` `[Send invitation]`

- **W-B — Crew revokes an _accepted_ reference** (Settings → References → Revoke on accepted row)
  - Title: _"Remove this reference?"_
  - Body: _"[Captain Smith]'s reference and comment will be removed from your profile permanently. The audit log keeps a record but the reference will no longer be visible to anyone."_
  - Buttons: `[Cancel]` `[Remove reference]` (destructive)

- **W-C — Crew cancels a _pending_ reference** (Settings → References → Revoke on pending row)
  - Title: _"Cancel this invitation?"_
  - Body: _"[Captain Smith] won't be notified. The link you shared will stop working."_
  - Buttons: `[Keep invitation]` `[Cancel invitation]` (destructive)

- **W-D — Crew resends a pending invitation** (Settings → References → Resend)
  - Title: _"Send a fresh invitation?"_
  - Body: _"We'll generate a new link and the old one will stop working. The previous invitation will be cancelled in your audit log."_
  - Buttons: `[Cancel]` `[Send fresh invitation]`

- **W-E — Referee accepts a reference** (the big one — fired by Accept on `/ref/[token]`)
  - Title: _"Confirm reference"_
  - Body: _"By accepting, you confirm that you worked with [Requester display_name] as [requester's claimed role] on [vessel name] (IMO [imo]) from [start] to [end]._
    - **_Your name and role will be shown publicly_** _on their profile, visible to employers, agents, and other crew viewing the profile._
    - **_Your comment_** _(if you write one) will also be visible publicly under the same rules._
    - _Employers may later request to contact you about this reference. You can accept or decline each contact request._
    - _You can revoke this reference at any time from Settings → References."_
  - Buttons: `[Cancel]` `[I confirm — accept reference]`
  - **This is the load-bearing consent moment.** Modal must be hard to miss; uses prominent styling.

- **W-F — Referee declines a reference** (fired by Decline on `/ref/[token]`)
  - Title: _"Decline this reference?"_
  - Body: _"We won't tell [Requester] that you declined. They'll see the invitation as 'pending' until it expires in 30 days. This action is final — you'd need a fresh invitation to accept later."_
  - Buttons: `[Cancel]` `[Decline silently]` (destructive)

- **W-G — Referee edits their comment** (fired by Edit comment in Settings → References)
  - Title: _"Update reference comment?"_
  - Body: _"This comment is visible publicly on [Requester]'s profile. Your previous comment will be replaced. Don't include personal information like salary or medical details — see DockWalker's content guidelines."_
  - Buttons: `[Cancel]` `[Update comment]`

- **W-H — Referee revokes their accepted reference** (fired by Revoke consent in Settings → References)
  - Title: _"Revoke your consent?"_
  - Body: _"[Requester] will lose this reference and your comment from their profile. The change is immediate. The audit log preserves a record."_
  - Buttons: `[Cancel]` `[Revoke consent]` (destructive)

- **W-I — Referee accepts a contact request from an employer** (fired by Accept on contact consent prompt in `/messages`)
  - Title: _"Open a conversation with [Employer Y]?"_
  - Body: _"[Employer Y] wants to contact you about [Requester crew's display_name] · [vessel name] · [dates]. Accepting opens a chat thread between you and the employer._
  - _[If `question` set:] Their question: '[question text]'_
  - _Messages are retained on DockWalker's servers and cannot be deleted by either party. You can close the conversation at any time."_
  - Buttons: `[Cancel]` `[Accept and open chat]`

- **W-J — Employer sends a contact request** (fired by Send in `<ContactReferenceDialog>`)
  - Title: _"Send contact request?"_
  - Body (Free): _"We'll notify [Captain Smith]. They can accept (opens a chat) or decline (silent — you won't be told). This will use 1 of your remaining 4 contact requests this month. Upgrade to Employer Pro for unlimited."_
  - Body (Pro): _"We'll notify [Captain Smith]. They can accept (opens a chat) or decline (silent — you won't be told)."_
  - _[If `question` set:] Your question will be shown on the consent prompt: '[question]'_
  - Buttons: `[Cancel]` `[Send request]`

- **W-K — Either party closes a reference contact chat** (fired by Close conversation in chat header)
  - Title: _"Close this conversation?"_
  - Body: _"Messages stay in your history. The other party can send a fresh contact request later if they want to re-open."_
  - Buttons: `[Cancel]` `[Close conversation]` (destructive)

**Inline hints (non-blocking, contextual):**

- **H-1 — `<AddReferenceDialog>` form:** persistent hint above the submit button: _"Once your referee accepts, the vessel, dates, and role on this experience are locked until you revoke the reference."_
- **H-2 — Comment textarea (`/ref/[token]` and Edit comment modal):** placeholder + caption: _"Visible publicly on [Requester]'s profile. Write about your professional experience working with them. Please don't share salary, medical, or other personal details. Max 500 characters."_ + live character counter.
- **H-3 — `<ContactReferenceDialog>` (employer side):** Free tier sees: _"You have [N] contact requests remaining this month. Each one is consumed only when the referee accepts."_ Pro tier sees no quota line.
- **H-4 — `/ref/[token]` snapshot card:** small caption under the snapshot: _"These details are locked — neither party can change them after you accept."_
- **H-5 — Settings → References tier-status row:** see the existing "Tier-status indicator" item in Phase 4 — already specified.
- **H-6 — Lightweight signup welcome screen:** _"By signing up you agree to DockWalker's Terms. Your basic profile (name + the role you held) will be visible only on the references you accept. You can complete a full crew profile later."_
- **H-7 — Experience-edit form when locked:** banner already specified — _"Some fields are locked because this experience has active references. Revoke references to change vessel, role, or dates."_
- **H-8 — Profile experience cards (own profile) when references exist:** small badge "🔒 Locked fields" next to the experience role to remind the user; click reveals the field-lock explainer.

**Implementation pattern:** all modals use the existing `<Dialog>` + `<DialogHeader>` + `<DialogTitle>` + `<DialogDescription>` + `<DialogFooter>` primitives (already used app-wide). Destructive variants use `Button variant="destructive"`. No "don't show again" checkboxes — these are deliberate consent moments, not noise. Modals fire on the user's intent click; the underlying API call is gated on confirmation.

#### Phase 1 — Schema + projection foundation (migrations 00125 + 00126)

- [x] Migration `00125_references_schema.sql` — new `references` table with columns: `id` `requester_person_id` `experience_id` (nullable — auto-nulled by FK on experience delete; preserved revoke audit row keyed off snapshot fields) `vessel_id` (nullable — same reason) `requester_role_at_time` `claimed_referee_role` `claimed_referee_name` `claimed_referee_email` (nullable) `token` (unique) `status` (CHECK `pending`/`accepted`/`declined`/`revoked`/`expired`) `referee_person_id` (nullable) `comment` text nullable (CHECK `length(comment) <= 500`) `comment_updated_at timestamptz` nullable `created_at` `consented_at` (nullable) `expires_at` (default `now() + interval '24 months'`) `pending_expires_at` (default `now() + interval '30 days'` — separate from accepted-consent expiry) `revoked_at` (nullable) **`revoke_reason` text nullable (CHECK `revoke_reason IN ('requester_revoked', 'referee_revoked', 'experience_removed', 'requester_deactivated', 'referee_deactivated', 'expired_pending', 'expired_accepted')`)** — populated by every revoke handler so the inbound audit can show a human-readable explanation. Snapshot fields: `snapshot_vessel_imo` `snapshot_vessel_name` `snapshot_start_date` `snapshot_end_date` (these survive even after `experience_id` and `vessel_id` get nulled by the FK so the audit row is still readable). **Unique constraint** `(experience_id, referee_person_id) WHERE referee_person_id IS NOT NULL AND experience_id IS NOT NULL AND status IN ('pending', 'accepted')` — one LIVE referee slot per experience (a person can't hold two simultaneously-active references on the same experience). **B-1 fix:** the `status IN ('pending', 'accepted')` clause is critical — without it, a revoked-then-re-requested same referee would unique-violate at REFERENCE.ACCEPTED time because the OLD revoked row still holds the (experience_id, referee_person_id) pair. The clause excludes `revoked`/`expired`/`declined` audit rows so they don't occupy the slot. The `experience_id IS NOT NULL` clause separately prevents the index from blocking multiple post-deletion audit rows accumulating against `(NULL, referee_person_id)`. New `reference_contacts` table: `id` `reference_id` `employer_person_id` `engagement_id` (nullable) `question text` nullable (CHECK length ≤ 200 — optional employer question shown on the consent prompt and pre-populated as the chat's first message) `status` (CHECK `pending`/`accepted`/`declined`) `created_at` `responded_at`. **FK behaviour:** `requester_person_id`, `referee_person_id`, `employer_person_id` → `persons` `ON DELETE NO ACTION` (revoke handled in PERSON.DATA_SCRUBBED projection — accounts deactivate via DEACTIVATED → SCRUBBED, not direct DELETE). `experience_id` → `crew_experiences` **`ON DELETE SET NULL`** (Fix A: a hard-CASCADE/NO-ACTION would block parent DELETE before projection can run; SET NULL lets the EXPERIENCE.REMOVED handler stamp `revoke_reason='experience_removed'` first, then the FK nulls the column afterwards). `vessel_id` → `vessels` **`ON DELETE SET NULL`** (same rationale; vessel hard-deletes are rare but rolled-back curated vessels could trigger this). `reference_id` on `reference_contacts` → `references` `ON DELETE CASCADE` (when reference row is hard-deleted, drop dependent contacts; with Fix A's soft-revoke pattern, refs are almost never hard-deleted — this CASCADE is defence-in-depth for admin scrubs). Add `active_engagements.reference_contact_id uuid null references reference_contacts(id) ON DELETE SET NULL`. **B-4 — active_engagements compatibility:** before adding the column, inspect existing `active_engagements` constraints (likely a CHECK enforcing `daywork_id IS NOT NULL OR permanent_posting_id IS NOT NULL`). If such a CHECK exists, ALTER it to add a third valid path: `OR reference_contact_id IS NOT NULL`. The migration must DROP and re-CREATE the CHECK constraint with the broadened predicate (PostgreSQL doesn't support modifying a CHECK in-place). Verify also that any NOT NULL constraints on `daywork_id` / `permanent_posting_id` themselves are absent (they should already be nullable — both daywork and permanent engagements use only their own column — but confirm). If the existing constraint name is unknown, query `pg_constraint` first; reference the actual constraint name in the migration. Stress test must include a smoke check that an INSERT with only `reference_contact_id` set succeeds. Add `events_aggregate_type_check` CHECK constraint values `reference` and `reference_contact` (per lessons.md aggregate-type pre-commit hook). **Add `profiles.referee_only boolean not null default false`** — flag for users who signed up via the lightweight referee flow (P1-C); middleware uses this to allow consent paths while blocking employer/discover paths until the user completes full onboarding. Indexes: `(requester_person_id, status)`, `(referee_person_id, status)`, `(token)` unique, `(experience_id, status) WHERE experience_id IS NOT NULL` for the cap query + edit-lock check (partial because cap only applies to live experiences), `(employer_person_id, created_at desc)` on contacts, partial `(pending_expires_at) where status='pending'` for the cron, partial `(referee_only) where referee_only = true` on profiles for fast middleware-side filtering. RLS: `references` SELECT = own row OR referee on it OR employer on an active engagement involving the requester (defer the third condition to the API layer for v1; serviceClient on the route side enforces); `reference_contacts` SELECT = parties only.

- [x] Rollback `00125_references_schema.down.sql` (B-5 — full reversibility): (1) `DROP TABLE IF EXISTS public.reference_contacts CASCADE;` (2) `DROP TABLE IF EXISTS public.references CASCADE;` (3) `ALTER TABLE public.active_engagements DROP COLUMN IF EXISTS reference_contact_id;` (4) **Restore the prior `active_engagements` CHECK constraint** — drop the broadened version added in 00125 and re-CREATE the original `daywork_id IS NOT NULL OR permanent_posting_id IS NOT NULL` form (use the captured constraint name from B-4's pre-Phase-1 inspection). (5) `ALTER TABLE public.profiles DROP COLUMN IF EXISTS referee_only;` (this also drops the partial index `idx_profiles_referee_only` automatically via PostgreSQL's column-drop CASCADE). (6) Restore prior `events_aggregate_type_check` (drop new version, re-create without `'reference'` and `'reference_contact'` values). Each step uses `IF EXISTS` so the rollback is idempotent against partial-failure recovery.

- [x] Migration `00126_references_projection.sql` — `CREATE OR REPLACE` `apply_projection` with the latest 00123 body PLUS 11 new event handlers below the SHORE_EXPERIENCE block AND extensions to **3 existing handlers** (PROFILE.CREATED, EXPERIENCE.UPDATED, EXPERIENCE.REMOVED, PERSON.DATA_SCRUBBED). Handler count goes **71 → 82** (11 new). Per lessons.md replacement protocol: copy entire 00123 body line-for-line, append new handlers, modify the 3 existing handlers in place, verify `$$` count = 2, file ends with `end if; end; $$;`.

  **Existing-handler extensions (3):**
  - `PROFILE.CREATED` — extend the INSERT to include `referee_only` from payload (default `false` if omitted). Existing onboarding flow doesn't pass it; the lightweight referee signup flow does.
  - `EXPERIENCE.UPDATED` — **edit-lock on snapshot fields (P0-A):** before applying the UPDATE, run a guard query: `SELECT count(*) FROM references WHERE experience_id = p_aggregate_id::uuid AND status IN ('pending', 'accepted')`. If > 0, check whether the payload attempts to change `vessel_id`, `start_date`, `end_date`, or `role_id` against the current row. If any of those four fields differs in the payload, RAISE EXCEPTION 'EXPERIENCE.UPDATED: cannot change vessel/dates/role while references are active — revoke references first'. Other fields (description, contract*type, flag_state, salary*_, sea*time*_, vessel_operation, is_current) update normally. The route layer enforces the same check for a clean error message; the projection-layer guard is defence in depth.
  - `EXPERIENCE.REMOVED` — **Fix A three-step sequence inside the same transaction** (the order matters because the FK auto-nulls `experience_id` after the DELETE; we must stamp the audit row first while it's still joinable):
    1. `UPDATE references SET status='revoked', revoked_at=now(), revoke_reason='experience_removed' WHERE experience_id = p_aggregate_id::uuid AND status IN ('pending', 'accepted')` — stamp the audit row first.
    2. `UPDATE reference_contacts SET status='declined', responded_at=now() WHERE reference_id IN (SELECT id FROM references WHERE experience_id = p_aggregate_id::uuid) AND status='pending'` — close pending contact prompts so the referee doesn't see a dangling consent request after the underlying reference is gone. Accepted contacts (live chats) stay intact — they hold conversation history; closure is opt-in via `<ReferenceContactHeader>`'s "Close conversation" button (W-K).
    3. `DELETE FROM crew_experiences WHERE id = p_aggregate_id::uuid` (existing logic). The FK on `references.experience_id` auto-nulls AFTER step 1 has already stamped the rows; snapshot fields preserve the audit history.
  - `PERSON.DATA_SCRUBBED` — extend to soft-revoke references where the deleted person was requester or referee, stamping the appropriate `revoke_reason` via a CASE:
    ```
    UPDATE references
       SET status = 'revoked',
           revoked_at = now(),
           revoke_reason = CASE
             WHEN requester_person_id = p_person_id THEN 'requester_deactivated'
             WHEN referee_person_id  = p_person_id THEN 'referee_deactivated'
           END
     WHERE (requester_person_id = p_person_id OR referee_person_id = p_person_id)
       AND status IN ('pending', 'accepted');
    ```
    Same for `reference_contacts` on `employer_person_id` (set status='declined' for pending; for accepted, the underlying engagement closure cascades via the existing flow). The CASE branches are mutually exclusive in practice (a single person isn't both requester and referee on the same row — unique constraint + UI flow prevents it), but the order in CASE is deterministic if it ever overlaps.

  **New handlers (11):**
  - `REFERENCE.REQUESTED` — **Vessel-state gate:** re-validate `vessels.nda_flag = false AND vessels.source = 'curated' AND vessels.hidden_at IS NULL` for the experience's vessel (RAISE if any check fails — defence in depth alongside route-layer). **Per-experience cap:** count existing `status IN ('pending', 'accepted')` rows for that experience, compare to Free/Pro limit by reading the requester's `subscriptions.plan`. RAISE EXCEPTION if over. Then INSERT into `references` with status=`pending`, snapshot fields populated from the payload (vessel IMO + period-correct vessel name + dates), `expires_at` from payload (default `now() + interval '24 months'`), `pending_expires_at` from payload (default `now() + interval '30 days'`).
  - `REFERENCE.ACCEPTED` — UPDATE `references` SET status=`accepted`, referee_person_id=p_person_id, consented_at=now() WHERE id=p_aggregate_id::uuid AND status=`pending` AND pending_expires_at > now(). State guard prevents double-accept and accept-after-pending-expiry.
  - `REFERENCE.COMMENT_UPDATED` — UPDATE references SET comment = nullif(p_payload->>'comment', ''), comment_updated_at = now() WHERE id = (p_payload->>'reference_id')::uuid AND referee_person_id = p_person_id AND status = 'accepted'. Empty/null comment clears it. Length validation belongs to the route layer (CHECK constraint catches if it slips through).
  - `REFERENCE.DECLINED` — UPDATE references SET status=`declined`, responded_at=now() WHERE id=p_aggregate_id::uuid AND status=`pending`.
  - `REFERENCE.REVOKED_BY_REQUESTER` — UPDATE references SET status=`revoked`, revoked_at=now(), **`revoke_reason='requester_revoked'`** WHERE id=p_aggregate_id::uuid AND requester_person_id=p_person_id AND **status IN ('pending', 'accepted')**. Comments table extension means the requester can revoke an accepted reference too (in case the comment is unflattering or the relationship soured) — same right as today's "delete experience" capability.
  - `REFERENCE.REVOKED_BY_REFEREE` — UPDATE references SET status=`revoked`, revoked_at=now(), **`revoke_reason='referee_revoked'`** WHERE id=p_aggregate_id::uuid AND referee_person_id=p_person_id AND status=`accepted`.
  - `REFERENCE.EXPIRED` — Two paths, each stamping a distinct `revoke_reason` so the inbound history can distinguish them: (a) accepted-consent expiry — UPDATE references SET status='expired', revoked_at=now(), **`revoke_reason='expired_accepted'`** WHERE status='accepted' AND expires_at < now(); (b) pending-invitation expiry — UPDATE references SET status='expired', revoked_at=now(), **`revoke_reason='expired_pending'`** WHERE status='pending' AND pending_expires_at < now(). Idempotent (WHERE-clause guards on status); cron fires this for both. Note: status transitions to `expired` (not `revoked`) here so the lifecycle distinguishes natural lapse from active revocation; the `revoke_reason` column is reused for the audit explanation regardless.
  - `REFERENCE.CONTACT_REQUESTED` — INSERT reference_contacts row with status=`pending`. **Two-tier gate inside the handler** (defence in depth): if the calling employer is not Pro, RAISE if `count(*) WHERE employer_person_id = p_person_id AND status='pending' >= 10`, OR if `count(*) WHERE employer_person_id = p_person_id AND status='accepted' AND created_at >= now() - interval '30 days' >= 5`. Also validate the underlying reference status='accepted' (can't contact a pending or revoked reference).
  - `REFERENCE.CONTACT_ACCEPTED` — UPDATE reference_contacts SET status=`accepted`, responded_at=now() WHERE id=p_aggregate_id::uuid AND status=`pending`. Re-validate underlying reference is still `accepted` (referee may have revoked between request and accept). INSERT active_engagements with reference_contact_id=p_aggregate_id, parties=employer + referee.
  - `REFERENCE.CONTACT_DECLINED` — UPDATE reference_contacts SET status=`declined`, responded_at=now() WHERE status=`pending`.
  - `REFERENCE.CONTACT_THREAD_CLOSED` (B-8 — hardcoded outcome): UPDATE active_engagements SET status=`closed`, **`outcome='reference_complete'`** WHERE id=(p_payload->>'engagement_id')::uuid AND reference_contact_id IS NOT NULL. The W-K close modal doesn't capture an outcome string; reference contact closure is binary, so the handler stamps a fixed value rather than reading from payload. (If a future flow needs to differentiate close reasons, add a `p_payload->>'outcome'` read with a CHECK-constrained allow-list.)

  _(EXPERIENCE.UPDATED, EXPERIENCE.REMOVED, PERSON.DATA_SCRUBBED extensions are documented in the "Existing-handler extensions" block above.)_

- [x] Rollback `00126_references_projection.down.sql` — NOTICE pointing at re-applying 00123 (defensive only).

- [x] **Pre-Phase-1 verification (B-4 + B-7) — DONE:**
  - `active_engagements`: XOR constraint name = `engagements_posting_xor`, defined as `((daywork_id is not null) != (permanent_posting_id is not null))`. NOT NULL columns to relax for reference-contact rows: `application_id`, `start_date`, `end_date`. `outcome` has CHECK `(outcome in ('successful_placement', 'not_successful', 'withdrew'))` — needs `'reference_complete'` added for B-8.
  - `onboard_person(p_identity_type, p_current_hat, p_profile jsonb, p_person_id)`: accepts flexible `p_profile jsonb` that's merged with `identity_type` and passed to PROFILE.CREATED. **No signature change needed** — lightweight signup passes `referee_only: true` inside the JSONB blob, and the modified PROFILE.CREATED handler reads `(p_payload->>'referee_only')::boolean` (default false).
  - Current `events_aggregate_type_check` allow-list (from 00099): `('person', 'vessel', 'daywork', 'application', 'message', 'engagement', 'checklist', 'invitation', 'experience', 'admin', 'permanent', 'support', 'shore_experience')` — append `'reference'` and `'reference_contact'`.

- [x] Apply both migrations to remote via `npx supabase db push`. Run existing Vessels V2 Wave B stress test post-migration (37/37 must still pass — confirms no regression in the projection body).

- [x] **Stress test 00125+00126:** new script `scripts/stress-test-references-schema.ts` covering:
  - **Per-experience cap:** Free user fires REFERENCE.REQUESTED for 2 refs on same experience (2nd raises); Pro user fires 4 (4th raises). Cap counts pending+accepted.
  - **Vessel-state gates:** REFERENCE.REQUESTED on NDA-flagged experience raises; on `source='pending'` vessel raises; on `hidden_at IS NOT NULL` vessel raises.
  - **Unique referee constraint (B-1 — partial-index status filter):**
    - **Concurrent live duplicates blocked:** with one `accepted` reference for (exp, refereeA), a fresh REFERENCE.REQUESTED + REFERENCE.ACCEPTED for the same (exp, refereeA) raises unique-violation. Same outcome with two pendings that BOTH accept.
    - **Re-request after revoke succeeds:** accepted ref → REVOKED_BY_REQUESTER (status='revoked') → fresh REFERENCE.REQUESTED + REFERENCE.ACCEPTED for the same (exp, refereeA) **succeeds** because the partial index's `status IN ('pending', 'accepted')` clause excludes the old revoked row.
    - **Re-request after expiry succeeds:** same flow but old row is `expired` not `revoked` — also succeeds.
    - **Re-request after referee decline succeeds:** old row is `declined` (referee_person_id NULL — this case shouldn't even hit the index, but verify).
  - **Accept flow:** referee_person_id stamped, consented_at set, status='accepted'.
  - **Comment write:** REFERENCE.COMMENT_UPDATED with 600 chars fails CHECK; 400 chars succeeds; null clears.
  - **Revoke:** by-requester succeeds for both pending AND accepted (new rule); by-referee succeeds for accepted only.
  - **Two-tier contact gate:** Free employer hits pending=10 → 11th request raises; accepts 5 in 30 days → 6th raises.
  - **Snapshot vs live:** vessel renamed via VESSEL.RENAMED post-acceptance — reference still shows the period-correct snapshot name, not the new name.
  - **Experience edit-lock (P0-A):** while an accepted reference exists on an experience, EXPERIENCE.UPDATED with a new `vessel_id`/`start_date`/`end_date`/`role_id` raises; UPDATE with only `description` change succeeds; revoking the reference unlocks the fields.
  - **Experience delete soft-revoke (Fix A — 5 sub-checks):**
    - **Pending ref only:** EXPERIENCE.REMOVED with one `pending` reference → reference soft-revokes (status='revoked', `revoke_reason='experience_removed'`), `experience_id` is now NULL via FK SET NULL, snapshot vessel name + IMO + dates remain readable.
    - **Accepted ref + no contacts:** EXPERIENCE.REMOVED with one `accepted` reference → reference soft-revokes with the same revoke_reason, comment + referee_person_id preserved on the audit row.
    - **Accepted ref + pending contact:** EXPERIENCE.REMOVED while a contact is `pending` → reference soft-revokes AND the pending contact transitions to `declined` with `responded_at=now()`. Referee never sees a dangling consent prompt.
    - **Accepted ref + active chat:** EXPERIENCE.REMOVED while `reference_contacts.status='accepted'` (chat is live) → reference soft-revokes; chat thread + `active_engagements.reference_contact_id` survive (no cascade); messages remain readable; both parties can still resolve the engagement_id.
    - **Re-add same vessel after delete:** delete experience that had an accepted ref → re-add a fresh experience for the same vessel + dates → the `(experience_id, referee_person_id) WHERE experience_id IS NOT NULL` partial unique index does NOT match the old NULL audit row, so a new request to the same referee succeeds.
  - **PERSON.DATA_SCRUBBED:** on requester → references soft-revoke; on referee → references soft-revoke; on employer with pending contacts → contacts decline.
  - **Lightweight referee signup:** PROFILE.CREATED with `referee_only=true` payload sets the column; existing onboarding (no flag in payload) defaults to `false`.

  **~30 checks total.**

#### Phase 2 — Event types + helpers

- [x] Extend `packages/types/src/events.ts`: add **11** new union members + payload shapes (REQUESTED, ACCEPTED, COMMENT_UPDATED, DECLINED, REVOKED_BY_REQUESTER, REVOKED_BY_REFEREE, EXPIRED, CONTACT_REQUESTED, CONTACT_ACCEPTED, CONTACT_DECLINED, CONTACT_THREAD_CLOSED). `REFERENCE.CONTACT_REQUESTED` payload includes optional `question?: string` field. **Extend `PROFILE.CREATED` payload** with optional `referee_only?: boolean` (default false). AggregateType union extended with `'reference'` and `'reference_contact'`.

- [x] Verify `scripts/check-aggregate-types.sh` (the pre-commit hook) still passes with the new event types — this is the bug class lessons.md flags as recurring.

- [x] **Idempotency-key strategy per event** — documented inline at each route's spec in Phase 3; no separate code artifact needed for Phase 2. Strategy:
  - `REFERENCE.REQUESTED` (initial create from `POST /api/references`) — key = `REFERENCE.REQUESTED:${experience_id}:${normalized_email_or_name}` — prevents double-submit on network retry; legitimate distinct invitations differ on email (or generated UUID if no email).
  - `REFERENCE.REQUESTED` (resend from `POST /api/references/[id]/resend` — **B-3 fix**) — key = `REFERENCE.REQUESTED:resend:${oldReferenceId}` — DISTINCT from the initial-create key so D-1 dedup doesn't silently drop the resend event when the same (experience_id, email_or_name) was used originally. This also gives double-tap protection on the Resend button itself: clicking Resend twice on the same old row dedups to one fresh invitation.
  - `REFERENCE.ACCEPTED` — key = `REFERENCE.ACCEPTED:${reference_id}` — double-tap on Accept resolves to first event.
  - `REFERENCE.CONTACT_ACCEPTED` — key = `REFERENCE.CONTACT_ACCEPTED:${reference_contact_id}` — same.
  - All other reference events: no idempotency key needed — state-transition events with WHERE-clause guards in projection are naturally idempotent.

#### Phase 3 — API routes (11 new + 1 cron + 3 modifications)

Each route follows the canonical pattern: `requireDomainUser()` (or `requireAuthSession()` for the public token read), early return on `!guard.ok`, full body in try/catch, `appendEvent` with deterministic `idempotencyKey` per the Phase 2 table. JSDoc block at the top. Co-located test in `__tests__/api/`.

**Modifications to existing routes:**

- [x] `PATCH /api/experiences/[id]` — **add snapshot field edit-lock (P0-A).** Before applying the patch, query `SELECT count(*) FROM references WHERE experience_id = id AND status IN ('pending', 'accepted')`. If > 0 AND the body attempts to change `vessel_id`, `role_id`, `start_date`, or `end_date`, return 409 with `{ error: 'Revoke active references on this experience before changing vessel, role, or dates.', locked_fields: [...], active_references: count }`. Other fields update normally. The route check is the user-friendly path; the projection-layer check is defence in depth.

- [x] `DELETE /api/experiences/[id]` — **Fix A notification fan-out.** BEFORE firing `EXPERIENCE.REMOVED`, query `SELECT id, referee_person_id, snapshot_vessel_name, snapshot_start_date, snapshot_end_date FROM references WHERE experience_id = id AND status='accepted' AND referee_person_id IS NOT NULL` to capture the affected accepted-referee set. Fire `EXPERIENCE.REMOVED` (projection runs the 3-step revoke sequence). AFTER the event commits, iterate the captured referee set and **insert one row per referee directly into the `notifications` table** (bypassing `notifyOnEvent` because that helper has no channel override and would fan out to email/WhatsApp/Telegram/push, which we don't want for this passive audit signal). Insert shape: `{ person_id: refereePersonId, type: 'reference_auto_revoked', title: 'Reference withdrawn', body: '<RequesterDisplayName> removed the experience this reference was tied to. Your reference for <snapshot_vessel_name> · <start>—<end> has been withdrawn.', deep_link: '/profile/settings/references', role_context: 'crew' }`. (No CHECK-constraint update needed — `notifications.type` is plain `text` with no enum guard, confirmed against migration 00040.) Pending refs without a `referee_person_id` are skipped (no one to notify yet). The fan-out is fire-and-forget (`.then(() => {})` swallow pattern, matches existing notifyOnEvent behaviour) so a notifications-table failure can't block the experience-delete response.

- [x] `GET /api/account/export` — **extend (P0-C)** to include in the JSON export:
  - `references` — all rows where caller is `requester_person_id` OR `referee_person_id`. Include status, snapshot fields, comment, comment_updated_at, consented_at, revoked_at, **revoke_reason**, expires_at, pending_expires_at.
  - `reference_contacts` — all rows where caller is `employer_person_id` OR is the referee on the underlying reference. Include status, question, created_at, responded_at, engagement_id.
  - Reference chat history is already covered by the existing engagement-export logic (chats live in the same `messages` table, already iterated).

**New routes (11):**

- [x] `POST /api/references` — crew creates invitation. Body validates `experienceId` is owned by caller, `claimedRefereeRole` enum, `claimedRefereeName` length, `claimedRefereeEmail?` format. **B-2 — current-experience gate:** reject with 400 if `crew_experiences.is_current = true` ("Mark this experience as completed before adding a reference — references are for past working relationships"). Defence-in-depth at route layer because the UI hides the button on active experiences but a power user could still POST directly. **Vessel-state gate:** read the experience's vessel; reject with 400 if `vessel.nda_flag=true` ("References on NDA vessels aren't supported yet") OR `vessel.source != 'curated'` ("References available once your vessel is verified") OR `vessel.hidden_at IS NOT NULL` ("This vessel is unavailable for references"). Reads experience to get start/end dates. Reads vessel for IMO. **Vessel name resolution:** call `resolveHistoricalVesselNames([{ vessel_id, start_date }])` (existing helper from `apps/web/src/lib/vessels/historical-names.ts`) to get the period-correct name. Fall back to `vessels.name` if no historical row covers the experience. Snapshot into payload. Generates token via `crypto.randomUUID()`. **Per-experience cap pre-check** (count existing `status IN ('pending', 'accepted')` for that experience vs Pro/Free tier — reads caller's `subscriptions.plan`). On cap-exceeded, return 402 with `{ error, gate: { reason: 'crew_pro_required', current: N, limit: 1, upgrade_path: '/billing' }}` so the UI can render the upgrade modal cleanly. Fires `REFERENCE.REQUESTED` with the snapshot fields baked in. Returns `{ id, token, link }`. **B-6 — opportunistic in-app notification at request time:** if `claimed_referee_email` is non-null, after firing the event the route does a `serviceClient.from('persons').select('id').eq('email', email.toLowerCase()).maybeSingle()` lookup. If a match exists, fire `notifyOnEvent('REFERENCE.REQUESTED', payload, requesterPersonId)` so the matched person sees the consent prompt in `/messages`. If no match (or no email provided), skip — the share-link is the primary discovery path. **Email courier is NOT used either way** — the lookup is in-app only, preserving the no-courier-email design decision. Notification is fire-and-forget (failure can't block the route response).

- [x] `GET /api/references/by-token/[token]` — **no auth required.** ServiceClient lookup by token. Returns the snapshot summary: requester `display_name`, `snapshot_vessel_name`, `snapshot_vessel_imo`, `snapshot_start_date`, `snapshot_end_date`, `requester_role_at_time`, `claimed_referee_role`, `claimed_referee_email` masked (e.g. `c***n@example.com`) if set. Refuses if `status != 'pending'` or `pending_expires_at < now()`. **Never** returns full requester PII beyond display_name.

- [x] `POST /api/references/[id]/accept` — auth required. Validates the reference is `pending` and `pending_expires_at > now()`. **Email-match enforcement:** if `claimed_referee_email IS NOT NULL`, the auth'd user's email must match (case-insensitive). Returns 403 with explicit "This invitation was sent to a different email" if mismatched. Body optionally accepts `comment: string | null` (max 500 chars). If comment present, fires `REFERENCE.ACCEPTED` + `REFERENCE.COMMENT_UPDATED` as a single `appendEvents` batch (atomic). Notification: fires `notifyOnEvent('REFERENCE.ACCEPTED', ...)` to the requester. Returns `{ ok }`.

- [x] `POST /api/references/[id]/decline` — auth required. Fires `REFERENCE.DECLINED`. **No notification** to the requester (decline is silent per UX rule). Returns `{ ok }`.

- [x] `POST /api/references/[id]/comment` — auth required, must be the referee, reference must be `accepted`. Body: `{ comment: string | null }` (max 500 chars). Fires `REFERENCE.COMMENT_UPDATED`. Returns `{ ok }`.

- [x] `POST /api/references/[id]/revoke` — auth required. Routes to `REFERENCE.REVOKED_BY_REQUESTER` (allows `status IN ('pending', 'accepted')`) or `REFERENCE.REVOKED_BY_REFEREE` (allows `status='accepted'` only) based on whether `auth.uid()` matches `requester_person_id` or `referee_person_id`. 403 if neither.

- [x] `POST /api/references/[id]/resend` — auth required, must be the requester, reference must be `pending` or `expired`. **Atomic two-event flow** via `appendEvents` batch: (1) `REFERENCE.REVOKED_BY_REQUESTER` on the existing row to close the audit trail (no idempotency key — naturally idempotent via WHERE-clause status guard); (2) fresh `REFERENCE.REQUESTED` with **idempotency key `REFERENCE.REQUESTED:resend:${oldReferenceId}` (B-3 fix — distinct from the initial-create key so D-1 dedup won't drop it as a duplicate of the original request)**, a NEW token, NEW `pending_expires_at = now() + 30d`, but reusing the SAME snapshot fields (vessel, dates, role, claimed referee name + email). Returns the new `{ id, token, link }` for the share-link UI. Counts as one slot under the per-experience cap (the old row is revoked first so the slot is freed and immediately re-taken). Used by the Settings → References "Resend" button (P1-B).

- [x] `GET /api/references/mine` — auth required. Returns three buckets: `outbound` (where caller is requester — includes status, comment if accepted), `inbound_accepted` (where caller is referee, accepted — for settings page edit), `inbound_pending` (where caller is referee, pending — for the `/messages` system-message pseudo-thread).

- [x] `POST /api/references/[id]/contact` — auth required, employer/agent only. Body: `{ question?: string }` (optional, max 200 chars — the employer's question to the referee, surfaced on the consent prompt and pre-populated as the chat's first message on accept; P1-D). **Two-tier gate** (also enforced at projection): if not Pro, count `(employer_person_id = caller AND status='pending')` — block at >= 10 with 402 + structured payload `{ error, gate: { reason: 'pending_budget', current: 10, limit: 10, upgrade_path: '/billing' }}`; count `(employer_person_id = caller AND status='accepted' AND created_at >= now() - interval '30 days')` — block at >= 5 with 402 + `{ gate: { reason: 'monthly_budget', current: 5, limit: 5, upgrade_path: '/billing' }}`. Validates underlying reference is `accepted`. Fires `REFERENCE.CONTACT_REQUESTED` (idempotency key per Phase 2). Notification: `notifyOnEvent('REFERENCE.CONTACT_REQUESTED', ...)` to the referee — payload includes `question` so the in-app + email + push body can render the question text. Returns `{ contactId, remaining: { pending: N, monthly: M }}` so the UI can update the "X left this month" hint after the request lands.

- [x] `POST /api/reference-contacts/[id]/accept` — auth required. Validates caller is the referee on the underlying reference, contact status='pending', underlying reference still `accepted` (referee may have revoked between request and accept). Fires `REFERENCE.CONTACT_ACCEPTED`. Notification: `notifyOnEvent('REFERENCE.CONTACT_ACCEPTED', ...)` to the employer with deep link. Returns `{ engagementId }` for redirect to `/messages/{engagementId}`.

- [x] `POST /api/reference-contacts/[id]/decline` — auth required. Validates caller is the referee. Fires `REFERENCE.CONTACT_DECLINED`. **No notification** to the employer (silent per UX rule).

- [x] `POST /api/cron/reference-expiry` — daily cron at `0 5 * * *` (slot between availability-expiry 08:00 and engagement-starts 07:00 — 05:00 UTC keeps DB load spread). **Two queries:** (a) accepted-consent expiry — `SELECT id WHERE status='accepted' AND expires_at < now()`; (b) pending-invitation expiry — `SELECT id WHERE status='pending' AND pending_expires_at < now()`. Fires `REFERENCE.EXPIRED` for each. Authenticated via `CRON_SECRET` header (existing pattern). Add to `vercel.json` crons array.

#### Phase 4 — UI surfaces (9)

- [x] **Add Experience flow — required "Include references?" checkbox (P2-promoted-to-P0):** the existing `add-experience` form (at `apps/web/src/app/(app)/profile/add-experience/`) gets a new required boolean field "Include references on this experience? · Yes / No". Validation: must be answered (no default — forces a deliberate choice). **B-2 disable when is_current=true:** when the user has ticked "I currently work here" (`is_current=true`), the references checkbox is disabled and pre-set to "No" with explainer "References are for past working relationships — you can add them after marking this job complete." If the user un-ticks is_current, the references checkbox becomes editable again. Behaviour on Yes/No:
  - **Yes:** after `EXPERIENCE.ADDED` is fired and the form submits successfully, the page transitions to opening `<AddReferenceDialog>` with the new experience id pre-filled. User can add 1-3 references inline (capped per their tier with the inline counter). They can dismiss the dialog at any point — choosing Yes then dismissing is fine, no error. They can return later via the per-experience "Add reference" button.
  - **No:** form submits, navigates back to `/profile`. Nothing further.

  **Onboarding hint:** during the existing onboarding profile-step (or at first-experience-add), show a one-time dismissible hint card: "References from past captains boost your hiring chances. Whenever you add an experience, you'll get the option to invite a reference." Hint is non-blocking; tracked via a localStorage key so it doesn't reappear after dismiss.

- [x] **Profile experience cards (own profile, crew):** "Add reference" button below each experience card on `/profile`. **Current-experience hide (B-2):** suppress the button when `experience.is_current = true` with hint "Mark this experience as completed to add a reference — references are for past working relationships." **Vessel-state hide:** the button is suppressed when the experience's vessel has `nda_flag=true` (hint: "References on NDA vessels aren't supported yet"), `source != 'curated'` (hint: "References available once your vessel is verified"), or `hidden_at IS NOT NULL` (hint: "This vessel is unavailable for references"). For valid vessels: the button shows a small counter "(2/3)" reflecting the user's tier cap so they always know where they are. Click opens `<AddReferenceDialog>` overlay.

  **`<AddReferenceDialog>`:** name input, role dropdown (Captain / Chief Officer / Chief Engineer / Chief Stew / 2nd Engineer / 2nd Stew / etc. — derive from `yacht_roles` lookup), email input (strongly recommended via UI hint "Add their email so only they can accept — we won't email it for you"). **Inline hint H-1** above submit. **Pay gate:** if the user's tier limit on this experience is already hit, the form button is replaced with `<UpgradeToCrewProCard>` showing "You've used your reference for this experience · €4.99/mo · Crew Pro adds up to 2 more references per experience + Docky AI access" + "Upgrade" CTA → `/billing?plan=crew_pro`. **Submit fires confirmation modal W-A** (consent stakes explained); only on confirm does the dialog POST `/api/references`. On 402 response with `gate.reason='crew_pro_required'`, render the upgrade modal as a fallback (defence in depth — the inline check should catch most cases). On success, dialog stays open showing the share-link primitive (mirrors `<ShareJobButton>` from `applied-tab.tsx:257-262` — uses `navigator.share` if available, falls back to clipboard copy with toast). "Done" button closes; "Add another" button (visible if user has remaining capacity) re-opens the form.

- [x] **Experience-edit form (modify existing):** when an experience has any `pending` or `accepted` references, disable the `vessel`, `start_date`, `end_date`, `role` fields. Show a banner above the form: "Some fields are locked because this experience has active references. Revoke references to change vessel, role, or dates." with an inline link to `/profile/settings/references`. Other fields (description, contract type, flag, salary, sea time, current/past) remain editable. On 409 response from PATCH route, render the same banner — defence in depth.

- [x] **`/ref/[token]` landing page:** new route at `apps/web/src/app/ref/[token]/page.tsx`. SSR-friendly. Reads via `/api/references/by-token/[token]`. Renders the snapshot summary card (requester display_name + period-correct vessel name + IMO + dates + claimed roles) with **inline hint H-4** ("These details are locked — neither party can change them after you accept"). **Optional comment textarea** below Accept/Decline CTAs: `<Textarea>` with placeholder + **inline hint H-2** (public visibility + don't-share-PII guidance) + live character counter. **Accept button fires confirmation modal W-E** — the load-bearing consent moment with explicit public-visibility stakes. Only on confirm does the page POST `/api/references/[id]/accept` with the comment in the body (route batches both events atomically). **Decline button fires confirmation modal W-F** (silent decline acknowledgement). Auth-gated CTAs — already-on-DockWalker auth-redirects to login then back; not-on-DockWalker shows **"Sign up as a referee"** CTA → `/auth/signup?next=/ref/{token}&referee=1` (lightweight signup flow — see next item). **Email-match UX:** if the auth'd user's email doesn't match `claimed_referee_email`, Accept button is disabled with "This invitation was sent to <masked email>". After signup, post-signup redirects back to `/ref/{token}` for explicit Accept (don't auto-accept — consent must be a deliberate action).

- [x] **Lightweight referee signup flow (P1-C):** new branch in `/auth/signup` triggered by `?referee=1` query param.
  - **Form simplification:** show only email + password (or "Continue with Google" OAuth) + display name. **Inline hint H-6** above the submit button (welcome + what becomes visible + Terms-acceptance line). Hide the role/identity-type/etc. selectors that the full signup uses.
  - **Profile creation (B-7):** on successful auth, fire the `onboard_person` RPC with **minimal fields**: `display_name` from input, `identity_type='crew'`, `current_hat='crew'`, **`referee_only=true`** flag. **The exact RPC call shape depends on the Phase-1 verification step's findings (B-4/B-7 pre-flight):** if `onboard_person` accepts a flexible JSONB payload that flows into PROFILE.CREATED, pass `referee_only` inside it; if `onboard_person` is fixed-arg, use the new optional `p_referee_only boolean DEFAULT false` parameter added in 00125; if the decision was to create a separate `onboard_referee()` RPC, call that instead. PROFILE.CREATED handler honours `referee_only` via the Phase 2 type extension. All other crew fields null/empty.
  - **Redirect:** push back to `next=/ref/{token}` so the user lands on the consent screen.
  - **Post-consent modal:** after the user successfully clicks Accept on `/ref/{token}` (in their first session), show a non-blocking modal: "Welcome to DockWalker. Want to complete your crew profile so employers can find you for jobs too?" with **Yes** (→ `/onboarding?from=referee` which routes through the existing flow; on completion, `referee_only` flips to false via PROFILE.UPDATED) and **Maybe later** (→ `/messages`). Modal is shown once per session; dismissed users can complete from `/profile` later.
  - **Middleware integration:** `referee_only=true` users are allowed on `/messages`, `/profile`, `/profile/settings/*`, `/ref/*`, `/auth/*`. Other paths (`/discover`, `/daywork/*`, `/permanent/*`, `/vessels`) redirect to `/profile?reason=complete-onboarding` with a banner: "Complete your DockWalker crew profile to apply for jobs and post availability." Banner has a primary CTA "Complete profile" → `/onboarding`.
  - **Bottom nav adapts:** for referee_only users, hide the Discover + Post tabs. Show Messages + Profile + Settings only. The bottom nav component reads `profile.referee_only` from `useLookups`-style context (or a new `useReferee()` hook).
  - **Profile page banner:** when a referee_only user lands on `/profile`, show a top-of-page card "You're a referee on DockWalker. Complete your crew profile to apply for jobs yourself." with primary CTA "Complete profile" → `/onboarding`. Dismissible (per session) but reappears on next visit until profile is completed.

- [x] **Profile experience cards (viewed by others — `/api/profile/[personId]` consumers):** the API now returns each experience's accepted+visible references (filtered by the viewer-context subscription rule in Phase 5). Add a new section to `<ProfileOverlay>`'s experience expansion: "References (N)" with one row per reference showing referee display_name + EpauletteBadge + role + the **comment (truncated via existing `<ExpandableText>` to 200 chars with "Read more")** in italics under quotation marks (mirrors `applied-tab.tsx:266-269` styling). Each row is tappable → opens nested `<ProfileOverlay>` of the referee with a **"Contact reference"** button if the viewer is employer/agent.

  **Contact reference flow:** clicking the button opens `<ContactReferenceDialog>` with an optional `<Textarea>` "What would you like to ask? (optional, max 200 chars)" + counter + hint "Increases the chance the reference accepts your contact." **Inline hint H-3** above submit (remaining contact requests this month for Free; nothing for Pro). **Submit fires confirmation modal W-J** (Free + Pro variants) showing the question text + remaining quota + silent-decline policy. Only on confirm does the dialog POST `/api/references/[id]/contact` with the question. **Pay gate:** the button shows the remaining count for free employers ("3 contact requests left this month"). On 402 response with `gate.reason='monthly_budget'` or `'pending_budget'`, render `<UpgradeToEmployerProCard>` showing "Employer Pro · €14.99/mo · Unlimited reference contacts + unlimited templates + expanded shortlist cap" + "Upgrade" CTA → `/billing?plan=employer_pro`.

- [x] **`/messages` system-message threads — invitation + contact consent.** New pseudo-engagement type for consent prompts. The `/api/messages` aggregator extended to return reference-invitation pending rows (where caller is referee) AND reference-contact pending rows in a UNION with the existing active_engagements query. Renders inline as a single system message with the snapshot card + (for contact prompts) **the employer's `question` text** if provided + Accept / Decline buttons. **Reference-invitation Accept fires confirmation modal W-E** (same as on `/ref/[token]` — re-uses the component); **reference-invitation Decline fires W-F**. **Contact-prompt Accept fires confirmation modal W-I** (open chat with employer); **contact-prompt Decline is silent** (no modal — single tap → archive). On either action, the pseudo-thread auto-archives. Contact-accept transitions to a real chat using the engagement_id returned from `REFERENCE.CONTACT_ACCEPTED`. **First message pre-population:** when the contact is accepted and the chat thread opens, the employer's `question` (if provided) is auto-inserted as the first message in the thread (system-attribution but visually the employer's), so the referee can respond inline. **`<ReferenceContactHeader>` for the chat:** when `active_engagements.reference_contact_id IS NOT NULL`, render a header showing "Reference for [crew] · [vessel] · [dates]" + the referee's comment in a context banner, instead of the daywork/permanent header. **Revoked-underlying-reference banner (Fix A):** the header reads the underlying `references.status` + `revoke_reason` via the existing engagement projection. If status is `revoked` or `expired`, render an inline dismissible banner above the chat input: "This reference was withdrawn — [human-readable reason from `revoke_reason`]. The conversation remains open for closure but no new context will appear from the reference." The banner copy varies by reason: `experience_removed` → "The crew member removed this experience from their profile."; `requester_revoked` → "The crew member revoked this reference."; `referee_revoked` → "You revoked your consent for this reference."; `requester_deactivated` → "The crew member deactivated their account."; `referee_deactivated` → "(N/A — you'd be deactivated)"; `expired_accepted` → "This reference reached its 24-month expiry."; `expired_pending` → "(N/A — accepted contacts only)". The chat input remains usable until either party clicks Close (W-K). **"Close conversation" button in the header fires confirmation modal W-K** (either party). Hide the engagement-action block (rate, complete, postpone — none apply). Existing `<DocumentExchange>` + realtime + chat-input infrastructure work unchanged.

- [x] **Settings → References:** new section at `/profile/settings/references`. Three lists with role-aware actions and confirmation modals on every consequential action:
  - **Outbound** (caller is requester) — for **pending** rows: status pill + share-link copy button + **Resend** button (fires modal **W-D**, then `/api/references/[id]/resend`) + **Revoke** button (fires modal **W-C**, then `/api/references/[id]/revoke`). For **accepted** rows: status pill + comment preview + **Revoke** button (fires modal **W-B** — destructive). For **expired** rows: **Resend** button (fires **W-D**) + Hide (UI-only audit removal, no modal).
  - **Inbound accepted** (caller is referee) — for each row: requester display_name + experience snapshot + the comment they wrote + **Edit comment** button (opens modal containing the 500-char textarea + counter + **inline hint H-2**, on save fires modal **W-G**) + **Revoke consent** button (fires modal **W-H** — destructive). Plus an audit log of **inbound contacts** they've responded to (employer name + date + accepted/declined + linked engagement_id if accepted).
  - **Inbound history** (declined/revoked/expired by either party) — read-only audit. Shows full timeline including a human-readable explanation per row sourced from `revoke_reason`: "Crew member revoked", "Crew member removed this experience", "You revoked your consent", "Crew member deactivated their account", "Reference reached its 24-month expiry", "Pending invitation expired (30 days)". The snapshot fields (vessel name, dates, role) remain visible on revoked rows even after `experience_id` was nulled by the FK — the audit row is keyed off snapshots, not the live experience.

  **Tier-status indicator** at the top of the page: "You're on Crew Free · 1 reference per experience · Upgrade to Crew Pro for up to 3" / "You're on Crew Pro · 3 references per experience" with an Upgrade button (Free only). Same pattern for employer side: "Employer Free · 5 contact requests / 30 days · 3 left" / "Employer Pro · Unlimited".

- [x] **Notification triggers:** 5 hooks total. **4 via `notifyOnEvent`** (multi-channel: in-app + email + WhatsApp/Telegram + push per user prefs; reuses existing `apps/web/src/lib/push-triggers/index.ts` — adds 4 small case branches inside `resolveNotification` + `mapEventToNotificationType` + `resolveDeepLink`) for REFERENCE.REQUESTED, REFERENCE.ACCEPTED, REFERENCE.CONTACT_REQUESTED, REFERENCE.CONTACT_ACCEPTED. **1 via direct `notifications` table insert** (in-app only — `notifyOnEvent` has no channel override) for the EXPERIENCE.REMOVED auto-revoke fan-out — see the `DELETE /api/experiences/[id]` modification spec in Phase 3. Decline events fire NO notification per the silent-decline UX rule. **Deep links per P1-A:**
  - `REFERENCE.REQUESTED` → `/messages` (consent pseudo-thread). **Conditional fire (B-6):** only when `claimed_referee_email` matches an existing person on DockWalker. The route does a persons-by-email lookup post-event-fire and fires `notifyOnEvent` only on hit. Channels: in-app + email + WhatsApp/Telegram per user prefs of the matched person. If no email or no match, the share-link is the only discovery path (by design — the link is the privacy-preserving primitive).
  - `REFERENCE.ACCEPTED` → `/profile/settings/references` (requester sees the new accepted reference + the comment). Channels: in-app + email + WhatsApp/Telegram per user prefs.
  - `REFERENCE.CONTACT_REQUESTED` → `/messages` (consent pseudo-thread). Channels: in-app + email + WhatsApp/Telegram per user prefs.
  - `REFERENCE.CONTACT_ACCEPTED` → `/messages/[engagementId]` (the chat that just opened). Channels: in-app + email + WhatsApp/Telegram per user prefs.
  - **`EXPERIENCE.REMOVED` → affected accepted referees (Fix A — in-app only):** deep link `/profile/settings/references`. Channel: **in-app only** (one direct `notifications` insert per affected referee from the `DELETE /api/experiences/[id]` route — see Phase 3 spec). Pending refs without a `referee_person_id` skip the notification.

#### Phase 5 — Subscription degrade visibility logic

- [x] In `/api/profile/[personId]/route.ts`, when assembling experience response: SELECT references WHERE experience_id IN (...) AND status='accepted' ORDER BY consented_at DESC. Group by experience_id. Apply LIMIT per experience based on the EXPERIENCE OWNER's subscription tier (lookup their `subscriptions.plan` once at the top): Free=1, Pro=3. Owner viewing own profile bypasses the limit. View-only profile (different person viewing) applies the limit.

- [x] Verify behaviour in test: a crew with 3 accepted references on one experience downgrades to Free. View-only profile API returns 1 reference (most recent). Re-upgrade restores all 3. References table itself is unchanged throughout — pure read-side filter.

#### Phase 6 — Tests, docs, commit

- [ ] Unit tests for all 11 routes in `__tests__/api/references-*.test.ts` and `__tests__/api/reference-contacts-*.test.ts`. Cover: 401, validation, per-experience cap (Free vs Pro), NDA-experience rejection, email-match enforcement, two-tier employer contact gate (pending<10 + accepted-30d<5), double-accept guard, revoke routing (requester pending + accepted, referee accepted only), snapshot immutability across experience edits, expired-reference rejection (24mo accepted + 30d pending), comment length cap (500 chars), comment write requires referee + accepted status, accept route batches REFERENCE.ACCEPTED + REFERENCE.COMMENT_UPDATED atomically when comment provided.

- [ ] Stress test `stress-test-references.ts` (live remote DB): fires the full 11-event sequence (request → accept-with-comment → comment-edit → contact-request → contact-accept → engagement chat → close → revoke-by-requester-on-accepted), then negative cases (decline, revoke-pending, double-accept, contact-without-accepted-reference, contact on a revoked reference, NDA experience rejection, email-match block, comment over 500 chars rejected). **Fix A experience-deletion edge cases (5 checks)** — same five sub-cases listed in Phase 1's stress test, run end-to-end against the route layer (DELETE `/api/experiences/[id]` → projection → assert references soft-revoked, contacts declined, chat preserved, snapshots readable, re-request to same referee allowed). **Fix A auto-revoke notification (2 checks):** delete an experience with one accepted referee → assert exactly one row in `notifications` for that referee with `type='reference_auto_revoked'` and the expected body + deep_link; delete an experience with one pending reference (no referee_person_id yet) → assert no notification fires. **B-fix coverage (6 checks):**
  - **B-1:** revoke an accepted ref → re-request the SAME referee → re-accept succeeds (no unique-violation). Same for re-request after expired and after referee-decline.
  - **B-2:** POST `/api/references` for an experience with `is_current=true` returns 400; same experience after toggling is_current=false succeeds.
  - **B-3:** initial REFERENCE.REQUESTED then resend: assert two distinct event rows (idempotency keys differ); double-tap the resend route with same payload → second tap dedups (one new ref, not two).
  - **B-4:** INSERT into `active_engagements` with only `reference_contact_id` set succeeds (existing CHECK doesn't block); regression-check that daywork-only and permanent-only inserts still pass.
  - **B-6:** REFERENCE.REQUESTED with claimed_referee_email matching an existing person → notification row appears in `notifications` for that person; without a match → no notification fires; no email provided → no notification fires.
  - **B-8:** CONTACT_THREAD_CLOSED writes `outcome='reference_complete'` regardless of payload contents.

  43-48 checks total.

- [ ] BUILD_STATE.md: bump schema v124 → v126 with two stage entries (one per migration). Migration table rows for 00125 and 00126.

- [ ] supabase/README.md: rows for 00125 + 00126.

- [ ] apps/web/README.md: section on the 11 new routes + the share-link primitive + the consent-pseudo-thread shape in `/messages` + the `<ReferenceContactHeader>` for chat layout switching.

- [ ] packages/types/README.md: 11 new event types listed.

- [ ] Final commit + push + watch CI green.

#### Done conditions

- All checklist items above ticked.
- 1286+ tests still pass (the new tests will add to the count).
- Type-check + lint clean.
- All three stress tests (00125+00126 schema, references end-to-end, existing Wave B regression) green on live remote.
- CI green on push.
- Manual smoke tests:
  - **Happy path (Add Experience flow):** crew adds new experience → ticks "Include references? Yes" → form submits, AddReferenceDialog auto-opens → adds Captain Smith with email → share link generated → opens link in private window → "Sign up as a referee" → lightweight signup (email + name only) → lands on consent page → enters comment + Accept → modal "Complete your crew profile?" → Skip → lands in /messages. Original crew sees Captain Smith reference + comment on their profile.
  - **Happy path (employer contact):** employer views crew profile → sees Captain Smith reference + comment → clicks Contact reference → enters question "How was their watchkeeping?" → submits → Captain Smith gets notification → opens /messages, sees consent prompt with the question → Accept → chat thread opens with the question pre-populated as employer's first message. Both can chat. Either closes the thread.
  - **"Include references?" required field:** Add Experience form refuses to submit if the checkbox is unanswered.
  - **NDA + pending vessel gates:** crew tries to add reference on an NDA-flagged experience → "Add reference" button hidden with hint; on a pending-vessel experience → button hidden with different hint. Direct API hit returns 400.
  - **Email-match:** crew adds reference with claimedRefereeEmail; referee A (different email) taps link → Accept button disabled with masked-email hint; referee B (matching email) taps → can accept.
  - **Experience edit-lock (P0-A):** crew has an accepted reference on Experience X → tries to edit X's vessel/dates/role → form fields disabled with banner; tries to submit via direct PATCH → 409 with clear error. Crew revokes the reference → fields unlock.
  - **Experience deletion:** crew with an accepted reference + active reference-contact chat deletes the experience → reference soft-revokes (status='revoked') but the chat thread is preserved and both parties can still view history.
  - **Vessel rename:** vessel renamed after reference accepted → reference card on profile shows the period-correct (snapshot) name, not the current renamed name.
  - **Subscription degrade:** Pro crew with 3 accepted references on one experience downgrades to Free → view-only profile API returns most-recent 1; owner still sees all 3.
  - **Pay gate (crew side):** Free crew on an experience with 1 accepted reference clicks "Add reference" → AddReferenceDialog shows "1/1" counter and the upgrade card; click Upgrade → routes to /billing.
  - **Pay gate (employer side):** Free employer hits 5 accepted contacts in 30 days → next Contact button shows "0 left this month"; clicking opens upgrade modal → /billing.
  - **Resend pending invitation:** crew sees their pending Captain Smith invitation in Settings → Resend → new token generated, share link refreshed, original auto-revokes (audit log shows both events).
  - **Lightweight referee blocked from /discover:** referee_only user navigates to /discover → redirected to /profile with banner "Complete your DockWalker crew profile to apply for jobs." Bottom nav hides Discover. After completing onboarding, referee_only flips false and Discover appears.
  - **GDPR export includes references:** any user runs /api/account/export → JSON contains `references` and `reference_contacts` sections with their data on both sides.
  - **Warning dialogs fire (W-A through W-K):** every consequential action surfaces the documented confirmation modal before the underlying API call. Cancel buttons abort cleanly. Particularly verify **W-E** (referee-accept) explicitly states "name and role will be shown publicly" + "comment will also be visible publicly" + "you can revoke at any time" — this is the load-bearing consent moment.
  - **Inline hints render (H-1 through H-8):** verify each hint appears in its documented surface and uses the correct content. H-1 above the AddReferenceDialog submit, H-2 below the comment textarea on `/ref/[token]` and Edit comment, H-3 above the ContactReferenceDialog submit (Free only), H-4 under the snapshot card on `/ref/[token]`, H-6 above the lightweight signup submit, H-7 banner on the locked experience-edit form.

#### Out of scope for this task (deferred)

- Throttling on referee inbound contact volume across multiple employers (per planning convo — edge case, defer).
- Manual "set primary reference" toggle for crew on subscription degrade (auto most-recent-first is sufficient v1).
- Reference badges or "verified by IMO" trust signals on the public profile (cosmetic, post-launch).
- Email courier for the share link (replaced by the social-share primitive per planning convo).
- Re-consent / refresh prompt at 24-month expiry (referee re-accepts a fresh invitation manually for now; future work could add one-tap renewal from a notification).
- NDA-vessel reference flow (vessel-owner-approved consent layer) — defer to v1.1.
- `ADMIN.REFERENCE_COMMENT_REMOVED` admin tooling for reported abusive comments — defer to v1.1; existing `<ReportDialog>` captures reports for now.
- Cooldown between repeated employer contact requests on the same reference — defer to v1.1.

---

---

## Queue

### Post-review backlog (sourced from end-to-end audit, 2026-04-27)

> Full context for every item below is in [`tasks/end-to-end-review-2026-04-27.md`](./end-to-end-review-2026-04-27.md). Risk IDs (M-1, F-1, etc.) match the consolidated risk register in that document. Both P0 fixes (D-1 event idempotency + D-2 null-safety guards) shipped 2026-04-27 — see commits `bd8a3f8` (D-2), `3eccfff` (D-1), schema v122 → v124.

#### P1 — operational + go-to-market posture

These are not code-level bugs; they are gaps in operational readiness, regulatory positioning, and external trust signals. Order of impact roughly: M-1 > M-2 > M-3 > the rest.

- [ ] **P1 — M-1: Publish MLC 2006 positioning statement, fix the marketing-copy/gate gap, and apply for MCA RPSP accreditation.**

  **Problem:** Every agency competitor (YPI Crew, The Crew Network, Wilson Halligan, Quay Crew, Bluewater) leads marketing with MLC 2006 / MCA accreditation. DockWalker is silent on this. To a captain or fleet manager evaluating the platform, that silence reads as "amateur hour" — even though the architecture would actually pass an audit better than most agency CRMs (append-only ledger, immutable IMO anchor, structured cancellation reasons, GDPR export coverage).

  **A separate, narrower issue surfaced by the 2026-04-27 codebase audit:** the Crew Pro tier gates the "Available Crew" tab (proactive employer-initiated invitations) at `apps/web/src/app/api/daywork/[id]/available-crew/route.ts:137-149` — only Crew Pro subscribers appear when employers browse for crew to invite. The structural model is defensible under Reg 1.4 (every daywork posting remains publicly applyable by every crew member; Available Crew is a parallel discovery surface, not the only one — this is closer to LinkedIn Premium than to the historical agency-fee abuse the convention was designed to stop, and Crewseekers operates a more aggressive paid-crew membership model openly without enforcement action). However, the marketing copy is inconsistent with the implementation: `apps/web/src/app/page.tsx:33-35` and `:143-149` claim "no pay-to-rank" / "fair visibility", which is factually contradicted by the gate. This is a truth-in-advertising issue separate from but adjacent to MLC. The upsell at `apps/web/src/components/availability-overlay.tsx:405-413` ("Upgrade to Crew Pro to appear in employer searches") and the feature label at `apps/web/src/app/(app)/billing/page.tsx:36` both read more aggressively than the actual model warrants — a regulator skim-reading those strings in isolation might bucket the platform incorrectly.

  **Why it matters:** Two concerns rolled together. The positioning silence is the largest single credibility gap with sophisticated buyers. The copy-vs-implementation gap creates a small but meaningful regulatory ambiguity that's trivial to close. Both are best handled in the same maritime-lawyer engagement.

  **Suggested fix:** Four deliverables. (1) **Marketing-copy reconciliation** (~1 hour, do this first): rewrite `availability-overlay.tsx:405-413` to lead with free-baseline-access ("Free crew can apply to any posted job. Crew Pro adds proactive discovery — employers can also find and invite you directly."); remove the "no pay-to-rank" / "fair visibility" claims from `page.tsx:33-35` and `:143-149` (the rest of the value-prop block stands); rewrite the Crew Pro feature label at `billing/page.tsx:36` to "Get discovered by employers — appear in proactive search alongside applying directly to posted jobs"; add one line to T&Cs §1 making equal-baseline-access explicit ("Crew may apply to any posted job at no cost. Crew Pro is an optional subscription for additional features."). (2) **Maritime-specialist lawyer review** (~1-2 hour engagement) to confirm the marketplace-facilitator vs manning-agency line is held AND specifically to bless the freemium structure against Reg 1.4. (3) **Marketing-site compliance page** (`/about/compliance` or similar) publishing the MLC 2006 alignment statement, citing Regulation 1.4, listing what DockWalker does and does not do, and naming the data-protection officer (DPO contact already wired as admin@nautalink.io per `apps/web/src/lib/legal-placeholders.ts`). The positioning statement should be deliberate: "DockWalker is a facilitation platform under MLC 2006 Regulation 1.4. We do not charge seafarers for job access. We do not place crew. We provide structured discovery and audit-grade event records." (4) **UK MCA RPSP accreditation application** — see MGN 490 for the criteria.

  **Acceptance:** copy-reconciliation merged (verify with grep that "pay-to-rank" no longer appears in landing page and the upsell leads with free-access framing); compliance page published; T&Cs reviewed by maritime lawyer with explicit Reg 1.4 sign-off on the Crew Pro tier; RPSP application submitted (regardless of outcome — submission alone is a signal).

- [ ] **P1 — M-2: Land 3 named captain endorsements before launch.**

  **Problem:** Trust in the superyacht industry is transitive through named individuals. One named senior captain on a 60m+ moves more crew than three months of paid acquisition. DockWalker has zero captain testimonials, zero named yacht references on the marketing surface today.

  **Why it matters:** The competitor matrix in `tasks/end-to-end-review-2026-04-27.md` shows that platforms without trust signals (Yotspot for crew quality, Crewseekers, etc.) live in the long tail. Agencies that survive long-term all have decades-of-named-captain endorsements quietly underwriting their pipeline. DockWalker can short-cut to that with three deliberate asks.

  **Suggested fix:** Identify three Antibes-based captains running charter-operated 60m+ vessels. Approach via warm intro (likely founder's existing network — Nautalink Technologies is UK-registered and the founder presumably has industry contacts). Offer Crew Pro for life for any named crew member of any captain who endorses. The endorsement is name + yacht (e.g., "Captain X, M/Y Y") — anonymized testimonials don't move trust in this industry.

  **Acceptance:** three published endorsements on the marketing site, by name, with yacht reference.

- [ ] **P1 — M-3: Resolve mobile-app blockage and complete Expo Phase 7 (TestFlight).**

  **Problem:** Daywork is intrinsically mobile. Crew use phones at the dock, captains coordinate from their cabin, the entire WhatsApp loop DockWalker is replacing is mobile-native. Until the Expo app ships, DockWalker is competing one-handed against Dayworker.co's iOS+Android presence and against the inherently-mobile WhatsApp loop. Per project memory, the blocker is a native startup crash that requires Mac + Xcode to debug, and the founder doesn't currently have access — estimated unblock ~June 2026.

  **Why it matters:** The architecture work is done — Phase 4 (conversations) is complete, Phase 5–7 are deployment + UX-polish + Capacitor-removal phases. The blockage is purely environmental, not architectural. Every week of delay extends the window in which Dayworker.co or a copycat can build mindshare in the daywork-native segment that's currently functionally vacant.

  **Suggested fix:** Either (a) acquire Mac+Xcode access (cheapest: rent a cloud Mac via MacStadium or AWS EC2 Mac — ~$60/month, sufficient for sporadic debugging), or (b) contract a Mac-native iOS developer for 2-3 days to surface the crash root cause (~£1500 budget). Option (a) is cheaper but requires founder bandwidth; option (b) is faster and resolves the blocker definitively. Once the crash is fixed: complete Phases 5 (in-flight UX polish), 6 (push notification provisioning), 7 (TestFlight + 3 tester devices + 48-hour zero-P0 window). Then delete Capacitor legacy files per `tasks/mobile-web-split-spec.md` § 9.

  **Acceptance:** TestFlight build distributed to 3+ tester devices; zero P0 bugs in 48 hours; Capacitor legacy files removed.

- [ ] **P1 — T-1: Wire Playwright E2E to GitHub Actions CI.**

  **Problem:** 355 Playwright specs across 17 files exist and pass locally (last manual run 2026-03-27 per `tasks/playwright-test-registry.md`). Pre-commit hook runs Vitest + type-check only — it does NOT run Playwright. Visual regressions and flow breakages can land on main and survive until the next manual testing-agent invocation.

  **Why it matters:** Pre-launch is exactly the moment when E2E coverage matters most — the Vitest unit tests catch logic bugs but miss layout regressions, modal z-index conflicts (a recurring class of bug per project memory), navigation flow breakage, and integration-level state drift between tabs.

  **Suggested fix:** Add a `playwright` job to `.github/workflows/ci.yml` that (a) installs Playwright browsers, (b) starts the Next.js dev server in background, (c) runs `npx playwright test`, (d) uploads HTML report as a CI artifact on failure. This will make CI noticeably slower (probably +3-5 minutes per push), but the cost is justified pre-launch. Tolerate occasional flakes by configuring 1-retry on Playwright suites.

  **Files to touch:** `.github/workflows/ci.yml` (add playwright job + dependencies between jobs). Possibly `apps/web/playwright.config.ts` to enable retries in CI mode only.

  **Acceptance:** CI runs Playwright on every push; report visible as artifact; failures block deploy.

- [ ] **P1 — S-1: Audit raw `from('vessels')` queries and ensure NDA masking goes through `get_vessel_public`.**

  **Problem:** `get_vessel_public(uuid)` and `get_vessels_public_batch(uuid[])` (most recently in migration 00122) are the only sanctioned vessel-read paths for non-owners — they apply NDA masking, hidden/pending exclusion, and engagement-based reveal. But there is no enforcement preventing a route from doing a raw `from('vessels').select('id, name, imo_number')` query that bypasses the masking entirely. Any such route silently leaks vessel data.

  **Why it matters:** Vessels V2 Wave F (just shipped) closed the front door (lookup route) and side doors (the two batch RPCs). If any other route still goes direct, the moderation actions admins take (hide a vessel, leave a vessel pending) are partially enforced. NDA + hidden + pending all share the same threat model: keep private data private.

  **Suggested fix:** `grep -rn "from('vessels')\|from(\"vessels\")" apps/web/src/app/api/ apps/web/src/lib/` to enumerate every direct vessel query. For each: confirm it's owner-scoped (e.g., `/api/vessels/[id]` PATCH where the user must own the vessel, RLS-enforced) — that's fine. Any non-owner-scoped read should switch to the RPC. Optionally add a custom ESLint rule banning raw vessel SELECTs outside an allowlist, to prevent regression.

  **Files to touch:** depends on grep result — probably a handful of routes need updating. ESLint rule lives in `apps/web/eslint.config.mjs`.

  **Acceptance:** every non-owner-scoped vessel read goes through one of the two RPCs; lint rule prevents regression.

- [ ] **P1 — S-2: Automate `PERSON.DATA_SCRUBBED` 30 days after `PERSON.DEACTIVATED`.**

  **Problem:** Deactivation flow (`/api/account/deactivate`) appends `PERSON.DEACTIVATED`, sets `deactivated_at`, and bans the auth user. The follow-up `PERSON.DATA_SCRUBBED` event (which actually wipes PII per migration 00108 — 22 profile fields nulled, experiences deleted, structure preserved) is documented but currently a manual admin process. If admin process slips, PII persists past the documented 30-day retention period — a GDPR exposure.

  **Why it matters:** Right-to-erasure under GDPR Article 17 has compliance teeth. EU crew (Antibes, Palma, Monaco) are the bulk of the Med-season audience. Manual processes break under load. The architecture for automation is already there (cron infrastructure exists for availability expiry + engagement-starts).

  **Suggested fix:** New cron at `/api/cron/data-scrub` running daily (recommend `0 4 * * *` to avoid clashing with existing crons at 07:00 and 08:00). Query: persons where `deactivated_at <= now() - interval '30 days'` AND `(scrubbed_at IS NULL OR scrubbed_at IS NOT YET SET)`. For each: append `PERSON.DATA_SCRUBBED` event. Projection (already in 00108) wipes fields. Add to `vercel.json` crons array. Add unit test that sets `deactivated_at` to a date >30d ago, runs the cron handler, asserts the scrub event was appended.

  **Files to touch:** new `apps/web/src/app/api/cron/data-scrub/route.ts`. `vercel.json` crons addition. New unit test in `apps/web/__tests__/api/`.

  **Acceptance:** cron runs daily; deactivated users' PII is scrubbed at 30d + 1 day; ledger event records the scrub.

- [ ] **P1 — I-1: Configure Sentry DSN in Vercel environment variables and verify error capture.**

  **Problem:** `@sentry/nextjs` SDK is integrated in `next.config.ts`, but the DSN is conditional (no-op if `NEXT_PUBLIC_SENTRY_DSN` is unset). The infrastructure agent flagged that the DSN may not be configured in production — meaning production errors live only in Vercel's per-deployment log dashboard, are not aggregated, are not searchable across deploys, and are not alertable.

  **Why it matters:** Pre-launch with no aggregated error tracking is "flying blind." First weeks of real-user traffic are exactly when you need fast iteration on the bug surface.

  **Suggested fix:** Confirm whether DSN is set (check Vercel Environment Variables dashboard → Production env). If not: create Sentry project for `dockwalker-web` (and a separate one for mobile when Expo ships), copy DSN into Vercel env vars. Verify by triggering a deliberate test error on a non-production preview deploy. Cost is roughly $29/month for the Team tier — covers 1M error events.

  **Files to touch:** Vercel Environment Variables dashboard (no code changes needed — `next.config.ts` already reads the DSN).

  **Acceptance:** test error on preview deploy appears in Sentry within 30 seconds.

- [ ] **P1 — I-2: Document database emergency-rollback runbook.**

  **Problem:** Database migrations auto-deploy on push to main (per `.github/workflows/ci.yml` deploy-migrations job). If a migration ships with a bug — a CHECK constraint that rejects valid data, a projection handler that breaks state, an index that takes too long to build — there is no documented procedure for the founder to roll back. Right now, recovery would be ad-hoc.

  **Why it matters:** The migration discipline is already excellent (every migration has a paired `.down.sql`, CI runs forward → reverse → forward cycle). What's missing is the _operational_ playbook: who notices the bad migration, what command runs, what's the order of operations, what's the safety rope if rollback also fails.

  **Suggested fix:** Create `tasks/runbook.md` with an "Emergency database rollback" section. Cover: (a) detection (Sentry error spike, user reports, stress-test failure), (b) decision criteria (when to rollback vs hotfix forward), (c) commands (`npx supabase db query --linked --file supabase/rollbacks/00XXX.down.sql` to apply a single rollback to remote), (d) verification (re-run relevant stress test), (e) post-mortem template. Reference from `CLAUDE.md` § Pre-Commit Hook Requirements.

  **Files to touch:** new `tasks/runbook.md`.

  **Acceptance:** runbook exists; founder can execute it cold without re-deriving.

- [ ] **P1 — I-3 / S-3: Audit and migrate secrets from `.env.production.local` to Vercel Environment Variables; rotate any keys that touched the local file.**

  **Problem:** The infrastructure + security agents both flagged that `.env.production.local` likely contains live API keys (Anthropic, OpenAI, Supabase service-role, possibly Stripe, Resend). Standard practice is to use Vercel Environment Variables for production secrets and keep `.env.production.local` git-ignored as a local-dev-only fallback. The risk is that if `.env.production.local` is ever accidentally committed (gitignore bypass, IDE save-on-focus, manual `git add .`), the keys are publicly exposed in git history.

  **Why it matters:** Service-role key has unrestricted database access. Anthropic / OpenAI keys have direct cost exposure (an attacker can run up tens of thousands in API charges before detection). This is operational hygiene that should be tightened pre-launch even if no incident has occurred.

  **Suggested fix:** (a) Audit Vercel Environment Variables dashboard against `apps/web/.env.example` — every key in `.env.example` should have a value in Vercel Production env. (b) Confirm `.env.production.local` is in `.gitignore` (likely already is — verify). (c) Rotate any key that has _ever_ been in `.env.production.local` on a developer's machine — Anthropic + OpenAI keys are the highest priority because cost exposure is direct. Supabase service-role rotation requires a one-time secret swap in Vercel + a re-deploy. (d) Document the secrets-management policy in `tasks/runbook.md` (no production secrets in the repo, ever).

  **Files to touch:** Vercel Environment Variables dashboard. `.gitignore` (verify). `tasks/runbook.md` (new policy section).

  **Acceptance:** every key in `.env.example` has a value in Vercel Production; rotation log entry exists for any rotated keys; documented policy.

---

## BLOCKED — external/lawyer

### Legal pages go-live

`/privacy` and `/terms` pages render with placeholder values wired in `apps/web/src/lib/legal-placeholders.ts` (Delaware incorporation, Nautalink Technologies Inc., admin@nautalink.io support/DPO, EU Frankfurt Supabase region).

- [ ] **Lawyer review of `/privacy` and `/terms` wording** (source drafts: `tasks/privacy-policy-spec.md` + `tasks/founder-drafts.md` §1) — placeholder VALUES are correct; the POLICY TEXT still needs legal review.
- [ ] Decide: cookie consent banner needed for target jurisdictions? (Functional cookies only — likely not required under GDPR, but check local law)

---

## Pre-launch QA (do before opening to real users)

### Google Sign-In edge cases

> Provider is live (OAuth client in Google Cloud under nautalink.io org,
> Supabase provider enabled, identity linking on). Basic sign-up/sign-in
> verified end-to-end. The items below are edge-case verifications.

- [ ] Sign up via Google in incognito → confirm display_name prefilled from Google profile on onboarding.
- [ ] As an OAuth-only user (no email/password identity), visit `/auth/forgot-password` → confirm the "Signed up with Google?" inline note + Google button render above the reset form.
- [ ] As an OAuth-only user, visit Settings → Account → confirm change-password section is hidden and replaced with "manage your password at Google" link.
- [ ] As an existing email/password user, sign in with Google using the same email → confirm the two identities merge into one account (manual linking is on).

### Stripe live mode QA

- [ ] Customer Portal flow: subscribe → click "Manage subscription" in app → land in Stripe Customer Portal → cancel from there → confirm app flips to Free.
- [ ] Failed payment recovery: use a card known to fail 3DS → confirm app shows graceful error, no orphaned subscription state.
- [ ] Subscription update via Stripe dashboard (e.g. change plan) → confirm `customer.subscription.updated` webhook fires and app reflects new plan.

---

## Deferred — intentional

### Custom Supabase auth domain ($10/mo)

> Cosmetic only — currently Google Sign-In account picker shows
> `hwpcuehqawullzqbmcdv.supabase.co` instead of "DockWalker". Stripe
> auth and other flows unaffected.

- Setup path when ready: Supabase Project Settings → Custom Domains → add `auth.dockwalker.io` → CNAME at Namecheap → wait for SSL → update Google OAuth client's redirect URI to use the custom domain → update Auth URL Configuration in Supabase.

### Vercel staging branch

> Skipped today; collapse-to-one-project setup is correct for solo
> pre-launch dev. Add when starting heavy feature work or when needed
> as a stable preview URL for Stripe test webhooks.

- Setup path: `git checkout -b staging && git push -u origin staging` → optional: attach `staging.dockwalker.io` as custom subdomain assigned to staging branch → split currently-Production+Preview env vars into Production-only (live) + Preview-only (test) entries (especially `STRIPE_*` keys to avoid feature branches hitting live mode).

### Apex → www 301 redirect

> Vercel currently 307s `dockwalker.io` → `www.dockwalker.io`.
> Bit us on Stripe webhook delivery (twice — both occasions documented in
> `tasks/lessons.md`). Browsers don't cache 307; making it 301 saves a
> round-trip on cold visits and avoids the same landmine if any future
> service pings the apex.

### WhatsApp via Meta Cloud API

> Telegram already covers crew/employer notification needs. WhatsApp
> migration is a v2 feature, not launch-blocking.

- Get dedicated number (prepaid SIM or Google Voice for Workspace)
- Register with Meta Cloud API directly (not Twilio — see lessons file for why)
- Swap Twilio dispatcher for Meta Graph API calls
- Submit templates for Meta approval

### Sensitive flag rotation on remaining "Needs Attention" vars

> Vercel flagged several env vars (Anthropic, OpenAI, Upstash, Supabase
> service role) as "should be Sensitive but isn't." Fix requires rotating
> the secret at the source, then re-adding to Vercel marked Sensitive
> (since Sensitive values can't be edited — only set on creation).

> Low priority pre-launch (solo developer). Do when adding team members.

---

## Backlog

> Active backlog. Pick items into Queue when ready.

### Deferred post-launch

- **Voice calling — replace Twilio + browser QA before unmute.** Phone button in chat header is gated behind a "Coming soon" toast (Fix 222d); `IncomingCallListener` unmounted from the app layout. `use-voice-call.ts`, `voice-call-context.tsx`, `call-bar.tsx`, `incoming-call-listener.tsx`, `turn-credentials` route, `call-ended` route all retained as dead code. When unmuting: (1) decide on managed RTC provider — LiveKit Cloud is the preferred replacement over Twilio TURN+Supabase-Realtime-signaling (SFU routing, call history, recording capability); (2) swap the hand-rolled `RTCPeerConnection` stack in `use-voice-call.ts` for the provider's SDK; (3) restore phone button's real `onClick` wiring to `voiceCall.startCall` + gate on `isPermanent && status === 'active'`; (4) re-mount `IncomingCallListener` in `(app)/layout.tsx`; (5) run browser QA matrix (Chrome/Firefox/Safari × desktop+mobile, glare resolution, network drops, backgrounded tab, multi-tab, offline user). Audit-trail gap: currently only `MESSAGE.SENT` records a call; add `CALL.STARTED`/`CALL.ENDED` events in the ledger at the same time.

### Business logic / server-side

- **Permanent crew withdrawal auto-revert** — employer should decide next step, not auto-revert.
- **Onboarding true atomicity** — `onboard_person` RPC should be fully atomic.
- **Negotiation timeout** — auto-close permanent engagements after X days inactivity.
- **Weekly check-in cron** — periodic nudge for permanent postings with no employer activity.
- **Deactivated user server-side sign-out** — force session invalidation on PERSON.DEACTIVATED.
- **CSRF origin validation** — add origin check middleware for POST/PATCH/DELETE routes (defense-in-depth, mitigated by SameSite cookies).
- **Stripe support runbook** — document refund-vs-cancel separation. Refund alone leaves subscription active until period end (correct Stripe design); for immediate revocation, refund + explicitly cancel subscription.

### Web-only UI

- **Agent market as discover mode** — let agents browse full market feed.
- **Form validation — styled inline errors** — replace browser-native validation (SUG-012). (Partially addressed by P1-A inline validation.)
- **Invalid URL error pages** — custom error pages for garbage URLs (SUG-013).
- **Edit experience "Unknown vessel" prefix** — seed data issue (SUG-017).
- **Applicant count badge on My Jobs**.
- **Discover filter chips**.
- **Notifications grouping**.
- **Email: List-Unsubscribe header**.
- **Share button on discover cards (crew view)** — secondary placement.
- **Admin identity type change** — deferred, medium-high effort, admin-only.
- **Chat page server-rendering** — stream context/messages server-side instead of client-side spinners.
- **Scroll position restoration** — restore scroll on back navigation from detail views.
- **Chat textarea send-then-snap-back** — when textarea grows multi-line then shrinks on send, layout shifts visibly. iOS-keyboard-specific; needs visualViewport API or careful keyboard-state detection. Cosmetic, not blocking.
- **Stripe success URL Apple Pay timeout** — observed during live testing: completing checkout via Apple Pay sometimes shows "session timed out" before redirect. Stripe-side issue or our success URL handler; investigate when seen by real users.
- **Notification handler `roleContext` mismatch** — handlers like `handleDayworkApplied` hardcode `roleContext: 'employer'` even when recipient is an agent. Fix 228 patched the count endpoint to ignore the filter for agents; proper fix is to set `roleContext` per recipient identity at handler dispatch time.

### Testing

- **Resilience tests** — network failure, timeout, retry scenarios.
- **Component tests for Permanent UI**.
- **Component tests for Form Pickers**.
