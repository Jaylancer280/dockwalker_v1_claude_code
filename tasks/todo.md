# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Mobile Phase 7: Ship — EAS config, TestFlight build, environment setup

---

## Queue

### Mobile Phase 7: Ship (iOS TestFlight)

**Context:** All 6 feature phases complete. EAS account created, Apple API key integrated, GitHub connected to EAS. Bundle ID `io.dockwalker.app` already set in `app.json`. EAS project ID `4a600184-f863-416e-b781-b90cc00b0f2a` linked. Goal: first iOS build on TestFlight for real user validation.

**This phase is mostly config + human actions, not feature code. The implementation agent handles config files; the user handles App Store Connect and EAS CLI commands.**

#### 1. EAS Build configuration

- [x] Create `apps/mobile/eas.json` with three profiles:
  ```json
  {
    "cli": { "version": ">= 15.0.0", "appVersionSource": "remote" },
    "build": {
      "development": {
        "developmentClient": true,
        "distribution": "internal",
        "ios": { "simulator": true }
      },
      "preview": {
        "distribution": "internal",
        "ios": { "buildConfiguration": "Release" }
      },
      "production": {
        "autoIncrement": true
      }
    },
    "submit": {
      "production": {
        "ios": { "appleId": "<USER_APPLE_ID>", "ascAppId": "<ASC_APP_ID>" }
      }
    }
  }
  ```
  The user fills in `appleId` and `ascAppId` from App Store Connect.
- [x] Add `expo-notifications` to `app.json` plugins (required for push notification entitlements in the native build):
  ```json
  ["expo-notifications", { "icon": "./assets/images/icon.png", "sounds": [] }]
  ```
- [x] Add `expo-image-picker` to `app.json` plugins (camera/photo library permissions):
  ```json
  [
    "expo-image-picker",
    { "photosPermission": "Allow DockWalker to access your photos for avatar upload" }
  ]
  ```
- [x] Verify `app.json` has all required fields: name, slug, version, ios.bundleIdentifier, android.package, scheme — all present.

#### 2. Environment variables in EAS

- [ ] Set environment variables in EAS dashboard (or via `eas env:create`):
  - `EXPO_PUBLIC_SUPABASE_URL` — production Supabase project URL
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY` — production Supabase anon key
  - `EXPO_PUBLIC_API_BASE_URL` — `https://dockwalker.io` (production Vercel)
- [x] Verify `.env.example` in `apps/mobile/` documents all three variables — already present.

#### 3. First iOS build (user action)

These are CLI commands the user runs, not implementation agent tasks.

- [ ] Run `cd apps/mobile && eas build --platform ios --profile preview` — first build. EAS compiles native code in the cloud, signs with the Apple API key. Takes ~15 minutes.
- [ ] If build succeeds: run `eas submit --platform ios --profile production` to upload to TestFlight. Apple processing takes ~15 minutes.
- [ ] If build fails: diagnose from EAS build logs, fix config, retry. Common issues: missing entitlements, wrong bundle ID, native module config.

#### 4. App Store Connect setup (user action)

- [ ] Create app in App Store Connect with bundle ID `io.dockwalker.app` (if not already created from Capacitor era — if it exists, the Expo build replaces it)
- [ ] Add TestFlight testers (internal group first)
- [ ] Fill in required metadata: app name "DockWalker", primary language, category (Business or Lifestyle)
- [ ] Privacy policy URL and Terms of Service URL (required for TestFlight)

#### 5. Post-build validation checklist

After TestFlight build is available to testers:

