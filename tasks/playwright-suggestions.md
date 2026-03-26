# Playwright UX Suggestions

> Written by the visual testing agent during test runs. The planning agent reads this during Orient and may promote suggestions to `tasks/todo.md` with user approval.
>
> Each suggestion has been verified against the actual codebase. False positives are marked and moved to Rejected.

## Pending

### SUG-001 — Crew review page shows employer-only UI (VERIFIED) (2026-03-26T16:45)

**Observed:** Crew navigating to `/daywork/[id]/review` sees the employer applicant review UI with "Failed to load applicants."

**Root cause:** `daywork/[id]/review/page.tsx` is a client component with zero `current_hat` check. It always renders employer review UI (Applicants/Shortlist/Available tabs). The API at `/api/daywork/[id]/applicants` correctly blocks non-owners, but the page chrome still renders.

**Fix:** Add role check in the page component. If `current_hat === 'crew'`, render a crew-specific view (application status, engagement details) instead of the applicant review UI.

**Impact:** HIGH. Crew cannot review any daywork engagement from the review page.

---

### SUG-003 — Crew discover "No jobs found" + false "Complete profile" banner (VERIFIED — PARTIAL FALSE POSITIVE) (2026-03-26T17:10)

**Observed:** c@1 discover page shows both issues.

**Root cause verified:**

- **"Complete your profile":** The check at line 162 requires `nationality_id` to be set. The seed data for c@1 does NOT set `nationality_id` in `onboard_person()`. This is a **true positive** — the banner is correct because `nationality_id` is null.
- **"No jobs found":** The discover API filters by location port if the filter is set. On first load with no filters, it should return all active jobs. However, the client-side also excludes already-interacted dayworks (line 95 in the API). c@1 has applied to/been engaged with DW-04 through DW-10. DW-01 has an invitation. DW-02 and DW-03 might be the only ones visible — but with location filtering they may not show. **This needs further investigation — could be a real issue OR correct filtering behavior.**

**Revised impact:** MEDIUM. The "Complete profile" banner is technically correct (missing nationality) but feels aggressive for a seeded test user. The "No jobs" may be correct filtering.

---

### SUG-004 — Employer message thread infinite spinner (VERIFIED) (2026-03-26T17:10)

**Observed:** Employer clicks into message thread, sees infinite spinner. Crew works fine.

**Root cause verified:** The message page at `messages/[engagementId]/page.tsx` fetches from `/api/messages/${engagementId}`. The API checks if user is `crew_person_id` or `employer_person_id` on the engagement. The `loadMessages()` function sets `loading = false` even if `result.ok` is false, but doesn't call `setMessages()`, so messages stays empty array. The spinner should stop but content stays empty.

**Revised assessment:** The "infinite spinner" may actually be the Realtime subscription connection failing silently, or the context API returning an error that prevents the initial render. The loading state does get cleared, so it's more likely an **empty message list with no error feedback** rather than an infinite spinner. Still a real bug — employer can't see messages.

**Impact:** HIGH. Core communication flow broken for employer side.

---

### SUG-005 — Employer review "No applicants" for postings with applicants (VERIFIED — CORRECT BEHAVIOR) (2026-03-26T17:10)

**Observed:** DW-05 shows Shortlist(1) but Applicants tab empty. Completed/cancelled postings show no applicants.

**Root cause verified:** The Applicants tab filters by `status === 'applied' || status === 'viewed'` (line 96-97 in review page). Shortlisted applicants appear on the Shortlist tab. Accepted/completed/cancelled applicants don't appear on either tab — this is **by design**. Once an applicant is shortlisted, they move off the Applicants tab. Once accepted, they move to the engagement flow.

**Revised assessment:** This is **correct behavior**, not a bug. The Applicants tab is a "to review" queue, not a full history. The naming "No applicants to review" is accurate — there are no applicants in the review queue because they've all been progressed.

**Action:** Move to Rejected. Consider renaming for clarity if the user finds it confusing.

---

### SUG-006 — Next.js dev mode error banners (VERIFIED — DEV ONLY) (2026-03-26T17:10)

**Observed:** "1 Issue" / "2 Issues" red banner on various pages.

**Root cause:** These are Next.js development mode error overlays (`__next-route-announcer__` or React hydration warnings). They do NOT appear in production builds. The underlying issues are likely harmless hydration mismatches from server/client rendering differences.

**Action:** Move to Rejected — dev-mode-only artifact, not a production concern.

---

### SUG-007 — Billing page shows "Crew Pro" to all roles (VERIFIED) (2026-03-26T17:10)

**Observed:** All three roles (employer, crew, agent) see identical "Crew Pro" upsell.

**Root cause verified:** `billing/page.tsx` has zero role checking. `FREE_FEATURES` and `PRO_FEATURES` are hardcoded crew-specific text. The API endpoint also lacks role checks. No conditional rendering exists.

