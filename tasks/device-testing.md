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
- [ ] **Pull-to-refresh after deploy** — Safari on iOS aggressively caches; if a screen looks unchanged from a recent deploy, drag down once to force a refresh.
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
- [ ] **Approve — full enrichment dialog**: click Approve → modal opens with editable fields **name**, **vessel_type**, **LOA** (auto-derives size band on change), **flag_state_id** (FlagStatePicker, searchable), **year_built**, **builder**, **gross_tonnage**, **beam_meters**, **nda_flag** toggle. The user submits a minimum payload (IMO + name + type + LOA); admin fills the rest from external sources before promotion.
- [ ] Submit Approve → row promotes to canonical with all enriched fields persisted; pending `vessel_names` + `vessel_flag_states` rows promote in the same call. The pending row disappears from the queue.
- [ ] LOA change in the Approve dialog re-derives `size_band_id` automatically — no manual band selection
- [ ] Required-field validation: clearing name / vessel_type / LOA blocks submit
- [ ] **Hide**: click → confirm → row disappears from pending; spot-check that the submitter still sees the vessel on their experience entry, but a different account searching the same IMO via `/api/vessels/lookup` returns "Not found"
- [ ] **Merge**:
  - [ ] Click → sub-dialog opens IMO search
  - [ ] Type a canonical IMO → matching vessels appear → select one
  - [ ] Confirm → submitter's experience entry re-points to the canonical vessel; pending vessel deleted
  - [ ] Try to merge into a pending target → blocked
  - [ ] Try to merge into self → blocked

### Admin Edit (mistake recovery, curated vessels)

If the admin typo'd during Approve, the canonical row is now editable in-place via PATCH `/api/admin/vessels/[id]`. No SQL needed.

- [ ] Login as admin → /admin/canonical → Vessels tab → each row has an **Edit** button alongside Hide
- [ ] Tap Edit → dialog mirrors the Approve enrichment form (same fields + validation)
- [ ] Edit the vessel name → save → `vessels.name` updates AND the open-ended `vessel_names` row updates in lockstep (timeline-table denormalisation stays consistent)
- [ ] Edit LOA → `size_band_id` re-derived automatically
- [ ] Edit flag state → updates the `flag_state_id` column directly (no `vessel_flag_states` timeline rewrite — those events are deferred per "they sit in the db but not projected for now")
- [ ] **Refuses pending vessels** 🔧 F12 — On `/admin/canonical` Vessels tab, find a row whose source is `pending` (the UI may show a Pending badge or hide the Edit button — if hidden, fire from Console). Tap **Edit** → modify any field → **Save**. DevTools → **Network** → click the PATCH `/api/admin/vessels/<vessel-id>` request:
  - Status: `409 Conflict`
  - Response body: `{"error":"Pending vessels must go through the pending-vessels Approve action — use that route instead."}`
  - If Edit is hidden in the UI, paste in **Console** instead:
    ```js
    fetch('/api/admin/vessels/<vessel-id>', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Should Reject' }),
    }).then((r) => r.json().then((b) => console.log(r.status, b)));
    ```
- [ ] **Diff-only update** 🔧 F12 — Tap Edit on a curated vessel → modify ONLY ONE field (e.g., change `year_built` from 2018 to 2019) → **Save**. DevTools → **Network** → click the PATCH `/api/admin/vessels/<vessel-id>` request → **Payload** tab:
  - Body should contain ONLY `{"year_built": 2019}` — nothing else.
  - Untouched fields (name, vessel_type, loa_meters, flag_state_id, builder, gross_tonnage, beam_meters, nda_flag) must NOT appear in the payload.
  - Status: `200`. Response: `{"ok": true}`.

### Admin midway-cancellation paths (queue manipulation while users are mid-flight)

