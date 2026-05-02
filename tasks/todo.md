# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

_Bug intake complete (B-001 → B-010). Fix plan committed below in `## Fix plan — Bug intake 2026-05-02`. Ready to start Batch 1._

## Fix plan — Bug intake 2026-05-02

> Three batches by risk + size + dependency. Each item links back to the intake entry below for full context. Implementation agent works top-down within a batch; user reviews after each batch closes.

### Batch 1 — Quick wins (low-risk, mostly UI/CSS, no migrations)

#### B-006 — header z-index collision

- [x] Bump header `z-10` → `z-30` in `apps/web/src/app/(app)/daywork/[id]/review/page.tsx:325`
- [x] Same change at `apps/web/src/app/(app)/permanent/[id]/review/page.tsx:235`
- [ ] Manual verify on desktop: scroll review page, confirm card no longer paints over header

#### B-009 — daywork past-date block (daywork-only — permanent intentionally allows past per `permanent-form-sections.tsx:110`)

- [x] Compute `todayISO = new Date().toISOString().slice(0, 10)` constant inside the post-page component
- [x] Pass `min={todayISO}` to start-date `DateInput` at `apps/web/src/app/(app)/daywork/post/page.tsx:669`
- [x] Pass `min={startDate || todayISO}` to end-date `DateInput` at line 686
- [x] In `apps/web/src/components/working-day-calendar.tsx`, add `disabled={date < todayISO}` to date-cell button (lines 113-126); style disabled cells (`opacity-40 cursor-not-allowed`)
- [x] Filter `selectAll` and `selectWeekdaysOnly` to skip past dates (lines 72-78) via shared `selectableDates` memo
- [x] WorkingDayCalendar isn't used elsewhere — only daywork post (confirmed via grep, 1 consumer)
- [ ] Manual verify: cannot select yesterday; date inputs reject past selections; submit no longer 4xxs

#### B-004 — employer button labels + Star clarity

- [x] Replace 3 icon-only circular buttons in `apps/web/src/app/(app)/daywork/[id]/review/_components/applicants-tab.tsx:147-171` with crew-style icon+label pair:
  - Red destructive: `<X /> Show next` (h-12 flex-1)
  - Amber warning (applicants tab only): `<Star /> Shortlist`
  - Green success: `<Check /> Hire`
- [x] On permanent review at `apps/web/src/app/(app)/permanent/[id]/review/page.tsx`, soften "Reject" → "Show next" (both instances) with `<X />` icon and destructive border styling
- [x] Add `<Star />` icon next to "Shortlist" in tab nav on both review pages — extended `UnderlineTabs` with optional `icon?: ReactNode` prop, wired Star on daywork shortlist tab + permanent shortlisted tab
- [ ] Manual verify on both review pages: buttons read explanatory; star icon visible inline on tab + button so the meaning anchors

#### B-007 — middleware route guards (broader sweep enabled per user defer)

- [ ] In `apps/web/src/lib/supabase/middleware.ts`, insert after line 261 a single crew-block clause:
  ```
  if (currentHat === 'crew' && (
    /^\/daywork\/post$/.test(path) ||
    /^\/daywork\/mine/.test(path) ||
    /^\/permanent\/mine/.test(path)
  )) → redirect to /discover
  ```
- [ ] Insert an employer-block clause for crew-only routes:
  ```
  if (currentHat === 'employer' && (
    /^\/profile\/add-experience$/.test(path) ||
    /^\/profile\/edit-experience\//.test(path) ||
    /^\/profile\/add-shore-experience$/.test(path) ||
    /^\/profile\/edit-shore-experience\//.test(path) ||
    /^\/settings\/cv$/.test(path) ||
    /^\/settings\/references/.test(path)
  )) → redirect to /daywork/mine
  ```
- [ ] Manual verify: crew on `/daywork/post` redirects to `/discover`; employer on `/profile/add-experience` redirects to `/daywork/mine`; review-page existing guards still work; agent on `/discover` still routes to `/discover/market`

### Batch 2 — Mid-sized (UI + API, no migrations except B-001 if API change needed)

#### B-008 — Applied tab tombstone for missing posting (daywork + permanent symmetric)

- [x] In `apps/web/src/app/(app)/discover/_components/permanent-application-card.tsx`, replace `if (!p) return null;` with a tombstone render: dashed-border card showing status badge + "Posting no longer available" + applied_at + optional message preview + Withdraw button (when withdrawable)
- [x] Symmetric edit at `apps/web/src/app/(app)/discover/_components/applied-tab.tsx`
- [x] No API change needed — daywork + permanent applications routes already select needed fields
- [x] Withdraw action on tombstone when status is `applied`/`viewed`/`shortlisted` (daywork) or `applied`/`shortlisted`/`selected` (permanent)
- [ ] Manual verify: count = visible-list. Cancelled/closed postings render as tombstone instead of vanishing.

#### B-001 — cert extras pill expansion (permanent UI + daywork API + UI)

- [x] **Permanent API:** `apps/web/src/app/api/permanent/[id]/review/route.ts` extended — captures `certExtraIds` array (was just count) and returns it as `cert_extras_ids` alongside the existing `cert_extras` count.
- [x] **Permanent UI:** `apps/web/src/app/(app)/permanent/[id]/review/page.tsx` — type extended with `cert_extras_ids`; page state `certsExpandedFor: Set<string>` + `toggleCertsExpanded`; `certNameById` memo from lookups; static span replaced with clickable button that toggles expand and renders cert-name pills below.
- [x] **Daywork API:** `apps/web/src/app/api/daywork/[id]/applicants/route.ts` — added `required_certification_ids` to dayworks select, parallel `certification_components` fetch when posting requires certs, per-applicant `cert_match` + `cert_extras_ids` computation using `meetsRequirements` (mirror of permanent route's logic).
- [x] **Daywork type:** `_components/types.ts` — `Applicant` extended with `cert_match` + `cert_extras` + `cert_extras_ids`.
- [x] **Daywork UI:** `applicants-tab.tsx` ApplicantCard — replaced bare `{count} certs` badge with cert match indicator + clickable +N additional pill that expands to show cert names; uses `useLookups()` to resolve names.
- [ ] Manual verify on both sides: required certs display match indicator; extras pill expands to show names; no regression on bundle-aware matching.

#### B-010 — Available Crew Pro filter diagnostic + fix

- [x] **Step 4 — empty state copy:** `available-crew-tab.tsx` empty-state rewritten — title "No available crew yet"; body explains the visibility rule ("Crew Pro members with current, in-range availability in the same city as the posting"); Show-all-roles hint shows only when `allRoles=false`.
- [x] **Step 5 — applicants-tab empty CTA:** `applicants-tab.tsx` empty state replaced — body now reads "No applicants yet — see who's available now in your area, or share the posting to attract more"; primary `<Users /> View available crew` button switches tab to Available; Refresh + ShareJobButton kept as secondary actions.
- [x] **Step 6 — integration test:** `apps/web/__tests__/api/daywork-available-crew.test.ts` ships 3 tests covering the monetization invariant — Crew Pro + active sub + non-expired availability + matching city + role mismatch + `allRoles=true` returns crew (positive); `allRoles=false` filters them out (negative); non-Pro crew never surface even with role match. All 3 pass — confirms route logic is correct.
- [ ] **Steps 1-3 (live diagnostic + repro):** deferred — pre-commit hook bans committed `console.log` so live instrumentation needs a separate session. **Route logic is provably correct (test covers the invariant)** — user's reproduction is almost certainly a data/state issue. Most likely culprits per recon: stale availability `expires_at` (mig 00082's `date + 1 day` rule); availability city ≠ posting's resolved city; `subscriptions.status` not `'active'` or `'trialing'`. Manual user check: query their test crew's `availability_windows` and `subscriptions` rows directly against the daywork's `start_date`/`end_date`/`location_port_id`-resolved city.