- [ ] App launches, sign-in works against production Supabase
- [ ] Onboarding flow completes (crew identity, hat selection)
- [ ] Discover tab: daywork swipe + permanent scroll with real production data
- [ ] Apply to a daywork job (if test data exists in production)
- [ ] My Jobs tab: visible when switching to employer hat
- [ ] Messages tab: conversation list loads (empty if no engagements)
- [ ] Profile tab: edit profile, add experience with IMO lookup
- [ ] Push notification received when another user takes an action
- [ ] Docky: send a question, receive AI response
- [ ] Settings: notification toggles work
- [ ] Billing: subscribe button opens Safari to dockwalker.io/billing
- [ ] Hat switch: crew ↔ employer, tabs update
- [ ] No crashes on any screen transition

#### 6. OTA update test

- [ ] After initial TestFlight validation, make a minor JS-only change (e.g. tweak a label in the More tab)
- [ ] Run `eas update --branch preview --message "Test OTA"` from `apps/mobile/`
- [ ] Verify the change appears in the TestFlight app without a new build (restart app)
- [ ] This validates the OTA pipeline for rapid bug fixes during testing

#### 7. Phase 7 sign-off

- [ ] 3+ tester devices have the Expo app installed via TestFlight
- [ ] All 20 user-facing screens functional
- [ ] Zero P0 bugs reported in 48 hours
- [ ] OTA update pipeline verified
- [ ] **After sign-off:** Capacitor removal can proceed per split spec Section 9

---

### Quick wins — production deploy (user action)

- [ ] Deploy migrations 00076 + 00077 to production Supabase

---

## Backlog

> Active backlog. Pick items into Queue when ready. Items tagged (web), (mobile), or (both).
> **Implementation agent: do NOT move items here to defer them. If a todo item
> is too hard, stop and ask — do not unilaterally deprioritise.**

### Business logic / server-side

- **Permanent crew withdrawal auto-revert** (both) — when crew withdraws from a selected permanent posting, employer should decide next step, not auto-revert. Full spec in git history.
- **Onboarding true atomicity** (both) — `onboard_person` RPC should be fully atomic; currently partial failure is possible on batch experience inserts.
- **Negotiation timeout** (both) — auto-close permanent engagements after X days of inactivity in negotiation. Server-side cron.
- **Weekly check-in cron** (both) — periodic nudge for permanent postings with no employer activity.
- **Deactivated user server-side sign-out** (both) — force session invalidation when `PERSON.DEACTIVATED` fires.

### Web-only UI

- **OG social sharing image** (web) — see `tasks/founder-drafts.md` § 7 for spec.
- **Agent market as discover mode** (web) — let agents browse the full market feed, not just their own postings.
- **Form validation — styled inline errors** (web) — replace browser-native validation with styled inline messages (SUG-012).
- **Invalid URL error pages** (web) — custom error pages for garbage URLs (SUG-013).
- **Edit experience "Unknown vessel" prefix** (web) — seed data shows "Unknown vessel" for employer-owned vessels in crew experience edit (SUG-017).
- **Applicant count badge on My Jobs** (both) — show pending applicant count on posting cards in My Jobs.
- **Discover filter chips** (both) — show active filters as dismissible pills above the feed.
- **Notifications grouping** (both) — group notifications by date or engagement instead of flat list.
- **Email: List-Unsubscribe header** (web) — add RFC 8058 header to transactional emails.

### Testing

- **Resilience tests** (web) — network failure, timeout, and retry scenarios for API routes.
- **Component tests for Permanent UI** (web) — unit tests for permanent posting components.
- **Component tests for Form Pickers** (web) — unit tests for hierarchical pills, location picker, role picker.

### Superseded by mobile split

- ~~Billing IAP bypass redesign~~ — replaced by `tasks/mobile-web-split-spec.md` Section 10.
- ~~Swipe card momentum~~ — mobile builds native swipe from scratch; web swipe stays as-is.
- ~~Haptics on toggles/filters~~ — Capacitor haptics are dead; mobile uses `expo-haptics` natively.

---

## Done

(See git history for completed stages 51-172. Mobile Phases 1-6 complete + UI primitives. Fix batches: 165b, 166, 169. CLAUDE.md + BUILD_STATE.md modernisation.)
