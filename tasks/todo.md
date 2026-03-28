# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Mobile Phase 1: Monorepo setup + Shell + Auth

---

## Queue

### 1. Monorepo infrastructure

**Context:** Add Turborepo, create `apps/mobile/` Expo project, extract `packages/shared/`, adapt `packages/db/` for mobile. Reference: `tasks/mobile-web-split-spec.md` Sections 2-3.

#### 1a. Turborepo setup

- [x] Install turbo as root dev dependency: `npm install turbo --save-dev`
- [x] Add `.turbo` to root `.gitignore`
- [x] Create `turbo.json` at repo root with tasks: `build` (dependsOn ^build), `dev` (persistent, no cache), `type-check` (dependsOn ^type-check), `test` (no cache), `lint`
- [x] Update root `package.json` scripts to use `turbo run` instead of direct `npm run --workspace` calls. Keep `prepare` as-is (husky).
- [x] Verify `turbo run type-check` passes (should run type-check for `packages/types`, `packages/db`, and `apps/web`)
- [x] Verify `turbo run test` passes (should run tests for `apps/web`)

#### 1b. Create Expo app

- [x] Run `npx create-expo-app@latest apps/mobile --template default@sdk-53` from repo root (SDK 53 is latest)
- [x] Set `name` to `"mobile"` in `apps/mobile/package.json` (already set by template)
- [x] Set `"main": "expo-router/entry"` in `apps/mobile/package.json` (already set by template)
- [x] Add dependencies: `@dockwalker/types: "*"`, `@dockwalker/db: "*"`, `@dockwalker/shared: "*"` to `apps/mobile/package.json`
- [x] Run `npm install` from root to link workspace packages
- [x] Add scripts to `apps/mobile/package.json`: `dev` (expo start), `type-check` (tsc --noEmit), `lint` (eslint .)
- [x] Create `apps/mobile/tsconfig.json` extending `expo/tsconfig.base` with `strict: true`, paths for `@/*` → `./src/*`, `@dockwalker/types` → `../../packages/types/src`, `@dockwalker/db` → `../../packages/db/src`, `@dockwalker/shared` → `../../packages/shared/src`
- [x] Verify `turbo run type-check` passes with the new mobile app included
- [x] Verify Expo app launches without errors

#### 1c. Extract `packages/shared/`

- [x] Create `packages/shared/package.json` (name: `@dockwalker/shared`, main: `./src/index.ts`, scripts: type-check)
- [x] Create `packages/shared/tsconfig.json` (strict, target ES2022)
- [x] Create `packages/shared/src/index.ts`
- [x] Move `apps/web/src/lib/units.ts` → `packages/shared/src/units.ts`. Export from index.
- [x] Move `apps/web/src/lib/languages.ts` → `packages/shared/src/languages.ts`. Export from index.
- [x] Move `apps/web/src/lib/compute-total-experience.ts` → `packages/shared/src/compute-total-experience.ts`. Export from index.
- [x] Move `apps/web/src/lib/epaulettes.ts` → `packages/shared/src/epaulettes.ts`. Export from index.
- [x] Update all imports in `apps/web/` from `@/lib/units` (etc.) to `@dockwalker/shared`. 43 files updated.
- [x] Add `@dockwalker/shared: "*"` to `apps/web/package.json` dependencies
- [x] Add `@dockwalker/shared` path to `apps/web/tsconfig.json` if needed for IDE resolution
- [x] Verify `turbo run type-check` passes (all three packages + web app)
- [x] Verify `turbo run test` passes (web tests still work with new import paths)
- [x] Verify the 4 original files in `apps/web/src/lib/` are deleted (not duplicated)

#### 1d. Adapt `packages/db/` for mobile

- [x] Add `createMobileClient(url: string, anonKey: string, storage: any)` to `packages/db/src/client.ts`. This factory accepts explicit params instead of reading `process.env`, and passes the storage adapter to `createClient()` auth config. Export from index.
- [x] Verify existing `createClient()` and `createServiceClient()` are unchanged
- [x] Verify `turbo run type-check` passes

---

### 2. Mobile app shell + auth

