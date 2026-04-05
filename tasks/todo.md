# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

### Share Job to Social (Stage 200)

> Primary organic acquisition channel. No migration, no event model changes. Public job page + OG tags + share button.
> **Full spec:** `tasks/share-job-to-social-spec.md` — read the entire spec before starting.

**Middleware (do first — unblocks the public routes):**

- [ ] In `apps/web/src/middleware.ts`: add `/jobs/:path*` to the public route allowlist (alongside `/`, `/auth/*`, etc.)
- [ ] Also add `/api/jobs/:path*` to the API public allowlist (no auth required)

**Public API route:**

- [ ] Create `apps/web/src/app/api/jobs/[jobNumber]/route.ts` — GET handler:
  - No auth required (public endpoint)
  - Parse job number: `DW-XXXXX` → query `dayworks`, `PM-XXXXX` → query `permanent_postings`
  - Validate format with regex (`/^(DW|PM)-\d{5}$/`) — return 404 immediately for malformed input
  - Query with `status = 'active'` only — inactive/cancelled/completed jobs return 404
  - Use `serviceClient` (no auth context available)
  - Hydrate: join role name (`yacht_roles`), port/city/region names, cert names (`certifications`), experience bracket label, vessel data via `get_vessel_public` (NDA-safe — no caller auth means NDA vessels show "NDA Vessel", no IMO)
  - Response shape: see spec § Components → 1. Public Job Detail API Route
  - Do NOT return: `poster_person_id`, `poster_name`, `imo_number`, `positions_filled`
  - Top-level try/catch with 500 JSON response

**Public page + layout:**

- [ ] Create `apps/web/src/app/jobs/[jobNumber]/layout.tsx` — minimal layout:
  - DockWalker logo (top-left), no sidebar, no bottom nav, no auth context
  - Simple footer: "DockWalker — Superyacht hiring, simplified"
- [ ] Create `apps/web/src/app/jobs/[jobNumber]/page.tsx` — server-rendered:
  - Fetch from the public API route (or query directly server-side with service client)
  - Department background image (same `getDepartmentImageSrc` helper from discover cards)
  - Role name + epaulette badge
  - Vessel name + type + size band (NDA-safe)
  - Location: port, city, region
  - Key details grid (daywork: dates, rate, positions, meals, experience | permanent: salary, contract, live aboard, start date)
  - Required certs as pill badges
  - Required languages as pill badges
  - Notes/description if present
  - Posted date + job reference
  - CTA section (sticky on mobile): "Sign up to apply on DockWalker" → `/auth/signup?returnTo=/discover`
  - "Already have an account? Log in" → `/auth/login?returnTo=/discover`
  - `robots: 'noindex'` in metadata (no search indexing initially)
  - `<link rel="canonical" href="https://www.dockwalker.io/jobs/{jobNumber}" />`
- [ ] Fallback state when job not found/inactive: "This job is no longer available" + "Browse jobs" CTA → `/auth/signup`
- [ ] `generateMetadata()` with dynamic OG tags:
  - Daywork title: `"{Role} — {City}, {days} days, {currency symbol}{rate}/day — DockWalker"`
  - Permanent title: `"{Role} — {City}, {currency symbol}{salaryMin}-{salaryMax}/month — DockWalker"`
  - Description: `"{Vessel} is looking for a {role} in {port}, {city}. {dateRange or 'Start ASAP'}. Apply on DockWalker."`
  - NDA description: `"A {sizeBand} {vesselType} yacht is looking for a {role} in {city}. Apply on DockWalker."`
  - `openGraph.images`: `/images/brand/og-image.png` (1200x630)
  - `twitter:card`: `summary_large_image`

**Share button component:**

- [ ] Create `apps/web/src/components/share-job-button.tsx`:
  - Props: `jobNumber`, `roleName`, `location`, `rate` (formatted string like "€250/day")
  - Constructs URL: `https://www.dockwalker.io/jobs/${jobNumber}`
  - Constructs text: `"{roleName} needed in {location} — {rate}. Apply on DockWalker."`
  - Tap: `navigator.share({ title, text, url })` if available
  - Fallback: copy URL to clipboard, show toast "Link copied"
  - Small share icon, unobtrusive
- [ ] Place on My Jobs cards (employer/agent view) — PRIMARY placement, prominent
- [ ] Place on discover card detail view or permanent job card (crew view) — secondary
- [ ] Place on the public job detail page itself (re-sharing)

**Static OG image:**

- [ ] Create `apps/web/public/images/brand/og-image.png` — 1200x630, dark navy background, DockWalker logo centred, tagline "Superyacht hiring, simplified". See `tasks/founder-drafts.md` § 7 for spec. If you can't generate the image, create a placeholder and flag for the user.

**Tests:**

- [ ] Test public API route: happy path daywork (200 + correct shape), happy path permanent (200), inactive job (404), malformed job number (404), NDA vessel returns "NDA Vessel" name
- [ ] `turbo run type-check` passes
- [ ] `turbo run lint` passes (filtered)
- [ ] All vitest tests pass

**Verify:**

- [ ] Open `https://localhost:3000/jobs/DW-00001` (or whatever seed job number exists) — page renders without auth
- [ ] Check OG tags: `curl -s https://localhost:3000/jobs/DW-00001 | grep 'og:'`
- [ ] Share button copies link on desktop, opens share sheet on mobile

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
- **Mobile Docky hooks/screens** — update to match new single-thread API when mobile unblocks.

---

## Done

(See git history for completed stages 51-199. Stages 185-199: audit fixes, Docky refactor Sessions A/B/C, MCA ingestion + production corpus, off-topic guard, CI/CD deploy-migrations, rollback hardening, availability fix, NDA vessel name masking, RAG threshold, production Docky launch, crew context diagnostics, usage pill refresh, experience fields, gear icon, auto-scroll, Pro gating, hallucination guard, tier messaging, smoker/tattoos, Available Crew Pro gate + tests, invitation direct hire.)
