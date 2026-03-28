# DockWalker Mobile/Web Split — Architecture Specification

> Implementation blueprint for the native mobile app alongside the existing web app.
> This document contains concrete decisions, not options. Follow it exactly.
>
> **Ground zero commit:** `7f3f2f5` (2026-03-28)
> **Bundle ID:** `io.dockwalker.app` (same as current Capacitor — Expo replaces it in-place)
> **Platform priority:** iOS first, Android follows as a polish pass on the same codebase
> **Admin screens:** Web-only — no admin routes in the mobile app

## Progress Tracker

> Updated by the planning agent at the end of each session. A fresh agent reads this first.

| Phase                                                          | Status      | Notes                                                                                     |
| -------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| Monorepo setup (turbo.json, packages/shared, db mobile client) | DONE        | Stage 163 — turbo, shared pkg, mobile db client                                           |
| Phase 1 — Shell + Auth                                         | DONE        | Stage 163 + Fix 163 — Expo SDK 53, NativeWind, auth context, 5-tab nav, onboarding shell. |
| Phase 2 — Discovery + Swipe                                    | DONE        | Stage 164-165 + Fix 165. Device testing deferred to post-Phase 7.                         |
| Phase 3 — Employer Flows                                       | IN PROGRESS | Checklist in todo.md. Forms, my jobs, review applicants, templates.                       |
| Phase 4 — Messaging                                            | NOT STARTED |                                                                                           |
| Phase 5 — Profile + Experience                                 | NOT STARTED |                                                                                           |
| Phase 6 — Docky + Polish                                       | NOT STARTED |                                                                                           |
| Phase 7 — Ship (iOS TestFlight)                                | NOT STARTED |                                                                                           |
| Phase 8 — Android polish pass                                  | NOT STARTED |                                                                                           |
| Capacitor removal                                              | BLOCKED     | Waiting on Phase 7 validation                                                             |

**Last session:** 2026-03-28 — Stage 168: Phase 3 complete. Post forms, My Jobs, review screens, templates all built.

---

## 1. Why We're Splitting

Capacitor + Next.js static export is architecturally impossible for DockWalker (UUID dynamic routes, 50+ API routes, `useParams()` incompatible with `output: 'export'`). The current build is a WKWebView wrapper loading Vercel remotely — it feels like a web page, not an app.

DockWalker's competitive advantage is being the only native mobile app in superyacht hiring. Users will reject anything that doesn't feel native.

**Goal:** Two frontends, one backend, shared types. The web app stays untouched. A new Expo/React Native app delivers the native experience.

---

## 2. Target Architecture

```
dockwalker/
├── apps/
│   ├── web/              ← Next.js on Vercel (EXISTS — untouched)
│   └── mobile/           ← Expo/React Native (NEW)
├── packages/
│   ├── types/            ← Shared TypeScript types (EXISTS — consumed by both)
│   ├── db/               ← Shared Supabase helpers (EXISTS — minor adaptation)
│   └── shared/           ← NEW: pure business logic extracted from web
├── supabase/             ← Backend (EXISTS — zero changes)
├── turbo.json            ← NEW: monorepo pipeline config
└── package.json          ← workspace config (add apps/mobile)
```

### What stays untouched

| Asset             | Reason                                                                   |
| ----------------- | ------------------------------------------------------------------------ |
| `apps/web/`       | Web app continues as-is on Vercel                                        |
| `supabase/`       | Same project, same RLS, same RPCs, same event ledger                     |
| `packages/types/` | All 77 event types, 19 models, 13 enums — consumed directly by both apps |
| All 88 API routes | Mobile calls the same Vercel-hosted endpoints for writes                 |
| Vercel deployment | Auto-deploys on push to main, serves web users and mobile API            |
| GitHub Actions CI | Extended to cover `apps/mobile/` — same pipeline, additional job         |

### What changes

| Asset                      | Change                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| Root `package.json`        | Add `apps/mobile` to workspaces                                                          |
| `turbo.json`               | NEW — pipeline definitions for build, test, type-check across both apps                  |
| `packages/db/`             | Add `createMobileClient(url, anonKey, storage)` alongside existing factories             |
| `packages/shared/`         | NEW — extract `units.ts`, `languages.ts`, `compute-total-experience.ts`, `epaulettes.ts` |
| `.github/workflows/ci.yml` | Add `test-mobile` job for type-check and tests                                           |