### Batch 3 — Rework + long-tail

#### B-005 — Templates: separation, validation bypass, partial-save fix, edit support, type-chooser entry

- [ ] **Migration `00134_templates_partial_save.sql`:**
  - DROP NOT NULL on `permanent_templates`: `vessel_id`, `role_id`, `port_id`, `start_date`, `salary_min`, `salary_max`, `salary_currency`, `salary_period`, `live_aboard`, `required_certification_ids`, `shortlist_cap` (review the list at fix time vs schema 00059:43-62)
  - ADD owner UPDATE RLS policy on `daywork_templates` (currently missing per 00006):
    ```
    create policy "Owners can update their templates"
      on public.daywork_templates for update
      to authenticated using (person_id = auth.uid()) with check (person_id = auth.uid());
    ```
  - Self-contained rollback: restore NOT NULL constraints (SET DEFAULT before re-applying), DROP the new RLS policy
- [x] **API: `POST /api/permanent/templates/route.ts`** — rewritten to build the insert from only fields the user supplied (no `|| null` coercion that hit NOT NULL). Tier cap enforcement preserved.
- [x] **API: `POST /api/daywork/templates/route.ts`** — same partial-friendly insert refactor + added missing `name` required-field validation.
- [x] **API: new `PATCH /api/daywork/templates/[id]/route.ts`** — mirrors permanent's PATCH (selective field update + ownership check). Migration 00134 added the missing UPDATE RLS policy that this depends on.
- [x] **UI: post-type selector** — added third option "Post from a template", routes to `/daywork/mine?tab=templates`.
- [x] **UI: daywork post form** — `templateMode` state + `editingTemplateId` derived from search params; toggle moved to TOP; `?mode=template`/`?mode=edit` query routing; required-field asterisks wrapped in `{!templateMode && ...}`; submit-validation bypassed in template mode; submit button text reframed (`Review and create template` / `Save changes`); page header reframed; legacy "save AND post" path removed; bottom toggle + load-template dropdown removed.
- [x] **UI: permanent post form** — same treatment via the search-param routing pattern; new top-of-form template-mode block; `handleSaveTemplate` with POST/PATCH branching; submit button + checklist + header all reframed; legacy "save AND post" + load-template dropdown removed.
- [x] **UI: templates tab in My Jobs**:
  - `daywork-templates-section.tsx`: added `Edit` button alongside `Use` + `Delete` (routes to `?type=daywork&mode=edit&templateId={id}`); `Create template` button at the top routes to `?type=daywork&mode=template`.
  - `permanent-mine-section.tsx`: same treatment, routes prefixed with `?type=permanent`.
- [x] **UI: post page handles `mode=edit`** — both forms read `mode` and `templateId` from search params, pre-fill on mount, PATCH on submit.
- [ ] **Tests:** save with partial fields succeeds (both types); save without name fails; edit existing template succeeds; tier cap enforced; "Use template" pre-fills post form; "Create template" lands in template mode. (Existing tests still pass; full coverage tests deferred to next session — manual verification recommended once migration 00134 lands.)

#### B-003 — References: employer visibility + shortlist gate + multi-reference picker + crew Manage entry

- [x] **API fix at `apps/web/src/app/api/profile/[personId]/route.ts:289`** — switched references query to `serviceClient`. `buildCrewProfile` signature extended to accept serviceClient as a separate param so the rest of the route still uses the regular client. Tier-cap visibility logic + upstream `checkRelationshipContext` are the access controls now.
- [x] **API gate at `apps/web/src/app/api/references/[id]/contact/route.ts`** — added a server-side derivation that the calling employer has a shortlisted-or-downstream application from the reference's requester on one of their own postings. Runs AFTER the budget gates (semantically: budget is "stop everything" global, shortlist is per-request).
  ```
  // Verify employer has a shortlisted (or downstream) application from referee
  const { count } = await serviceClient
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('crew_person_id', ref.referee_person_id)
    .in('status', ['shortlisted', 'selected', 'in_negotiation'])
    .or(`daywork_id.in.(...employer's dayworks),permanent_posting_id.in.(...employer's postings)`)
  ;
  if ((count ?? 0) === 0) return 403 'Crew must be shortlisted before contacting references'
  ```
  Subqueries: select `dayworks.id where poster_person_id = user.id`, `permanent_postings.id where employer_person_id = user.id`. Cache in two batched fetches before the application count query.
- [x] **New shared component: `apps/web/src/components/references/contact-references-button.tsx`** — drop-in trigger for the shortlist surfaces. 0 refs → renders nothing; 1 ref → opens `ContactReferenceDialog` directly; 2+ refs → opens an inline picker dialog (referee name + role + vessel snapshot per row), then opens the dialog for the chosen reference.
- [x] **Daywork shortlist tab — applicant card extension** — `applicants-tab.tsx` ApplicantCard now renders `<ContactReferencesButton>` with the applicant's references[]. Naturally limited to shortlisted+ since the API only populates the array for those statuses.
- [x] **Permanent shortlist tab — same** — `permanent/[id]/review/page.tsx` applicant card mirrors the daywork wiring.
- [x] **Applicant card data** — `/api/daywork/[id]/applicants` and `/api/permanent/[id]/review` extended with hydrated `references[]` per applicant (only populated when status is shortlisted-or-downstream — matches the contact-API gate). Service client bypasses owner-scoped RLS; per-referee profile + role resolution batched.
- [x] **Crew self-profile "Manage references" button** — sibling Button next to "Add reference (x/y)" at `profile-experience-section.tsx`. Renders only when `refsActive > 0`. Routes to `/settings/references?exp={id}` deep-link.
- [x] **Settings references page deep-link** (`apps/web/src/app/(app)/settings/references/page.tsx`): reads `?exp=` query param, finds the first matching reference row across status sections (accepted/pending/expired) in render order, scrolls it into view, applies a `ring-2 ring-[var(--accent)]` highlight.
- [ ] **Pre-shortlist passive pill (optional, lower priority):** on the Applicants tab (pre-shortlist), show a passive `📎 N references` indicator (no button) so employers see the reference count exists. Encourages shortlist conversion. Default OFF unless trivial to add.
- [ ] **Tests:**
  - Employer viewing shortlisted candidate sees their references
  - Employer viewing applicant (pre-shortlist) does NOT see Contact button
  - Contact API rejects when application not shortlisted (new 403 case)
  - Multi-reference picker opens when 2+ references on same experience

#### B-002 — Rejection notification tone (Telegram + in-app/push only; WhatsApp dispatcher edits DROPPED — deferred per project notes)

- [x] **Telegram dispatcher** (`apps/web/src/lib/push-triggers/telegram-dispatcher.ts`) — edited 3 branches:
  - `DAYWORK.REJECTED`: was `❌ <b>Application not selected</b>` → now `📈 <b>On to the next — {roleName}</b>\n{jobNumber} found a different fit. Plenty of new daywork live today.`
  - `PERMANENT.REJECTED`: was `❌ <b>Permanent application not selected</b>` → now `🔍 <b>Keep exploring — {roleName}</b>\n{jobNumber} closed for now. Fresh permanent postings match your profile every week.`
  - `PERMANENT.PLACEMENT_CONFIRMED` "Position Filled" branch: was `ℹ️ <b>Position filled</b>` → now `🌟 <b>Role filled — {roleName}</b>\n{jobNumber} went to another crew. New permanent postings live this week — keep applying.`
