# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Mobile UI primitives — adoption pass (primitives created but not used)

---

## Queue

### UI primitives adoption — the actual refactor (must complete before Phase 5)

**Context:** Stage 170 created 11 UI primitives in `apps/mobile/src/components/ui/` and extracted 4 inline components. However, **only the rating overlay actually imports from ui/**. The other 27 files still use inline styles. `#2563eb` appears in 27 non-primitive files (should be 0). The primitives are dead code until this adoption pass is done.

**Implementation agent: do NOT mark items [x] unless the import is verified in the file. The previous agent marked all adoption items complete without doing the work. grep for the import before marking done.**

#### Page files — replace inline patterns with primitives

Each file below must import and use the listed primitives. After each file, grep to confirm zero `#2563eb` remains (except in ui/ files).

- [x] `app/(app)/(tabs)/my-jobs.tsx` — TabBar, Card, Button, EmptyState, colors.primary. Grep verified: zero `#2563eb`.
- [x] `app/(app)/(tabs)/messages.tsx` — TabBar, EmptyState. Grep verified: zero `#2563eb`.
- [x] `app/(app)/(tabs)/discover.tsx` — TabBar, Button, colors.primary. Grep verified: zero `#2563eb`.
- [x] `app/(app)/post-daywork.tsx` — ScreenHeader, FormInput, SectionHeader, Pill, Button, colors.primary. Grep verified: zero `#2563eb`.
- [x] `app/(app)/post-permanent.tsx` — ScreenHeader, FormInput, SectionHeader, Pill, Button, colors.primary. Grep verified: zero `#2563eb`.
- [x] `app/(app)/post.tsx` — ScreenHeader, Card. Grep verified: zero `#2563eb`.
- [x] `app/(app)/daywork/[id]/review.tsx` — ScreenHeader, TabBar, Button, EmptyState, Card. Grep verified: zero `#2563eb`.
- [x] `app/(app)/permanent/[id]/review.tsx` — ScreenHeader, TabBar, EmptyState, colors.primary. Grep verified: zero `#2563eb`.
- [x] `app/(app)/messages/[engagementId].tsx` — colors.primary for back arrow + send button. Grep verified: zero `#2563eb`.

#### Component files — replace inline patterns with primitives

- [x] `src/components/discover-filters.tsx` — Pill, SectionHeader, Button, colors.primary. Grep verified: zero `#2563eb`.
- [x] `src/components/availability-overlay.tsx` — colors.primary, Button. Grep verified: zero `#2563eb`.
- [x] `src/components/vessel-selector.tsx` — colors.primary, Pill, Button. Grep verified: zero `#2563eb`.
- [x] `src/components/form-role-picker.tsx` — colors.primary. Grep verified: zero `#2563eb`.
- [x] `src/components/form-location-picker.tsx` — colors.primary. Grep verified: zero `#2563eb`.
- [x] `src/components/form-cert-picker.tsx` — colors.primary. Grep verified: zero `#2563eb`.
- [x] `src/components/form-language-picker.tsx` — colors.primary. Grep verified: zero `#2563eb`.
- [x] `src/components/cancel-employer-overlay.tsx` — Button, SectionHeader, colors.primary. Grep verified: zero `#2563eb`.
- [x] `src/components/cancel-crew-overlay.tsx` — Button, SectionHeader, colors.primary. Grep verified: zero `#2563eb`.
- [x] `src/components/postponement-overlay.tsx` — Button, SectionHeader. Grep verified: zero `#2563eb`.
- [x] `src/components/template-selector.tsx` — Card. Grep verified: zero `#2563eb`.
- [x] `src/components/job-detail-sheet.tsx` — colors.primary, Button. Grep verified: zero `#2563eb`.
- [x] `src/components/permanent-detail-sheet.tsx` — colors.primary, Button. Grep verified: zero `#2563eb`.
- [x] `src/components/applicant-card.tsx` — colors.primary. Grep verified: zero `#2563eb`.
- [x] `src/components/permanent-applicant-row.tsx` — Button already imported. Grep verified: zero `#2563eb`.
- [x] `src/components/conversation-row.tsx` — colors.primary for unread badge. Grep verified: zero `#2563eb`.
- [x] `src/components/message-bubble.tsx` — colors.primary for own-message bg. Grep verified: zero `#2563eb`.
- [x] `src/components/checklist-card-chat.tsx` — colors.primary. Grep verified: zero `#2563eb`.

#### Final verification

- [x] `grep -r '#2563eb' apps/mobile/app/` returns **zero results** — verified
- [x] `grep -r '#2563eb' apps/mobile/src/components/` returns results **only in** `ui/button.tsx`, `ui/pill.tsx`, `ui/bool-toggle.tsx`, `ui/yes-no-partial-picker.tsx`, `ui/screen-header.tsx`, `ui/colors.ts` — verified (message-bubble now uses `colors.primary`)
- [x] `turbo run type-check` passes — verified

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

(See git history for completed stages 51-170, UI-0 through UI-19, all fix batches, workflow protocol, Playwright baseline, rollback + test fixes, SUG fixes, UI consistency 1-3, Codemagic CI, app icon, bundle ID, Capacitor dead-end cleanup, mobile Phase 1-4: auth, discovery, employer flows, messaging core — conversations, chat threads, summary cards, realtime, checklist, engagement action UI shells, Stage 170 UI primitives extraction)
