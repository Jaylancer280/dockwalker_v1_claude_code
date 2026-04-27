# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

### Location manual-add bug on daywork posting

> Reported during references QA on 2026-04-27. Parked while we shipped the references work; now resuming.

**Symptoms (user report):**

- During daywork posting, when the LocationPicker can't find a place and the user uses "Add it manually", the location appears not to save and the user is bounced back to the "Post a job" type selector (daywork vs permanent).
- Admin → Pending locations is empty after the manual add — no row to approve / merge / hide.

Both ends broken: the row isn't being persisted AND the form navigates away. Two possibly-independent failures stacked.

**Investigation steps:**

- [ ] Reproduce locally: post-daywork → location field → search for `Captain Bob's Private Dock` → click "Add it manually" → fill country/city/port/notes → submit → observe network tab + page navigation.
- [ ] Check the manual-add API route. Likely candidates: `apps/web/src/app/api/locations/request/route.ts` or similar. Read the handler — does it actually insert, or does it rollback. Verify the `00117_locations_pending_v1.sql` migration is applied to the live remote (working tree had it untracked initially).
- [ ] Inspect the LocationPicker submit handler. Why does the form navigate to the type selector? Likely: form state is reset after the picker modal closes, then a stale `router.push` fires.
- [ ] Verify the admin pending-locations RLS — submitter can see their own pending rows, admins can see all. If admin sees nothing, either the row isn't being inserted, or the admin policy doesn't grant SELECT.

**Acceptance:**

- Manually-added location persists in the post form (no kick-back to type selector).
- Row appears in admin Pending Locations queue with Approve / Merge / Hide actions.
- Resulting job card shows the location label to all viewers.

---

## Queue

### Post-review backlog (sourced from end-to-end audit, 2026-04-27)

> Full context for every item below is in [`tasks/end-to-end-review-2026-04-27.md`](./end-to-end-review-2026-04-27.md). Risk IDs (M-1, F-1, etc.) match the consolidated risk register in that document. Both P0 fixes (D-1 event idempotency + D-2 null-safety guards) shipped 2026-04-27 — see commits `bd8a3f8` (D-2), `3eccfff` (D-1), schema v122 → v124.

#### P1 — operational + go-to-market posture

These are not code-level bugs; they are gaps in operational readiness, regulatory positioning, and external trust signals. Order of impact roughly: M-1 > M-2 > M-3 > the rest.