- [ ] **Admin Hides a pending vessel that already has an active reference attached to it via the experience**: the requester's experience FK still resolves (they own it), but other users searching the same IMO via /api/vessels/lookup get "Not found". The reference itself stays Accepted (the lookup-route filter is upstream of the references projection). Confirm by viewing the requester's profile from another non-engaged account → reference card still renders with snapshot fields (snapshot survives via FK ON DELETE SET NULL).
- [ ] **Admin Approves a pending vessel during a pending reference invitation**: the reference's snapshot fields were captured at REFERENCE.REQUESTED time and don't change. The vessel just goes from `source='pending'` to `'curated'`. The referee's `/ref/[token]` link continues to work; on accept, snapshot fields render unchanged.
- [ ] **Admin Merges a pending vessel during a pending reference invitation**: the user's experience FK re-points to the merge target. Reference's `vessel_id` points to the OLD pending row which then gets deleted → reference's `vessel_id` becomes NULL via ON DELETE SET NULL, snapshot fields preserved. Confirm reference is still readable on both party views.

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

### 🔧 F12 helper — server-side lock verification

Several tests below verify that **server-side** locks fire even if the UI is bypassed. The UI greys out locked inputs, so you can't trigger these by tapping. Use DevTools → **Console** tab and paste a `fetch` call. The browser session cookie authenticates you automatically.

**Boilerplate** (substitute the marked bits per test):

```js
fetch('<URL>', {
  method: '<METHOD>',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(<BODY>),
}).then(r => r.json().then(b => console.log(r.status, b)));
```

You'll see something like `409 { error: "...", locked_fields: [...], active_references: N }` printed in the Console.

**Where to find IDs:**

- `<experience-id>` — open `/profile/edit-experience/<id>` and copy the trailing UUID from the URL bar.
- `<vessel-id>` (admin-only) — open `/admin/canonical` Vessels tab → DevTools → Network → reload the page → click the `vessels` GET request → Response tab → find the row's `id` field.
- `<reference-id>` — `/settings/references` → Network tab → look in the `/api/references/mine` response body.

**Network-tab tests** (status code + payload inspection) — open DevTools → **Network** tab → filter by `Fetch/XHR` → tap the action in the UI → click the resulting request to see status and request/response body.

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

### Currently-onboard references — happy path (00129)

> 00129 dropped B-2: first-vessel crew can now request references from the captain they're working under right now (the most valuable referee they will ever have).

- [ ] Crew has a `is_current = true` experience (Currently onboard). On the expanded card, the **Add reference** CTA appears (no longer blocked).
- [ ] Tap Add Reference → dialog opens, fill in referee → submit → POST succeeds (no 400)
- [ ] Settings → References → Pending: row shows the experience with date range "Jan 2024 – **Present**" (snapshot_end_date is null while still onboard)
- [ ] Referee accepts → row promotes to Accepted on both sides; on the employer-view of the requester's profile, dates render "Jan 2024 – Present"

### Currently-onboard references — midway cancellation paths

- [ ] **Requester revokes while pending**: send a current-experience invitation → before the referee accepts, requester taps Cancel from Settings → References → Pending → confirm → row moves to History as "Crew member revoked"; the referee's `/ref/[token]` link now says "No longer available"
- [ ] **Referee declines mid-flight**: send a current-experience invitation → referee taps Decline on `/ref/[token]` → confirm dialog ("We won't tell {requester} that you declined") → silent for the requester (no notification), row moves to History as "Declined"
- [ ] **Auto-supersede on resend**: send to `captainA@x.com` for a current experience → without revoking, send to the same `captainA@x.com` for the same experience again → fresh link returned; previous pending row in History as "Crew member revoked", only one Pending row remains (count stays 1/N)
- [ ] **Referee revokes after accept**: referee accepts → on referee account, Settings → References → "References you've given" → Revoke consent → confirm → row gone from requester's profile, History entry on both sides reads "Referee revoked"
- [ ] **Pending invitation expiry (30 days)**: an invitation older than `pending_expires_at` should not be acceptable. If you have a way to fast-forward (DB tweak), confirm `/ref/[token]` reads "expired" and the requester's row moves to History as "Expired"

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
- [ ] **Self-contact guard** (edge case) 🔧 F12 — A dual-hat user who is BOTH the employer side AND the referee on a reference should not be able to contact themselves. Set up: a reference where you are the accepted referee, switch to your employer hat. Get the reference id from `/settings/references` Network → `/api/references/mine` response (`inbound_accepted[].id`). Console → paste:
  ```js
  fetch('/api/references/<paste-reference-id>/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'self-contact attempt' }),
  }).then((r) => r.json().then((b) => console.log(r.status, b)));
  ```
  Expected: `409 { error: "You're the referee on this reference — you can't contact yourself" }`.