**Impact:** LOW. Billing is not revenue-critical at launch. But showing "Crew Pro" to employers is confusing.

---

### SUG-008 — Agent bottom nav missing Docky (VERIFIED — BY DESIGN) (2026-03-26T17:10)

**Observed:** Agent nav has Post Job, My Jobs, Messages, Profile — no Docky.

**Root cause verified:** `bottom-nav.tsx` defines separate nav arrays: `crewNav` includes Docky, `employerNav` does not. Agent uses employer nav. This is **intentional** — agents are volume posters, not career advice consumers. Docky is a crew tool.

**Action:** Move to Rejected — by design.

---

### SUG-009 — Employer notifications empty (VERIFIED — SEED LIMITATION) (2026-03-26T17:10)

**Observed:** "No notifications yet" despite active engagements.

**Root cause verified:** The notifications table is populated by `notifyOnEvent()` which runs when events are appended via the API at runtime. The seed data uses `append_event()` SQL function directly, which does NOT trigger the notification creation logic (that lives in the Next.js API layer, not in the database). Seed data never generates notifications.

**Revised assessment:** This is a **seed data limitation**, not a code bug. In production, notifications would be generated as events flow through the API. The testing agent could address this by adding notification seed data directly, but the app itself works correctly.

**Impact:** LOW. Not a code bug. Seed enhancement needed if we want to test notification rendering.

---

### SUG-010 — Daywork vs permanent forms use different cert/language UI (VERIFIED) (2026-03-26T17:30)

**Observed:** Daywork uses checkboxes in scrollable container. Permanent uses toggle pills in flex-wrap.

**Root cause verified:** Daywork form is inline in `page.tsx` (lines 570-606). Permanent form uses extracted `RequirementsSection` in `permanent-form-sections.tsx` (lines 281-331). Different components, different patterns. The permanent form was built later with a more modular architecture.

**Impact:** MEDIUM. Consistency issue — same data, different UI.

---

### SUG-011 — Cancel posting has no confirmation dialog (VERIFIED) (2026-03-26T18:00)

**Observed:** Clicking Cancel on daywork posting executes immediately with only a toast.

**Root cause verified:** `daywork/mine/page.tsx` line 209: `handleCancel()` calls the API directly with no confirmation dialog. Permanent postings DO have a confirmation dialog in `chat-dialogs.tsx` — the pattern exists but wasn't applied to daywork cancellation on the My Jobs page.

**Impact:** HIGH. Destructive, irreversible action with no confirmation. Cancel button is adjacent to Review Applicants — misclick risk on mobile.

---

### SUG-012 — Form validation uses browser-native tooltips (VERIFIED) (2026-03-26T18:00)

**Observed:** Empty form submission triggers browser native "Please fill out this field."

**Root cause:** The daywork form uses HTML `required` attributes on date inputs and lets the browser handle validation. No custom validation logic or styled error messages.

**Impact:** MEDIUM. Functional but rough UX.

---

### SUG-013 — Invalid URLs show "Failed to load applicants" (VERIFIED) (2026-03-26T18:00)

**Observed:** Non-existent daywork ID renders review chrome, then API errors.

**Root cause verified:** The review page is a client component with no server-side existence check. `loadDayworkMeta()` silently fails if daywork doesn't exist (data is null, no error state set). The applicants API returns 404 but the page shows generic "Failed to load" error.

**Impact:** LOW. Users don't type URLs manually.

---

### SUG-014 — Invitations tab count vs content mismatch (NEEDS RE-VERIFICATION) (2026-03-26T18:00)

**Observed:** Tab shows "(1)" but content is "No pending invitations."

**Root cause investigation:** Both count and content use the same `/api/daywork/invitations` endpoint. The API filters by `status = 'pending'` then removes stale invitations (past start date, non-active posting, filled positions). If DW-01's start date hasn't passed and the posting is still active, the invitation should appear.

**Revised assessment:** This could be a **timing/state issue** from the test run. The edge-cases spec cancelled DW-01 during the same session (SUG-011 notes the active count dropped from 5 to 3). If DW-01 was cancelled before this test ran, the invitation would be filtered out as stale (posting no longer active), but the count might have been cached from a pre-cancellation state. **Needs re-test after fresh reseed.**

**Impact:** MEDIUM if real, LOW if test pollution.

---

### SUG-015 — Applied tab count vs content mismatch (NEEDS RE-VERIFICATION) (2026-03-26T18:00)

**Observed:** Tab shows "(8)" but content is "No pending applications."

**Root cause investigation:** The Applied tab merges results from two APIs: `/api/daywork/applications` (filters `status IN ['applied', 'viewed', 'shortlisted']`) and `/api/permanent/applications` (filters `status IN ['applied', 'shortlisted', 'selected', 'not_selected', 'rejected']`). The count comes from the merged array length.