- [ ] **P1 — M-1: Publish MLC 2006 positioning statement, fix the marketing-copy/gate gap, and apply for MCA RPSP accreditation.**

  **Problem:** Every agency competitor (YPI Crew, The Crew Network, Wilson Halligan, Quay Crew, Bluewater) leads marketing with MLC 2006 / MCA accreditation. DockWalker is silent on this. To a captain or fleet manager evaluating the platform, that silence reads as "amateur hour" — even though the architecture would actually pass an audit better than most agency CRMs (append-only ledger, immutable IMO anchor, structured cancellation reasons, GDPR export coverage).

  **A separate, narrower issue surfaced by the 2026-04-27 codebase audit:** the Crew Pro tier gates the "Available Crew" tab (proactive employer-initiated invitations) at `apps/web/src/app/api/daywork/[id]/available-crew/route.ts:137-149` — only Crew Pro subscribers appear when employers browse for crew to invite. The structural model is defensible under Reg 1.4 (every daywork posting remains publicly applyable by every crew member; Available Crew is a parallel discovery surface, not the only one — this is closer to LinkedIn Premium than to the historical agency-fee abuse the convention was designed to stop, and Crewseekers operates a more aggressive paid-crew membership model openly without enforcement action). However, the marketing copy is inconsistent with the implementation: `apps/web/src/app/page.tsx:33-35` and `:143-149` claim "no pay-to-rank" / "fair visibility", which is factually contradicted by the gate. This is a truth-in-advertising issue separate from but adjacent to MLC. The upsell at `apps/web/src/components/availability-overlay.tsx:405-413` ("Upgrade to Crew Pro to appear in employer searches") and the feature label at `apps/web/src/app/(app)/billing/page.tsx:36` both read more aggressively than the actual model warrants — a regulator skim-reading those strings in isolation might bucket the platform incorrectly.

  **Why it matters:** Two concerns rolled together. The positioning silence is the largest single credibility gap with sophisticated buyers. The copy-vs-implementation gap creates a small but meaningful regulatory ambiguity that's trivial to close. Both are best handled in the same maritime-lawyer engagement.

  **Suggested fix:** Four deliverables. (1) **Marketing-copy reconciliation** (~1 hour, do this first): rewrite `availability-overlay.tsx:405-413` to lead with free-baseline-access ("Free crew can apply to any posted job. Crew Pro adds proactive discovery — employers can also find and invite you directly."); remove the "no pay-to-rank" / "fair visibility" claims from `page.tsx:33-35` and `:143-149` (the rest of the value-prop block stands); rewrite the Crew Pro feature label at `billing/page.tsx:36` to "Get discovered by employers — appear in proactive search alongside applying directly to posted jobs"; add one line to T&Cs §1 making equal-baseline-access explicit ("Crew may apply to any posted job at no cost. Crew Pro is an optional subscription for additional features."). (2) **Maritime-specialist lawyer review** (~1-2 hour engagement) to confirm the marketplace-facilitator vs manning-agency line is held AND specifically to bless the freemium structure against Reg 1.4. (3) **Marketing-site compliance page** (`/about/compliance` or similar) publishing the MLC 2006 alignment statement, citing Regulation 1.4, listing what DockWalker does and does not do, and naming the data-protection officer (DPO contact already wired as admin@nautalink.io per `apps/web/src/lib/legal-placeholders.ts`). The positioning statement should be deliberate: "DockWalker is a facilitation platform under MLC 2006 Regulation 1.4. We do not charge seafarers for job access. We do not place crew. We provide structured discovery and audit-grade event records." (4) **UK MCA RPSP accreditation application** — see MGN 490 for the criteria.

  **Acceptance:** copy-reconciliation merged (verify with grep that "pay-to-rank" no longer appears in landing page and the upsell leads with free-access framing); compliance page published; T&Cs reviewed by maritime lawyer with explicit Reg 1.4 sign-off on the Crew Pro tier; RPSP application submitted (regardless of outcome — submission alone is a signal).

