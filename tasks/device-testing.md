# Device Testing Checklist

> Real-device verification of the **substantive feature work** shipped since the launch close-out (commit `636dc83`, 2026-04-09). The window is the last 22 commits up to `4411430`, but we only device-test the meaningful product shifts — six feature areas in total.
>
> **Why 22 commits is the right cut, not 30 or 50:** the launch close-out at `636dc83` is a natural waterline. Everything before it was already shipped to users; everything after is new work that hasn't been touched by a human on a phone yet. 50 commits would drag in pre-launch infra; 30 would split a coherent feature cluster (Locations V2 + Vessels V2 + multi-nationality phase 2) at an awkward seam.
>
> **Skipped — not user-visible (no device test needed):**
>
> - `95d1abc`, `3f14dc3` — CI infrastructure
> - `29ae8aa` — internal migration renumbering doc
> - `e892a62` — admin runbook + Python normalisation script
> - `9de90e0` — server-side defence-in-depth caps (verified by stress test)
> - `de8ee02` — pure code dedup, zero behavior change
> - `3540fa1` — small bug fix (profile-context PostgREST query refactor) verified by the original reporter; covered indirectly by section 2 below
>
> The remaining big-or-relevant changes — multi-nationality phase 2, permanent review-card enrichment, cert "extras" indicator, date/time picker upgrades, Locations V2 (4 waves), Vessels V2 (6 waves) — are grouped by feature area below.

## Pre-test setup

