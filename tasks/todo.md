# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Mobile Phase 4: Messaging — conversation list, chat threads, engagement actions, rating, checklist

---

## Queue

### Stage 169 review fixes — API field mismatches (all calls return 400)

#### CRITICAL 1 — Cancel overlays send wrong field names

Both cancel overlays use `reason` and `freeText`. The API expects `reason_category` and `reason_text`.

- [x] Fixed cancel-employer-overlay: reason_category, reason_text, relist_requested, relist reason fields body from `{ reason, freeText, relist }` to `{ reason_category: reason, reason_text: freeText.trim() || undefined, relist_requested: relist }`. Also add relist reason fields: when `relist` is true, show a second reason picker with options (`wrong_crew`, `requirements_changed`, `different_skills`, `relist_other`) and pass as `relist_reason_category` and `relist_reason_text`.
- [x] Fixed cancel-crew-overlay: reason_category, reason_text body from `{ reason, freeText }` to `{ reason_category: reason, reason_text: freeText.trim() || undefined }`.

#### CRITICAL 2 — Postponement overlay sends camelCase, API expects snake_case

`apps/mobile/src/components/postponement-overlay.tsx:28-29` sends `{ newStartDate, newEndDate, newWorkingDays, confirmConflict }`. The API expects `{ start_date, end_date, working_days, confirm_conflict }`.

- [x] Fixed postponement: snake_case fields, working_days required, auto-calculate from dates`(not`newStartDate`), `end_date`(not`newEndDate`), `working_days`as integer (not`newWorkingDays`), `confirm_conflict`(not`confirmConflict`). Also: `working_days` is **required** by the API (not optional) — must be a positive integer. Remove the "optional" label; auto-calculate from date span if user doesn't enter one.

#### CRITICAL 3 — Rating overlay has wrong field names AND wrong field types

The rating API uses yes/no/partial strings and booleans, not star ratings. Complete rebuild required.

- [x] Rebuilt rating-overlay with correct field types`to match the API exactly. Reference:`apps/web/src/app/(app)/messages/[engagementId]/\_components/rating-form-overlay.tsx`. The correct fields are:

  **Symmetric (all contexts, both roles):**
  - `communication_accuracy`: **boolean** (Yes/No toggle, not stars)
  - `overall_match`: **integer 1-5** (stars OK here)

  **Cancelled context — crew only:**
  - `notice_given`: **string** `'yes' | 'no' | 'partial'` (3-way picker)

  **Cancelled context — employer only:** just the symmetric fields above.

  **Completed context — crew:**
  - `pay_accuracy`: **string** `'yes' | 'no' | 'partial'`
  - `meals_accuracy`: **string** `'yes' | 'no' | 'partial'`
  - `role_accuracy`: **string** `'yes' | 'no' | 'partial'`
  - `working_days_accuracy`: **string** `'fewer' | 'as_listed' | 'more'`
  - `vessel_condition`: **integer 1-5** (stars OK)
  - `would_work_on_vessel_again`: **boolean**

  **Completed context — employer:**
  - `skills_as_advertised`: **string** `'yes' | 'no' | 'partial'`
  - `certifications_verified`: **boolean**
  - `punctuality`: **string** `'yes' | 'no' | 'partial'`
  - `would_rehire`: **boolean**

#### MEDIUM — Message send doesn't append to UI

`apps/mobile/app/(app)/messages/[engagementId].tsx:85-89` expects `{ message: Message }` from the POST response. The API returns `{ success: true }`. The sent message won't appear until Realtime delivers it or the query refetches.

- [x] Fixed message send: optimistic append with local message, Realtime dedup `result.data.message`. Instead, construct the message locally (`{ id: crypto.randomUUID(), sender_person_id: user.id, content, created_at: new Date().toISOString(), is_system: false }`) and call `appendMessage()` for optimistic display. Deduplicate when Realtime delivers the server copy (check `id` before appending in the Realtime handler).

---

### Mobile UI primitives extraction (must complete before Phase 5)