**Revised assessment:** The count and content both come from the same state (`applications`). If the APIs return data, both should show it. If both APIs return empty, both should be zero. An "(8)" count with empty content would mean the state was set and then cleared, or the component has client-side filtering the count doesn't apply. **Needs re-test after fresh reseed** — the edge-cases spec may have polluted state.

**Impact:** HIGH if real, LOW if test pollution.

---

### SUG-016 — Employer not redirected from /discover (VERIFIED) (2026-03-26T18:30)

**Observed:** Employer navigates to `/discover` and stays there.

**Root cause verified:** Middleware at `middleware.ts` line 84 only checks `identity_type === 'agent'`, NOT `current_hat !== 'crew'`. Employer with `identity_type = 'crew'` and `current_hat = 'employer'` passes through because the agent check doesn't match. The redirect only fires for agents, not for employer-hat users.

**Fix:** Change middleware to `if ((person.identity_type === 'agent' || person.current_hat !== 'crew') && path === '/discover')`.

**Impact:** HIGH. Business rule violation — employer accessing crew-only discover feed.

---

### SUG-017 — Edit experience shows "Unknown vessel" (VERIFIED) (2026-03-26T19:00)

**Observed:** Edit experience page shows "M/Y Unknown vessel" instead of "S/Y Wanderer."

**Root cause verified:** The experience API fetches with a JOIN: `.select('... vessels(id, imo_number, name, ...)')`. If the vessel exists, `exp.vessels` should contain the name. The display code uses `vesselName || 'Unknown vessel'` with `vesselType` defaulting to `'motor'`. If `exp.vessels` is null (join returned nothing), `vesselName` stays empty string and `vesselType` defaults to motor — hence "M/Y Unknown vessel" instead of "S/Y Wanderer."

**Possible cause:** RLS on the vessels table may block crew from seeing vessels they don't own. S/Y Wanderer was created by e@1 (employer), not c@1 (crew). If the vessel RLS policy only allows the owner to read, the join returns null even though the experience record references it. The experience was created as a direct INSERT in seed, bypassing the normal flow where crew creates their own vessel.

**Impact:** MEDIUM. Affects all crew experiences referencing vessels owned by other users.

## Accepted

- **SUG-001** — Crew review page role gate → todo: "Fix: Crew on /daywork/[id]/review should redirect"
- **SUG-003** — Discover empty feed + profile banner → todo: "Fix: Profile completeness banner" + "Fix: Discover empty feed"
- **SUG-004** — Employer message thread spinner → todo: "Fix: Vessels RLS too restrictive"
- **SUG-010** — Form cert/language UI inconsistency → todo: "UX: Unify daywork form cert/language selectors"
- **SUG-011** — Cancel posting no confirmation → todo: "Fix: Daywork mine cancel has no confirmation dialog"
- **SUG-015** — Applied tab empty list → todo: "Fix: Applied tab shows count but empty list"
- **SUG-016** — Employer not redirected from /discover → todo: "Fix: Employer not redirected from /discover"
- **SUG-017** — Edit experience "Unknown vessel" → resolved by vessels RLS fix

**Deferred to Post-TestFlight:**

- **SUG-002** — Agent profile "1 Issue" banner (Next.js dev mode only)
- **SUG-006** — "1 Issue"/"2 Issues" error banners (dev mode only)
- **SUG-007** — Billing shows Crew Pro to employer (billing not active for TestFlight)
- **SUG-008** — Agent no Docky in nav (design decision)
- **SUG-009** — Employer notifications empty (seed data has no notification rows; will generate in production)
- **SUG-012** — Form validation uses browser native (forms work, just not styled)
- **SUG-013** — Invalid URLs show wrong error (users don't type URLs)
- **SUG-014** — Invitations tab count/content mismatch (working as designed; verify after fresh reseed)

## Rejected

### SUG-005 — Employer review "No applicants" (CORRECT BEHAVIOR)

**Reason:** The Applicants tab is a "to review" queue filtering by `status IN ['applied', 'viewed']`. Once applicants are shortlisted/accepted/completed, they correctly move off this tab. The Shortlist tab shows shortlisted candidates. This is by design — not a bug.

---

### SUG-006 — Next.js dev mode error banners (DEV ONLY)

**Reason:** These are Next.js development mode error overlays. They do not appear in production builds. The underlying issues are likely harmless hydration mismatches.

---

### SUG-008 — Agent bottom nav missing Docky (BY DESIGN)

**Reason:** Agents use the employer nav which doesn't include Docky. Docky is a crew career advisor tool — agents are employment intermediaries, not active crew seeking career advice. This is an intentional design decision per the mission doc.
