# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

### Diagnose empty crew context — profile query failing silently

> Docky says "I don't have access to your profile" despite a full profile existing. `buildCrewContext()` returns empty when the profile query fails silently. Need to see the actual query error.

- [ ] Add `console.error` to `apps/web/src/lib/advisor/crew-context.ts` after line 57:
  ```typescript
  if (profileError || !rawProfile) {
    console.error('buildCrewContext failed:', profileError, 'personId:', personId);
    return { markdown: '', certNames: [], roleName: '' };
  }
  ```
- [ ] Also log the crew context in the message route — in `apps/web/src/app/api/advisor/thread/messages/route.ts` after line 139:
  ```typescript
  console.log('Crew context length:', fullCrewContext.length, 'Chunks:', chunks.length);
  ```
- [ ] Push, send a Docky message, check Vercel runtime logs for the error/context length

---

### Fix Docky usage pill not updating after message sent

> `loadUsage()` only runs on mount. After sending a message and receiving a response, the pill stays stale until page remount.

- [ ] In `apps/web/src/app/(app)/docky/page.tsx`: extract `loadUsage()` out of the `useEffect` (or make it callable), then call it again after a successful stream completes — at the end of `sendMessage()` after the assistant message is added to state

---

### Fix experience private fields not loading in edit form

> Sea time and salary fields ARE saved to DB (PATCH + apply_projection work). But the GET `/api/experiences` endpoint excludes them from the `.select()`. The edit form can't pre-populate fields it never receives. These are the user's own data — RLS already scopes to owner. The "never returned" rule applies to other users viewing the profile, not the owner editing their own experience.

- [ ] In `apps/web/src/app/api/experiences/route.ts` GET handler (~line 35): add `sea_time_days, sea_time_nautical_miles, salary_amount, salary_currency, salary_period` to the `.select()` string
- [ ] Update the comment that says "Salary fields are NEVER returned" — change to "Salary fields returned to owner only (RLS-scoped, never exposed via view-only profile API)"
- [ ] In the edit experience page (`apps/web/src/app/(app)/profile/edit-experience/[id]/page.tsx`): populate `seaTimeDays`, `seaTimeNauticalMiles`, `salaryAmount`, `salaryCurrency`, `salaryPeriod` state from the loaded experience data
- [ ] Verify the view-only profile API (`apps/web/src/app/api/profile/[personId]/route.ts`) does NOT return salary or sea time — these stay private to the owner
- [ ] Verify: edit an experience, set sea time days to 90 + salary to 5000 EUR monthly, save, re-open — both should show

---

### Replace engineering epaulette icon — wrench looks like a cigarette at small sizes

> Current wrench SVG path doesn't read well at 14px. Replace with a gear/cog silhouette — universally recognized for engineering, bold at any size.

- [ ] In `apps/web/src/components/epaulette-badge.tsx`: replace `WrenchIcon` with a `GearIcon` — simple 6-tooth cog with center circle, single filled path, no strokes
- [ ] Verify at actual rendered size in the browser (12-14px) — should be immediately recognizable as engineering

---

### Product decisions captured (2026-04-05) — needs detailed planning before implementation

**Monetization — 2-tier model (free + pro):**

> Remove `crew_unlimited` tier entirely. Two plans only: `free` and `crew_pro`. No boost mechanics, no pay-to-win, no pay-to-be-seen.

- **Crew Pro** gated features:
  - Docky unlimited messages (already built — 15 free/mo, 500 pro/mo)
  - Daywork invitation visibility — crew must be Pro to appear in the "Available Crew" / invite tab for employers. Free crew can still apply to postings, just can't be invited. This is the key lever for green crew who want to be found.
- **Employer/Agent Pro** (same paywall for both — prevents agents signing up as crew to avoid it):
  - Template cap — free: X templates, pro: unlimited
  - Same tier, same price, same features for employers and agents

- **Implementation scope (not yet planned):**
  - [ ] Remove `crew_unlimited` from plan CHECK constraint, `require-subscription.ts`, billing page
  - [ ] Gate invitation visibility behind `crew_pro` — the available-crew API should exclude non-Pro crew
  - [ ] Gate template count — enforce cap at API layer for free employers/agents
  - [ ] Update billing page for 2-tier presentation (crew vs employer/agent)
  - [ ] Decide: what are the free template caps? (e.g., 3 daywork + 1 permanent?)

**Email notifications — primary channel pivot:**

> Push doesn't exist (no native app). Email becomes the primary notification channel, not a fallback.

- Rename all "push" language in settings to "notification" language
- Master email toggle (on/off all emails)
- Specific toggles: jobs, applications, messages, reminders (same categories, just not called "push")
- Send emails for ALL notification-worthy events (currently only 5 of 20+ events trigger email)
- Keep in-app notification bell as-is
- **Implementation scope (not yet planned):**
  - [ ] Expand email templates to cover all events that currently only fire push/in-app
  - [ ] Update `notifyOnEvent()` to always attempt email (not just when no push tokens)
  - [ ] Rename preference columns or add email-specific columns
  - [ ] Update settings UI — remove "push" language, show email notification controls

**Smoker + tattoos visible to employers:**

> These fields exist on profiles (migration 00080) but are not shown in the employer-facing views.

- [ ] Add smoker + visible_tattoos to the view-only profile API response (`/api/profile/[personId]`) for employer/agent viewers
- [ ] Show in applicant review cards and "how employers see you" profile preview
- [ ] These are factual fields, not discriminatory metrics — employers need them for vessel policy compliance

---

## Deferred items

- [ ] Visually verify card background image watermark effect
- [ ] Run screenshot script (blocked by port 54322 — needs system restart)
- [ ] Interaction logging 90-day cleanup cron — build when data volume warrants it
- [ ] Subscription plan in JWT custom access token hook — future optimisation to eliminate `requireSubscription` DB query
- [ ] Remove `console.error` diagnostic lines from `llm.ts` and `thread/messages/route.ts` (added for Anthropic 400 debugging — no longer needed)
- [ ] Commit ingestion script fixes (pdf-parse v1 downgrade + lib import path) — working locally, not yet committed

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

- **OG social sharing image** — see `tasks/founder-drafts.md` § 7.
- **Agent market as discover mode** — let agents browse full market feed.
- **Form validation — styled inline errors** — replace browser-native validation (SUG-012).
- **Invalid URL error pages** — custom error pages for garbage URLs (SUG-013).
- **Edit experience "Unknown vessel" prefix** — seed data issue (SUG-017).
- **Applicant count badge on My Jobs**.
- **Discover filter chips**.
- **Notifications grouping**.
- **Email: List-Unsubscribe header**.

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

(See git history for completed stages 51-195. Stages 185-195: audit fixes, Docky refactor Sessions A/B/C, MCA ingestion script + production corpus load, off-topic guard, CI/CD deploy-migrations, rollback hardening, availability fix, NDA vessel name masking, RAG threshold tuning, production Docky launch.)