### Email-mismatch path on /ref/[token]

- [ ] Send an invitation with `claimed_referee_email = a@example.com`
- [ ] Open the share link while signed in as a _different_ email account → consent page shows amber "This invitation was sent to a different email" warning with a masked hint (`a***a@example.com`)
- [ ] Sign out + sign in with the matching email → consent page accepts the user, Accept/Decline buttons render

### Vessel-state gating (post-00128/00129/00130)

> Of the original 3 write-time gates, only **hidden_at** remains. NDA dropped in 00130 (referee was the captain — they already know the IMO; mask moved to the chat-header display layer). Pending dropped in 00128 (admin queue can take days to drain; first-vessel crew shouldn't have to wait).

- [ ] Add Reference on a **hidden** vessel → 400 "vessel is unavailable for references" (admin Hide on /admin/canonical Vessels tab is the easiest setup)
- [ ] Add Reference on a **NDA vessel** → succeeds (00130). The mask happens at chat-header time, not write time.
- [ ] Add Reference on a **pending (admin-queue) vessel** → succeeds (00128). The vessel doesn't have to be admin-approved first.
- [ ] Add Reference on a **non-existent vessel_id** → projection raises "vessel … not found" (route layer should catch this earlier with 404; defence-in-depth check)

### Closing-transition warning — happy path (00129)

When a user has active references on a currently-onboard experience and is about to close it (set an end_date / clear is_current), a one-time confirmation dialog must fire because end_date is permanently locked afterwards while refs are attached. Snapshot end_date on the references row also auto-propagates to the new value so referee-verified records stop saying "Jan 2024 – Present" forever after the user leaves.

Setup: a currently-onboard experience with at least one Accepted reference (run "Currently-onboard references — happy path" first).

- [ ] Profile → Edit experience on the currently-onboard one with active refs
- [ ] Note: vessel/role/start_date are greyed/disabled with the snapshot-locked banner; end_date input + "Currently onboard" checkbox remain editable (this is the one-time closing transition)
- [ ] Uncheck "Currently onboard" → end_date input becomes active → pick a date in the past → tap **Save**
- [ ] Confirmation dialog fires: "**Lock end date?** You're closing a currently-onboard experience that has N active reference(s). This is a one-time change — once saved, the end date can't be edited again while references are attached, and your referee's record will update to show the closed period."
- [ ] Tap **Confirm and save** → form saves, navigates to /profile, experience now shows "Jan 2024 – Apr 2025"
- [ ] Open Settings → References (referee account) → "References you've given" → date range now reads "Jan 2024 – Apr 2025" (NOT "Jan 2024 – Present"). Auto-propagation worked.
- [ ] Open the requester's public profile from another account → reference card on the experience also shows the closed range
- [ ] Try editing the same experience again → end_date input is disabled (greyed), Currently-onboard checkbox disabled. ✅ UI-side check passes.
- [ ] **Server-side end_date lock** 🔧 F12 — UI greys out the input; verify the server still rejects. Open `/profile/edit-experience/<id>` to copy `<id>` from the URL, then DevTools → **Console** → paste:
  ```js
  fetch('/api/experiences/<paste-experience-id>', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endDate: '2025-06-30' }),
  }).then((r) => r.json().then((b) => console.log(r.status, b)));
  ```
  Expected: `409 { error: "Revoke active references...", locked_fields: ["end_date"], active_references: <N> }`.

### Closing-transition — midway cancellation paths

- [ ] **Cancel the warning dialog**: trigger the closing-transition save → on the dialog, tap **Cancel** → dialog closes, form remains in edit mode, no save happened, end_date input still shows the date you typed (not committed yet). Navigate away → discarded.
- [ ] **Cancel by navigating away**: trigger the dialog → tap iOS back gesture or close the modal entirely → no save, no warning lingers
- [ ] **Edit without closing-transition**: edit description / salary / sea-time on a currently-onboard-with-refs experience without touching end_date or is_current → no warning dialog, normal save
- [ ] **Edit a non-current experience with refs**: pick an already-completed experience that has active refs → end_date is unconditionally locked (greyed), no closing-transition dialog ever fires for these
- [ ] **Try to "re-open" a closed experience** 🔧 F12 — UI disables the field; verify the server still rejects. DevTools → **Console** → fire two requests against the same experience and confirm both 409:

  ```js
  // Attempt to clear end_date
  fetch('/api/experiences/<paste-experience-id>', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endDate: null }),
  }).then((r) => r.json().then((b) => console.log('clear end_date →', r.status, b)));

  // Attempt to re-tick Currently-onboard
  fetch('/api/experiences/<paste-experience-id>', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isCurrent: true }),
  }).then((r) => r.json().then((b) => console.log('re-tick is_current →', r.status, b)));
  ```

  Both expected: `409 { error: "Revoke active references...", locked_fields: ["end_date"] }` / `["is_current"]` respectively.

### Edit-experience field locks (00126/00129)

A defence-in-depth check that complements the closing-transition tests above.

- [ ] Active references on a _completed_ experience → vessel, role, start_date, end_date all greyed/disabled with snapshot-locked banner
- [ ] **Server-side role_id lock** 🔧 F12 — Get a _different_ role UUID first (DevTools → Network → reload `/profile` → click the `/api/onboarding-data` or `/api/profile` request → find any role from the `roles` array that's NOT the current one). Console → paste:
  ```js
  fetch('/api/experiences/<paste-experience-id>', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleId: '<paste-other-role-uuid>' }),
  }).then((r) => r.json().then((b) => console.log(r.status, b)));
  ```
  Expected: `409 { error: "Revoke active references...", locked_fields: ["role"], active_references: <N> }`.
- [ ] **Server-side start_date lock** 🔧 F12 — Console → paste:
  ```js
  fetch('/api/experiences/<paste-experience-id>', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: '2020-01-01' }),
  }).then((r) => r.json().then((b) => console.log(r.status, b)));
  ```
  Expected: `409 { error: "Revoke active references...", locked_fields: ["start_date"], active_references: <N> }`.
- [ ] Active references on a _currently-onboard_ experience → vessel, role, start_date locked; end_date + is_current editable (closing transition allowed exactly once)
- [ ] No active references on any experience → all fields editable as before
- [ ] After revoking the only active reference, the lock should release → re-edit the experience → vessel/role/dates editable again

### NDA references — referee full reveal (00130)

> Referee was the captain/HOD on the vessel — they obviously already know the IMO. The whole point of asking them is to verify the period of service, which means they need to see what they're being asked to vouch for. Mask moves to the chat-header display layer.

- [ ] Crew owns an NDA vessel and has an experience on it → Add Reference on that experience → succeeds (was 400 pre-00130)
- [ ] Settings → References (requester side) → pending row shows full vessel name + IMO (they own it, no mask in their own view)
- [ ] Send the link to the referee out-of-band (WhatsApp/email) → referee opens `/ref/[token]` → consent page shows full vessel name + IMO + date range
- [ ] Referee accepts → row promotes to Accepted; both party views (requester + referee) show full snapshot

### NDA references — referee declines / revokes mid-flight

- [ ] **Referee declines NDA invitation**: send an NDA reference invite → referee opens `/ref/[token]` → Decline → silent for the requester, History row reads "Declined"
- [ ] **Referee revokes NDA accepted reference**: NDA reference accepted → referee Settings → References → "References you've given" → Revoke consent → row gone from requester's profile + chat-header, History on both sides reads "Referee revoked"
- [ ] **Requester revokes mid-pending**: send an NDA invite → before referee accepts, requester taps Cancel from Settings → References → Pending → confirm; referee's `/ref/[token]` link reads "No longer available"

### NDA references — employer chat-header mask (00130)

This is where the NDA actually protects the vessel identity from outside parties. The flow requires (a) an NDA-vessel reference accepted and (b) an employer initiating contact via /references/[id]/contact, then both parties viewing the resulting chat header.

Setup: a crew with an Accepted NDA reference; an employer/agent test account that has cross-party context with the crew (engagement/application/invitation).

- [ ] Crew applies to a daywork or permanent posting from employer X → context is established
- [ ] Employer X opens crew's profile from the application → references list renders with referee name/role/comment (snapshot fields are not exposed by the profile API anyway, so no leak here pre-mask either)
- [ ] Employer X taps **Contact reference** on the NDA-vessel reference → ContactReferenceDialog opens (note: dialog never displays the vessel name) → submit → toast "Request sent"
- [ ] Referee receives a `REFERENCE.CONTACT_REQUESTED` in-app notification → tap → consent screen → Accept → 1:1 chat opens
- [ ] **Employer X views the chat header** (ReferenceContactHeader): vessel name renders as "**NDA Vessel**", IMO is empty, date range / requester role / referee role / comment all render normally
- [ ] **Referee views the same chat from their account**: vessel name + IMO render in **full** — the referee was aboard, no NDA against themselves
- [ ] **Trust-boundary unmask**: separately, employer X also has an _active_ engagement (daywork or permanent) with the same crew on the **same NDA vessel** (e.g., they previously hired this crew via a daywork on this boat) → re-open the reference-contact chat → vessel name + IMO now reveal in full to employer X (existing 00083 trust-boundary precedent — they already crossed the trust line). Confirm by ending that engagement (cancel/complete) → mask should reapply on the next chat header refresh.

### NDA contact-reference — midway cancellation paths

- [ ] **Referee declines the contact request**: employer X sends contact request on NDA reference → referee taps Decline on the consent prompt → silent for employer (no notification); employer's `/messages` does NOT open a chat with the referee; their counter does NOT increment toward the 30-day cap (only accepted contacts count)
- [ ] **Either party closes the chat**: after Accept, either party taps Close conversation → fires `REFERENCE.CONTACT_THREAD_CLOSED` → `active_engagements.status='closed'` + `outcome='reference_complete'`. Chat header now shows ClosedBanner, footer disabled.
- [ ] **Underlying reference revoked while contact chat is open**: referee revokes the reference (Revoke consent on Settings → References) → chat header shows the Fix A "reference revoked" banner with the structured revoke reason; employer cannot re-contact (the cap row is preserved as audit history)
- [ ] **NDA flag toggled mid-flight**: admin un-NDAs the vessel (admin canonical edit, set NDA flag = false) → re-open the chat header → vessel name + IMO now reveal to employer (live nda_flag check). Re-NDA the vessel → mask reapplies on next refresh.

### Billing tier copy advertises reference outreach (employer)

> Both crew and employer billing tiers now advertise their reference allowances. Without this, the paywall fires with no prior context.

- [ ] Login as **crew** → /billing → Free card lists "1 reference per experience" + Crew Pro card lists "Up to 3 references per experience" (was already there)
- [ ] Login as **employer** → /billing → Free card lists "**Reach out to references — 5 contacts per 30 days (10 pending)**" + Pro card lists "**Unlimited reference outreach**" (NEW this session — was missing before)
- [ ] **Free 30-day cap hit mid-flight**: as Free employer, send 5 contact requests that get accepted in any rolling 30-day window → next attempt → 402 "Monthly contact-request budget reached" with **Upgrade to Employer Pro** button
- [ ] **Free outstanding-pending cap hit**: at 10 pending (no responses yet) → 402 "You have too many outstanding contact requests" with Upgrade button
- [ ] **Pro lifts both caps**: as Employer Pro, neither cap fires; counter copy in ContactReferenceDialog reads "Employer Pro · unlimited contact requests"
- [ ] **Self-contact guard** 🔧 F12 — Same setup as the §7 Contact-reference self-contact test above. Confirm the gate fires regardless of which surface initiates the request:
  ```js
  fetch('/api/references/<paste-reference-id>/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'self-contact attempt' }),
  }).then((r) => r.json().then((b) => console.log(r.status, b)));
  ```
  Expected: `409 { error: "You're the referee on this reference — you can't contact yourself" }`.

### Pending-vessel references (00128) — no separate test

> Already covered by "Vessel-state gating (post-00128/00129/00130)" above (third bullet). The pending-vessel happy path is just "create a vessel via /vessels Add (which lands as `source='pending'`), add an experience on it, request a reference — it works." No mid-flight cancellation specific to the pending state — the standard revoke / decline / supersede paths apply identically. If admin Hides the vessel mid-flight, the experience-level RPC filter takes over (covered in §6 "Lookup filter — pending/hidden visibility").

---

## 7b. CV Builder — fully locked (Stage 231)

> Per the 2026-04-29 product call, the entire CV Builder surface is hard-locked
> behind `CV_BUILDER_ENABLED = false` in `apps/web/src/lib/cv/feature-flag.ts`.
> Every user-facing entry point — settings, profile hot button, public
> `/cv/[handle]` page, hire-from-QR wizards, apply-after-invite — short-circuits
> to a Coming-Soon screen or 503 BEFORE auth/DB work runs. These device tests
> verify the lockdown holds.

### Lockdown verification (current state)

- [ ] `/settings/cv` — page renders Coming-Soon screen. Toggles render but tapping any one fires the Coming-Soon toast and does NOT call `/api/cv/settings`. Generate CV button greyed out + Coming-Soon toast on tap.
- [ ] **Profile hot button** — locked card appears on `/profile` (crew-hat + crew identity_type only). Tap fires Coming-Soon toast. Hidden for agent identity.
- [ ] `/cv/<any-handle>` — visit an admin-minted handle in any auth state (signed-out, signed-in crew, signed-in employer). Always renders the Coming-Soon screen (no profile data leaks, no fetch fires).
- [ ] `/cv/<not-a-real-handle>` — invalid handle still renders Coming-Soon (lockdown fires before validation).
- [ ] **Hire-from-QR routes** — `/daywork/post?invite=<personId>` and `/daywork/post?invite=<personId>&type=permanent` short-circuit to Coming-Soon screens (the regular `/daywork/post` without `?invite=` still works).
- [ ] **Apply-after-invite** — `/permanent/<id>/apply?from_invitation=<id>` strips the `from_invitation` query param so the regular apply UX still works for direct-navigation cases. No invitation context banner renders.
- [ ] **API direct hit** — `curl https://<deploy>/api/cv/<handle>` returns 503 with the Coming-Soon JSON payload. Same for POST `/api/cv/generate`, PATCH `/api/cv/settings`, POST `/api/permanent/<id>/invite`.

### Cron — invitation expiry (still active during lockdown)

- [ ] **Trigger the cron** — `curl -H "Authorization: Bearer <CRON_SECRET>" https://<deploy>/api/cron/invitation-expiry`. Response: `{ expired: <count> }`. Idempotent; no rows to expire while locked.

### Stage 2 unlock — re-enable these checks when CV_BUILDER_ENABLED flips to true

> Stage 1 prior surface tests (settings toggles persistence, QR-landing
> three render states, NDA mask, stale banner, tombstone, hire-from-QR
> daywork + permanent flows, apply-after-invite, ✉ Invited badge) live
> in git history at this section before commit `<this-commit-sha>`. Re-add
> from there at unlock time, then drop this section.

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