- [ ] Open the app on a real iPhone via Safari (or whichever device + browser is the user-facing target).
- [ ] **Pull-to-refresh after deploy** — the Capacitor-style webview caches page state, so tab navigation will not load the new bundle. If a screen looks unchanged from last time, drag down once.
- [ ] Have at least two test accounts handy:
  - **Crew** account with at least one experience entry on a curated vessel.
  - **Employer/agent** account with at least one active permanent posting that has applicants.
  - **Admin** account (dockwalker_only or whoever you've stamped as admin).

If you only have one device + one phone, you can swap accounts via Logout → Login between sections.

---

## 1. Multi-nationality (commit `c3c300e`)

Dual-passport holders should now see and be able to set multiple flags.

### Crew profile (own)

- [ ] Profile → edit → tap "Nationality" → multi-select picker opens with chips
- [ ] Add a second nationality, save → profile summary shows **both flag emojis** side-by-side (not just one)
- [ ] Remove one nationality → only the remaining flag renders
- [ ] Save with zero nationalities → no flag block appears at all (graceful empty state)

### Crew profile (viewing someone else's)

- [ ] As an employer/agent, open ProfileOverlay on a crew applicant who has multiple nationalities → all their flags render
- [ ] Spot-check: a crew with only the legacy `nationality_id` (single) still renders one flag — backwards compat check

### Permanent review card

- [ ] Open a permanent posting's review queue → applicant cards show **all** of each candidate's nationality flags inline (not just primary)

### Onboarding

- [ ] Sign up a fresh test account → reach the profile step → nationality picker accepts multi-select → finishes onboarding cleanly

---

## 2. Permanent applicant card enrichment (commit `355c203`)

The review card now shows five new signals so you can triage 100+ candidates without opening every overlay.

- [ ] Open a permanent posting's review queue. On each applicant card, verify visible at a glance:
  - [ ] **Total sea time** ("X yrs Y mos" or similar)
  - [ ] **Vessel-size exposure range** (e.g., "30–90m" or "90m+")
  - [ ] **Location** with 📍 emoji ("Port Name, City Name")
  - [ ] **Bio preview** — two-line truncated excerpt above the application message
  - [ ] **Cert-match indicator** — green "✓ All N required certs" OR orange "⚠ M/N certs · K missing"
- [ ] Tap a card to open the profile overlay → confirm the data on the card matches the data inside the overlay
- [ ] Edge case: applicant with no experience entries, no bio, no location → card still renders without breaking layout (graceful empty)

---

## 3. Cert "extras" third-state indicator (commit `65b2b7b`)

Third state on the applicant card for candidates with bonus certs beyond the spec.

- [ ] On a permanent posting where some applicants exceed required certs: card shows "**+ N additional**" in blue, inline with the existing match badge
- [ ] On a posting with **zero** required certs but applicants with certs: cards show "**+ N additional**" alone (no green/orange match badge)
- [ ] Open the candidate's profile overlay → all their certs (required + bundle + extras) listed; numbers should reconcile

---

## 4. Date + Time picker visual upgrades (commit `7bc5021`)

Every date input across the app now uses a calendar overlay; the checklist time field uses an iOS-style scroll wheel.

### Date picker

Try at least 3 of these screens — they all share the same `DateInput` component:

- [ ] **Daywork post** — start_date, end_date pickers
- [ ] **Permanent post** — anticipated start date
- [ ] **Profile → Experience** add/edit — start_date, end_date
- [ ] **Onboarding** — any date field
- [ ] **Discover filters** — start_date / end_date filter
- [ ] **Postponement overlay** — proposed new dates

For each:

- [ ] Tap the calendar icon → calendar popover overlays (NOT the native date picker spinner from before)
- [ ] Today is highlighted; selected day has a clear filled background
- [ ] Prev/next month buttons work
- [ ] Days outside the [min, max] range are visibly disabled (e.g., past dates on a "start_date" picker)
- [ ] Type a date directly into the dd/mm/yyyy text input — value commits when complete + valid (keyboard path still works)
- [ ] Picker collision-flips correctly near the bottom of the viewport (scroll the screen and re-tap the icon)

### Time picker

Only one callsite: pre-arrival checklist.

- [ ] Open an active engagement → checklist → "Add task" with a time → time picker shows two scroll columns (hours 0–23, minutes in 15-minute steps)
- [ ] Scroll-snap settles on the centerline; row in the highlight band is the committed value
- [ ] Momentum scroll doesn't fire intermediate values — only the final settled position emits an `HH:mm` change
- [ ] Saved value persists correctly (close + reopen the form to confirm)

---

## 5. Locations V2 — manual location request (commits `1763bef`, `213a64d`, `f81638a`, `f57dbf1`)

Three-layer fallback for "I can't find my location": canonical → OSM Nominatim → manual request → admin queue.

### Submitter flow (any user)

Find a screen with a `LocationPicker` — daywork post, permanent post, profile city, etc.

- [ ] Search for a real but obscure marina (e.g., "Vrsar" or "Sukošan") → canonical search returns nothing → OSM live results appear inline (mode `port-optional` only)
- [ ] Pick an OSM result → label shows immediately (no flash to "Loading"), value commits, page navigates correctly
- [ ] Search for something OSM also can't find (e.g., "Captain Bob's Private Dock") → "Add it manually" CTA appears below the search input
- [ ] Tap "Add it manually" → modal opens with country dropdown (populated from `/api/locations/regions`), city input, port input (required if mode is `port-required`), notes
- [ ] Submit → modal closes, picker shows the typed text immediately (no "Loading"), value commits to the form
- [ ] Save the form → reopen → location persists (your own pending FK still resolves)
- [ ] Open a different account on a different device → search for the same marina/city you just submitted → it does **NOT** appear (pending-row filter for non-submitter)

### Admin flow

- [ ] Login as admin → sidebar has "**Pending locations**" entry → page loads two tables (Cities, Ports)
- [ ] Each row shows parent chain (region → city), submitter name, recency
- [ ] **Approve** action: click → `prompt()` lets you fix typos (or accept default name) → row disappears from pending; spot-check from a non-submitter account that the location now appears in canonical search
- [ ] **Hide** action: click → confirm dialog → row disappears from pending; the submitter still sees it on their existing record but no one else does
- [ ] **Merge** action: click → sub-dialog opens a search picker → type the canonical match's name → select it → submitter's existing FK re-points to the canonical row, pending row deleted
- [ ] Try merge with the _same_ row as target → blocked with error
- [ ] Try merge into a pending target → blocked with error

### Admin notification

- [ ] After a non-admin submits a manual location → admin's notification bell shows "+1" → tap → notification reads "<submitter> added <name>[ (<port>)] in <country>" → tapping deep-links to `/admin/locations/pending`

---

## 6. Vessels V2 — manual vessel request (commits `bc2c578`, `9446d0b`, `46e9ce5`, `1acb76f`, `7f80b65`, `9e1db1a`, `4411430`)

Same shape as Locations V2 but for vessels. Schema v119 → v122. The IMO is the truth anchor; users can request a vessel that isn't in the canonical DB and the admin curates it.

### Crew submitter flow — manual add from `/profile/add-experience`

- [ ] Profile → "Add experience" → enter an IMO that isn't seeded (e.g., random 7-digit number)
- [ ] Lookup says "Not found" → "**Add it manually**" CTA appears below the IMO search box
- [ ] Tap → AddVesselDialog overlay opens with required fields (IMO, name, vessel_type, LOA) at top
- [ ] Tap "Add more details" → toggle reveals optional flag state, year built, builder, gross tonnage, beam meters
- [ ] Submit with required-only → dialog closes, the experience form pre-fills with the new (pending) vessel data so you can finish the experience entry without re-typing
- [ ] Save the experience → it persists on your profile

### Crew submitter flow — `/vessels` standalone manager

- [ ] Navigate to `/vessels` → "Add vessel" → manual entry on an unknown IMO works the same way → vessel appears in your vessel list

### All-creates-go-to-pending (canonical-curation rule)

Every user-submitted vessel — regardless of which form created it — should land as `source='pending'` until an admin approves it. Only seed-migration data and admin-approved rows are `'curated'`.

- [ ] Create a vessel from `/profile/add-experience` (manual-add path) → admin Pending Vessels queue lists it
- [ ] Create a vessel from `/vessels` standalone Add Vessel form → admin Pending Vessels queue also lists it (was the gap before this fix — these creates were silently landing as `curated` and bypassing review)
- [ ] Search the same IMO from a _different_ account via the IMO-lookup field → returns "Not found" until admin approves (the submitter's own FK still resolves on their own profile)
- [ ] After admin Approve → IMO lookup from any account now returns the vessel; row drops out of the pending queue

### Daywork & permanent post flows (indirect)

Per Wave D's note, post forms redirect to `/vessels` via the existing `saveFormAndCreateVessel` pattern.

- [ ] Daywork post → vessel field → search unknown IMO → button to "Create vessel" → routes to `/vessels` → manual add → return to daywork post → vessel attached
- [ ] Same for permanent post

### Admin curation queue

- [ ] Login as admin → sidebar has "**Pending vessels**" → page lists every pending vessel with M/Y or S/Y prefix, IMO, builder, full specs row (LOA / size band / flag / year built / GT), submitter name, recency
- [ ] **Approve**: click → `prompt()` lets you optionally fix the name → row promotes to canonical; pending vessel_names + vessel_flag_states rows promote in the same call
- [ ] **Approve with name override**: edit the name in the prompt, save → vessel + vessel_names row both update
- [ ] **Hide**: click → confirm → row disappears from pending; spot-check that the submitter still sees the vessel on their experience entry, but a different account searching the same IMO via `/api/vessels/lookup` returns "Not found"
- [ ] **Merge**:
  - [ ] Click → sub-dialog opens IMO search
  - [ ] Type a canonical IMO → matching vessels appear → select one
  - [ ] Confirm → submitter's experience entry re-points to the canonical vessel; pending vessel deleted
  - [ ] Try to merge into a pending target → blocked
  - [ ] Try to merge into self → blocked

### Admin notification on submission

- [ ] After a crew submits a manual vessel → admin's notification bell shows "+1" → notification body reads "<submitter> added <name> (IMO <imo>)" → tapping deep-links to `/admin/vessels/pending`

### Lookup filter — pending/hidden visibility

The integrity-critical piece of Wave F. Two crew can request the same IMO without colliding because the index is `(imo_number, owner_person_id)`, but the second submitter must **not** see the first's name/LOA/flag.

- [ ] Account A submits a manual vessel for an unseeded IMO → leaves it pending (don't ask admin to act yet)
- [ ] Switch to Account B (different person) → search the same IMO → result is "Not found" (NOT Account A's vessel)
- [ ] Switch back to Account A → same IMO search → returns Account A's vessel as expected
- [ ] Admin hides Account A's vessel → Account A still sees it on their experience entry, Account B still sees "Not found"

### Historical vessel name display (Fix 255)

This requires a vessel that has been renamed via admin action. To set up:

1. Submit a manual vessel under name "Sea Wolf", IMO X, complete an experience entry against it (start_date 2018, end_date 2019).
2. Admin approves the vessel.
3. Admin (or you, via a privileged route, or directly via DB) fires `VESSEL.RENAMED` to "Black Pearl" with `effective_from = 2020-01-01`.
4. Refresh.

- [ ] Profile → Experience cards: the 2018-2019 experience shows "**Sea Wolf**" (the period-correct name) — NOT "Black Pearl"
- [ ] Long-press / hover the vessel name → tooltip / title attribute reads "**Now M/Y Black Pearl**"
- [ ] Open ProfileOverlay on this profile from another account → same period-correct rendering with hover/title showing the current name
- [ ] If you have an agent profile: maritime background section shows the same rendering

> If you don't want to manually fire VESSEL.RENAMED, this case can be skipped — the helper has unit-test coverage. The on-device check is to confirm the field is populated and rendered when present (which the more critical "no rename happened" case below covers).

- [ ] Profile experience for a vessel that was **NOT** renamed → card shows the current name with NO tooltip (historical_vessel_name is null when current ≡ historical)

### RPC-filter spillover (Fix 254, same commit as historical-name)

The `get_vessel_public` RPC now filters pending + hidden vessels for non-owner non-engaged callers across five callsites — daywork discover, daywork applications, daywork invitations, permanent applications, permanent discover.

- [ ] Daywork discover loads cleanly with no missing-vessel crashes (non-owner viewpoint)
- [ ] Permanent review tab — applicant cards render with vessel info pulled from each crew's experiences; no missing-data crashes
- [ ] Engagement-reveal exception: if you have an active engagement on a vessel that admin then hides, your chat summary / engagement card still shows the vessel name (the operational case admin moderation must not break)

---

## 7. Consent-based references (commits `b2d6d50` → `030600c`)

End-to-end peer references with snapshot lock + employer contact flow. The bulk of the happy path was verified live (send → accept → render on profile, snapshot edit-lock, public profile rendering); below covers what hasn't been on a device yet.

### Already verified live (skip)

- [x] Crew sends a reference invitation → row appears as Pending in Settings → References → 1/3 (or 1/1 on Free)
- [x] Share link from WhatsApp → consent page renders correctly (vessel, dates, both roles, comment field)
- [x] Referee accepts with comment → row promotes to Accepted, requester sees it on Settings → References + on the public/employer-view of their profile
- [x] Edit-experience locks role + dates + currently-onboard inputs (greyed out) when an active reference exists; saves still go through for non-locked fields (description, salary, sea time)
- [x] Notification deep-links: `REFERENCE.REQUESTED` → `/ref/[token]`, `REFERENCE.ACCEPTED` → `/settings/references`

### Auto-supersede (resend-with-edits)

- [ ] Send a reference to `captain@example.com` for an experience → confirm pending in Settings → References
- [ ] Without revoking, open Add Reference on the same experience again with the **same** email → confirm route returns a fresh share link
- [ ] Settings → References: previous pending should be in **History → "Crew member revoked"**, the new one should be the only **Pending** entry (count stays 1/N, no orphan rows)
- [ ] Repeat with **same name + no email**: the supersede should match by normalized name; same single-pending result

### Per-experience cap

- [ ] On Free plan, send a reference → try to send a second to a _different_ referee on the same experience → 402 with **"upgrade to Crew Pro"** copy and an **Upgrade** button linking to `/billing`
- [ ] Upgrade to Crew Pro (or stamp the test account directly) → cap should now be 3 — third send to a third referee succeeds; fourth is blocked with **"Per-experience cap of 3 reached"**
- [ ] Cap pre-check excludes the soon-to-be-superseded row: at-cap user can still resend to one of their existing referees

### B-2 — current-experience block

- [ ] Mark an experience `is_current = true` (Currently onboard) → Add reference button on the expanded card should not appear (blocked by B-2)
- [ ] If you somehow reach the dialog, server returns 400 — "Mark this experience as completed before adding a reference"

### Decline path

- [ ] Generate an invitation; on the referee's account tap **Decline** → confirm dialog says "We won't tell {requester} that you declined"
- [ ] Confirm → toast says "Invitation declined", referee returns to Messages
- [ ] Requester's Settings → References: invitation moves from **Pending Invitations** to **History → "Declined"** (no notification fires to requester per Phase 2 spec)

### Resend (manual, from Settings → References)

- [ ] Pending invitation card shows **Copy link**, **Resend**, **Cancel** buttons
- [ ] Tap **Resend** → confirm dialog → fresh link generated, old token stops working (visit it → "No longer available — declined/revoked")
- [ ] Tap **Cancel** on a pending invitation → confirm dialog → row moves to History as "Crew member revoked"

### Edit comment as referee

- [ ] On the referee account, Settings → References → "References you've given" → tap **Edit comment** on an accepted reference
- [ ] Type a new comment, tap Save → confirm dialog explains it's publicly visible → confirm → toast "Comment updated"
- [ ] Reload the requester's public profile → updated comment shows on the experience card
- [ ] Try a comment over 500 chars → server rejects with 400

### Edit-notify + audit badge (anti silent-flip)

- [ ] After a referee edits an accepted comment, the **requester** receives an in-app notification: "Reference comment updated — Your referee updated their comment on the {vessel} reference. Tap to review." → tapping deep-links to `/settings/references`
- [ ] If the referee _clears_ the comment (saves blank), notification body reads "...removed their comment..."
- [ ] On the requester's public profile (own preview AND from another account viewing them) → the comment block on the experience card shows "**Edited Xm ago**" / "**Xh ago**" / "**Xd ago**" / absolute date if older than 30 days, with a tooltip showing the full timestamp
- [ ] On the requester's `/settings/references` "Pending invitations / Accepted references" list → same "Edited X ago" badge appears under the comment
- [ ] On the _first_ save during accept (referee accepts WITH a comment in the same submission), no "Edited" badge shows — the badge only appears after a _subsequent_ edit to an already-accepted reference

### Revoke by referee

- [ ] On the referee account, Settings → References → "References you've given" → tap **Revoke consent**
- [ ] Confirm dialog: "The crew member will lose this reference and your comment from their profile" → confirm
- [ ] Reload the requester's public profile → reference is gone from the experience card and `references_active_count` drops
- [ ] Settings → References (referee side): row gone from accepted list; (requester side): row in History as "Referee revoked"

### Auto-revoke on experience removal (Fix A)

- [ ] Crew has an experience with an accepted reference → delete that experience from /profile
- [ ] Confirm: experience disappears, reference auto-revokes
- [ ] Referee receives a `reference_auto_revoked` in-app notification: "<Requester> removed the experience this reference was tied to. Your reference for <vessel> has been withdrawn." → tapping deep-links to `/settings/references`
- [ ] Both Settings → References pages show the row in History with revoke reason "Crew member removed this experience"

### Contact-reference flow (employer side)

Requires an employer/agent account that has _context_ with the crew (engagement, application, or invitation). Easiest setup: the employer test account posts a daywork; the crew with the reference applies.

- [ ] Employer opens the crew's profile from the application → references render on each experience card with the referee's name/role/comment
- [ ] Tap **Contact reference** → dialog with optional question (≤200 chars) + consent stakes copy
- [ ] Submit → toast "Request sent" → counter "X left this month" updates
- [ ] **Free cap**: at 10 outstanding pending → 402 with `pending_budget` gate + Upgrade button. At 5 accepted in any rolling 30-day window → 402 with `monthly_budget` gate + Upgrade button. Pro = unlimited.
- [ ] Referee receives `REFERENCE.CONTACT_REQUESTED` in-app notification → tap → consent screen with the question (if provided) and Accept/Decline
- [ ] Accept → opens a 1:1 conversation with the question pre-populated as the first message (P1-D); Decline → silent on employer side, no notification fires
- [ ] **Self-contact guard** (edge case): if a dual-hat user is _both_ an employer and the referee on a reference, they should NOT be able to "contact themselves" — server returns 409 "You're the referee on this reference — you can't contact yourself"

### Email-mismatch path on /ref/[token]

- [ ] Send an invitation with `claimed_referee_email = a@example.com`
- [ ] Open the share link while signed in as a _different_ email account → consent page shows amber "This invitation was sent to a different email" warning with a masked hint (`a***a@example.com`)
- [ ] Sign out + sign in with the matching email → consent page accepts the user, Accept/Decline buttons render

### Vessel-state gating

- [ ] Try Add Reference on an experience attached to an **NDA vessel** → 400 "references on NDA vessels are not supported"
- [ ] Try Add Reference on an experience attached to a **pending (not curated)** vessel → 400 "references require a curated vessel"
- [ ] Try Add Reference on a **hidden** vessel → 400 "vessel is hidden"

---

## 8. Regression spot-checks

These weren't directly modified but share infrastructure with what was — quick re-confirm.

- [ ] **Apply to a daywork** end-to-end → apply → accept → message → mark complete → rate (no breakage from any of the 22 commits)
- [ ] **Apply to a permanent posting** end-to-end → apply → shortlist → select → confirm placement (cert hard-gate still rejects unqualified applications)
- [ ] **Availability** set/clear cycle → daywork discover refreshes correctly when availability is set
- [ ] **NDA reveal** — a crew on an active daywork engagement still sees the IMO on the chat summary card and engagement detail (Wave F filter shouldn't break this)
- [ ] **Profile photo** upload → crops → renders on profile, applicant cards, chat → not affected by lazy-load split
- [ ] **Push notifications** — tap one → deep-links to the right screen
- [ ] **Sign in / sign out** — works without errors

---

## 9. Known device-test quirks (from `memory/`)

Read these before reporting bugs — some of what looks broken is a known caching or layering issue:

- **Capacitor webview caching**: Code changes won't appear after deploy until you pull-down refresh. Tab navigation alone doesn't reload.
- **Modal z-index**: All overlays should be `z-[60]+`; bottom nav is `z-50`. If a modal renders behind the nav bar, it's a z-index regression — file as a bug.
- **Remote control reliability**: Permission prompts sometimes don't render; if a prompt seems to drop, try the action again before assuming denial.

---

## When you're done

- Tick the boxes you verified.
- Anything failing → file in `tasks/error-logs.md` with screenshot + steps.
- Anything passing but feels rough/slow/clunky UX-wise → file in `tasks/playwright-suggestions.md` for planning-agent triage.
