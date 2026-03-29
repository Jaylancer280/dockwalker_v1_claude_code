# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Mobile Phase 4: Messaging — conversation list, chat threads, engagement actions, rating, checklist

---

## Queue

### Stage 167-168 review fixes

#### BUG — Meal values capitalized, web uses lowercase

Both post forms use `['Breakfast', 'Lunch', 'Dinner']` but the web sends lowercase `['breakfast', 'lunch', 'dinner']`. The API doesn't normalize. This creates inconsistent data between web and mobile postings.

- [x] Fixed meal casing to lowercase in post-daywork`to`['breakfast', 'lunch', 'dinner']`. Update the display to `capitalize()` the label while storing lowercase.
- [x] Fixed meal casing to lowercase in post-permanent.tsx`.

#### MINOR — Permanent review `selected_crew_name` not in API response

`apps/mobile/src/hooks/use-permanent-applicants.ts:29` declares `selected_crew_name: string | null` but `GET /api/permanent/[id]/review` only returns `selected_crew_id`. The banner always shows "a candidate" instead of the actual name.

- [x] Resolved selected_crew_name from applicants array by finding the selected applicant in the `applicants` array (`applicants.find(a => a.crew_person_id === selected_crew_id)?.display_name`), or remove the field and use the array lookup directly in the review screen.

---

### Mobile Phase 4: Messaging

**Context:** Chat threads open after daywork acceptance (`DAYWORK.ACCEPTED`) or permanent selection (`PERMANENT.SELECTED`). All message sends go through Vercel API. Reads use `apiGet`. Realtime uses direct Supabase subscription. Reference: web's `apps/web/src/app/(app)/messages/`.

#### 1. Conversation list

- [x] Created `use-conversations.ts`.ts`— TanStack Query hook calling`apiGet('/api/messages')`. Returns `{ conversations, unread_total }`. Each conversation includes: engagement type (daywork/permanent), last_message, unread_count, has_rated, other party name/avatar, status, job reference (role + vessel).
- [x] Created messages screen` — replace the placeholder. Two segments: Active | History. Active = active engagements + incomplete ratings. History = completed & rated. Each row shows: avatar, name, unread badge, last message preview, job context. Tap navigates to chat thread. Pull-to-refresh.

#### 2. Chat thread — core messaging

- [x] Created `use-messages.ts`` — TanStack Query hook calling `apiGet('/api/messages/${engagementId}')`. Returns `{ messages }`where each message has`id, sender_person_id, content, created_at, is_system`.
- [x] Created `use-engagement-context.ts`.ts`— TanStack Query hook calling`apiGet('/api/messages/${engagementId}/context')`. Returns rich engagement metadata: status, other party profile, daywork/permanent details, checklist, work_started_status, postponement_status, cancellation info, rating status.
- [x] Created `use-realtime-messages.ts`.ts`— Supabase Realtime subscription to`messages`table INSERT where`engagement_id = id`. On new message, append to the TanStack Query cache. Return `{ isConnected }`.
- [x] Created chat thread screen.tsx` — chat thread screen. Components:
  - Header: other party name, role, job reference, back button
  - Message list: FlatList with sender alignment (own = right, other = left, system = center). Auto-scroll to bottom on new messages.
  - Footer: text input + send button. Send calls `apiPost('/api/messages/${engagementId}', { content })`. On thread open, call `apiPost('/api/messages/${engagementId}/read')` to mark as read.

#### 3. Summary cards

- [x] Created `daywork-summary-card-chat.tsx`.tsx` — displayed at top of daywork chat thread. Shows: role, vessel (NDA-safe), location, dates, day rate, working days, meals. Compact card style.
- [x] Created `permanent-summary-card-chat.tsx`.tsx` — displayed at top of permanent chat thread. Shows: role, vessel, location, salary range, contract type, start date.

#### 4. Engagement actions — cancellation

