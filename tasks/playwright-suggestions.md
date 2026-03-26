# Playwright UX Suggestions

> Written by the visual testing agent during test runs. The planning agent reads this during Orient and may promote suggestions to `tasks/todo.md` with user approval.
>
> Format: one suggestion per entry. Include what was observed, what the suggestion is, and why it matters from a user's perspective.

## Pending

### SUG-001 — Crew review page shows employer-only "Failed to load applicants" error (2026-03-26T16:45)

**Observed:** When crew (c@1) navigates to `/daywork/[id]/review` for ANY daywork posting (DW-04 applied, DW-05 shortlisted, DW-06 in-progress, DW-02 NDA), the page shows the employer's applicant review UI with "Failed to load applicants. Please try again." The crew bottom nav is visible, confirming they're authenticated as crew.

**Suggestion:** The `/daywork/[id]/review` route needs role-based rendering. Crew should see their own application/engagement status (applied, shortlisted, accepted, in-progress with checklist, etc.), not the employer's applicant review tabs. Currently the page serves the employer component regardless of hat, and the API correctly blocks crew, resulting in the error.

**Impact:** HIGH. Crew cannot review the status of any daywork engagement from the review page. The only way to see engagement details is through the message thread. This blocks the crew's ability to track their own applications.

---

### SUG-002 — Agent profile shows "1 Issue" error banner (2026-03-26T17:10)

**Observed:** The agent (a@1) profile page shows a red "1 Issue" banner at the top of the page. Same banner appears on the agent vessels page and the crew-alt (g@1) profile page.

