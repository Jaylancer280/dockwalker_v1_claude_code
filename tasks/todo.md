# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Fix EAS build + web type-check errors — unblock iOS TestFlight

---

## Queue

### Fix web type-check errors (BLOCKING COMMIT)

**Context:** Pre-commit hook runs `turbo run type-check` across all workspaces. The web workspace has ~15 test files importing `screen`, `fireEvent`, `waitFor` from `@testing-library/react` that fail TS resolution. This blocks ALL commits including mobile config fixes.

- [x] Diagnose why `@testing-library/react` exports are not found in `apps/web/__tests__/` — likely a `@types/react` version conflict or missing `@testing-library/jest-dom` types
- [x] Fix the TS errors across all affected test files
- [x] Verify `turbo run type-check` passes clean

### EAS build fixes (READY TO COMMIT — blocked by above)

**Context:** Three config fixes already applied locally, waiting for clean type-check to commit.

Changes already made (unstaged):

- [x] `apps/mobile/metro.config.js` — merge watchFolders with Expo defaults instead of replacing
- [x] `apps/mobile/app.json` — explicit `"root": "app"` for router resolution
- [x] `.easignore` — moved to repo root with corrected paths + `.git/` exclusion

After commit + push:

- [ ] Run `cd apps/mobile && eas build --platform ios --profile preview`
- [ ] Verify Metro bundling passes (EXPO_ROUTER_APP_ROOT resolved)
- [ ] Verify upload size reduced from 290MB

### Mobile Phase 7: Ship (iOS TestFlight) — remaining items

**Context:** EAS config done. First successful build needed before these can proceed.

#### Environment variables in EAS

- [ ] Set environment variables in EAS dashboard (or via `eas env:create`):
  - `EXPO_PUBLIC_SUPABASE_URL` — production Supabase project URL
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY` — production Supabase anon key
  - `EXPO_PUBLIC_API_BASE_URL` — `https://dockwalker.io` (production Vercel)

#### First iOS build + TestFlight (user action)

- [ ] First successful `eas build --platform ios --profile preview`
- [ ] `eas submit --platform ios --profile production` to upload to TestFlight
- [ ] App Store Connect setup: testers, metadata, privacy policy URL

#### Post-build validation

- [ ] App launches, sign-in works against production Supabase
- [ ] Onboarding flow completes
- [ ] Discover tab: daywork swipe + permanent scroll
- [ ] Apply to a daywork job
- [ ] My Jobs tab visible as employer
- [ ] Messages tab loads
- [ ] Profile tab: edit profile, add experience with IMO lookup
- [ ] Push notification received
- [ ] Docky: send a question, receive AI response
- [ ] Settings: notification toggles work
- [ ] Billing: subscribe button opens Safari
- [ ] Hat switch: crew ↔ employer, tabs update
- [ ] No crashes on any screen transition

#### OTA update test

- [ ] Make a minor JS-only change
- [ ] Run `eas update --branch preview --message "Test OTA"`
- [ ] Verify change appears without a new build

#### Phase 7 sign-off

- [ ] 3+ tester devices via TestFlight
- [ ] All 20 user-facing screens functional
- [ ] Zero P0 bugs in 48 hours
- [ ] OTA update pipeline verified

---

### Quick wins — production deploy (user action)

- [ ] Deploy migrations 00076 + 00077 to production Supabase

---

## Backlog

> Active backlog. Pick items into Queue when ready.
> **Implementation agent: do NOT move items here to defer them. If a todo item
> is too hard, stop and ask — do not unilaterally deprioritise.**

### Business logic / server-side

- **Permanent crew withdrawal auto-revert** (both) — when crew withdraws from a selected permanent posting, employer should decide next step, not auto-revert.
- **Onboarding true atomicity** (both) — `onboard_person` RPC should be fully atomic.
- **Negotiation timeout** (both) — auto-close permanent engagements after X days inactivity.
- **Weekly check-in cron** (both) — periodic nudge for permanent postings with no employer activity.
- **Deactivated user server-side sign-out** (both) — force session invalidation on PERSON.DEACTIVATED.

### Web-only UI

- **OG social sharing image** (web) — see `tasks/founder-drafts.md` § 7.
- **Agent market as discover mode** (web) — let agents browse full market feed.
- **Form validation — styled inline errors** (web) — replace browser-native validation (SUG-012).
- **Invalid URL error pages** (web) — custom error pages for garbage URLs (SUG-013).
- **Edit experience "Unknown vessel" prefix** (web) — seed data issue (SUG-017).
- **Applicant count badge on My Jobs** (both).
- **Discover filter chips** (both).
- **Notifications grouping** (both).
- **Email: List-Unsubscribe header** (web).

### Testing

- **Resilience tests** (web) — network failure, timeout, retry scenarios.
- **Component tests for Permanent UI** (web).
- **Component tests for Form Pickers** (web).

### Superseded by mobile split

- ~~Billing IAP bypass redesign~~ — replaced by split spec Section 10.
- ~~Swipe card momentum~~ — mobile builds native swipe from scratch.
- ~~Haptics on toggles/filters~~ — Capacitor dead; mobile uses expo-haptics.

---

## Done

(See git history for completed stages 51-173. Mobile Phases 1-6 complete + UI primitives. EAS config stage 173.)
