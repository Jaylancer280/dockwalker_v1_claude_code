# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

### Fix public job page crash — replace self-fetch with direct DB query

> **Root cause (confirmed):** The page server component at `apps/web/src/app/jobs/[jobNumber]/page.tsx` line 44 does `fetch('https://www.dockwalker.io/api/jobs/${jobNumber}')` — a self-fetch back to its own deployment. This is a known Vercel anti-pattern that fails due to cold starts, circular routing, and edge cases in serverless. Four fix attempts tried variations of URL construction — all still self-fetch.
>
> **The fix:** Replace `fetchJob()` with a direct `createServiceClient()` query inside the page. The API route (`apps/web/src/app/api/jobs/[jobNumber]/route.ts`) has the exact query logic — extract it into a shared function or duplicate it in the page.

**Recommended approach — extract shared query function:**

- [ ] Create `apps/web/src/lib/jobs/get-public-job.ts` — extract the query logic from the API route into a reusable function:

  ```typescript
  export async function getPublicJob(jobNumber: string): Promise<JobData | null>;
  ```

  - Accepts job number string, validates format, queries DB with `createServiceClient()`
  - Returns the hydrated `JobData` object or `null` if not found/inactive
  - Handles both DW and PM prefixes
  - Same NDA masking, same hydration (role, port, certs, vessel, bracket)

- [ ] Update `apps/web/src/app/jobs/[jobNumber]/page.tsx`:
  - Replace `fetchJob()` self-fetch function with: `import { getPublicJob } from '@/lib/jobs/get-public-job'`
  - In the page component and `generateMetadata()`: call `getPublicJob(jobNumber)` directly
  - Remove the `fetch()` call entirely

- [ ] Update `apps/web/src/app/api/jobs/[jobNumber]/route.ts`:
  - Import `getPublicJob` from the shared function
  - Replace inline query logic with: `const job = await getPublicJob(jobNumber); if (!job) return 404; return NextResponse.json(job);`
  - Keeps the API route working for any future direct API consumers

- [ ] Verify: open `https://www.dockwalker.io/jobs/DW-00001` (or active job) — page renders, no crash
- [ ] Verify: OG tags work (share link in WhatsApp, check preview card)

---

### Add share button to all job card locations

> `ShareJobButton` exists and works (Web Share API + clipboard fallback). Currently only on My Jobs daywork active cards and the public job page. Must be on every surface where a user sees a job — crew sharing is viral acquisition.

- [ ] Add `ShareJobButton` to daywork discover cards — on the swipe card detail expansion or action area. Pass `job_number`, `role_name`, port name, and formatted rate from the discover API data.
- [ ] Add `ShareJobButton` to permanent discover cards — on the scrollable feed card or detail view. Same props pattern.
- [ ] Add `ShareJobButton` to permanent mine section — employer's permanent posting cards (currently only daywork mine has it). Same pattern as `daywork/mine/page.tsx` line 351.
- [ ] Verify the share text reads naturally in WhatsApp: "{roleName} needed in {location} — {rate}. Apply on DockWalker."

---

---

## Backlog

> Active backlog. Pick items into Queue when ready.
> **Implementation agent: do NOT move items here to defer them. If a todo item
> is too hard, stop and ask — do not unilaterally deprioritise.**

### Business logic / server-side

- **Permanent crew withdrawal auto-revert** — when crew withdraws from a selected permanent posting, employer should decide next step, not auto-revert.
- **Onboarding true atomicity** — `onboard_person` RPC should be fully atomic.
- **Negotiation timeout** — auto-close permanent engagements after X days inactivity.
- **Weekly check-in cron** — periodic nudge for permanent postings with no employer activity.
- **Deactivated user server-side sign-out** — force session invalidation on PERSON.DEACTIVATED.

### Web-only UI

- **Agent market as discover mode** — let agents browse full market feed.
- **Form validation — styled inline errors** — replace browser-native validation (SUG-012).
- **Invalid URL error pages** — custom error pages for garbage URLs (SUG-013).
- **Edit experience "Unknown vessel" prefix** — seed data issue (SUG-017).
- **Applicant count badge on My Jobs**.
- **Discover filter chips**.
- **Notifications grouping**.
- **Email: List-Unsubscribe header**.

### Testing

- **Resilience tests** — network failure, timeout, retry scenarios.
- **Component tests for Permanent UI**.
- **Component tests for Form Pickers**.

### Deferred — Mobile (blocked, needs Mac + Xcode)

- **Mobile Phase 7: TestFlight validation** — app crashes on startup (SIGABRT TurboModule init). Needs Xcode debugger. See `memory/project_mobile_blocked.md`.
- **Mobile Phase 8: Android polish pass**.
- **Capacitor removal** — waiting on Phase 7 validation.
- **Mobile OTA update test**.
- **Mobile Docky hooks/screens** — update to match new single-thread API when mobile unblocks.

---

## Done

(See git history for completed stages 51-200. Stages 185-200: audit fixes, Docky refactor Sessions A/B/C, MCA ingestion + production corpus, off-topic guard, CI/CD deploy-migrations, rollback hardening, availability fix, NDA vessel name masking, RAG threshold, production Docky launch, crew context diagnostics, usage pill refresh, experience fields, gear icon, auto-scroll, Pro gating, hallucination guard, tier messaging, smoker/tattoos, Available Crew Pro gate + tests, invitation direct hire, share job to social.)