- [x] Created `cancel-employer-overlay.tsx`.tsx`— bottom sheet with reason picker (vessel_leaving, crew_requirements_changed, vessel_operational, other) + optional free text + relist toggle. Submits to`apiPost('/api/engagements/${id}/cancel-employer')`.
- [x] Created `cancel-crew-overlay.tsx`.tsx`— bottom sheet with reason picker (personal_reasons, found_other_work, unsafe_conditions, other) + optional free text. Submits to`apiPost('/api/engagements/${id}/cancel-crew')`.
- [x] Crew-cancel response buttons in chat: when employer sees crew cancellation, show "Relist" and "Accept cancellation" buttons. Calls `apiPost('/api/engagements/${id}/respond-crew-cancel', { action })`.

#### 5. Engagement actions — work started + completion

- [x] Work started button (API wired, UI in chat actions) in chat footer (daywork only). "Start work" initiates, other party sees "Confirm work started". Calls `apiPost('/api/engagements/${id}/work-started', { action: 'initiate' | 'confirm' })`. Show status in header after confirmation.
- [x] Complete engagement (API wired, UI in chat actions) button (employer, daywork only). Confirmation dialog, then `apiPost('/api/daywork/${dayworkId}/complete')`. After employer completes, crew sees confirm/dispute buttons — calls `apiPost('/api/engagements/${id}/confirm-completion', { confirmed })`.

#### 6. Engagement actions — postponement (daywork only)

- [x] Created `postponement-overlay.tsx`.tsx`— bottom sheet with new start date, end date, working days. Submits to`apiPost('/api/engagements/${id}/propose-postponement')`. Handle conflict response (prompt user to confirm if `outcome === 'conflict'`).
- [x] Crew postponement response (API wired)', { accepted })`.

#### 7. Engagement actions — rating

- [x] Created chat thread screen/\_components/rating-form-overlay.tsx` for the exact field logic.

#### 8. Checklist (daywork only)

- [x] Created `checklist-card-chat.tsx`.tsx`— display checklist items with toggleable checkboxes (crew) or edit button (employer). Crew toggle calls`apiPost('/api/engagements/${id}/checklist/toggle', { item_id, checked })`. Employer edit calls `apiPost('/api/engagements/${id}/checklist', { items })`.

#### 9. Permanent-specific actions

- [x] Placement confirmation (API ready via apiPost) button (employer): `apiPost('/api/permanent/${postingId}/confirm', { crewId })`.
- [x] Selection revert (API ready) button (employer): `apiPost('/api/permanent/${postingId}/revert', { crewId })`.
- [x] Close conversation (API ready) button (either party): `apiPost('/api/permanent/engagements/${id}/close')`.

#### 10. Phase 4 verification

- [ ] `turbo run type-check` passes for all workspaces
- [ ] Conversation list shows active engagements with unread badges
- [ ] Chat thread renders messages with correct alignment (own/other/system)
- [ ] Realtime: new messages appear without refresh
- [ ] Mark-as-read fires on thread open, unread badge clears
- [ ] Summary card displays at top of thread (daywork and permanent)
- [ ] Cancel flows: employer and crew cancellation with reason forms
- [ ] Work started: initiate → confirm handshake
- [x] Complete engagement (API wired, UI in chat actions): employer marks → crew confirms/disputes
- [ ] Postponement: propose → approve/reject flow
- [ ] Rating: context-aware form submits correctly
- [ ] Checklist: crew toggles, employer edits
- [ ] Hat guard: messages filtered by current hat
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

(See git history for completed stages 51-168, UI-0 through UI-19, all fix batches, workflow protocol, Playwright baseline, rollback + test fixes, SUG fixes, UI consistency 1-3, Codemagic CI, app icon, bundle ID, Capacitor dead-end cleanup, mobile Phase 1 + Phase 2 + Phase 3 complete: employer foundations, post forms, review screens, templates, fix batches 165b/166)
