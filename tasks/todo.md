# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

---

### Stage 136a: Push Triggers + Email Templates

**Goal:** All permanent notification types handled by `notifyOnEvent`. Push, in-app, and email delivery for permanent events. This is the core of Stage 136 — 80% of the complexity.

**Will touch:** `push-triggers.ts` (additive), `email/templates.ts` (additive).

**Will NOT touch:** Cron, GDPR export, admin routes, documentation.

**Done condition:** All 9 permanent notification types fire. 3 email templates created. Tests pass. Commit independently.

---

#### 1a. Add to `mapEventToNotificationType()` (around line 63-82)

- [ ] Add 8 new entries:
  ```typescript
  'PERMANENT.APPLIED': 'permanent_application_received',
  'PERMANENT.SHORTLISTED': 'permanent_shortlisted',
  'PERMANENT.SELECTED': 'permanent_selected',
  'PERMANENT.REJECTED': 'permanent_rejected',
  'PERMANENT.PLACEMENT_CONFIRMED': 'permanent_placed',
  'PERMANENT.SELECTION_REVERTED': 'permanent_selection_reverted',
  'PERMANENT.CANCELLED_BY_EMPLOYER': 'permanent_posting_cancelled',
  'PERMANENT.ENGAGEMENT_CLOSED': 'permanent_conversation_closed',
  ```
  `PERMANENT.APPLICATION_BLOCKED` and `PERMANENT.WITHDRAWN` are NOT in this map — no notifications.

#### 1b. Add `getPermanentJobNumber()` helper

- [ ] New function alongside existing `getJobNumber()`:
  ```typescript
  async function getPermanentJobNumber(sc: SupabaseClient, postingId: string): Promise<string> {
    const { data } = await sc
      .from('permanent_postings')
      .select('job_number')
      .eq('id', postingId)
      .single();
    return data?.job_number ? `PM-${String(data.job_number).padStart(5, '0')}` : 'a permanent role';
  }
  ```

#### 1c. Extend `getEngagementParties()` to include `permanent_posting_id`

- [ ] Add `permanent_posting_id` to the select:
  ```typescript
  .select('crew_person_id, employer_person_id, daywork_id, permanent_posting_id')
  ```
- [ ] Update return type to include `permanent_posting_id: string | null`

#### 1d. Add `resolveDeepLink()` cases

- [ ] Add cases to the switch:
  ```typescript
  case 'PERMANENT.APPLIED':
    return payload.permanent_posting_id ? `/permanent/${payload.permanent_posting_id}/review` : null;
  case 'PERMANENT.SELECTED':
    return payload.engagement_id ? `/messages/${payload.engagement_id}` : null;
  case 'PERMANENT.SHORTLISTED':
  case 'PERMANENT.REJECTED':
  case 'PERMANENT.PLACEMENT_CONFIRMED':
  case 'PERMANENT.SELECTION_REVERTED':
  case 'PERMANENT.CANCELLED_BY_EMPLOYER':
    return '/discover';
  case 'PERMANENT.ENGAGEMENT_CLOSED':
    return null;
  ```

#### 1e. Add handler functions in `resolveNotification()` switch

Each handler returns `NotifyContext[]`:

- [ ] **`PERMANENT.APPLIED`** — notify employer. Fetch posting for role name + employer_person_id. Title: "New application for {role}", body: "{crewName} applied to {jobNum}"

- [ ] **`PERMANENT.SHORTLISTED`** — notify crew. Fetch posting for role name. Title: "You've been shortlisted for {role}"

- [ ] **`PERMANENT.SELECTED`** — notify crew. Fetch posting for role name. Title: "You've been selected for {role} — check your messages". Deep link to engagement chat.

- [ ] **`PERMANENT.REJECTED`** — notify crew. Title: "Update on your {role} application"

- [ ] **`PERMANENT.PLACEMENT_CONFIRMED`** — most complex handler:
  1. Fetch active engagement for posting → `crew_person_id` is the placed crew
  2. Notify placed crew: "Your placement as {role} is confirmed"
  3. Query applications where `permanent_posting_id` AND `status = 'not_selected'` → notify each: "The {role} position has been filled"
  - Returns multiple `NotifyContext` entries