**Context:** Mobile Phases 1-4 were built with zero shared UI primitives. Every screen has inline styles for buttons, cards, pills, inputs, headers, and empty states. 125 inline style patterns across 28 files. A single color change requires find-and-replace across the entire app. 4 components are also inlined in page files (MessageBubble, ApplicantRow, ConversationRow, ProgressDots). This must be fixed before any further feature work.

#### Primitive components to create in `apps/mobile/src/components/ui/`

- [ ] `button.tsx` — `<Button variant="primary" | "secondary" | "destructive" | "ghost" size="sm" | "md" | "lg" disabled loading>`. Replaces all inline `Pressable` + background color + text color patterns. Primary = `#2563eb`, destructive = `#dc2626`, secondary = border + transparent, ghost = no border.
- [ ] `card.tsx` — `<Card>` wrapper with consistent border radius (12), border color (`#e5e7eb`), white background, padding. Used by job cards, applicant cards, posting cards, conversation rows.
- [ ] `pill.tsx` — `<Pill selected label>`. Replaces the ~40 inline pill patterns (borderRadius 16, paddingHorizontal 12, paddingVertical 6, selected = blue bg + white text, unselected = gray bg + dark text). Used by filters, certs, meals, languages, experience brackets.
- [ ] `text-input.tsx` — `<FormInput label required placeholder>`. Wraps `TextInput` with consistent label, border style, spacing. Replaces the repeated label + TextInput + marginBottom 14 pattern in both post forms.
- [ ] `section-header.tsx` — `<SectionHeader title subtitle>`. Replaces the repeated `fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4` label pattern.
- [ ] `screen-header.tsx` — `<ScreenHeader title onBack>`. Replaces the repeated back button + title + spacer row pattern in post-daywork, post-permanent, review screens, chat.
- [ ] `empty-state.tsx` — `<EmptyState message>`. Replaces the repeated centered gray text empty state pattern.
- [ ] `tab-bar.tsx` — `<TabBar tabs activeTab onChange>`. Replaces the repeated segmented toggle pattern in my-jobs (4 tabs), messages (2 tabs), both review screens (2 tabs).
- [ ] `star-rating.tsx` — `<StarRating value onChange>`. For rating overlay's overall_match and vessel_condition (the only two 1-5 integer fields).
- [ ] `yes-no-partial-picker.tsx` — `<YesNoPartialPicker value onChange>`. For rating overlay's yes/no/partial fields. 3-way toggle.
- [ ] `bool-toggle.tsx` — `<BoolToggle label value onChange>`. For rating overlay's boolean fields (communication_accuracy, would_work_again, would_rehire, certifications_verified).

#### Extract inline components from page files

- [ ] Extract `MessageBubble` from `app/(app)/messages/[engagementId].tsx` to `src/components/message-bubble.tsx`
- [ ] Extract `ApplicantRow` from `app/(app)/permanent/[id]/review.tsx` to `src/components/permanent-applicant-row.tsx`
- [ ] Extract `ConversationRow` from `app/(app)/(tabs)/messages.tsx` to `src/components/conversation-row.tsx`
- [ ] Extract `ProgressDots` from `app/onboarding.tsx` to `src/components/progress-dots.tsx`

#### Adopt primitives across existing screens

- [ ] Replace inline button patterns in all 28 files with `<Button>`
- [ ] Replace inline pill patterns with `<Pill>`
- [ ] Replace inline card patterns with `<Card>`
- [ ] Replace inline input patterns in post-daywork and post-permanent with `<FormInput>`
- [ ] Replace inline screen headers with `<ScreenHeader>`
- [ ] Replace inline tab bars with `<TabBar>`
- [ ] Replace inline empty states with `<EmptyState>`
- [ ] Verify: `#2563eb` (primary blue) appears ONLY in `button.tsx` and `pill.tsx` — not in any page file

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

(See git history for completed stages 51-169, UI-0 through UI-19, all fix batches, workflow protocol, Playwright baseline, rollback + test fixes, SUG fixes, UI consistency 1-3, Codemagic CI, app icon, bundle ID, Capacitor dead-end cleanup, mobile Phase 1-4: auth, discovery, employer flows, messaging core — conversations, chat threads, summary cards, realtime, checklist, engagement action UI shells)
