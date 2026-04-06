# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

### URGENT — Public job page crash: `useToast must be used within ToastProvider`

> **Evidence from Vercel logs:** `Error: useToast must be used within ToastProvider`. The `ShareJobButton` calls `useToast()` for the "Link copied" fallback. The public page layout (`/jobs/[jobNumber]/layout.tsx`) doesn't have a `ToastProvider` — only the app layout (`/(app)/`) does.

- [ ] In `apps/web/src/app/jobs/[jobNumber]/layout.tsx`: wrap `{children}` with the `ToastProvider` (and `Toaster` component for rendering toasts). Import from the same source as the app layout.
- [ ] Verify: open share link → page renders → tap share button → "Link copied" toast appears

---

### Agent profile overlay — add AgentProfileView

> The profile overlay uses `CrewProfileView` for agents — shows crew fields (certs, vessel exposure) but missing agent fields. Needs a dedicated `AgentProfileView`.

- [ ] In `apps/web/src/components/profile-overlay.tsx`: add `AgentProfileView` showing: agency name, nickname, placement locations, department specialisation pills, active posting count, bio, maritime background count
- [ ] The view-only profile API must return these for agents — verify and extend if missing
- [ ] Route agents to `AgentProfileView` (not `CrewProfileView`) based on `identity_type`

---

### Agent maritime history — use shared ProfileExperienceSection

> Agent profile renders experience entries as bare divs (vessel name + role + date only). Should reuse the crew's `ProfileExperienceSection` with expandable cards, M/Y/S/Y prefix, operation badge, epaulette, edit/delete.

- [ ] In `agent-profile-section.tsx`: replace inline experience rendering with `ProfileExperienceSection` component
- [ ] Forward required props from parent `profile/page.tsx` (same as crew branch ~line 654-666)

---

### Agent market — add department filter

> Market filter panel has role, location, cert filters. No department filter. Add cascading department → role dropdown.

- [ ] In `market-filter-panel.tsx`: add "Department" dropdown above "Role". Options: All, Deck, Interior, Engineering, Galley, Bridge.
- [ ] When department selected, filter roles dropdown to that department only.

---

### Agent My Jobs not showing posted jobs

> Agent posts a job → visible on discover (crew sees it) → does NOT appear in agent's My Jobs. The mine API or page may filter by hat/role_context excluding agents.

- [ ] Check `apps/web/src/app/api/daywork/mine/route.ts` and `permanent/mine/route.ts` — do they filter by `role_context = 'employer'` only? Agent posts have `role_context = 'agent'`.
- [ ] Fix: include `role_context IN ('employer', 'agent')` or filter by `poster_person_id` only.

---

### Vessel fuzzy search doesn't save (manual entry works)

> Selecting an existing vessel from IMO fuzzy search doesn't save. Manual entry works. The bug is in the "select existing" code path.

- [ ] Trace the vessel selector flow: when user picks from search results, what value is submitted? Is `vessel_id` passed to the API, or does it try to create a new vessel?
- [ ] Add `console.error` to vessel POST route for diagnostics.

---

### UX fixes (all hats — verify across crew, employer, agent)

**Contract type drill-down broken:**

- [ ] Selecting "Rotational" doesn't show sub-options (2:2, 3:3, custom). Selecting "Permanent" doesn't show leave days. Check all forms.

**Meals optional when live aboard:**

- [ ] When live aboard checked, change label to "Meals included (optional)". Check daywork + permanent forms.

---

### Admin identity type change (deferred — medium-high effort)

> `identity_type` is immutable by design. Changing it requires new event type, projection handler, hat correction, agent data validation. 24+ routes check it. Admin-only, not self-service.

- Scope captured. Build when needed.

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
- **Share button on discover cards (crew view)** — secondary placement.

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

(See git history for completed stages 51-200+. Recent: audit fixes, Docky refactor + production launch, CI/CD deploy-migrations, rollback hardening, NDA name masking, invitation direct hire, share to social, agent profile enhancements, date input component, permanent card truncation, department specialisation pills, permanent mine shadcn tabs, citiesToGroups helper, Available Crew Pro gate.)