---

## 3. Shared Packages

### 3.1. `packages/types/` — transfers 100%, zero changes

- 77 event types with typed payloads (`EventPayloadMap`)
- 19 model interfaces (Person, Daywork, PermanentPosting, Engagement, etc.)
- 13 enums (RoleContext, ApplicationStatus, ContractType, etc.)
- `DomainEvent`, `AggregateType`, `DayworkInvitation` interfaces

### 3.2. `packages/db/` — transfers with one addition

**Transfers directly:**

- `appendEvent<T>()` — typed event append via RPC
- `appendEvents<T>()` — batch event append
- `checkNoOverlap()` — date overlap validation
- `checkNoOverlapExcluding()` — overlap check with exclusion

**New export for mobile:**

- `createMobileClient(url, anonKey, storage)` — accepts explicit params and an `AsyncStorage` adapter for session persistence. The existing `createClient()` and `createServiceClient()` stay unchanged for web.

**Not available on mobile:** `createServiceClient()`. The service role key never exists in the mobile bundle. Mobile uses the anon key exclusively — RLS is the security boundary.

### 3.3. `packages/shared/` — NEW, extracted from `apps/web/src/lib/`

Pure TypeScript. Zero React, zero Next.js, zero DOM, zero platform dependencies. Both apps import these directly:

| Module                        | What it does                                                              |
| ----------------------------- | ------------------------------------------------------------------------- |
| `units.ts`                    | Currency symbols (`currencySymbol()`), distance/length conversion         |
| `languages.ts`                | 20 language codes + labels                                                |
| `compute-total-experience.ts` | "2y 3m" format from experience dates                                      |
| `epaulettes.ts`               | Maritime rank insignia mapping (`getEpaulette()`, `getDepartmentColor()`) |

After extraction, `apps/web/` imports from `@dockwalker/shared` instead of its local `lib/` copies. The local copies are deleted.

**Not extracted** (platform-specific, stays in each app):

- `safe-fetch.ts` — web-only; mobile uses direct Supabase for reads, API calls with auth header for writes
- `supabase/client.ts` — web uses `@supabase/ssr` (cookies); mobile uses `@supabase/supabase-js` (AsyncStorage)
- `supabase/middleware.ts` — Next.js-specific routing; mobile handles navigation in Expo Router
- `push-notifications.ts` — Capacitor-specific; mobile uses `expo-notifications`
- `haptics.ts` — Capacitor-specific; mobile uses `expo-haptics`
- `stripe.ts`, `rate-limit.ts`, `resend` — server-side only, never on mobile

---

## 4. Data Layer

### 4.1. Hybrid data fetching

**Reads** — direct Supabase queries from mobile. Discover feeds, my postings, messages, profile, notifications are simple `.from().select()` with RLS enforcing access. Faster (one fewer hop), cacheable, offline-readable via TanStack Query.

**Writes** — call Vercel API routes. Apply, accept, cancel, rate, post, message all involve `appendEvent`, validation logic, and side effects (push notifications, email). This logic stays server-side. Mobile sends `Authorization: Bearer <token>` on every write request.

**Realtime** — direct Supabase Realtime subscription from mobile. The web app already does this for chat (the `useRealtimeMessages` hook uses the browser client, not an API route). Same pattern in React Native, same RLS gate.

### 4.2. Authentication

**Web:** `@supabase/ssr` with cookie-based auth in server components and middleware.

**Mobile:** `@supabase/supabase-js` with `@react-native-async-storage/async-storage` for token persistence.

```typescript
// apps/mobile/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true },
});
```

Same Supabase project, same RLS policies, same JWT. For write requests to Vercel API routes, mobile includes the Supabase JWT in the `Authorization` header. The API route's `requireDomainUser` guard validates it.

### 4.3. Realtime

```typescript
supabase
  .channel(`messages:${engagementId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `engagement_id=eq.${engagementId}`,
    },
    (payload) => {
      /* new message */
    },
  )
  .subscribe();
