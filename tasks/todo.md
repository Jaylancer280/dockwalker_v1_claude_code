# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Fix 163: Auth context bugs — wrong column, missing schema match

---

## Queue

### 0. Fix 163 — auth context bugs (BLOCKS ALL DEVICE TESTING)

**Context:** Planning agent review of Stage 163 found 2 bugs in `apps/mobile/src/lib/auth-context.tsx` that will prevent login from working on a real Supabase instance. Both are schema mismatches — the auth context queries columns/values that don't exist.

#### A. `fetchPerson` queries wrong column

Line 58: `.eq('user_id', userId)` — the `persons` table has no `user_id` column. The person's `id` IS the auth user UUID (same as `user.id` from Supabase Auth).

- [x] Change `.eq('user_id', userId)` to `.eq('id', userId)` in `fetchPerson` function
- [x] Verify this matches the web pattern: `apps/web/src/lib/supabase/middleware.ts` line 67 does `.eq('id', user.id)`

#### B. `is_active` column doesn't exist + wrong `identity_type` values

Line 57: `.select('id, current_hat, identity_type, is_active')` — no `is_active` column on `persons`. The web app checks deactivation via `deactivated_at IS NULL`, not a boolean flag.

Line 9: `identity_type: 'individual' | 'agent'` — the actual values in the DB are `'crew' | 'agent'` (see `packages/types/src/enums.ts` `IdentityType`).

- [x] Remove `is_active` from the `.select()` call — just `'id, current_hat, identity_type'`
- [x] Remove `is_active` from the `Person` interface
- [x] Change `identity_type` in the `Person` interface from `'individual' | 'agent'` to `'crew' | 'agent'`
- [x] Import `IdentityType` and `RoleContext` from `@dockwalker/types` instead of inline string unions — keeps the mobile app's types in sync with the shared package

#### C. Clean up template default assets (MINOR)

- [x] Delete placeholder Expo template images from `apps/mobile/assets/images/` that aren't used (react-logo, partial-react-logo variants) + SpaceMono font. Kept icon.png, splash-icon.png, adaptive-icon.png, favicon.png.

#### D. Verify

- [x] `turbo run type-check` passes
- [x] Auth context `Person` interface matches the actual `persons` table schema

---

### 1. Quick wins — production deploy (user action)

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

(See git history for completed stages 51-163, UI-0 through UI-19, all fix batches, workflow protocol, Playwright baseline, rollback + test fixes, SUG fixes, UI consistency 1-3, Codemagic CI, app icon, bundle ID, Capacitor dead-end cleanup, mobile Phase 1 monorepo + shell + auth)