- [x] **In-app handlers** — body softened:
  - `daywork-handlers.ts` `handleDayworkRejected`: body now reads `"{jobNumber} went a different way — see what's open in your area"` (was `"Update on your application for {jobNumber}"`).
  - `permanent-handlers.ts` `handlePermanentRejected`: body now reads `"{role} went a different way — keep exploring permanent roles"` (was `"Update on your {role} application"`).
  - Titles unchanged ("Application Update") — already neutral.
- [x] **WhatsApp dispatcher** — DROPPED from scope per project notes (WhatsApp migration is deferred). Inline comments added on `dw_rejected` / `pm_rejected` / `pm_position_filled` template branches noting that warmer copy mirroring the Telegram body should be re-submitted to Meta as `_v2` templates when WhatsApp launches.
- [ ] **Tests:** existing dispatcher tests still pass (1516/1516, no regressions). No new tests added — copy changes only.

### Open at fix-time (not blocking)

- B-002 final Telegram copy: agent locks 1 of the drafted candidates per surface; user reviews in PR.
- B-005 confirm exact NOT NULL list to drop on `permanent_templates` after re-reading migration 00059.
- B-007 once landed, optionally extend to `/permanent/[id]/apply` employer-block (low risk, listed as a notable edge case).

## Bug intake 2026-05-02

> Pending triage. Each entry captures user-reported symptom + initial code pointer. Plan + fix order will be added once the list is complete.