```

No backend changes. RLS gates access. Works identically to the web implementation.

---

## 5. Technology Stack

| Layer                  | Technology                                             | Why                                                                 |
| ---------------------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| Framework              | Expo SDK 52+                                           | Monorepo auto-detection, EAS Build, OTA updates                     |
| Navigation             | Expo Router                                            | File-based routing, native stack transitions (slide-in, swipe-back) |
| Styling                | NativeWind v4                                          | Tailwind classes → RN StyleSheet (reuse design tokens from web)     |
| Data fetching (reads)  | TanStack Query                                         | Cache, offline, background refresh, stale-while-revalidate          |
| Data fetching (writes) | fetch to Vercel API                                    | Server-side validation + side effects preserved                     |
| State management       | Zustand                                                | Lightweight global state (auth, hat, preferences)                   |
| Forms                  | React Hook Form + Zod                                  | Same as web — validation schemas transfer directly                  |
| Gestures               | react-native-gesture-handler + react-native-reanimated | Native 60fps swipe mechanic with spring physics                     |
| Push                   | expo-notifications                                     | Unified APNs/FCM via Expo Push Service                              |
| Haptics                | expo-haptics                                           | Native haptic feedback on all interactive elements                  |
| Image picking          | expo-image-picker                                      | Camera + gallery for avatar upload                                  |
| Secure storage         | expo-secure-store                                      | Auth token supplement (sensitive values)                            |
| Deep linking           | expo-linking + Expo Router                             | Universal links for push notification deep links                    |
| Error tracking         | @sentry/react-native                                   | Same Sentry project as web                                          |

### Dependencies NOT installed on mobile

These are web/server-only:

- `next`, `react-dom`, `@supabase/ssr` — web framework
- `stripe`, `@upstash/redis`, `@upstash/ratelimit`, `resend` — server-side services
- `@anthropic-ai/sdk`, `openai` — Docky runs server-side, mobile calls the API
- All `@capacitor/*` — dead architecture
- `dompurify` — no HTML injection risk in RN
- `radix-ui`, `shadcn` — web UI primitives; mobile uses RN native components
- `framer-motion` — replaced by `react-native-reanimated`

---

## 6. Screen-by-Screen Build Plan

### Navigation structure

```
TabNavigator
├── Discover (crew) / My Jobs (employer/agent)
│   ├── Daywork Browse (swipe stack)
│   ├── Permanent Browse (scrollable feed)
│   ├── Applied Tab
│   ├── Invitations Tab
│   └── Job Detail → Apply
├── Messages
│   ├── Conversation List (Active / History)
│   └── Chat Thread
│       ├── Daywork Summary Card
│       ├── Permanent Summary Card
│       ├── Checklist Card
│       └── Overlays: Cancel, Postponement, Rating, Crew Cancel
├── Profile
│   ├── View Profile (public preview)
│   ├── Edit Profile
│   ├── Add Experience → IMO Lookup → Vessel Create
│   ├── Edit Experience
│   └── Vessels List → Edit Vessel
├── Notifications
└── More (Settings, Billing, Docky, Availability)
```

### Build phases

**Phase 1 — Shell + Auth (Week 1)**

Expo project bootstrap in monorepo. Turborepo config. Tab navigator with 5 tabs. Login, signup, forgot password, reset password screens. Supabase auth with AsyncStorage. Onboarding flow (6 steps). Hat switcher. Auth-gated navigation (unauthenticated → login, unboarded → onboarding, crew → discover, employer → my jobs).

**Phase 2 — Discovery + Swipe (Weeks 2-3)** ← highest risk, prototype first

Daywork browse with native swipe gestures (`react-native-gesture-handler` + `react-native-reanimated` with spring physics). Permanent browse scrollable feed with cursor pagination. Job detail bottom sheet. Apply with optional message. Filter panel (role, cert, location, experience bracket). Availability overlay (14-day date grid + hierarchical location picker). Direct Supabase reads for all discovery queries. TanStack Query for caching.

**Phase 3 — Employer Flows (Week 4)**

Post daywork form. Post permanent form. My Jobs with tabs (Active, In Progress, Done, Templates). Review applicants — swipe stack for daywork, scrollable list for permanent. Accept/reject/shortlist/select confirmation dialogs. Template CRUD. All write operations via Vercel API routes.

**Phase 4 — Messaging (Weeks 5-6)**

Conversation list with unread badges (via `get_unread_counts` RPC). Chat thread with Supabase Realtime subscription for live messages. Daywork summary card. Permanent summary card. Interactive checklist card. Cancel/postponement/rating/crew-cancel overlays. Work started mutual confirmation flow. All message sends via Vercel API.

**Phase 5 — Profile + Experience (Week 7)**

Profile view with experience cards (expand/collapse). Profile edit form with hierarchical pills for certs, roles, languages. Add/edit experience with IMO vessel lookup. Vessel management (create, edit, NDA flag). Avatar upload with image picker and cropper.

**Phase 6 — Docky + Polish (Weeks 8-9)**

Docky AI advisor — full conversation chat UI calling existing `/api/advisor/conversations/[id]/messages` endpoint. Conversation list, new conversation, message history. Usage metering display. Functions like any maritime-trained LLM through the MCA RAG pipeline.

Push notifications via `expo-notifications` (register token → `/api/push-tokens`, handle foreground/background/tap). Deep linking from push to correct screen. Haptics on swipe, apply, accept, toggle, confirm. Offline indicators. Skeleton loading states. Settings page. Billing page (tier display + `Linking.openURL` to Safari for Stripe Checkout).

**Phase 7 — Ship (Week 10)**

EAS Build configuration (`eas.json`). iOS TestFlight submission (same bundle ID `io.dockwalker.app` — replaces Capacitor build on testers' devices). Validate with real users. Android Play Store internal testing follows as a separate ~1 week polish pass after iOS validation.

Capacitor removal from `apps/web/` happens after the Expo app passes real user validation — not before.

---

## 7. Deployment

### Web — unchanged

```
Push to main → Vercel auto-deploy → dockwalker.io
                                   → API routes serve mobile writes
                                   → Cron jobs run daily
                                   → Stripe webhooks active
```

### Mobile — new

```
Push to main → EAS Build → TestFlight (iOS)
             → EAS Update → OTA JS patches (no App Store review)
             → (later) Play Store Internal (Android)
```

EAS Build replaces Codemagic. Config via `eas.json` in `apps/mobile/`. OTA updates via EAS Update for JS-only changes — critical for rapid bug fixes without App Store review.

### Environment variables

**Web (Vercel) — unchanged.** All current env vars stay. The web app is both the user-facing website and the API server for mobile.

**Mobile (`apps/mobile/.env`):**

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_API_BASE_URL=https://dockwalker.io
```

**Never in mobile env:** `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`, any `APNS_*` or `FCM_*` keys (Expo Push handles delivery credentials server-side).

### CI/CD

GitHub Actions extended with one additional job:

```yaml
test-mobile:
  steps:
    - cd apps/mobile && npx jest
```

Type-checking runs via `turbo run type-check` (covers all workspaces). EAS Build handles native compilation — CI only does lint, type-check, and unit tests.

---

## 8. Contamination Prevention

### Import boundaries

| Package                  | `apps/web` can import | `apps/mobile` can import                   |
| ------------------------ | --------------------- | ------------------------------------------ |
| `@dockwalker/types`      | Yes                   | Yes                                        |
| `@dockwalker/db`         | Yes                   | Yes (`createMobileClient` + event helpers) |
| `@dockwalker/shared`     | Yes                   | Yes                                        |
| `@supabase/ssr`          | Yes                   | **NO** — server/cookie-based               |
| `next`, `react-dom`      | Yes                   | **NO**                                     |
| `react-native`, `expo-*` | **NO**                | Yes                                        |

**Enforced by:**

- `tsconfig.json` paths in each app — no cross-app imports possible
- ESLint `no-restricted-imports` — mobile blocks `next`, `react-dom`, `@supabase/ssr`; web blocks `react-native`, `expo-*`
- Turborepo `dependsOn` — packages build before apps, type errors caught at shared boundary

### Shared package rules

- `packages/types/` — pure TypeScript, zero runtime dependencies
- `packages/db/` — depends only on `@supabase/supabase-js` and `@dockwalker/types`
- `packages/shared/` — pure TypeScript, zero React, zero platform code

**Rule:** If a utility needs React → app-level, not package. If it needs `react-native` → `apps/mobile/`. If it needs `next` → `apps/web/`.

### Service role key isolation

The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. It exists ONLY in:

- Vercel environment variables (server-side API routes)
- GitHub Actions secrets (CI database tests)

It must NEVER appear in `apps/mobile/` code, env files, or any `EXPO_PUBLIC_*` variable. Mobile uses the anon key exclusively. RLS is the security boundary. Violations are a security incident.

---

## 9. Capacitor Migration

### Timing

The Capacitor webview build continues serving testers during the entire Expo build. The Expo app uses the same bundle ID (`io.dockwalker.app`), so TestFlight automatically replaces the Capacitor app on testers' devices when the first Expo build ships.

Capacitor removal happens in a single clean commit after the Expo app passes real user validation. Not before. No gap in coverage.

### Files to remove from `apps/web/` (after Expo validation)

- `capacitor.config.ts`
- `apps/web/ios/` — entire Xcode project
- `apps/web/android/` — entire Android project
- `codemagic.yaml`
- `apps/web/scripts/cap-build.mjs`
- All `@capacitor/*` dependencies from `apps/web/package.json`
- `apps/web/src/components/native-init.tsx`
- `apps/web/src/lib/push-notifications.ts` (Capacitor push)
- `apps/web/src/lib/haptics.ts` (Capacitor haptics)
- `apps/web/src/components/push-prompt.tsx`, `push-toast.tsx`

### Files to keep in `apps/web/`

- `apps/web/public/.well-known/` — deep link association files (update domains for Expo)
- Push token API route (`/api/push-tokens/`) — mobile registers Expo Push tokens here
- Push delivery logic (`/lib/push-delivery.ts`, `/lib/push-triggers/`) — server-side, platform-agnostic, sends via Expo Push Service instead of raw APNs/FCM

---

## 10. Billing

### Web — unchanged

User visits `dockwalker.io/billing` → Stripe Checkout → webhook updates `subscriptions` table.

### Mobile — external checkout via Safari

1. Billing screen shows tier names + feature lists (no prices in the app)
2. "Subscribe" button calls `Linking.openURL('https://dockwalker.io/billing?token=...')`
3. Opens system Safari (NOT in-app browser — required for App Store compliance)
4. User auto-logs in via token, completes Stripe Checkout
5. Webhook fires, `subscriptions` table updated
6. Back in app: subscription status refreshed on next data fetch

**Legal basis:** Post-May 2025 U.S. court ruling allows all iOS apps to link to external payment. EU DMA enforces the same. A direct Safari link is more conservative than what's now permitted (Netflix and Spotify show prices and direct purchase links in-app).

The web billing page already exists. Mobile needs only the link with an auth token.

---

## 11. Risks

| Risk                                 | Severity | Mitigation                                                                                                                                                                                                                     |
| ------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Swipe gesture doesn't feel right     | HIGH     | Prototype in Phase 2 before building anything else. `react-native-gesture-handler` + `react-native-reanimated` with spring physics. If it doesn't feel native after a week of tuning, escalate — this is the make-or-break UX. |
| Shared package change breaks one app | MEDIUM   | Turborepo pipeline type-checks both apps on every commit. CI catches breaks before merge.                                                                                                                                      |
| API route latency on mobile writes   | MEDIUM   | Measure round-trip. If MESSAGE.SENT exceeds 500ms, move it to direct Supabase RPC from mobile (it's a simple insert, RLS-gated).                                                                                               |
| Expo OTA update breaks production    | MEDIUM   | EAS Update channels: staging first, promote to production after verification.                                                                                                                                                  |
| App Store rejection on billing link  | LOW      | Using system Safari, not in-app webview. More conservative than what Netflix does.                                                                                                                                             |
| Two frontends drift apart in UX      | LOW      | Shared design tokens in `packages/shared/`. Same component names and behavior, different renderers.                                                                                                                            |

---

## 12. Success Criteria

The mobile app is correct when:

1. Cold start to first screen renders in < 500ms (no network dependency for shell)
2. Swipe-to-apply feels native (spring physics, haptic feedback, 60fps throughout)
3. Page transitions use native stack animations (slide-in, swipe-back gesture)
4. Chat messages arrive in < 1 second via Supabase Realtime
5. App works offline for reads (cached data via TanStack Query)
6. Push notifications arrive and deep-link to the correct screen
7. All 20 user-facing screens match the web app's functionality
8. Docky AI advisor functions as a full maritime-trained LLM chat through the MCA RAG pipeline
9. No service role key or server secret in the mobile bundle
10. `tsc --noEmit` passes for both apps in CI
11. Web app is completely unaffected by mobile app changes
