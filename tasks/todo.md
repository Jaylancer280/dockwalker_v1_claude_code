# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Mobile Phase 6: Docky + Polish — AI advisor, push notifications, notifications tab, settings, billing

---

## Queue

### Mobile Phase 6: Docky + Polish

**Context:** Final feature phase before shipping. Covers the Docky AI advisor (crew-only), push notifications via expo-notifications, the notifications tab, settings/preferences page, billing page (external Stripe checkout), and the More tab. All API routes exist on the web backend. UI primitives from Stage 170 must be used throughout.

#### 1. Docky AI advisor

**Context:** Crew-only AI maritime advisor. Uses existing `/api/advisor/` endpoints. Free tier: 3 questions/month. Crew Pro: unlimited. RAG pipeline runs server-side — mobile just sends messages and displays responses.

- [x] Create `apps/mobile/src/hooks/use-docky-conversations.ts`
- [x] Create `apps/mobile/src/hooks/use-docky-messages.ts`
- [x] Create `apps/mobile/src/hooks/use-docky-usage.ts`
- [x] Create `apps/mobile/app/(app)/docky.tsx` — conversation list with usage pill, new conversation, delete via long-press, empty state with Docky intro.
- [x] Create `apps/mobile/app/(app)/docky/[conversationId].tsx` — chat thread with user/assistant bubbles, collapsible sources, thinking state, 402 upgrade prompt, 500 char input.
- [x] Link Docky from the More tab.

#### 2. Push notifications

**Context:** Register Expo Push Token with the backend, handle foreground/background/tap. The backend already sends push via Expo Push Service — mobile just needs to register the token and handle incoming notifications.

- [x] Install `expo-notifications`.
- [x] Create `apps/mobile/src/lib/push-notifications.ts` — register/deregister token, foreground suppression, tap→deep link navigation.
- [x] Foreground handler: suppresses native notification when app is in foreground.
- [x] Tap handler: maps deep_link data to correct screen (chat, discover, review, profile).
- [x] Wire push registration into auth flow: register on fetchPerson success, deregister on signOut.

#### 3. Notifications tab

- [x] Create `apps/mobile/src/hooks/use-notifications.ts`
- [x] Create `apps/mobile/src/hooks/use-notification-count.ts` — 30s staleTime, 60s refetchInterval.
- [x] Rebuild `apps/mobile/app/(app)/(tabs)/notifications.tsx` — notification list with unread dot, tap→deep link, mark all read, pull-to-refresh, empty state.
- [x] Wire unread badge count into tab navigator via `_layout.tsx` — `tabBarBadge` on Alerts and Messages tabs.
- [x] Mark notification as read on tap via `apiPost('/api/notifications/${id}/read')`.

#### 4. Settings page

- [x] Create `apps/mobile/src/hooks/use-preferences.ts`
- [x] Create `apps/mobile/app/(app)/settings.tsx` — notification toggles, sign out, data export, account deletion (type DELETE), change password, version/terms/privacy/support links.
- [x] Link from More tab.

#### 5. Billing page

- [x] Create `apps/mobile/app/(app)/billing.tsx` — plan status, Crew Free/Pro tier cards, subscribe opens Safari (App Store compliance), manage subscription via Stripe portal.
- [x] Link from More tab.

#### 6. More tab

- [x] Rebuild `apps/mobile/app/(app)/(tabs)/more.tsx` — menu list: Docky, Settings, Billing, My Vessels (employer/agent only), Sign Out with confirmation, app version.

#### 7. Phase 6 verification

- [x] `turbo run type-check` passes
- [ ] Docky: conversation list, new conversation, send message, receive AI response
- [ ] Docky: free tier limit (402) shows upgrade prompt
- [ ] Docky: delete conversation works
- [ ] Push: token registered on sign-in, deregistered on sign-out
- [ ] Push: tap notification navigates to correct screen
- [ ] Notifications tab shows notification list with unread indicators
- [ ] Tab badges show unread counts (notifications + messages)
- [ ] Settings: notification toggles save immediately
- [ ] Settings: data export downloads, account deletion works
- [ ] Billing: shows current plan, subscribe opens Safari
- [ ] More tab: all links navigate correctly
- [x] All new screens use UI primitives — zero inline `#2563eb` (grep verified)
- [ ] Web app completely unaffected

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

(See git history for completed stages 51-171. Mobile Phases 1-5 complete + UI primitives. Fix batches: 165b, 166, 169. CLAUDE.md + BUILD_STATE.md modernisation.)