**Suggestion:** Investigate what "1 Issue" refers to. Likely a profile completeness check flagging something the agent is missing (possibly a field that's required for crew but not relevant for agents). If it's a profile completeness warning, agent-specific profiles should have their own completeness criteria (agency_name, not certs/availability).

**Impact:** MEDIUM. A persistent red error banner on the agent's primary profile page looks broken. Agents will assume something is wrong. If it's a false positive from crew-oriented validation, it undermines trust in the platform.

---

### SUG-003 — Crew discover page shows "Complete your profile" banner + "No jobs found" (2026-03-26T17:10)

**Observed:** Crew (c@1) discover page shows two issues simultaneously: (1) a "Complete your profile to start applying" banner even though c@1 has a fully seeded profile with role, certs, and experience, and (2) "No jobs found" empty state despite 5 active daywork postings existing in the seed data (DW-01 through DW-05).

**Suggestion:** The profile completeness check may be too aggressive — c@1 has `display_name: "Profile Two"` which might trigger the "looks like email prefix" check since it has no space... wait, it does have a space. Investigate the exact completeness logic. The "No jobs found" despite active postings suggests a filter mismatch — possibly location/availability filtering is too restrictive, or the seed data dates have expired relative to today.

**Impact:** HIGH. If a fully-seeded crew member sees "No jobs found" when jobs exist, and a "complete your profile" prompt when their profile IS complete, the app appears broken. This is the core crew experience — job discovery.

---

### SUG-004 — Employer message thread shows loading spinner, never loads (2026-03-26T17:10)

**Observed:** When the employer (e@1) clicks into a message thread from the messages list, the thread page shows an infinite loading spinner. The "Type a message..." input is visible at the bottom but the message content never renders. The crew (c@1) message thread loads fine and shows the full conversation with checklist and messages.

**Suggestion:** The employer's message thread rendering has a bug — either the engagement ID resolution or the message fetch is failing silently. Compare the employer and crew message thread API calls to find the divergence.

**Impact:** HIGH. Employer cannot read or send messages in any engagement thread. This blocks the core post-acceptance communication flow for the employer side.

---

### SUG-005 — Employer review pages show "No applicants to review" for postings that HAVE applicants (2026-03-26T17:10)

**Observed:** DW-05 (shortlisted applicant) shows "Shortlist (1)" tab count but the Applicants tab says "No applicants to review." DW-07 (completed), DW-09 (cancelled by crew), DW-10 (cancelled by employer) all show "No applicants to review" despite having had applicants/engagements. Even DW-01 (which has an invited crew member) shows empty.

**Suggestion:** The applicant list on the review page may be filtering too aggressively — possibly only showing applicants in `applied` state and hiding those who have moved to shortlisted/accepted/completed. For completed/cancelled engagements, the review page should show the historical applicant data, not filter it away. The Shortlist tab correctly shows "(1)" for DW-05, suggesting the data exists but isn't surfacing on the Applicants tab.

**Impact:** MEDIUM. Employer can navigate to the Shortlist tab to find shortlisted candidates, but the Applicants tab appears empty even when applicants exist in other states. For historical postings (completed, cancelled), there's no way to see who was involved.

---

### SUG-006 — "1 Issue" / "2 Issues" error banner appears on crew-alt and agent pages (2026-03-26T17:10)

**Observed:** The crew-alt (g@1) profile and discover pages show "1 Issue" red banner. The employer messages and employer message thread pages show "2 Issues" red banner. This appears to be a Next.js development-mode error overlay, not an app-level UI element.

**Suggestion:** These are likely React hydration errors or console errors being surfaced by Next.js dev mode. They won't appear in production but indicate underlying issues that should be fixed. The testing agent should note: in a production build, these banners would be hidden, but the underlying errors may still cause subtle rendering bugs.

**Impact:** LOW for production (banner hidden), but the underlying errors could cause issues. Worth investigating what the "issues" are — likely hydration mismatches or client/server rendering differences.

---

### SUG-007 — Billing page shows "Crew Pro" subscription tier to employer (2026-03-26T17:10)

**Observed:** The employer (e@1) billing page shows "Free" current plan and "Crew Pro" as the upgrade tier with crew-oriented benefits ("Unlimited questions", "Personalised career advice", "Priority responses"). These are Docky AI benefits aimed at crew, not employer features.

**Suggestion:** The billing page should be role-aware. Employers should either see employer-specific tier benefits (if any exist) or not see the Crew Pro upsell at all. Showing "Crew Pro" to an employer is confusing and irrelevant. Per the mission doc, employer monetization is deferred to Phase 2 (shortlist cap tiers), so for now employers should see a different billing page or no upsell.

**Impact:** LOW (billing is not revenue-critical at launch) but it's a polish issue that makes the app feel unfinished. An employer seeing "Crew Pro" will wonder if they're on the wrong page.

---

### SUG-008 — Agent bottom nav missing Docky icon (2026-03-26T17:10)

**Observed:** Comparing bottom navs: Crew has (Discover, Messages, Docky, Profile), Employer has (Post Job, My Jobs, Messages, Profile), Agent has (Post Job, My Jobs, Messages, Profile). Agent bottom nav uses a plain chat bubble icon for Messages instead of the Messages icon with notification badge that employer has. More notably, agents have no access to Docky from the bottom nav.

**Suggestion:** This may be intentional (agents are volume users focused on posting, not career advice), but worth confirming. If agents should access Docky, add it. If not, no action needed — just documenting the observation.

**Impact:** LOW. Design decision, not a bug.

---

### SUG-009 — Employer notifications empty despite having active engagements (2026-03-26T17:10)

**Observed:** Employer (e@1) has 10 daywork postings, multiple applications, messages, and active engagements — but the notifications page shows "No notifications yet." The bottom nav shows a "4" badge on Messages, indicating unread items exist, but none are reflected in notifications.

**Suggestion:** Either notifications aren't being generated from events (application received, message sent, work started, etc.) or the notification query is filtering them out. Given the seed data has extensive engagement activity, there should be notifications.

**Impact:** MEDIUM. Notifications are the primary way employers discover new applications and messages without actively checking each posting. If notifications aren't generated, employers miss time-sensitive applications.

### SUG-011 — Cancel posting shows toast but no confirmation modal (2026-03-26T18:00)

**Observed:** When employer clicks "Cancel" on an active daywork posting (DW-01), a "Posting cancelled" toast appears immediately over the card. There is no confirmation dialog — the action is instant and irreversible. The active count drops from 5 to 3 (DW-01 was cancelled during this test run, visible in screenshot).

**Suggestion:** Cancelling a posting is destructive — it notifies all applicants and removes the job from discovery. This should have a confirmation modal ("Are you sure? X applicants will be notified.") before executing. The toast-only feedback gives no chance to undo a misclick.

**Impact:** HIGH. An accidental tap on "Cancel" (which is right next to "Review applicants") permanently cancels a posting. On mobile touch targets this is a real risk.

---

### SUG-012 — Daywork form validation uses browser-native tooltip, not styled errors (2026-03-26T18:00)

**Observed:** Submitting an empty daywork form triggers the browser's native "Please fill out this field" tooltip on the Start date input. No styled inline validation errors appear. The form relies entirely on HTML5 `required` attributes and native browser validation rather than custom error messages.

**Suggestion:** Replace browser-native validation with styled inline errors that match the app's design system. Native tooltips are inconsistent across browsers, don't persist, and don't tell the user which OTHER fields are also missing. A proper validation pass should highlight all missing required fields simultaneously.

**Impact:** MEDIUM. The form technically prevents empty submission, but the UX is rough — users see one error at a time, native browser styling, and no clear list of what needs fixing.

---

### SUG-013 — Invalid daywork/vessel URLs show "Failed to load applicants" instead of 404 (2026-03-26T18:00)

**Observed:** Navigating to `/daywork/00000000-0000-0000-0000-000000000000/review` (non-existent UUID) shows the review page with "Failed to load applicants. Please try again." — same error as the crew role-gating issue (SUG-001). A garbage non-UUID URL (`/daywork/not-a-uuid/review`) shows the same error for crew.

**Suggestion:** The review page should check if the daywork posting exists before rendering the applicant UI. If the posting doesn't exist, show a proper "Posting not found" page or redirect to `/daywork/mine`. Currently it renders the full review chrome and then errors on the API call.

**Impact:** LOW (users rarely type URLs manually) but indicates the review page has no existence check — it always renders and lets the API call fail.

---

### SUG-014 — Crew invitations tab shows "No pending invitations" despite seed having DW-01 invitation (2026-03-26T18:00)

**Observed:** Crew (c@1) discover page has an "Invitations (1)" tab count, but clicking into it shows "No pending invitations." The tab counter says 1 but the content is empty. The seed data (003_advanced_scenarios.sql) creates a `DAYWORK.INVITED` event for c@1 on DW-01.

**Suggestion:** The invitations tab count and content are sourced from different queries or the invitation data is being filtered out. The count query sees the invitation but the list query doesn't return it. This is either a projection bug or a filter mismatch (possibly filtering by date/expiry).

**Impact:** MEDIUM. The "(1)" badge creates an expectation that clicking the tab will show something. Empty content after a badge count is a broken promise that erodes trust.

---

### SUG-015 — Crew applied tab shows "No pending applications" despite having 8 active applications in seed (2026-03-26T18:00)

**Observed:** Crew (c@1) has applications on DW-04, DW-05, DW-06, DW-07, DW-08, DW-09, DW-10 plus permanent applications PM-02 through PM-05. The "Applied (8)" tab count on discover shows these exist, but clicking into the Applied tab shows "No pending applications."

**Suggestion:** Same pattern as SUG-014 — the tab count and tab content use different data sources. The count is correct but the list query returns nothing. Likely the list query filters by a status or date range that excludes all current applications.

**Impact:** HIGH. Crew cannot see any of their application history from the discover page. This is a core crew feature — tracking what you've applied to.

---

### SUG-016 — Employer not redirected from /discover — sees crew feed (2026-03-26T18:30)

**Observed:** Employer (e@1) navigates to `/discover` and is NOT redirected to `/daywork/mine`. The page renders the crew discover feed with "No jobs found" and the employer bottom nav (Post Job, My Jobs, Messages, Profile). The middleware in `middleware.ts` should redirect non-crew hats away from `/discover`.

**Suggestion:** The middleware redirect for employer→`/daywork/mine` on `/discover` is not firing. The employer can see the crew discover page which shows the "Complete your profile" banner and job feed (empty). Per CLAUDE.md: employer hat cannot see the crew discover feed. This is a business rule violation at the middleware layer.

**Impact:** HIGH. Employer can see crew-oriented UI and potentially interact with it. The discover page was designed exclusively for crew job browsing.

---

### SUG-010 — Daywork and permanent post forms use different UI patterns for certs and languages (2026-03-26T17:30)

**Observed:** Daywork post form uses checkboxes in a scrollable container (`max-h-40 overflow-y-auto`) for both certifications and languages. Permanent post form uses toggle pills (`rounded-full` buttons with accent color fill) in a flex-wrap layout for the same fields. Same data, same user, two different interaction patterns.

**Suggestion:** Unify cert and language selectors across both forms. The permanent form's `RequirementsSection` component in `permanent-form-sections.tsx` is already extracted and reusable — the daywork form could adopt it, or a shared component could be created. The pill pattern is arguably better for mobile (larger touch targets, visual state clarity) but the choice should be consistent.

**Impact:** MEDIUM. Not a functional bug — both work. But an employer who posts a daywork job and then a permanent job encounters two different UIs for the same selection task. This erodes the feeling of a polished, cohesive product.

---

### SUG-017 — Edit experience page shows "Unknown vessel" instead of actual vessel name (2026-03-26T19:00)

**Observed:** When crew (c@1) navigates to `/profile/edit-experience/aa000000-...001` (their Deckhand experience on S/Y Wanderer), the page header shows "M/Y Unknown vessel" instead of "S/Y Wanderer." All other fields are correctly pre-filled (role: Deckhand, operation: Charter, flag: GBR, dates, description).

**Suggestion:** The vessel name lookup on the edit experience page is failing silently. The vessel ID is stored on the experience record but the join/lookup to resolve the vessel name is returning null. The vessel type prefix also shows "M/Y" when S/Y Wanderer is a sail vessel — suggests a default fallback rather than actual data.

**Impact:** MEDIUM. The experience can still be edited and saved, but the user sees "Unknown vessel" which is confusing and could lead them to think their data was lost. If they re-save without noticing, the vessel reference might get corrupted.

---

## Accepted

_Suggestions promoted to `tasks/todo.md` move here with a link._

## Rejected

_Suggestions reviewed and declined move here with a reason._