**Context:** Expo Router file-based routing with tab navigator, auth gate, Supabase auth. Reference: `tasks/mobile-web-split-spec.md` Section 6 Phase 1.

#### 2a. NativeWind setup

- [x] Install NativeWind v4 + Tailwind v3 in `apps/mobile/`
- [x] Create `apps/mobile/tailwind.config.js` with content paths and `nativewind/preset`
- [x] Create `apps/mobile/global.css` with `@tailwind base/components/utilities`
- [x] Create `apps/mobile/babel.config.js` with `babel-preset-expo` (jsxImportSource: nativewind) + `nativewind/babel`
- [x] Create `apps/mobile/metro.config.js` with `withNativeWind` + monorepo watchFolders
- [x] Create `apps/mobile/nativewind-env.d.ts` with `/// <reference types="nativewind/types" />`

#### 2b. Supabase client

- [x] Install: `npx expo install @supabase/supabase-js expo-secure-store`
- [x] Create `apps/mobile/.env` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (local dev values)
- [x] Add `EXPO_PUBLIC_API_BASE_URL` to `.env`
- [x] Create `apps/mobile/src/lib/supabase.ts` — Supabase client using expo-secure-store for session storage, `AppState` listener for auto-refresh
- [x] Add `.env` to `apps/mobile/.gitignore`
- [x] Create `apps/mobile/.env.example` listing the 3 required vars (no values)

#### 2c. Auth context + storage

- [x] Create `apps/mobile/src/lib/auth-context.tsx` — React context providing `session`, `user`, `person` (current hat + identity), `signIn`, `signUp`, `signOut`, `isLoading`
- [x] Session persistence handled by expo-secure-store via supabase client config (no separate use-storage-state needed)
- [x] Auth context listens to `supabase.auth.onAuthStateChange`, fetches person record, exposes `person` for hat-based routing

#### 2d. Navigation structure

- [x] Create root layout `apps/mobile/app/_layout.tsx` — wraps app in auth provider, imports `global.css`
- [x] Create auth gate via index.tsx + (app)/\_layout.tsx: no session → sign-in; session but no person → onboarding; session + person → tabs
- [x] Create `apps/mobile/app/sign-in.tsx` — email + password login with error display, links to sign-up and forgot-password
- [x] Create `apps/mobile/app/sign-up.tsx` — email + password signup with "check your email" confirmation
- [x] Create `apps/mobile/app/forgot-password.tsx` — email input, sends reset link
- [x] Create tab layout `apps/mobile/app/(app)/(tabs)/_layout.tsx` with 5 tabs using Ionicons
- [x] Create placeholder screens for each tab showing tab name + current hat
- [x] Hat-based tab routing: Discover as default tab for all hats (My Jobs placeholder deferred to Phase 3)

#### 2e. Onboarding shell

- [x] Create `apps/mobile/app/onboarding.tsx` — 6-step flow shell (Welcome → Identity → Experience → Profile → Vessel Experience → Hat Selection)
- [x] For Phase 1, onboarding is a UI shell — submits to `/api/onboarding` endpoint via fetch with auth header
- [x] Progress dots at top showing current step / total steps
- [x] On completion, routes back to index which re-evaluates auth state

#### 2f. Verification

- [x] `turbo run type-check` passes for all 5 workspaces
- [x] `turbo run test` passes for web — 908 tests, 117 test files
- [ ] App launches on iOS simulator: shows login screen (requires macOS — deferred to device testing)
- [ ] Can sign in with a staging test user (requires running Supabase + web server — deferred to device testing)
- [ ] Can sign out and return to login screen (deferred to device testing)
- [x] Web app is completely unaffected — all existing tests pass with new import paths

---

### 3. Quick wins — production deploy (user action)

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

(See git history for completed stages 51-162c, UI-0 through UI-19, all fix batches, workflow protocol, Playwright baseline, rollback + test fixes, SUG fixes, UI consistency 1-3, Codemagic CI, app icon, bundle ID, profile overlay fix, employer spinner fix, LOA conversion fix, pill transition fix, Capacitor dead-end cleanup)