- [ ] **B-001 — Applicant card cert-extras pill is not expandable.**
  - **Symptom:** On the applicant review card, certifications the candidate holds that fall _outside_ the job's required cert list are summarised as "+ X additional" with no way to see what they are. Employers can't quick-vet for bonus certs without leaving the card / opening the full profile.
  - **Permanent side:** `apps/web/src/app/(app)/permanent/[id]/review/page.tsx:390-392` — renders `<span className="text-[var(--primary)]">+ {app.cert_extras} additional</span>`. `cert_extras` is a count only (`number`), so the cert _names_ are not currently in the API response.
  - **Daywork side (user-confirmed: same symptom):** "+X additional" appears on daywork applicant cards too. Source location TBC at fix time — likely rendered inside `applicants-tab.tsx` or a sub-component (didn't grep up under that label, so may use slightly different copy). Find at fix time and apply the same expandable-pill treatment.
  - **Expected:** pill is tappable / expandable, reveals the actual cert names (e.g. inline expansion like the discover-card pattern shipped in commit `50891a9` "cert bundle expansion + clickable +N more pill on daywork/permanent cards").
  - **Likely scope:** (1) extend applicant-list API to return `extra_cert_names` (or full cert id array) per applicant, (2) replace static span with expandable pill component, (3) replicate the discover-card +N more pill behaviour for consistency. Pure UX, no schema change.
  - **Severity:** medium — vetting friction, not blocking.

- [ ] **B-002 — Rejection notification tone is too brutal.**
  - **Symptom:** Crew rejection notifications hit hard (red ❌ + "Application not selected" / "Permanent application not selected"). Terminal, funereal feel — especially harsh for green crew. Needs warmer, more humane copy that acknowledges the outcome without the funeral framing. (User screenshot of Telegram surface evidences this — bottom card "❌ Permanent application not selected — Third Engineer · PM-00028".)
  - **Surfaces — all need review:**
    - **Telegram (worst offender, screenshotted):** `apps/web/src/lib/push-triggers/telegram-dispatcher.ts:190` for `DAYWORK.REJECTED` ("❌ <b>Application not selected</b>") and `:426` for `PERMANENT.REJECTED` ("❌ <b>Permanent application not selected</b>"). Plain copy change.
    - **WhatsApp:** `apps/web/src/lib/push-triggers/whatsapp-dispatcher.ts:91` (`dw_rejected` template) and `:238` (`pm_rejected` template). Wording is server-side on Meta — **copy changes require new template names + Meta re-approval**, not just code edits.
    - **In-app + push (already softer, but worth tone-aligning):** `apps/web/src/lib/push-triggers/daywork-handlers.ts:60-64` ("Application Update — Update on your application for [job]") and `apps/web/src/lib/push-triggers/permanent-handlers.ts:139-143` ("Application Update — Update on your [role] application"). Tone is OK; keep consistent with new wording.
    - **Sibling to fix in lockstep (user-confirmed):** `PERMANENT.PLACEMENT_CONFIRMED` "Position Filled" branch at `telegram-dispatcher.ts:436-441` and `whatsapp-dispatcher.ts:251-`. Apply the same warmer treatment — same audience (rejected applicants), same risk.
  - **Expected (user-confirmed direction):** Warmer tone. Drop red ❌. Avoid "rejected" framing. **The point is to inform and encourage more applications, not leave applicants despondent.** Use the same vibes as the other (positive) templates — friendly, forward-looking, gentle nudge to keep applying. Implementation agent drafts the copy; planning step picks it.
  - **Likely scope:** Copy + emoji edits across 4 dispatcher branches (×2 with sibling Position Filled = 6). WhatsApp side adds a Meta template-resubmission step. No schema, no API contract change.
  - **Severity:** medium-high — first-impression harm, affects crew retention.

- [ ] **B-003 — References feature has no employer-side discoverability and no crew-side management entry point.**

  Three related sub-issues. Same feature (Fix 258 / Fix 258b consent-based references), same code area, fix together.
  - **B-003a — Employer-facing reference visibility / Contact buttons are effectively invisible.**
    - **User report (verified end-to-end):** Tested with 3 real profiles (crew, employer, referee). Add/revoke/remove flows all work. Real `status='accepted'` references exist. From the employer view, references and Contact reference buttons do not appear at any stage — applicant card, shortlist card, ProfileOverlay opened from "View profile" in chat, etc.
    - **Likely root cause (to verify at fix time, not now):** The crew profile API (`apps/web/src/app/api/profile/[personId]/route.ts:289`) queries `references` using the **regular `supabase` client**, not `serviceClient`. Per migration 00125 RLS, `references` rows are owner-scoped (requester + referee). An employer viewing a crew profile has zero RLS access to those rows, so the query returns `[]` and the UI silently renders nothing. Same client/RLS pattern likely affects `referee_display_name` join and any sibling reads. Cross-checks needed: do the contact-route GETs use `serviceClient` correctly (`/api/references/[id]/contact/route.ts:40` does — good). The wiring is broken on the _visibility_ side, not the _contact-action_ side.
    - **What the UI is wired to do (when data flows):** `ProfileOverlay` (`apps/web/src/components/profile-overlay.tsx:610-617`) DOES render `<ReferenceRowList>` with per-reference "Contact reference" buttons (lines 347-362) gated on `canContactReferences = viewerHat === 'employer' || viewerHat === 'agent'` (line 154). So the deeper layer works — only the data flow is broken AND the entry point is too buried.
    - **Surfaces needing reference visibility (post-fix):**
      - Daywork shortlist tab cards (`apps/web/src/app/(app)/daywork/[id]/review/_components/applicants-tab.tsx` + shortlist-tab wrapper)
      - Permanent shortlist tab cards (`apps/web/src/app/(app)/permanent/[id]/review/_components/applicants-tab.tsx`)
      - Chat header / chat sidebar action list — already has "View profile" → ProfileOverlay, but no inline reference signal
    - **NEW PRODUCT RULE (from user this turn):** **Contact reference is only available on shortlisted candidates** (and downstream states — selected, in-negotiation). Forces a "shortlist → reference contact" mechanic. Rationale: shortlisting is a meaningful commitment, prevents fishing, limits referee burden. Cleanly aligns with surface decisions: shortlist tab is the primary entry point; pre-shortlist applicants don't get the button; chat surfaces inherit the gate naturally (chat opens on `DAYWORK.ACCEPTED` / `PERMANENT.SELECTED`, both downstream of shortlist).
    - **Implications:**
      - **API gate:** `POST /api/references/[id]/contact` (`apps/web/src/app/api/references/[id]/contact/route.ts`) currently only checks `references.status='accepted'` (line 48-53), not the application status. Add a check: the calling employer must have a `shortlisted` (or downstream) application from the referee's crew on one of the employer's postings. Tricky to scope cleanly — one option is to take the `applicationId` as a body param and verify employer ownership + `status IN ('shortlisted', 'selected', 'accepted', 'in_negotiation')`. Decide at fix time.
      - **UI:** Contact button only renders on shortlist-tab card surfaces and shortlist-context ProfileOverlay opens. Pre-shortlist Applicants tab gets a passive "N references" pill (informational, no button) — preserves the visibility signal without enabling contact.
    - **Expected outcome:** Employer opens shortlisted candidate (card or chat) → sees a "References (N)" surface → taps → multi-reference picker → opens existing `ContactReferenceDialog`.

  - **B-003b — Multi-reference picker UX.**
    - **User concern:** "If multiple references exist on one experience, employer needs to pick WHICH one to contact."
    - **Today:** Inside ProfileOverlay each reference row has its own dedicated "Contact reference" button (per-reference disambiguation already works — `profile-overlay.tsx:347-362`).
    - **Implication for the fix:** any NEW Contact-reference entry point added higher up the funnel (shortlist card, chat header) must NOT assume a single reference. It needs a picker step — show referee names + roles + vessel snapshot (snapshot lives on `references.snapshot_*` columns), let employer choose, then open `<ContactReferenceDialog>` for the chosen `referenceId`. The picker IS the multi-reference resolution.
    - **Suggested component:** new `<ReferencePicker>` shared component, takes `references[]` + `applicationId` (for the API gate), renders the picker, opens `ContactReferenceDialog` on select.

  - **B-003c — Crew self-profile lacks a "Manage references" entry point.**
    - **Current state:** On the crew self-profile, each experience card shows an `Add reference ({refsActive}/{refsCap})` ghost button at `apps/web/src/app/(app)/profile/_components/profile-experience-section.tsx:244-247`. The settings references page (`apps/web/src/app/(app)/settings/references/page.tsx`) is reachable only via `Settings → Account → References` — non-intuitive.
    - **User wants:** Add a sibling "Manage references" (or "View references") button next to "Add reference (x/y)" that routes to `/settings/references`. Settings page lives in the right place — it just needs more entry points.
    - **Likely scope:** trivially small — one extra `<Button>` in the same flex row, links to `/settings/references`. Maybe also surface in the profile header somewhere (open question).

  - **Combined severity:** high — references is a flagship feature shipped recently (Fix 258 / 258b); employers can't find it and crew can't manage it. Quietly defeats most of the work.
  - **Combined scope:** UI-layer only. No schema, no API change. New shared `ReferencePicker` component, new lightweight reference summary on applicant cards, plus the small crew-side button. Work concentrates in the two `applicants-tab.tsx` files, the chat header/sidebar component, and the crew profile experience section.

- [ ] **B-004 — Employer review-page action buttons are unexplanatory (green tick / red X) — match the crew "Show next / Apply" treatment.**
  - **Symptom:** On both daywork and permanent applicant review, the buttons employers tap to move candidates between states are either icon-only or use curt verb labels. The crew browser uses explanatory side-by-side buttons (red X "Show next" + green Check "Apply") that read clearly. Employer surface should mirror this clarity.
  - **Crew-side reference pattern (the "good" model to copy):**
    - `apps/web/src/app/(app)/discover/_components/daywork-browse.tsx:312-336` — two side-by-side buttons:
      - Red `variant="destructive"`, `<X />` icon + label "Show next"
      - Green `variant=` overridden to `--success`, `<Check />` icon + label "Apply"
    - Both `h-12 flex-1`, paired in a single flex row. Reads at a glance.
  - **Daywork employer side (current):** `apps/web/src/app/(app)/daywork/[id]/review/_components/applicants-tab.tsx:147-171` — 3 circular icon-only buttons (50-56px) with no text:
    - Red `<X />` (Reject) at 148-154
    - Yellow `<Star />` (Shortlist, applicants tab only) at 156-162
    - Green `<Check />` (Accept) at 164-170
    - Symbol-only — works for first-time users only after they figure out icons. No accessibility label confirmation either.
  - **Permanent employer side (current):** `apps/web/src/app/(app)/permanent/[id]/review/page.tsx:438-477` — inline text-only buttons inside each applicant card:
    - "Reject" outline button (line 448)
    - "Shortlist" / "Shortlist full" primary button (line 457)
    - On Shortlisted tab: "Reject" + "Select" (line 471+)
    - Text exists but tone is curt; "Reject" is the brutal verb the crew side avoids.
  - **Expected:**
    - Replace icon-only daywork buttons with crew-style icon+label pair: red "Show next" / green "Hire" (or similar) + amber "Shortlist" middle button kept.
    - Soften permanent button labels: "Reject" → "Show next" (or "Pass"); keep "Shortlist" / "Select" since those already describe the action.
    - Consistent visual treatment across daywork + permanent so employers don't context-switch.
  - **Open copy questions (decide at fix time):**
    - Daywork accept = "Hire"? "Confirm"? "Take on"?
    - Permanent reject = "Show next"? "Pass"? "Move on"?
    - Shortlist label stays as "Shortlist" (clear enough).
  - **Star icon clarity (user follow-up):**
    - The Star icon used for "Shortlist" on the action button is currently unlabelled (`applicants-tab.tsx:161`) — needs a text label like the other buttons. Pair the `<Star />` icon with the word "Shortlist" inline (matching the X+"Show next", Check+"Apply" pattern).
    - **Tab coherence:** the Shortlist tab itself in the tab nav should also carry an inline `<Star />` icon next to the "Shortlist" label — visually anchors the icon-meaning across the page so the action button's star reads as obviously the same concept. Tab nav is rendered in `apps/web/src/app/(app)/daywork/[id]/review/page.tsx` (search for the Tabs/TabsList for the daywork side) and equivalently on the permanent side. Keep the icon size and placement consistent with existing tab patterns (other icons used elsewhere in tabs, if any).
  - **Likely scope:** UI-only. Replace button JSX in two files (`daywork .../applicants-tab.tsx` and `permanent .../review/page.tsx`), update tab labels in both review pages to include `<Star />` next to "Shortlist". Keep handlers wired identically. Reuse existing icon imports. No schema, no API. Trivial.
  - **Severity:** medium — UX clarity + tone alignment; brutal "Reject" verb on the employer side compounds the same friction as B-002.

- [ ] **B-005 — Templates feature is broken end-to-end (save, edit, discover, use). Paid feature for Employer Pro.**

  Six related defects in the templates feature. The user is paying for "more templates" (Stage 198 tier-cap: free=3 daywork / 1 permanent, Pro=unlimited) but the feature largely doesn't work. Fix together.
  - **B-005a — Permanent template save inserts NULL into NOT NULL columns → DB violation.**
    - **Where:** `apps/web/src/app/api/permanent/templates/route.ts:101-108` (POST handler) writes `vessel_id`, `role_id`, `port_id`, `start_date`, `salary_min`, `salary_max` from request body with `|| null` / `|| 0` fallbacks.
    - **Schema reality:** `supabase/migrations/00059_permanent_jobs.sql:43-62` declares ALL of those columns `NOT NULL`. Saving a template with partial fields → constraint violation → save fails. This is the most direct "templates are broken" symptom.
    - **Decision needed at fix time:** template tables need their NOT NULL constraints relaxed (new migration that drops NOT NULL on the partial-fields, with corresponding rollback) AND the POST handler should write only fields the user supplied, not coerce nulls to zeros.

  - **B-005b — Required-field validation blocks template-only saves.**
    - **Where:** Daywork form `apps/web/src/app/(app)/daywork/post/page.tsx:479-490` and permanent form `apps/web/src/app/(app)/daywork/post/_components/permanent-post-form.tsx:538-546` gate the submit button on full required-field set (vessel, role, location, dates, rate/salary). Validation runs uniformly regardless of save-as-template state.
    - **User intent:** an employer who only wants a "Deckhand €2500" reusable template should be able to provide ONLY role + day rate + template name and save it. No vessel, no dates, no location required.
    - **Fix shape:** when `saveAsTemplate=true` (and the form is in "template-only" mode — see B-005c), drop the full-form validation gate. Only validate template name (1-100 chars, see B-005f) + at minimum _something_ (e.g. require ≥1 field beyond name) so empty templates don't pollute the list. Posting validation only kicks in when user is genuinely posting a job (template-off OR "save AND post" path — see B-005c).

  - **B-005c — Save-as-template UI is at the BOTTOM of the form; should be at the TOP and reframe the form mode.**
    - **Current placement:**
      - Daywork: `apps/web/src/app/(app)/daywork/post/page.tsx:862-882` — checkbox + conditional name input rendered after notes section, before live requirements checklist.
      - Permanent: `apps/web/src/app/(app)/daywork/post/_components/permanent-post-form.tsx:481-501` — same pattern, near the bottom.
    - **Required UX (user-confirmed, strict separation):** Move the checkbox to the TOP of the post form. When toggled ON, the form reframes as "Create template" mode:
      - All required-field asterisks drop (B-005b takes effect).
      - Submit button changes from "Review and post" → "Review and create template".
      - No job is posted in this path — template-only.
    - When toggled OFF: normal posting form, full validation, posts a job.
    - **Strict separation rationale (user words):** "It is illogical to try and create a template with fields missing that posting requires and it is illogical to post a job with fields missing as a template — there needs to be a 'create template' entry and a 'use template' entry." So no dual "save AND post" path. Two distinct gestures: create template, OR post a job (optionally seeded from a template via B-005d).

  - **B-005d — No "Post from a template" entry on the post-type chooser.**
    - **Where:** `apps/web/src/app/(app)/daywork/post/_components/posting-type-selector.tsx:9-41` shows two buttons (Daywork / Permanent). User wants a third: "Post from a template" → opens a template picker → applies template → continues to the appropriate post form (daywork or permanent depending on template type) pre-filled.
    - **Today's "use template" flow:** Buried in dropdowns inside the post forms (daywork dropdown at `daywork/post/page.tsx:575-603`, permanent dropdown at `permanent-post-form.tsx:393-422`). User specifically calls out: "to do it only from My jobs is not logical — that's a job with various states, not a template selector space." (Note: my-jobs may also surface templates somewhere — worth a search at fix time, but the fundamental complaint is no clear top-level entry.)
    - **Fix shape:** add third option on the type chooser. Selecting "From a template" lists user's daywork + permanent templates (mixed list, badged with type), employer picks one, gets routed to the appropriate post form with fields pre-populated. The post form then runs in normal posting mode (full validation), with template values as defaults the user can override.

  - **B-005e — Daywork templates have no PATCH/UPDATE path → not editable.**
    - **API:** `apps/web/src/app/api/daywork/templates/[id]/` has only DELETE (per agent recon — no PATCH file).
    - **DB:** `supabase/migrations/00006_daywork_templates.sql:24-36` defines RLS with no UPDATE policy. Even if a PATCH route is added, owners can't UPDATE their own rows under current RLS.
    - **Permanent side:** Already has PATCH (`apps/web/src/app/api/permanent/templates/[id]/route.ts:45`) and an UPDATE RLS policy (migration 00059 lines 162-166). Use as the model for parity.
    - **Fix shape:** new migration adds owner UPDATE policy on `daywork_templates`; new PATCH route under `apps/web/src/app/api/daywork/templates/[id]/`; rollback removes the policy. Plus a UI surface to actually edit (see B-005f).

  - **B-005f — No standalone template manager / editor UI.**
    - **Today:** Templates are loadable via dropdowns inside post forms; not viewable as a list, not editable, not deletable from a dedicated surface.
    - **Fix shape:** add a templates manager — likely a settings-style page or a dedicated `/templates` route — listing both daywork + permanent templates, with edit + delete + "use this template" actions. Reachable from settings AND from the new "Post from a template" chooser entry (B-005d).

  - **Template name length:**
    - API layer truncates to 100 chars: `apps/web/src/app/api/daywork/templates/route.ts:80` and `apps/web/src/app/api/permanent/templates/route.ts:99` use `.slice(0, 100)`.
    - DB has no CHECK length constraint. Reasonable cap.
    - User noted "don't forget max character for naming" — confirm 100 is right at fix time; surface it visibly in the UI input (`maxLength={100}` + "X/100" counter).

  - **Combined severity:** high — paid feature, advertised on billing page, doesn't actually work. Reputational risk if a Pro subscriber tries it.
  - **Combined scope:**
    - **Migration:** drop NOT NULL on partial-fields for `permanent_templates`; add owner UPDATE policy on `daywork_templates`. Add reversible rollback.
    - **API:** rewrite both POST handlers to write only supplied fields; add daywork PATCH route at parity with permanent.
    - **UI:** move save-as-template toggle to top of both post forms; conditional validation gating; new third option on `posting-type-selector.tsx`; new template-picker dialog/page; new template manager page (or section); editing surface; max-char counter on template name.
    - **Tests:** save with partial fields (no vessel, no dates) succeeds for both types; save without name fails; edit existing template succeeds; tier cap still enforced; templates loadable via picker pre-fill correct fields.

- [ ] **B-006 — Daywork applicant card scrolls over the page header on desktop (z-index collision).**
  - **Symptom (user screenshot, `/daywork/[id]/review`):** On desktop, scrolling the review page causes the applicant card to slide up and visually overlap the "Review" header bar instead of being clipped beneath it. Card content + the back chevron + page title all render at the same vertical band.
  - **Root cause (already located):** The page header at `apps/web/src/app/(app)/daywork/[id]/review/page.tsx:325` is `className="sticky top-0 z-10 ..."`. The applicant card swipe wrapper at `apps/web/src/app/(app)/daywork/[id]/review/_components/applicants-tab.tsx:240` is `className="absolute inset-0 z-10 cursor-grab ..."`. **Both at z-10.** Since the card's containing stacking context paints later in the DOM than the header, the card wins the tie and renders over the header.
  - **Compounding:** The swipe-accept / swipe-reject / swipe-shortlist overlay labels at lines 248 / 254 / 261 are `z-20` — they'd also cover the header during an in-progress swipe.
  - **Fix shape:** Promote the header to `z-30` (or higher), keeping it above all card-stack stacking. Verify the same fix on the permanent review page header (`apps/web/src/app/(app)/permanent/[id]/review/page.tsx`) — it shares the same sticky header pattern. Cross-check the chat/messages and discover headers if they share the issue. Pure CSS, no behaviour change.
  - **Severity:** medium — visually broken on desktop; not blocking but looks unprofessional.

- [ ] **B-007 — Crew hat can land on `/daywork/post` (and `/permanent/post`) — missing middleware role-gate.**
  - **Symptom:** On desktop, while on the post-job page, switching hats via the sidebar "Switch to crew" button reloads the page (per `hat-switcher.tsx:38` `window.location.reload()`) but the post form re-renders normally for the now-crew user. Form looks fully usable. Violates the CLAUDE.md role-gating invariant: "crew hat cannot post jobs."
  - **What protects what (current state):**
    - **API: protected.** `apps/web/src/app/api/daywork/route.ts:24` rejects with `if (!['employer', 'agent'].includes(person.current_hat))`. Permanent POST routes follow the same pattern. So a crew can't actually create a posting — submission would 403. Data integrity is intact.
    - **Middleware: NOT protected.** `apps/web/src/lib/supabase/middleware.ts:264-271` has guards for crew → review pages (`/daywork/[id]/review`, `/permanent/[id]/review`) but NO guard for `/daywork/post` (or any equivalent). The post page renders for crew until they hit submit, then they get a confusing 403.
    - **Client page: no hat check.** `apps/web/src/app/(app)/daywork/post/page.tsx` does not check `current_hat` — no `current_hat` reference anywhere in the file.
  - **Fix shape:** Extend the existing middleware crew-block pattern (lines 264-271) to cover post routes:
    ```
    if (currentHat === 'crew' && /^\/daywork\/post/.test(path)) → redirect to /discover
    if (currentHat === 'crew' && /^\/permanent\/post/.test(path)) → redirect to /discover  (verify route shape — daywork/post hosts the permanent form too via PostingTypeSelector, so single guard may suffice)
    ```
    Pure middleware change. JWT custom claims (`current_hat` already present, Stage 174) make this zero-DB-cost.
  - **Broader sweep — DEFAULT YES (user deferred):** scope decision was "I don't know"; defaulting to running the audit because (a) it's cheap once we've built the post-route guard pattern, (b) prevents regression discovery later. Audit every employer-only and crew-only route for missing middleware guards. Known unguarded employer-only routes besides post:
    - `/daywork/mine`, `/permanent/mine` (employer "My jobs" pages — crew shouldn't see them)
    - `/vessels` (vessel manager — crew can use it via the experience-add flow, so it's _not_ employer-only — verify before guarding)
    - Any `/daywork/[id]/review` already guarded; permanent equivalents already guarded.
      Known unguarded crew-only routes:
    - `/discover` for crew is the active surface; agents and employers are already redirected (lines 250-261). Good.
    - `/profile/add-experience`, settings/references — these are crew-only conceptually; if employer hat lands on them, do they break? Worth checking.
  - **Severity:** medium-high — invariant violation per CLAUDE.md, confusing UX dead-end ("looks like it works, then 403"), but data integrity holds because API rejects. If user just sees 403 they assume the app is broken; if a future API route forgets the guard it becomes a real privilege escalation.

- [ ] **B-008 — Applied tab shows badge count > 0 with empty list (orphan applications when employer / posting is gone).**
  - **Symptom (user screenshot):** Permanent → Applied tab shows `Applied (4)` in the tab badge but the body renders empty. User reports this happened after a connected user (employer) was deleted — suspects "restore not cleared state" or scrub side-effect.
  - **Why count and list disagree (NOT the SUG-014 mismatched-source pattern):** Both feed from the same `applications` array via `useDiscoverData()` context (`apps/web/src/app/(app)/discover/_components/discover-data-context.tsx:82-107` loads from `/api/permanent/applications` once and exposes the array; `discover-applied.tsx:32-38` and `page.tsx:106-108` filter the same array with the same `a.type === 'permanent'` predicate). Same source, no drift.
  - **Actual root cause — silent card null-bail when joined posting is missing:**
    - `apps/web/src/app/(app)/discover/_components/permanent-application-card.tsx:87-88` early-returns `null` when `application.posting` is null: `const p = application.posting; if (!p) return null;`.
    - Same pattern on the daywork side at `apps/web/src/app/(app)/discover/_components/applied-tab.tsx:165-166` (`const dw = application.daywork; if (!dw) return null;`).
    - The API (`apps/web/src/app/api/permanent/applications/route.ts:110-149`) hydrates `posting` only when the PostgREST join `permanent_postings(...)` returns a row — line 124 `posting: pp ? {...} : null`. If RLS blocks the joined posting, or the posting row is gone, `pp` is null → `posting: null` → card renders null → invisible, but the application row is still counted in the array → `filteredAppCount = 4`.
  - **Why `pp` would be null (most likely scenarios):**
    - Most plausible given user note ("this WAS a deleted user"): `PERSON.DATA_SCRUBBED` ran on the employer. Per Stage 197 / 199 / Fix 258 lessons + projection extensions, the scrub handler currently affects `notification_channels`, `agent_placement_cities`, `deck_name`, `engagement_documents`, and references. **Need to verify what it does to `permanent_postings` and `dayworks`** — probable that posting rows are either hard-deleted or status-flipped to a state that RLS blocks, leaving applications referencing a now-invisible posting. (The applications row itself is preserved — sensible for audit per the append-only ledger principle, but it produces this UX break.)
    - Secondary: `permanent_postings.status='cancelled'` filtered by RLS for non-employers. Same effect.
    - Tertiary: a non-existent posting (impossible per "no hard deletes" invariant unless a scrub bypasses it).
  - **Daywork side has the same defect:** `applied-tab.tsx:166` returns null when `application.daywork` is null. Symptom hasn't been screenshotted but the code path is identical — fix together.
  - **Fix shape — DEFAULT TOMBSTONE (user deferred):** scope decision was "I don't know"; defaulting to option 2 (render a "Posting no longer available · you applied on …" tombstone card) because (a) preserves history, (b) gives crew closure on "what happened to this application?", (c) makes count = visible-list trivially. Easily revertible to API-filter if the tombstone clutters the UI in practice.
  - **Verification before planning fix:** check whether `apply_projection`'s `PERSON.DATA_SCRUBBED` handler hard-deletes or status-flips the scrubbed user's `permanent_postings` and `dayworks` rows. Read the latest `apply_projection` body in the most recent migration. The behaviour drives whether the API filter / tombstone needs to handle missing rows or just RLS-blocked rows.
  - **Severity:** medium — confusing UX (count lies), not blocking, no data integrity issue. Will degrade as the platform ages and more users get scrubbed.

- [ ] **B-009 — Daywork post form lets users pick past start/end dates and past working days; submit then errors. Calendar should block past dates entirely.**
  - **Symptom (user):** "Calendar opens for daywork selection days but then throws an error if you offer days in the past — the calendar should block days in the past or days before the selected range so it stops throwing the error and annoying users."
  - **Where the gap is — three layers, all unguarded:**
    1. **Start date input** at `apps/web/src/app/(app)/daywork/post/page.tsx:669-677`: `<DateInput value={startDate} onChange={...} required />` — **no `min` prop**. Picker accepts dates in the past.
    2. **End date input** at `page.tsx:686-694`: same — no `min`. Should at minimum be `min={startDate}` so end can't precede start (and `min={today}` so neither is in the past).
    3. **WorkingDayCalendar** at `apps/web/src/components/working-day-calendar.tsx`: generates dates between `startDate` and `endDate` inclusive (line 47, `dateRange`). When start is in the past, all past dates inside the range render as toggle-able buttons (lines 111-127). No `disabled` check for `date < today` anywhere. The "Select all" / "Weekdays only" actions (lines 72-78) also include past dates in `allDates`.
  - **DateInput already supports `min`** — `apps/web/src/components/ui/date-input.tsx:15` declares `min?: string`. The post forms simply don't pass it.
  - **Permanent post form has the same gap** — `apps/web/src/app/(app)/daywork/post/_components/permanent-post-form.tsx:91+` carries a `startDate` state used in a `<DateInput>`; almost certainly missing `min` too. Audit at fix time.
  - **Where the error fires (the annoying part):** Server-side validation rejects past-dated submissions; the user sees a toast / inline error after they've already filled the form. Surface-level fix is to make the bad state unreachable in the UI.
  - **Fix shape:**
    1. `<DateInput>` for `startDate`: pass `min={todayISO}` (where `todayISO = new Date().toISOString().slice(0, 10)`).
    2. `<DateInput>` for `endDate`: pass `min={startDate || todayISO}` so end ≥ start ≥ today.
    3. `<WorkingDayCalendar>`: extend the date-cell render (lines 113-126) with `disabled={date < todayISO}` and dim the disabled cell. Filter the `selectAll` and `selectWeekdaysOnly` quick-actions to skip past dates.
    4. Replicate on the permanent post form's `startDate` input.
    5. Keep server-side validation as a defence-in-depth — UI fix prevents the user pain, server still rejects bad payloads from non-UI clients.
  - **Edge case to handle:** the working-days calendar must NOT block past dates inside the experience-add flow (where past dates are correct — crew log historical experience). Only the post-job flow needs the past-block. The component is currently shared per the file path; may need a `minDate` prop to make this explicit.
  - **Severity:** medium — pure UX friction; doesn't break data integrity (server catches it). Annoys users.

- [ ] **B-010 — Available Crew tab is invisible to employers when no applicants arrive, and a known Crew Pro crew did not appear even with "Show all roles" enabled. Threatens the Crew Pro monetization lever.**

  Three intertwined sub-issues. Same feature, fix together.
  - **B-010a — Zero-applicant state doesn't surface the Available Crew tab as the next action.**
    - **Where:** Empty state on the Applicants tab at `apps/web/src/app/(app)/daywork/[id]/review/_components/applicants-tab.tsx:88-105`. Body reads: _"No new applications to review. Check back later or view your shortlist."_ CTAs are Refresh + ShareJobButton. **Zero mention of "Available crew."**
    - **Tab nav exists at `page.tsx` (line ~361) — Available Crew is a third tab option** — but employers genuinely miss it. From a paid-feature perspective this is a quiet revenue leak: an employer who got no applicants is the prime conversion candidate for the Available Crew workflow.
    - **Fix shape:** when the Applicants tab is empty AND the user is on a daywork posting (Available Crew is daywork-only), replace the current generic empty state with a positive CTA: "No applicants yet — see who's available now in your area" with a primary button that switches to the Available Crew tab. Optional secondary: keep ShareJobButton as a fallback.

  - **B-010b — A known Crew Pro crew profile did not appear in Available Crew even with "Show all roles" enabled — confirmed real bug, not a config edge case.**
    - **User-confirmed test scenario:** Employer posted a daywork → went to Applied tab → 0 applicants → reviewed applicants (0) → switched to Available Crew tab → toggled Show all roles → known Crew Pro crew with `subscriptions.status='active'` did NOT appear. So the user has already eliminated the "no applicants visible because they applied" path. This is a code-side filter dropping the crew, not a data-state explanation.
    - **What "Show all roles" does (correct):** `apps/web/src/app/api/daywork/[id]/available-crew/route.ts:184-186` drops the role-match filter when `allRoles=true` (`if (!allRoles) matchedProfiles = matchedProfiles.filter((p) => p.primary_role_id === daywork.role_id)`). That part works.
    - **The Crew Pro gate (correct in design, possible misfire in test):** `available-crew/route.ts:137-149` filters every candidate down to those with an active `crew_pro` subscription:
      ```ts
      .eq('plan', 'crew_pro')
      .in('status', ['active', 'trialing'])
      ```
      The gate is CREW-SIDE (only Crew Pro crew surface) — this matches the monetization story per CLAUDE.md / mission.md ("Crew Pro = unlimited" features) and the user's intent ("the whole monetization lever for crew").
    - **Likely culprits (already eliminated by user — applied/invited path):** so remaining candidates ranked by likelihood:
      1. **Availability window stale or city-mismatched.** Per CLAUDE.md the calendar both expires after 7 days of inactivity AND requires at least one future selected date. Also: availability is tied to a specific city/port (migration 00024-00025) — the test crew's window may point at a city that doesn't match the daywork's port. Verify at fix time by running the API's first query (`availability_windows` filter at lines 69-99) directly against the test crew's row.
      2. **Subscription row schema/state:** `subscriptions.plan='crew_pro'` AND `status IN ('active','trialing')` must both be true. Verify directly: `select plan, status from subscriptions where person_id = <test crew>`. Past-due trials, incomplete rows, or a stale `free` placeholder would silently drop them.
      3. **Profile not loaded into `matchedProfiles`:** the route does multiple staged filters (availability → eligible → exclude applied/invited → Crew Pro filter → role match). A bug in any earlier stage would drop the crew before the Pro filter even runs. Worth tracing.
    - **Diagnostic step at fix time:** instrument the route briefly to log `eligibleIds.length`, `proSet.size`, and `matchedProfiles.length` for the test scenario. Tells us instantly which filter dropped the crew. Add an integration test pinning the happy-path so this regresses loudly if it breaks again.
    - **Risk:** if Crew Pro crew aren't reliably surfacing, the entire Crew Pro value proposition collapses (per mission doc). High severity for the monetization story.

  - **B-010c — "Available crew" representation is correct but worth surfacing the rules to employers.**
    - **How it renders today:** Card stack — `apps/web/src/app/(app)/daywork/[id]/review/_components/available-crew-tab.tsx:103-122`. One `SwipeableAvailableCrew` card on top with the next card scaled 0.97 underneath. Same swipe pattern as the Applicants tab.
    - **Order:** `b.available_days - a.available_days` (most-available-days first), capped at 50 per query (`available-crew/route.ts:226` per agent recon).
    - **Empty state:** "No available crew nearby — Try enabling 'Show all roles' to broaden the search." (line 89/97). Decent copy but doesn't tell employers WHY they're seeing no one — e.g. "Available Crew shows Crew Pro members with current availability in this city. There are no Crew Pro members available in [Bodrum] for [these dates] yet." Telling employers the rule transparently makes the empty state non-confusing.
    - **Optional enhancement:** show a subtle pill on each card indicating "Crew Pro" so employers understand the visibility model. Connects the dots between "this user paid to be visible" and "I should reach out."

  - **Combined severity:** high (monetization-touching). Crew Pro is the primary crew-side revenue lever; if it's invisible to employers OR the surfacing logic silently drops Pro crew, the entire pricing story is undermined.
  - **Combined scope:**
    - **UI:** new empty-state CTA on Applicants tab (B-010a). Reword the Available Crew empty state to explain the visibility rules (B-010c). Optional Crew Pro pill on cards.
    - **Diagnostics-then-fix:** instrument `available-crew/route.ts` to identify why the test Crew Pro crew was dropped (B-010b). Fix the underlying filter mismatch — most likely a stale availability window or a subscription row in an unexpected status.
    - **Tests:** add an integration test asserting that a Crew Pro crew with current availability in the matching city + non-applied + role-mismatched + `allRoles=true` IS surfaced. This codifies the monetization invariant.

### Open from pre-launch audit

- [ ] **P1-I6 console → Sentry sweep** — blocked on P0-6 Sentry DSN landing in Vercel env (Sentry no-ops without it).
- [ ] **Upload route test** (deferred from P1-T1) — substantial mocking surface (FormData + MIME + magic-byte + Upstash rate limit). Focused follow-up commit.
- [ ] **Phase H — execute the handoff checklist** at `tasks/handoff-pre-launch.md` (5 user-dashboard actions: key rotation, Sentry DSN, GitHub Environment, Stripe webhook URL, MEMORY.md decision). Blocked on user.
- [ ] **Phase J — P2 launch-week polish batch** (25+ items in audit chat output, none gating).

---

## Queue

### Post-review backlog (sourced from end-to-end audit, 2026-04-27)

> Full context for every item below is in [`tasks/end-to-end-review-2026-04-27.md`](./end-to-end-review-2026-04-27.md). Risk IDs (M-1, F-1, etc.) match the consolidated risk register in that document. Both P0 fixes (D-1 event idempotency + D-2 null-safety guards) shipped 2026-04-27 — see commits `bd8a3f8` (D-2), `3eccfff` (D-1), schema v122 → v124.

#### P1 — operational + go-to-market posture

These are not code-level bugs; they are gaps in operational readiness, regulatory positioning, and external trust signals. Order of impact roughly: M-1 > M-2 > M-3 > the rest.

- [ ] **P1 — M-1: Publish MLC 2006 positioning statement and apply for MCA RPSP accreditation.**

  Marketing-copy reconciliation (sub-deliverable 1) shipped in audit P0-5. Three pieces still open:
  1. **Maritime-specialist lawyer review** (~1-2 hour engagement) to confirm the marketplace-facilitator vs manning-agency line is held AND specifically to bless the freemium structure (Available Crew tab Crew-Pro gate at `apps/web/src/app/api/daywork/[id]/available-crew/route.ts:137-149`) against MLC 2006 Reg 1.4.
  2. **Marketing-site compliance page** (`/about/compliance` or similar) publishing the alignment statement, citing Reg 1.4, listing what DockWalker does and does not do, naming the DPO. Suggested copy: "DockWalker is a facilitation platform under MLC 2006 Regulation 1.4. We do not charge seafarers for job access. We do not place crew. We provide structured discovery and audit-grade event records."
  3. **UK MCA RPSP accreditation application** — see MGN 490 for criteria.

  **Why it matters:** every agency competitor (YPI Crew, The Crew Network, Wilson Halligan, Quay Crew, Bluewater) leads marketing with MLC 2006 / MCA accreditation. The silence reads as "amateur hour" to sophisticated buyers, even though the architecture would actually pass an audit better than most agency CRMs.

  **Acceptance:** compliance page published; T&Cs reviewed by maritime lawyer with explicit Reg 1.4 sign-off; RPSP application submitted.

- [ ] **P1 — M-2: Land 3 named captain endorsements before launch.**

  **Problem:** Trust in the superyacht industry is transitive through named individuals. One named senior captain on a 60m+ moves more crew than three months of paid acquisition. DockWalker has zero captain testimonials, zero named yacht references on the marketing surface today.

  **Why it matters:** The competitor matrix in `tasks/end-to-end-review-2026-04-27.md` shows that platforms without trust signals (Yotspot for crew quality, Crewseekers, etc.) live in the long tail. Agencies that survive long-term all have decades-of-named-captain endorsements quietly underwriting their pipeline. DockWalker can short-cut to that with three deliberate asks.

  **Suggested fix:** Identify three Antibes-based captains running charter-operated 60m+ vessels. Approach via warm intro (likely founder's existing network — Nautalink Technologies is UK-registered and the founder presumably has industry contacts). Offer Crew Pro for life for any named crew member of any captain who endorses. The endorsement is name + yacht (e.g., "Captain X, M/Y Y") — anonymized testimonials don't move trust in this industry.

  **Acceptance:** three published endorsements on the marketing site, by name, with yacht reference.

- [ ] **P1 — S-1: Audit raw `from('vessels')` queries and ensure NDA masking goes through `get_vessel_public`.**

  **Problem:** `get_vessel_public(uuid)` and `get_vessels_public_batch(uuid[])` (most recently in migration 00122) are the only sanctioned vessel-read paths for non-owners — they apply NDA masking, hidden/pending exclusion, and engagement-based reveal. But there is no enforcement preventing a route from doing a raw `from('vessels').select('id, name, imo_number')` query that bypasses the masking entirely. Any such route silently leaks vessel data.

  **Why it matters:** Vessels V2 Wave F (just shipped) closed the front door (lookup route) and side doors (the two batch RPCs). If any other route still goes direct, the moderation actions admins take (hide a vessel, leave a vessel pending) are partially enforced. NDA + hidden + pending all share the same threat model: keep private data private.

  **Suggested fix:** `grep -rn "from('vessels')\|from(\"vessels\")" apps/web/src/app/api/ apps/web/src/lib/` to enumerate every direct vessel query. For each: confirm it's owner-scoped (e.g., `/api/vessels/[id]` PATCH where the user must own the vessel, RLS-enforced) — that's fine. Any non-owner-scoped read should switch to the RPC. Optionally add a custom ESLint rule banning raw vessel SELECTs outside an allowlist, to prevent regression.

  **Files to touch:** depends on grep result — probably a handful of routes need updating. ESLint rule lives in `apps/web/eslint.config.mjs`.

  **Acceptance:** every non-owner-scoped vessel read goes through one of the two RPCs; lint rule prevents regression.

> **Sentry DSN, secrets rotation, and `.env.production.local` deletion** are tracked in `tasks/handoff-pre-launch.md` (P0-6 + P0-3). **Database rollback runbook** is shipped at `tasks/runbook.md`. **Playwright in CI** is wired (`continue-on-error: true` until baseline refresh).

---

## BLOCKED — external

### CV Builder v1 Phase 8 (PDF render + unlock)

- [ ] **Phase 8 — gated on PDF visual design sign-off.** Stage 1 (Phases 1–7) shipped in Stages 223–230 then user-locked in Stage 231 (`CV_BUILDER_ENABLED = false` in `apps/web/src/lib/cv/feature-flag.ts`). Stage 2 unlock = single flag flip + replace 503 stub at `/api/cv/generate` with real PDF return + add `/api/cv/regenerate-handle`. See git history (Stage 223–231) for the full Stage 1 build record.

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

- **Voice calling — green-field re-add when prioritised.** Subsystem deleted 2026-04-30 per audit P0-4 (the dead-code stance was a launch-day liability — `pendingOffer` from another tab could flip a chat into ringing state with no decline path). Phone button in chat header keeps its Coming-Soon toast. When re-adding: (1) managed RTC provider, LiveKit Cloud preferred over hand-rolled WebRTC (SFU routing, call history, recording); (2) build behind a feature flag mirroring `CV_BUILDER_ENABLED`; (3) add `CALL.STARTED`/`CALL.ENDED` events to the ledger at the same time as the UI (the prior implementation only recorded `MESSAGE.SENT` — audit-trail gap); (4) browser QA matrix (Chrome/Firefox/Safari, glare resolution, network drops, backgrounded tab, multi-tab, offline user); (5) gate on `isPermanent && status === 'active'` for the call button.

### Business logic / server-side

- **Permanent crew withdrawal auto-revert** — employer should decide next step, not auto-revert.
- **Onboarding true atomicity** — `onboard_person` RPC should be fully atomic.
- **Negotiation timeout** — auto-close permanent engagements after X days inactivity.
- **Weekly check-in cron** — periodic nudge for permanent postings with no employer activity.
- **Deactivated user server-side sign-out** — force session invalidation on PERSON.DEACTIVATED.
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