- [ ] **`PERMANENT.SELECTION_REVERTED`** — fetch engagement parties → notify crew: "The employer is reviewing other candidates for {role}"

- [ ] **`PERMANENT.CANCELLED_BY_EMPLOYER`** — query all non-withdrawn applications for posting → notify each crew: "{role} posting has been closed"

- [ ] **`PERMANENT.ENGAGEMENT_CLOSED`** — fetch engagement parties → notify the other party: "Conversation closed"

#### 1f. Email templates for high-value events

- [ ] In `sendEmailForEvent()`, add cases for `PERMANENT.SHORTLISTED`, `PERMANENT.SELECTED`, `PERMANENT.PLACEMENT_CONFIRMED`
- [ ] Create 3 email template functions in `apps/web/src/lib/email/templates.ts`:
  - `permanentShortlistedEmail({ recipientName, roleName, jobNumber })`
  - `permanentSelectedEmail({ recipientName, roleName, jobNumber, engagementId })`
  - `permanentPlacementConfirmedEmail({ recipientName, roleName, jobNumber })`
- [ ] Follow existing template patterns (branded HTML, CTA button, `wrap()` + `ctaButton()` helpers)

#### 1g. Tests

New file: `apps/web/__tests__/api/permanent-notifications.test.ts`

- [ ] Test: `PERMANENT.APPLIED` — notifies employer
- [ ] Test: `PERMANENT.SHORTLISTED` — notifies crew
- [ ] Test: `PERMANENT.SELECTED` — notifies crew with engagement deep link
- [ ] Test: `PERMANENT.REJECTED` — notifies crew
- [ ] Test: `PERMANENT.PLACEMENT_CONFIRMED` — notifies placed crew AND remaining shortlisted
- [ ] Test: `PERMANENT.SELECTION_REVERTED` — notifies previously selected crew
- [ ] Test: `PERMANENT.CANCELLED_BY_EMPLOYER` — notifies all applicants
- [ ] Test: `PERMANENT.ENGAGEMENT_CLOSED` — notifies other party
- [ ] Test: `PERMANENT.APPLICATION_BLOCKED` — does NOT generate notification
- [ ] Test: `PERMANENT.WITHDRAWN` — does NOT generate notification

#### 1h. Verify + commit

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx vitest run` — all tests pass (802 existing + new)
- [ ] `npx eslint src/ --max-warnings 0` — zero warnings
- [ ] Commit: "Stage 136a: Permanent push triggers + email templates — 10 new tests"

---

### Stage 136b: Cron + GDPR Export + Admin

**Goal:** Engagement-starts cron handles permanent engagements. GDPR export includes permanent data. Admin engagements show permanent_posting_id. Three independent additive modifications.

**Will touch:** `engagement-starts/route.ts`, `account/export/route.ts`, `admin/engagements/route.ts`.

**Will NOT touch:** push-triggers, discover/review/chat, migrations.

**Done condition:** Cron resolves role names for permanent engagements. Export includes permanent fields + postings. Admin shows permanent_posting_id. Tests pass. Commit independently.

---

#### 2a. Engagement-starts cron — permanent awareness

File: `apps/web/src/app/api/cron/engagement-starts/route.ts`

- [ ] Add `permanent_posting_id` to the engagement select (line 28)
- [ ] Split engagement IDs into daywork and permanent groups:
  ```typescript
  const dayworkIds = [...new Set(engagements.filter((e) => e.daywork_id).map((e) => e.daywork_id))];
  const permanentIds = [
    ...new Set(
      engagements.filter((e) => e.permanent_posting_id).map((e) => e.permanent_posting_id),
    ),
  ];
  ```
- [ ] Fetch permanent posting role names (parallel with daywork fetch):
  ```typescript
  const { data: permanentPostings } = await serviceClient
    .from('permanent_postings')
    .select('id, yacht_roles(name)')
    .in('id', permanentIds);
  const permanentRoleMap = new Map(
    (permanentPostings ?? []).map((p: any) => [p.id, p.yacht_roles?.name ?? 'Permanent role']),
  );
  ```
- [ ] Resolve role name per engagement:
  ```typescript
  const roleName = eng.daywork_id
    ? (roleMap.get(eng.daywork_id) ?? 'Daywork')
    : (permanentRoleMap.get(eng.permanent_posting_id) ?? 'Permanent role');
  ```

#### 2b. GDPR export — include permanent data

File: `apps/web/src/app/api/account/export/route.ts`

- [ ] Applications select: add `permanent_posting_id, rejection_reason`
- [ ] Engagements select: add `permanent_posting_id, outcome`
- [ ] Add permanent postings export for employer:
  ```typescript
  const { data: permanentPostings } = await supabase
    .from('permanent_postings')
    .select(
      'id, job_number, role_id, port_id, vessel_id, start_date, salary_min, salary_max, salary_currency, salary_period, live_aboard, status, created_at',
    )
    .eq('employer_person_id', user.id)
    .order('created_at', { ascending: true });
  ```
- [ ] Include `permanent_postings` in the export JSON

#### 2c. Admin engagements — include permanent_posting_id

File: `apps/web/src/app/api/admin/engagements/route.ts`

- [ ] Add `permanent_posting_id` to the select string

#### 2d. Verify + commit

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx vitest run` — all tests pass
- [ ] `npx eslint src/ --max-warnings 0` — zero warnings
- [ ] Commit: "Stage 136b: Cron + GDPR export + admin permanent awareness"