- [ ] **P1 — M-2: Land 3 named captain endorsements before launch.**

  **Problem:** Trust in the superyacht industry is transitive through named individuals. One named senior captain on a 60m+ moves more crew than three months of paid acquisition. DockWalker has zero captain testimonials, zero named yacht references on the marketing surface today.

  **Why it matters:** The competitor matrix in `tasks/end-to-end-review-2026-04-27.md` shows that platforms without trust signals (Yotspot for crew quality, Crewseekers, etc.) live in the long tail. Agencies that survive long-term all have decades-of-named-captain endorsements quietly underwriting their pipeline. DockWalker can short-cut to that with three deliberate asks.

  **Suggested fix:** Identify three Antibes-based captains running charter-operated 60m+ vessels. Approach via warm intro (likely founder's existing network — Nautalink Technologies is UK-registered and the founder presumably has industry contacts). Offer Crew Pro for life for any named crew member of any captain who endorses. The endorsement is name + yacht (e.g., "Captain X, M/Y Y") — anonymized testimonials don't move trust in this industry.

  **Acceptance:** three published endorsements on the marketing site, by name, with yacht reference.

- [ ] **P1 — M-3: Resolve mobile-app blockage and complete Expo Phase 7 (TestFlight).**

  **Problem:** Daywork is intrinsically mobile. Crew use phones at the dock, captains coordinate from their cabin, the entire WhatsApp loop DockWalker is replacing is mobile-native. Until the Expo app ships, DockWalker is competing one-handed against Dayworker.co's iOS+Android presence and against the inherently-mobile WhatsApp loop. Per project memory, the blocker is a native startup crash that requires Mac + Xcode to debug, and the founder doesn't currently have access — estimated unblock ~June 2026.

  **Why it matters:** The architecture work is done — Phase 4 (conversations) is complete, Phase 5–7 are deployment + UX-polish + Capacitor-removal phases. The blockage is purely environmental, not architectural. Every week of delay extends the window in which Dayworker.co or a copycat can build mindshare in the daywork-native segment that's currently functionally vacant.

  **Suggested fix:** Either (a) acquire Mac+Xcode access (cheapest: rent a cloud Mac via MacStadium or AWS EC2 Mac — ~$60/month, sufficient for sporadic debugging), or (b) contract a Mac-native iOS developer for 2-3 days to surface the crash root cause (~£1500 budget). Option (a) is cheaper but requires founder bandwidth; option (b) is faster and resolves the blocker definitively. Once the crash is fixed: complete Phases 5 (in-flight UX polish), 6 (push notification provisioning), 7 (TestFlight + 3 tester devices + 48-hour zero-P0 window). Then delete Capacitor legacy files per `tasks/mobile-web-split-spec.md` § 9.

  **Acceptance:** TestFlight build distributed to 3+ tester devices; zero P0 bugs in 48 hours; Capacitor legacy files removed.

- [ ] **P1 — T-1: Wire Playwright E2E to GitHub Actions CI.**

  **Problem:** 355 Playwright specs across 17 files exist and pass locally (last manual run 2026-03-27 per `tasks/playwright-test-registry.md`). Pre-commit hook runs Vitest + type-check only — it does NOT run Playwright. Visual regressions and flow breakages can land on main and survive until the next manual testing-agent invocation.

  **Why it matters:** Pre-launch is exactly the moment when E2E coverage matters most — the Vitest unit tests catch logic bugs but miss layout regressions, modal z-index conflicts (a recurring class of bug per project memory), navigation flow breakage, and integration-level state drift between tabs.

  **Suggested fix:** Add a `playwright` job to `.github/workflows/ci.yml` that (a) installs Playwright browsers, (b) starts the Next.js dev server in background, (c) runs `npx playwright test`, (d) uploads HTML report as a CI artifact on failure. This will make CI noticeably slower (probably +3-5 minutes per push), but the cost is justified pre-launch. Tolerate occasional flakes by configuring 1-retry on Playwright suites.

  **Files to touch:** `.github/workflows/ci.yml` (add playwright job + dependencies between jobs). Possibly `apps/web/playwright.config.ts` to enable retries in CI mode only.

  **Acceptance:** CI runs Playwright on every push; report visible as artifact; failures block deploy.

- [ ] **P1 — S-1: Audit raw `from('vessels')` queries and ensure NDA masking goes through `get_vessel_public`.**

  **Problem:** `get_vessel_public(uuid)` and `get_vessels_public_batch(uuid[])` (most recently in migration 00122) are the only sanctioned vessel-read paths for non-owners — they apply NDA masking, hidden/pending exclusion, and engagement-based reveal. But there is no enforcement preventing a route from doing a raw `from('vessels').select('id, name, imo_number')` query that bypasses the masking entirely. Any such route silently leaks vessel data.

  **Why it matters:** Vessels V2 Wave F (just shipped) closed the front door (lookup route) and side doors (the two batch RPCs). If any other route still goes direct, the moderation actions admins take (hide a vessel, leave a vessel pending) are partially enforced. NDA + hidden + pending all share the same threat model: keep private data private.

  **Suggested fix:** `grep -rn "from('vessels')\|from(\"vessels\")" apps/web/src/app/api/ apps/web/src/lib/` to enumerate every direct vessel query. For each: confirm it's owner-scoped (e.g., `/api/vessels/[id]` PATCH where the user must own the vessel, RLS-enforced) — that's fine. Any non-owner-scoped read should switch to the RPC. Optionally add a custom ESLint rule banning raw vessel SELECTs outside an allowlist, to prevent regression.

  **Files to touch:** depends on grep result — probably a handful of routes need updating. ESLint rule lives in `apps/web/eslint.config.mjs`.

  **Acceptance:** every non-owner-scoped vessel read goes through one of the two RPCs; lint rule prevents regression.

- [ ] **P1 — S-2: Automate `PERSON.DATA_SCRUBBED` 30 days after `PERSON.DEACTIVATED`.**

  **Problem:** Deactivation flow (`/api/account/deactivate`) appends `PERSON.DEACTIVATED`, sets `deactivated_at`, and bans the auth user. The follow-up `PERSON.DATA_SCRUBBED` event (which actually wipes PII per migration 00108 — 22 profile fields nulled, experiences deleted, structure preserved) is documented but currently a manual admin process. If admin process slips, PII persists past the documented 30-day retention period — a GDPR exposure.

  **Why it matters:** Right-to-erasure under GDPR Article 17 has compliance teeth. EU crew (Antibes, Palma, Monaco) are the bulk of the Med-season audience. Manual processes break under load. The architecture for automation is already there (cron infrastructure exists for availability expiry + engagement-starts).

  **Suggested fix:** New cron at `/api/cron/data-scrub` running daily (recommend `0 4 * * *` to avoid clashing with existing crons at 07:00 and 08:00). Query: persons where `deactivated_at <= now() - interval '30 days'` AND `(scrubbed_at IS NULL OR scrubbed_at IS NOT YET SET)`. For each: append `PERSON.DATA_SCRUBBED` event. Projection (already in 00108) wipes fields. Add to `vercel.json` crons array. Add unit test that sets `deactivated_at` to a date >30d ago, runs the cron handler, asserts the scrub event was appended.

  **Files to touch:** new `apps/web/src/app/api/cron/data-scrub/route.ts`. `vercel.json` crons addition. New unit test in `apps/web/__tests__/api/`.

  **Acceptance:** cron runs daily; deactivated users' PII is scrubbed at 30d + 1 day; ledger event records the scrub.

- [ ] **P1 — I-1: Configure Sentry DSN in Vercel environment variables and verify error capture.**

  **Problem:** `@sentry/nextjs` SDK is integrated in `next.config.ts`, but the DSN is conditional (no-op if `NEXT_PUBLIC_SENTRY_DSN` is unset). The infrastructure agent flagged that the DSN may not be configured in production — meaning production errors live only in Vercel's per-deployment log dashboard, are not aggregated, are not searchable across deploys, and are not alertable.

  **Why it matters:** Pre-launch with no aggregated error tracking is "flying blind." First weeks of real-user traffic are exactly when you need fast iteration on the bug surface.

  **Suggested fix:** Confirm whether DSN is set (check Vercel Environment Variables dashboard → Production env). If not: create Sentry project for `dockwalker-web` (and a separate one for mobile when Expo ships), copy DSN into Vercel env vars. Verify by triggering a deliberate test error on a non-production preview deploy. Cost is roughly $29/month for the Team tier — covers 1M error events.

  **Files to touch:** Vercel Environment Variables dashboard (no code changes needed — `next.config.ts` already reads the DSN).

  **Acceptance:** test error on preview deploy appears in Sentry within 30 seconds.

- [ ] **P1 — I-2: Document database emergency-rollback runbook.**

  **Problem:** Database migrations auto-deploy on push to main (per `.github/workflows/ci.yml` deploy-migrations job). If a migration ships with a bug — a CHECK constraint that rejects valid data, a projection handler that breaks state, an index that takes too long to build — there is no documented procedure for the founder to roll back. Right now, recovery would be ad-hoc.

  **Why it matters:** The migration discipline is already excellent (every migration has a paired `.down.sql`, CI runs forward → reverse → forward cycle). What's missing is the _operational_ playbook: who notices the bad migration, what command runs, what's the order of operations, what's the safety rope if rollback also fails.

  **Suggested fix:** Create `tasks/runbook.md` with an "Emergency database rollback" section. Cover: (a) detection (Sentry error spike, user reports, stress-test failure), (b) decision criteria (when to rollback vs hotfix forward), (c) commands (`npx supabase db query --linked --file supabase/rollbacks/00XXX.down.sql` to apply a single rollback to remote), (d) verification (re-run relevant stress test), (e) post-mortem template. Reference from `CLAUDE.md` § Pre-Commit Hook Requirements.

  **Files to touch:** new `tasks/runbook.md`.

  **Acceptance:** runbook exists; founder can execute it cold without re-deriving.

- [ ] **P1 — I-3 / S-3: Audit and migrate secrets from `.env.production.local` to Vercel Environment Variables; rotate any keys that touched the local file.**

  **Problem:** The infrastructure + security agents both flagged that `.env.production.local` likely contains live API keys (Anthropic, OpenAI, Supabase service-role, possibly Stripe, Resend). Standard practice is to use Vercel Environment Variables for production secrets and keep `.env.production.local` git-ignored as a local-dev-only fallback. The risk is that if `.env.production.local` is ever accidentally committed (gitignore bypass, IDE save-on-focus, manual `git add .`), the keys are publicly exposed in git history.

  **Why it matters:** Service-role key has unrestricted database access. Anthropic / OpenAI keys have direct cost exposure (an attacker can run up tens of thousands in API charges before detection). This is operational hygiene that should be tightened pre-launch even if no incident has occurred.

  **Suggested fix:** (a) Audit Vercel Environment Variables dashboard against `apps/web/.env.example` — every key in `.env.example` should have a value in Vercel Production env. (b) Confirm `.env.production.local` is in `.gitignore` (likely already is — verify). (c) Rotate any key that has _ever_ been in `.env.production.local` on a developer's machine — Anthropic + OpenAI keys are the highest priority because cost exposure is direct. Supabase service-role rotation requires a one-time secret swap in Vercel + a re-deploy. (d) Document the secrets-management policy in `tasks/runbook.md` (no production secrets in the repo, ever).

  **Files to touch:** Vercel Environment Variables dashboard. `.gitignore` (verify). `tasks/runbook.md` (new policy section).

  **Acceptance:** every key in `.env.example` has a value in Vercel Production; rotation log entry exists for any rotated keys; documented policy.

---

## BLOCKED — external/lawyer

### Legal pages go-live

`/privacy` and `/terms` pages render with placeholder values wired in `apps/web/src/lib/legal-placeholders.ts` (Delaware incorporation, Nautalink Technologies Inc., admin@nautalink.io support/DPO, EU Frankfurt Supabase region).

- [ ] **Lawyer review of `/privacy` and `/terms` wording** (source drafts: `tasks/privacy-policy-spec.md` + `tasks/founder-drafts.md` §1) — placeholder VALUES are correct; the POLICY TEXT still needs legal review.
- [ ] Decide: cookie consent banner needed for target jurisdictions? (Functional cookies only — likely not required under GDPR, but check local law)

---

## Pre-launch QA (do before opening to real users)

### Google Sign-In edge cases

> Provider is live (OAuth client in Google Cloud under nautalink.io org,
> Supabase provider enabled, identity linking on). Basic sign-up/sign-in
> verified end-to-end. The items below are edge-case verifications.

- [ ] Sign up via Google in incognito → confirm display_name prefilled from Google profile on onboarding.
- [ ] As an OAuth-only user (no email/password identity), visit `/auth/forgot-password` → confirm the "Signed up with Google?" inline note + Google button render above the reset form.
- [ ] As an OAuth-only user, visit Settings → Account → confirm change-password section is hidden and replaced with "manage your password at Google" link.
- [ ] As an existing email/password user, sign in with Google using the same email → confirm the two identities merge into one account (manual linking is on).

### Stripe live mode QA

- [ ] Customer Portal flow: subscribe → click "Manage subscription" in app → land in Stripe Customer Portal → cancel from there → confirm app flips to Free.
- [ ] Failed payment recovery: use a card known to fail 3DS → confirm app shows graceful error, no orphaned subscription state.
- [ ] Subscription update via Stripe dashboard (e.g. change plan) → confirm `customer.subscription.updated` webhook fires and app reflects new plan.

---

## Deferred — intentional

### Custom Supabase auth domain ($10/mo)

> Cosmetic only — currently Google Sign-In account picker shows
> `hwpcuehqawullzqbmcdv.supabase.co` instead of "DockWalker". Stripe
> auth and other flows unaffected.

- Setup path when ready: Supabase Project Settings → Custom Domains → add `auth.dockwalker.io` → CNAME at Namecheap → wait for SSL → update Google OAuth client's redirect URI to use the custom domain → update Auth URL Configuration in Supabase.

### Vercel staging branch

> Skipped today; collapse-to-one-project setup is correct for solo
> pre-launch dev. Add when starting heavy feature work or when needed
> as a stable preview URL for Stripe test webhooks.

- Setup path: `git checkout -b staging && git push -u origin staging` → optional: attach `staging.dockwalker.io` as custom subdomain assigned to staging branch → split currently-Production+Preview env vars into Production-only (live) + Preview-only (test) entries (especially `STRIPE_*` keys to avoid feature branches hitting live mode).

### Apex → www 301 redirect

> Vercel currently 307s `dockwalker.io` → `www.dockwalker.io`.
> Bit us on Stripe webhook delivery (twice — both occasions documented in
> `tasks/lessons.md`). Browsers don't cache 307; making it 301 saves a
> round-trip on cold visits and avoids the same landmine if any future
> service pings the apex.

### WhatsApp via Meta Cloud API

> Telegram already covers crew/employer notification needs. WhatsApp
> migration is a v2 feature, not launch-blocking.

- Get dedicated number (prepaid SIM or Google Voice for Workspace)
- Register with Meta Cloud API directly (not Twilio — see lessons file for why)
- Swap Twilio dispatcher for Meta Graph API calls
- Submit templates for Meta approval

### Sensitive flag rotation on remaining "Needs Attention" vars

> Vercel flagged several env vars (Anthropic, OpenAI, Upstash, Supabase
> service role) as "should be Sensitive but isn't." Fix requires rotating
> the secret at the source, then re-adding to Vercel marked Sensitive
> (since Sensitive values can't be edited — only set on creation).

> Low priority pre-launch (solo developer). Do when adding team members.

---

## Backlog

> Active backlog. Pick items into Queue when ready.

### Deferred post-launch

- **Voice calling — replace Twilio + browser QA before unmute.** Phone button in chat header is gated behind a "Coming soon" toast (Fix 222d); `IncomingCallListener` unmounted from the app layout. `use-voice-call.ts`, `voice-call-context.tsx`, `call-bar.tsx`, `incoming-call-listener.tsx`, `turn-credentials` route, `call-ended` route all retained as dead code. When unmuting: (1) decide on managed RTC provider — LiveKit Cloud is the preferred replacement over Twilio TURN+Supabase-Realtime-signaling (SFU routing, call history, recording capability); (2) swap the hand-rolled `RTCPeerConnection` stack in `use-voice-call.ts` for the provider's SDK; (3) restore phone button's real `onClick` wiring to `voiceCall.startCall` + gate on `isPermanent && status === 'active'`; (4) re-mount `IncomingCallListener` in `(app)/layout.tsx`; (5) run browser QA matrix (Chrome/Firefox/Safari × desktop+mobile, glare resolution, network drops, backgrounded tab, multi-tab, offline user). Audit-trail gap: currently only `MESSAGE.SENT` records a call; add `CALL.STARTED`/`CALL.ENDED` events in the ledger at the same time.

### Business logic / server-side

- **Permanent crew withdrawal auto-revert** — employer should decide next step, not auto-revert.
- **Onboarding true atomicity** — `onboard_person` RPC should be fully atomic.
- **Negotiation timeout** — auto-close permanent engagements after X days inactivity.
- **Weekly check-in cron** — periodic nudge for permanent postings with no employer activity.
- **Deactivated user server-side sign-out** — force session invalidation on PERSON.DEACTIVATED.
- **CSRF origin validation** — add origin check middleware for POST/PATCH/DELETE routes (defense-in-depth, mitigated by SameSite cookies).
- **Stripe support runbook** — document refund-vs-cancel separation. Refund alone leaves subscription active until period end (correct Stripe design); for immediate revocation, refund + explicitly cancel subscription.

### Web-only UI

- **Agent market as discover mode** — let agents browse full market feed.
- **Form validation — styled inline errors** — replace browser-native validation (SUG-012). (Partially addressed by P1-A inline validation.)
- **Invalid URL error pages** — custom error pages for garbage URLs (SUG-013).
- **Edit experience "Unknown vessel" prefix** — seed data issue (SUG-017).
- **Applicant count badge on My Jobs**.
- **Discover filter chips**.
- **Notifications grouping**.
- **Email: List-Unsubscribe header**.
- **Share button on discover cards (crew view)** — secondary placement.
- **Admin identity type change** — deferred, medium-high effort, admin-only.
- **Chat page server-rendering** — stream context/messages server-side instead of client-side spinners.
- **Scroll position restoration** — restore scroll on back navigation from detail views.
- **Chat textarea send-then-snap-back** — when textarea grows multi-line then shrinks on send, layout shifts visibly. iOS-keyboard-specific; needs visualViewport API or careful keyboard-state detection. Cosmetic, not blocking.
- **Stripe success URL Apple Pay timeout** — observed during live testing: completing checkout via Apple Pay sometimes shows "session timed out" before redirect. Stripe-side issue or our success URL handler; investigate when seen by real users.
- **Notification handler `roleContext` mismatch** — handlers like `handleDayworkApplied` hardcode `roleContext: 'employer'` even when recipient is an agent. Fix 228 patched the count endpoint to ignore the filter for agents; proper fix is to set `roleContext` per recipient identity at handler dispatch time.

### Testing

- **Resilience tests** — network failure, timeout, retry scenarios.
- **Component tests for Permanent UI**.
- **Component tests for Form Pickers**.
