# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

### USER ACTION: Enable JWT claims + deploy migrations

- [ ] Enable the hook in Supabase dashboard (Auth → Hooks → Custom Access Token → `public.custom_access_token_hook`)
- [ ] Deploy migrations 00076-00079 to production Supabase
- [ ] Verify discover page loads in <1 second with 50 results (batch vessel lookup)

### Performance Fix 3: Cache static lookups in app shell (HIGH — eliminates ~20 queries per page)

**Context:** Yacht roles, certifications, experience brackets, nationalities, visa types, ports, cities, regions, size bands — all canonical data that changes once a quarter. Currently fetched from Supabase on every page load by every page that needs dropdowns or pills. ~20 queries per page.

**Approach:** Create a `LookupsProvider` React context that fetches all canonical data once on app shell mount, caches it in memory, and provides it to all child components. Revalidate on a timer (every 24 hours) or on explicit user action.

- [ ] Create `apps/web/src/hooks/use-lookups.ts` — React context + provider that fetches all canonical tables in a single `Promise.all` on mount: `yacht_roles`, `certifications`, `experience_brackets`, `nationalities`, `visa_types`, `ports`, `cities`, `regions`, `vessel_size_bands`, `languages` (from shared)
- [ ] Create `apps/web/src/components/lookups-provider.tsx` — wraps the app shell, provides the context
- [ ] Add `<LookupsProvider>` to the app layout (`apps/web/src/app/(app)/layout.tsx`)
- [ ] Update discover page: use lookups from context instead of fetching `/api/daywork/discover` lookups
- [ ] Update post daywork page: use lookups from context instead of inline Supabase queries
- [ ] Update post permanent page: same
- [ ] Update profile edit page: same
- [ ] Update onboarding page: same
- [ ] Update filter panel: same
- [ ] Verify: no page makes individual Supabase queries for canonical lookup data anymore (grep for `from('yacht_roles')`, `from('certifications')`, etc. in page components — should only be in the provider and API routes)

### Performance Fix 4: Deduplicate middleware + auth guard (HIGH)

**Context:** Even after Fix 1 (JWT claims), the middleware and auth guard both call `supabase.auth.getUser()` which hits the Supabase Auth server. The middleware validates the session, then the API route validates it again. The middleware result should be passed through.

- [ ] Research: can Vercel middleware pass data to API routes via headers? (Yes — `x-` headers on the rewritten request)
- [ ] Update middleware: after validating session, set `x-user-id`, `x-person-id`, `x-current-hat`, `x-identity-type` headers on the request
- [ ] Update `require-domain-user.ts`: check for `x-person-id` header first. If present and valid, skip `supabase.auth.getUser()` call. Only call auth if headers are missing (direct API calls that bypass middleware)
- [ ] Security check: ensure these headers can't be spoofed by external callers (middleware must strip any incoming `x-person-id` headers before setting its own)
- [ ] Test: verify API routes no longer call `supabase.auth.getUser()` when accessed via browser (middleware sets headers)

### Performance Fix 5: Parallelize client-side fetches (HIGH)

**Context:** Discover page fires 6+ API calls mostly in sequence. Profile page fires 5+ sequential calls. Each blocks the next.

- [ ] Update `apps/web/src/app/(app)/discover/page.tsx`: wrap all independent data fetches in a single `Promise.all` — discover data, applications, invitations, availability should all fire simultaneously
- [ ] Update `apps/web/src/app/(app)/profile/page.tsx`: same — profile, availability, experiences, lookups should fire in parallel
- [ ] Update `apps/web/src/app/(app)/messages/page.tsx`: remove duplicate `get_unread_counts` RPC call (fetched twice — once via API, once directly)
- [ ] Audit all other page components for sequential fetch patterns and parallelize where possible

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

- **OG social sharing image** — see `tasks/founder-drafts.md` § 7.
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

---

## Done

(See git history for completed stages 51-174. Mobile Phases 1-6 complete + UI primitives. EAS config stage 173. Vercel build fix. Stage 174: hat switcher copy, full-bleed cards, header toggle, JWT claims, batch vessel lookup, favicon.)