---

### Stage 136c: Final Contamination Checklist + Documentation

**Goal:** Run the full contamination checklist from the permanent jobs spec. Update all governed documentation. Mark the spec as implemented. No code changes.

**Will touch:** Documentation files only (`BUILD_STATE.md`, `apps/web/README.md`, `tasks/permanent-jobs-spec.md`, `tasks/todo.md`).

**Will NOT touch:** Source code, migrations, tests.

**Done condition:** All 9 contamination checklist items pass. All documentation current. Spec marked as implemented.

---

#### 3a. Contamination checklist (from permanent-jobs-spec.md)

- [ ] `npx vitest run` — all tests pass (verify original 716 daywork tests still present by checking test file count for `__tests__/api/` files that don't start with `permanent-`)
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx eslint src/ --max-warnings 0` — zero warnings
- [ ] `grep -r "daywork" apps/web/src/app/api/permanent/` — only shared infrastructure imports (auth, events, push), no daywork-specific modules
- [ ] `git diff HEAD~12..HEAD -- apps/web/src/app/api/daywork/` — should show ONLY the Stage 126b type guards (`.not('daywork_id', 'is', null)` on 11 routes), nothing else
- [ ] `git diff HEAD~12..HEAD -- supabase/migrations/ --name-only` — only `00059_permanent_jobs.sql`
- [ ] `npx supabase db reset` — clean reset with all 59 migrations
- [ ] `npm run test:integration` — 36 integration tests pass
- [ ] Verify shared-file modifications are additive: messages API, context API, profile view route, push-triggers, cron, export, admin — existing daywork output unchanged

#### 3b. Documentation final pass

- [ ] Update `BUILD_STATE.md`:
  - Stage entries for 136a, 136b (or combined as Stage 136)
  - Schema version: still v59
  - "In Progress" → "None"
  - Update test count
- [ ] Update `apps/web/README.md`:
  - Add permanent notification types table to Permanent Jobs section
  - Note email templates for SHORTLISTED, SELECTED, PLACEMENT_CONFIRMED
  - Note cron handles both daywork and permanent engagements
  - Note GDPR export includes permanent postings
- [ ] Verify `packages/types/README.md` — permanent types documented (from Stage 127)
- [ ] Verify `supabase/README.md` — migration 00059 documented (from Stage 127)
- [ ] Update `tasks/permanent-jobs-spec.md` status: change "Draft v5" to "Implemented — Stages 126b-136"
- [ ] Clean up `tasks/todo.md` — clear queue, update Done section

#### 3c. Commit

- [ ] Commit: "Stage 136c: Final contamination checklist passed + documentation"

---

## Done

(See git history for completed stages 51-135, fixes 118a/123a/123b/127a/128a/128b/131a, messages test cleanup)
