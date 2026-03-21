# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

---

### Stage 138: Push-Triggers Decomposition

**Goal:** Split `push-triggers.ts` (1,033 lines, 23 event types, 6 concerns) into focused modules. No behavioral change — pure refactor.

**Will touch:** `apps/web/src/lib/push-triggers.ts` → split into `apps/web/src/lib/push-triggers/` directory.

**Will NOT touch:** API routes (import path stays the same via barrel export), migrations, components, pages.

**Done condition:** Same 812 tests pass. Same notification behavior. File sizes under 300 lines each. `tsc` + `eslint` clean.

---

#### Module split

- [ ] Create `apps/web/src/lib/push-triggers/` directory
- [ ] `index.ts` — barrel export of `notifyOnEvent` + `getRecipientEmail` (preserves existing import paths)
- [ ] `event-router.ts` — `resolveNotification()` switch statement dispatching to handler functions
- [ ] `daywork-handlers.ts` — all `handleDaywork*` functions (existing daywork notification logic)
- [ ] `permanent-handlers.ts` — all `handlePermanent*` functions (Stage 136a notification logic)
- [ ] `notification-mapper.ts` — `mapEventToNotificationType()` + `resolveDeepLink()` (both domain maps)
- [ ] `email-dispatcher.ts` — `sendEmailForEvent()` + `shouldSendMessageEmail()` + email template calls
- [ ] `broadcast.ts` — `enqueueBroadcast()` + `fireBroadcast()` + `resolveCityForPort()`
- [ ] `loaders.ts` — `getJobNumber()`, `getDisplayName()`, `getEngagementParties()`, `getDayworkPoster()`, `getPermanentPostingInfo()`, `getRecipientEmail()`
- [ ] `types.ts` — `NotifyContext` interface and shared types

#### Verification

- [ ] All imports in API routes resolve correctly (barrel re-export from `index.ts`)
- [ ] `getRecipientEmail` export still works (used by engagement-starts cron)
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx vitest run` — 812+ tests pass (push-triggers tests may need import path updates)
- [ ] `npx eslint src/ --max-warnings 0` — zero warnings
- [ ] Commit: "Stage 138: Push-triggers decomposition — 9 modules, same behavior"

---

## Done

(See git history for completed stages 51-139, fixes 118a/123a/123b/127a/128a/128b/131a, messages test cleanup)
