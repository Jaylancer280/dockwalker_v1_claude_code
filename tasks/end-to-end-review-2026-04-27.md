# DockWalker End-to-End Review — 2026-04-27

> Comprehensive production-readiness audit synthesised from six parallel domain agents (infrastructure, security, frontend/UX, testing/API, business logic, industry positioning). Every claim is footnoted with a confidence level: **[verified]** = checked first-hand during synthesis; **[agent]** = reported by the domain agent and not independently re-verified; **[memory]** = drawn from prior session context.
>
> **Snapshot:** Schema v122 (122 migrations applied), 1286 unit tests passing, 355 Playwright E2E specs, 4 live-DB stress test scripts. Two frontends (web active, mobile blocked). UK-registered (Nautalink Technologies). Pre-launch.

---

## Executive Verdict

**DockWalker is architecturally exceptional and behind on go-to-market posture.** The codebase is the strongest part of the product: an append-only event ledger with database-level mutation prevention, 71 deterministic projection handlers covering every domain transition, three-tier auth with custom JWT-claim injection, comprehensive RLS, and a CI/CD gauntlet that catches structural bugs before they ship. The product itself is genuinely differentiated — the daywork-native space is functionally vacant (Cotton Crew abandoned 2020, Dayworker.co live but tiny). Single-profile dual-role and IMO-as-truth-anchor are novel.

The credibility gaps are operational and external, not technical. The largest is silence on MLC 2006 / MCA RPSP positioning — every agency competitor leads with this and DockWalker doesn't mention it. The second is mobile-app blockage in a domain where daywork is intrinsically mobile. The third is concrete event-idempotency and null-coercion risks in the projection layer that need code-level fixes before scaling.

**Verdict:** Ship-ready architecture, ~80% ship-ready operational posture. Roughly 6 weeks of focused work closes the gap, the bulk of which is regulatory positioning + a small set of P0 code fixes + getting the Expo app on TestFlight.

---

## 1. Infrastructure & Deployment

**Stack** _(per CLAUDE.md, locked-in)_: Next.js 16 + TypeScript on Vercel, Supabase Postgres 17 with RLS, Turborepo monorepo, Expo (React Native) for mobile, Stripe, Resend, Anthropic Claude (for Docky AI), Upstash Redis (rate limiting), Sentry (scaffolded). Capacitor remains as legacy code pending Phase 7 Expo validation.

**Hosting + regions:** **[verified]** Functions are pinned to `fra1` (Frankfurt) via `vercel.json:2`, co-locating with the EU-region Supabase. This was a Fix 222l intervention after observing 300–500ms cross-Atlantic round-trips per request. Security headers at the same file (`HSTS`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`) and three Vercel cron jobs (availability expiry 08:00 UTC, engagement-starts 07:00 UTC, document-cleanup every 6h).

**CI/CD pipeline (`.github/workflows/ci.yml`):** **[agent + memory]** Five jobs — Quality (lint + type-check), Documentation Governance, Tests (Vitest), Database Checks (rollback cycle + NDA RLS + Locations schema), and Deploy Migrations to Production (gated on main branch + all prior jobs passing). Pre-commit hooks run prettier + eslint + type-check + the full Vitest suite + 6 custom bash checks (no console.log, no TODO, no merge markers, every migration has a rollback, docs freshness, schema-version match). The `aggregate_type` audit script has caught two real bugs (Stages 46 and 53 added new event types without updating the CHECK constraint).

**Migration discipline:** **[verified during this session]** 122 numbered migrations, every one with a paired rollback in `supabase/rollbacks/`. Schema version tracked in `BUILD_STATE.md` and validated by CI. The `apply_projection` function is replaced via `CREATE OR REPLACE` per migration with handler-count diffs documented. Rollback cycle (forward → reverse → forward) verified in CI on every push. **Caveat:** the cycle test redirects stderr to `/dev/null` (`tests/verify_rollback_cycle.sh:37`); when it fails, you can't see why without temporarily un-redirecting (we hit this exact issue earlier today on a transient docker race).

**Monitoring:** Sparse but functional. **[agent]** Sentry SDK is integrated but DSN may not be configured in production env vars. Vercel Analytics + Speed Insights are auto-enabled. There's no centralised log aggregation, no business-metric dashboard (signups, apply-to-accept conversion), and no external uptime monitor on `/api/health`.

**Secrets:** **[agent]** The infrastructure agent flagged that `.env.production.local` may contain live API keys (Anthropic, OpenAI, Supabase service-role). The standard practice is to put production secrets in Vercel Environment Variables and keep `.env.production.local` git-ignored; the `.env.example` confirms which keys are required. The risk is that if `.env.production.local` is ever accidentally committed (gitignore bypass, IDE accident), keys are exposed.

**Cost surface:** **[agent]** At 1000 DAU, projected ~$300–500/month. Anthropic Docky queries are the only variable cost driver (~$200/mo at modest volumes); Vercel + Supabase + Upstash are near-fixed. Free-tier gating is already wired on Docky (3 questions/month per crew).

**Mobile platform:** **[memory]** Phase 4 of the Expo build is complete; Phases 5–7 (TestFlight, in-flight UX polish, removal of Capacitor legacy) are blocked pending a Mac + Xcode for native debugging of a startup crash. Estimated unblock ~June 2026 per project memory.

### Top infrastructure risks

| #   | Risk                                                                                                | Severity | Mitigation                                             |
| --- | --------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------ |
| I-1 | Sentry DSN not visibly configured; production errors only in Vercel logs (not aggregated/alertable) | **P1**   | Create Sentry project, add DSN to Vercel env vars      |
| I-2 | Database migrations auto-deploy on main; rollback procedure not documented in runbook               | **P1**   | Document emergency rollback in `tasks/runbook.md`      |
| I-3 | Secrets in `.env.production.local` if not yet migrated to Vercel env vars                           | **P1**   | Audit + migrate; rotate any keys that touched the file |
| I-4 | No external uptime monitor on `/api/health`                                                         | **P2**   | Add Pingdom/BetterStack                                |
| I-5 | Mobile platform blocked (Capacitor legacy + Expo TestFlight)                                        | **P2**   | Resolve Mac+Xcode access; complete Phase 7             |

### Top infrastructure strengths

1. **Append-only ledger + reversible migrations** — every state change immutable, every migration has a paired rollback, CI verifies the cycle.
2. **Domain-aware pre-commit hooks** — the aggregate-type checker has prevented at least two production bugs.
3. **Region co-location** — Vercel functions and Supabase both in fra1; ~300-500ms latency win documented in Fix 222l.

---

## 2. Security & Privacy

**Auth model:** **[agent + verified]** Three-layer system. (a) Supabase Auth issues JWTs. (b) A `custom_access_token_hook` (migration 00078, 00105) injects `person_id`, `current_hat`, `identity_type`, `onboarded`, `deactivated`, `blocked` claims — eliminates ~4 DB queries per request. (c) Three guards: `requireAuthSession` (lightweight, JWT-only), `requireDomainUser` (full domain check, falls back to DB if claims missing), `requireAdmin` (chains domain guard + DB query for `is_admin` — intentionally NOT in JWT claims for security sensitivity). Every API route I sampled follows the `if (!guard.ok) return guard.response; const { user, supabase, serviceClient } = guard.value;` pattern. **[testing agent: 100% adoption across 145 routes].**

**RLS:** Comprehensive. **[agent]** Every table has policies; service-role usage is gated by admin guards. Spot-checks of `persons`, `profiles`, `applications`, `active_engagements`, `vessels` all show appropriate scoping (own-row, participant-only, or owner-only). No service-role usage was found in places that should have used auth-scoped queries.

**NDA + IMO masking:** **[verified during this session — Vessels V2 Wave F]** `get_vessel_public(uuid)` and `get_vessels_public_batch(uuid[])` mask IMO + name to `'NDA Vessel'` unless caller is owner OR has an active daywork/permanent engagement on a posting referencing the vessel. Migration 00122 (just shipped) adds upstream filtering to exclude `source = 'pending' OR hidden_at IS NOT NULL` rows for non-owner non-engaged callers. Five callsites consume these RPCs (daywork discover, daywork applications, daywork invitations, permanent applications, permanent discover) and all handle missing rows gracefully via `Map<id, row>` lookups.

**Concern (P1) — NDA coverage drift:** **[agent]** The domain-logic agent flagged that `get_vessel_public` is the only sanctioned vessel read path for non-owners, but there's no enforcement preventing routes from doing raw `from('vessels')` queries that bypass the masking. Recommendation: grep the codebase for `from('vessels')` calls outside the function body, audit each.

**Input validation:** **[agent]** Strong on sampled routes — `vessels/request` validates IMO format (7 digits exact), name length (120 chars), vessel type enum, LOA range, year_built range, gross_tonnage > 0, beam < 100m. `locations/canonicalize` validates lat/lng range, ISO-3166 country code regex, length caps. `profile` PATCH validates display name, languages enum, nationality IDs. No injection surface visible in raw query construction (all parameterised via Supabase client).

**Rate limiting (`apps/web/src/lib/rate-limit.ts`):** **[agent]** Upstash-backed, sliding window: 100 req/60s global per IP, 30 req/60s for write methods. Health/webhook/cron routes exempt. **Gaps:** per-IP only (no per-user), graceful degradation if Upstash is down (no rate limiting), no per-route limits on expensive operations (Docky chat, vessel-request notification fan-out).

**Webhook security:** **[agent]** Stripe uses `stripe.webhooks.constructEvent` with signature + timestamp validation — strong. Telegram webhook validation is a simple secret-string comparison with no timestamp/HMAC — vulnerable to replay if intercepted (P2). WhatsApp webhook handler not visible in this review.

**GDPR readiness:** **[agent]** `PERSON.DEACTIVATED` flow working (`/api/account/deactivate` appends event, sets `deactivated_at`, bans auth user for ~100 years to preserve unique-email constraint). Account export (`/api/account/export`) is comprehensive — profile, events, messages, engagements, availability, vessels, preferences, experiences, applications, invitations, ratings, device tokens, advisor conversations, permanent postings, engagement document metadata. **Gap:** the `PERSON.DATA_SCRUBBED` cron-driven follow-up (after retention period) is documented but not yet implemented as automation; currently a manual admin process.

**Secret hygiene:** **[agent]** No hardcoded test keys found in committed code. Service-role key never reaches client bundle. `crypto.ts` uses AES-256-GCM for encrypted phone storage (WhatsApp opt-in).

**OWASP Top 10 spot-check:** **[agent]** Strong on A01 (access control), A03 (no SQL injection — parameterised everywhere), A07 (auth failures), A08 (data integrity via append-only ledger). Acceptable on A05 (security misconfig — rate limit + signed webhooks). Unclear on A09 (logging/monitoring — no audit log table for admin actions).

**Account abuse / multi-account detection:** **[agent + memory]** CLAUDE.md describes a one-way device fingerprint hash; the agent could not find the implementing migration. This is on the deferred features list. Reactivation flow (`/api/auth/reactivate`) has no rate limit, which could let an attacker rapid-fire reactivation attempts on known emails (P2).

### Top security risks

| #   | Risk                                                                                      | Severity | Mitigation                                                                     |
| --- | ----------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------ |
| S-1 | NDA masking coverage drift — raw `from('vessels')` queries can bypass `get_vessel_public` | **P1**   | Audit + add lint rule blocking raw vessel selects outside the function body    |
| S-2 | GDPR `DATA_SCRUBBED` not automated; if admin process slips, PII persists past retention   | **P1**   | Add cron job to fire DATA_SCRUBBED 30d after DEACTIVATED                       |
| S-3 | Secrets in `.env.production.local` (per infra agent)                                      | **P1**   | See I-3                                                                        |
| S-4 | Telegram webhook replay vulnerability (string-secret only, no HMAC + timestamp)           | **P2**   | Implement HMAC-SHA256 with timestamp                                           |
| S-5 | Per-IP rate limit only — botnet across IPs evades; no per-user budget                     | **P2**   | Add per-`person_id` rate limit on auth-required routes                         |
| S-6 | No admin action audit log — admin who did what isn't recorded                             | **P2**   | Add `admin_action_log` table with `admin_person_id`, action, target, timestamp |
| S-7 | JWT claim propagation lag (~1 hour) for blocked/deactivated users mid-session             | **P2**   | Document; middleware DB fallback partially mitigates                           |

### Top security strengths

1. **NDA masking architecture** with engagement carve-out is sophisticated and rare in the industry — owner sees, engaged parties see, everyone else sees `'NDA Vessel'`.
2. **JWT claim injection discipline** — admin status intentionally not in claims; eliminates the "stolen JWT becomes admin" class of vulnerability.
3. **Append-only ledger as compliance asset** — GDPR right-to-erasure preserves event structure while wiping PII. Audit-grade.

### Addendum (2026-04-27): MLC 2006 / Reg 1.4 codebase alignment audit

A targeted grep audit was run after the main review to check the codebase against the seven MLC red-flag patterns: (1) charging crew for placement-related services, (2) untrue vetting claims, (3) manning-agency self-positioning, (4) per-placement commission, (5) pay-to-rank for crew, (6) "we place / we vet / we recruit" language, (7) marketing claims contradicted by implementation.

**Results:**

| Metric                                             | Status                               | Evidence                                                                                              |
| -------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| 1. Crew fees for placement services                | 🟡 Yellow (revised from initial Red) | See discussion below                                                                                  |
| 2. Untrue vetting claims                           | 🟢 Green                             | T&Cs §4 explicitly disclaims verification                                                             |
| 3. Manning-agency positioning                      | 🟢 Green                             | T&Cs §1: _"DockWalker is not an employment agency and does not employ crew or guarantee placements."_ |
| 4. Per-placement commission                        | 🟢 Green                             | Zero in codebase; explicitly disclaimed in `tasks/business-model.md:16`                               |
| 5. Pay-to-rank for crew                            | 🟡 Yellow                            | Same evidence as metric 1                                                                             |
| 6. "We place / we vet" language                    | 🟢 Green                             | Zero hits in user-facing strings (only internal code comments)                                        |
| 7. Marketing claims contradicted by implementation | 🟡 Yellow                            | See below                                                                                             |

**The yellow finding — Crew Pro gate on Available Crew tab:**

`apps/web/src/app/api/daywork/[id]/available-crew/route.ts:137-149` filters to `subscriptions.plan = 'crew_pro'` when employers browse the proactive-invitation tab. Upsell copy at `apps/web/src/components/availability-overlay.tsx:405-413`: _"Upgrade to Crew Pro to appear in employer searches. Free crew can apply to jobs but are not shown in the Available Crew tab."_ Crew Pro feature list at `apps/web/src/app/(app)/billing/page.tsx:36`: _"Appear in employer searches for daywork invitations."_

**Initial reading was that this is a Reg 1.4 violation.** Revised reading after considering the platform's actual structure: **it is defensible, not a violation**, but the marketing copy is inconsistent with the implementation.

The structural argument: every daywork posting is publicly applyable by every crew member, free or paid. Free crew see all the same jobs and can apply to all the same jobs. The Available Crew tab is a _parallel_ discovery surface (employer-initiated invitations) that exists alongside the public-posting feed (crew-initiated applications). Both paths can result in the same engagement. Crew Pro is a flat subscription whether the crew gets hired or not — not a per-application fee, not a per-engagement commission, not a per-CV-submitted charge. This is materially closer to LinkedIn Premium (job-seekers paying for additional discoverability) than to the historical maritime crewing-agency abuse Reg 1.4 was designed to stop (paying $500 to register with an agent who gates job access).

Industry precedent supports the defensibility: **Crewseekers** has charged crew an explicit membership fee for 20+ years and has not been classified as an MLC-non-compliant Recruitment and Placement Service Provider. A freemium model with a paid tier offering supplementary discovery is on safer ground than Crewseekers' paywalled model.

**The actual problem is the gap between marketing copy and implementation:**

- `apps/web/src/app/page.tsx:33-35` (landing hero): _"Connect directly with vessels — no hidden ranking, no pay-to-rank."_
- `apps/web/src/app/page.tsx:143-149` (value-prop block): _"Smart features, fair visibility... no hidden algorithms or pay-to-rank."_

The Available Crew tab IS literally a pay-to-rank surface. Whether or not it's MLC-defensible, it's factually a paid-rank feature; the marketing claim is not strictly true as written. This is a truth-in-advertising issue separate from MLC.

**Concrete fix scope (revised down from initial estimate):**

1. `apps/web/src/components/availability-overlay.tsx:405-413` — rewrite the upsell to lead with free-baseline-access. Recommended phrasing: _"Free crew can apply to any posted job. Crew Pro adds proactive discovery — employers can also find and invite you directly."_
2. `apps/web/src/app/page.tsx:33-35` and `:143-149` — qualify or remove the "no pay-to-rank" claim. Recommended: remove (the rest of the value-prop block stands).
3. `apps/web/src/app/(app)/billing/page.tsx:36` — rewrite _"Appear in employer searches for daywork invitations"_ to _"Get discovered by employers — appear in proactive search alongside applying directly to posted jobs."_
4. T&Cs §1 — add one line making the equal-baseline-access principle explicit: _"Crew may apply to any posted job at no cost. Crew Pro is an optional subscription for additional features."_

Total work: ~1 hour. Three files + the T&Cs.

**Caveats:**

- This analysis is from a non-lawyer perspective. Reg 1.4 is interpreted by flag states (UK MCA in DockWalker's case), and a maritime specialist's hour answers the "is this safe" question definitively. The M-1 P1 item below already includes this lawyer review. The grey-zone framing here adds a specific question for that lawyer to confirm.
- The risk profile is "low probability, high consequence" — the consequence being mandatory MCA RPSP accreditation if MCA reclassifies the platform as a manning agency, not platform shutdown. The copy fixes above defuse the most aggressive language and reduce the probability further.
- Keeping the gate is justified on product grounds: it's the central monetisation hook for the Crew tier per `tasks/business-model.md`. Removing it would require restructuring the tier around Docky AI alone, which is a larger product decision.

---

## 3. Domain Logic & Event Sourcing

**[Most of this section is verified by the domain-logic agent; depths follow.]**

**Event ledger integrity:** Migration 00001 installs `events_no_update` and `events_no_delete` triggers — UPDATE and DELETE on the events table raise exceptions before RLS even fires. Application-server compromise cannot mutate the ledger. Strong.

**`apply_projection` function:** 71 handlers across PERSON (5), PROFILE (2), AGENT (1), VESSEL (5), EXPERIENCE (3), DAYWORK (6), DAYWORK invitations (3), DAYWORK applications (5), APPLICATION (2), ENGAGEMENT (13), CHECKLIST (2), AVAILABILITY (1), MESSAGE (1), ADMIN (7), SUPPORT (2), SHORE_EXPERIENCE (3), PERMANENT (11). Every event type referenced in `packages/types/src/events.ts` has a matching handler in the latest migration body. State guards are enforced both at the route layer (pre-emit) AND at the projection layer (in the WHERE clause of UPDATE statements) — defence in depth.

**Daywork state machine:** Applied → Viewed → Shortlisted → Accepted/Rejected/Withdrawn/Superseded → Completed/Cancelled. Race guard against double-fill on multi-crew positions added in Stage 53 (migration 00053). Shortlist correctly optional — projection allows ACCEPTED from any of `('applied', 'viewed', 'shortlisted')`.

**Permanent state machine:** Applied → Shortlisted → Selected → (Placement confirmed | Selection reverted) plus terminal Rejected/Withdrawn/Not Selected. Cert hard-gate fires server-side at apply time AND emits `PERMANENT.APPLICATION_BLOCKED` for the rejected event log (intelligence event, not a state transition). Shortlist cap enforced at projection layer.

**Cancellation semantics:** All eight cancellation event types have handlers with appropriate downstream effects (e.g., `DAYWORK.CANCELLED_BY_EMPLOYER` cancels daywork + all pending applications + revokes invitations atomically; `PERMANENT.CANCELLED_BY_EMPLOYER` closes any in-negotiation engagement). Structured reason categories validated at the route layer.

**Date overlap resolution:** `check_no_overlap` RPC fires at acceptance time. Auto-supersedes overlapping pending applications (in `('applied', 'viewed', 'shortlisted')`). Back-to-back days correctly NOT treated as overlap.

**Availability model:** Rolling 14-day window with dual expiry. Per-date shrinkage (date passed = window expires) AND 7-day refresh window. Clearing dates implemented as immediate-expiry events through the ledger, not direct deletes. Permanent availability is profile-level (immediate / after_notice / not_looking) and informational, not gating.

**IMO truth anchor:** `vessels.imo_number text not null unique` — no UPDATE handler ever touches IMO post-creation. The events table never emits a `VESSEL.IMO_CHANGED` event. IMO is genuinely immutable by design + by data path.

### Top domain risks

| #   | Risk                                                                                                                                                                                                                                                                                                                                                | Severity | Mitigation                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| D-1 | **Event idempotency**: no DB-level uniqueness constraint preventing double-append of the same event (e.g., network retry without client-side dedup). DAYWORK.ACCEPTED fired twice could increment `positions_filled` past `positions_available`.                                                                                                    | **P0**   | Add `idempotency_key` column to events + unique constraint on `(person_id, idempotency_key)`; pass key from route on every append |
| D-2 | **NULL coercion in DAYWORK.ACCEPTED race guard**: if the daywork is concurrently deleted, `select positions_filled, positions_available into v_filled, v_available` returns NULL, and `if v_filled >= v_available` evaluates to NULL → coerced to false → accept proceeds with orphan FK. Latent vuln if any cleanup process ever deletes dayworks. | **P0**   | Add explicit `if not found then raise 'daywork no longer exists'` after the SELECT                                                |
| D-3 | NDA masking coverage gap (see S-1)                                                                                                                                                                                                                                                                                                                  | **P1**   | Audit raw `from('vessels')` calls                                                                                                 |
| D-4 | Permanent availability `not_looking` may not be filtered out of permanent discovery feed                                                                                                                                                                                                                                                            | **P2**   | Verify the discover route applies the filter; add test                                                                            |
| D-5 | Projection replay divergence on disaster recovery — handlers assume prior state (e.g., daywork exists) without invariant checking                                                                                                                                                                                                                   | **P2**   | Document playbook; consider strict-mode replay flag                                                                               |

### Top domain strengths

1. **Database-level append-only enforcement** is rare and exemplary.
2. **71 handlers fully wired with state guards at both route and projection layer** — no hand-wavy "we'll catch it in the route".
3. **IMO truth anchor + NDA reveal** is a genuine architectural innovation; no competitor in the industry has equivalent rigor.

---

## 4. Frontend & UX

**[Most of this section is per the frontend agent. I verified two contested claims:]**

**Verified:** **[verified]** `apps/web/src/app/(app)/discover/page.tsx` is **834 lines** — the agent's claim is exact. There IS no `(auth)` route group; auth pages live flat at `apps/web/src/app/auth/`, `/blocked`, `/onboarding`, `/jobs`, `/privacy`, `/terms` and don't inherit the `(app)/layout.tsx` (so the agent's concern that they "incorrectly inherit bottom nav" is actually NOT a problem — they're outside the route group entirely). I disregard that finding.

**App router architecture:** **[agent]** Clean hierarchy. Root layout initialises ThemeProvider, NativeInit, PushToast, analytics. `(app)/layout.tsx` is the auth-gated zone with 5 providers (ToastWrapper, VoiceCallProvider, LookupsProvider, NotificationCountsProvider, OfflineBanner) — provider depth is high but each one is justified. `(admin)/admin/layout.tsx` exists as a separate gate.

**Critical user paths:** **[agent]** Crew sign-up → onboarding → set availability → discover → apply works end-to-end. Employer sign-up → post → review → accept → message works end-to-end. Permanent flow exists but agent couldn't fully trace it (didn't sample the right files).

**Discover page (834 lines):** **[verified line count]** Mega-page mixing state management, swipe animation, lazy-load triggers, 5 lazy-loaded sub-components (AvailabilityOverlay, ProfileOverlay, AppliedTab, InvitationsTab, PermanentJobFeed). 40+ state vars. **Recommendation:** split into `<DiscoverBrowse>`, `<DiscoverApplied>`, `<DiscoverInvitations>`, `<DiscoverPermanent>` with discover/page.tsx as a thin tab router. **P1 maintainability risk.**

**State + data layer:** **[agent]** Mixed pattern. `safeFetch()` wrapper is excellent — never throws, returns discriminated union, automatic 401 redirect, safe JSON parse, default 15s timeout. `useSafeFetch` hook wraps SWR. But page-level `loadProfile()` / `loadMessages()` imperative calls coexist with SWR — no coherent cache invalidation strategy. **Recommendation:** standardise on TanStack Query with explicit `queryClient.invalidateQueries` on mutations.

**Realtime:** **[agent]** Messages use Supabase Realtime with 5s polling fallback if connection drops. Good resilience. Concern: useEffect cleanup may not unsubscribe consistently — potential listener leak.

**Performance:** **[agent + memory]** Recent wins: lazy ImageCropper (-24.6 KB from /profile + /onboarding), broadcast query consolidation (15 → 5 queries per single-posting daywork), composite indexes 00112 (4 hot-path indexes), fra1 region pin (300–500ms saved). Hot paths still likely fat: discover page bundle, calendar/time-picker components (recent additions, ~6.3 KB and ~7.1 KB respectively).

**Mobile responsiveness:** **[agent]** Bottom nav at `z-40`, safe-area inset applied. ProfileOverlay at `z-[60]`, AddVesselDialog at `z-[70]` — modals correctly clear bottom nav (per project memory's known-issue list). No systematic z-index naming; relies on human discipline. **Concern:** small touch targets on cert/role pickers (`size="sm"` is ~32-36px; iOS HIG says 44pt minimum).

**Capacitor legacy:** **[verified]** `capacitor.config.ts` exists at `apps/web/`. No `apps/web/ios/` or `apps/web/android/` directories visible — possibly already partially removed. The `NEXT_PUBLIC_API_BASE_URL` workaround in `safeFetch.ts` is still wired for Capacitor's relative-URL resolution. Removal blocked behind Expo Phase 7 completion.

**Accessibility:** **[agent]** Sparse coverage. Most buttons rely on text content for accessible names (which is fine), but decorative icons usually lack `aria-hidden="true"`. No focus-trap on dialogs visible (Radix Dialog should provide it natively if used). No return-focus-to-trigger on modal close. **P2.**

**i18n:** **[agent]** Zero infrastructure. All strings hard-coded English. Targeting EU yacht crew (Med season) with English-only UI is acceptable for v1 (industry lingua franca is English) but should be on the post-launch roadmap.

**Brand consistency:** **[agent + memory]** Theme variables (`--foreground`, `--surface`, `--accent`) used consistently. Typography scale ad-hoc (mix of `text-sm`, `text-[10px]`, `text-[24px]`). Memory flags landing page as needing redesign.

### Top frontend risks

| #   | Risk                                                        | Severity | Mitigation                                                             |
| --- | ----------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| F-1 | Discover page (834 lines) unmaintainable                    | **P1**   | Split into 4 tab components                                            |
| F-2 | Messages page may crash on context-load failure             | **P2**   | Add error boundary; render error UI when context is null               |
| F-3 | No coherent cache strategy (SWR + imperative loadX coexist) | **P2**   | Standardise on TanStack Query                                          |
| F-4 | Z-index has no systematic naming                            | **P2**   | Define enum (`z-modal`, `z-overlay`) or Tailwind utility classes       |
| F-5 | ARIA coverage sparse; focus management not enforced         | **P2**   | Audit; add `aria-hidden` on decorative icons; verify Dialog focus trap |

### Top frontend strengths

1. **`safeFetch()` wrapper** — discriminated union return type, never throws, 401 auto-redirect. Eliminates an entire class of runtime crashes.
2. **Realtime + polling fallback on messages** — sub-1s on good connections, 5s worst-case. Robust.
3. **Cursor-based discover pagination** with auto-load-when-≤5 cards. Clean UX, no offset-limit foot-guns.

---

## 5. Testing & API Surface

**Unit tests:** **[agent]** 116/145 API routes covered (~80%). 21 component tests, 20 lib tests, 17 hook/auth tests. Total ~1286 unit tests passing as of this session. Untested critical paths: hat-switching mid-session, concurrent cancellation+relist, async notification fan-out failures, Stripe metadata edge cases.

**Test quality:** **[agent]** Mixed. Strong tests use `makeSingleChain()` factory to mimic Supabase fluent API and verify projection-aware logic (cert bundle matching, FK ripple ordering on merge actions). Weak tests over-mock — `vessel-lookup.test.ts` returns 6 fixture rows and just asserts `.slice(0,5)` count without checking which rows survive. Mock realism issue documented in lessons: `.mockReturnValue()` chains break easily when route adds a new `.filter()` call.

**E2E (Playwright):** **[agent]** 355 tests across 17 specs covering smoke, employer flows, crew flows, agent flows, onboarding, interactions, consistency, edge cases. Last run 2026-03-27 with all passing. **Critical gap:** Playwright is NOT in CI — runs are manual via the testing agent. Visual regressions can land unnoticed until next manual run. **P1.**

**Live-DB stress tests:** Locations V2 (25/25 passing), Vessels V2 Wave A (23/23), Wave B (37/37), Wave F RPC (6/6). Pattern works well — tests insert sentinel data, verify behaviour, clean up. **Not in CI** (require service-role credentials), runnable locally.

**API design consistency:** **[agent]** REST conventions mostly followed: GET list / GET [id] / POST create / PATCH update / POST [id]/action for state transitions. Status codes correct (200, 201, 400, 401, 403, 404, 409, 500). Error shape consistent: `{ error: string }`. **Gap:** payload casing mixed — server returns snake_case (DB columns), client sends camelCase. Inconsistency causes frontend mapping bugs.

**Idempotency:** **[agent]** Mostly absent. `/api/permanent/[id]/apply` checks for duplicate via `maybeSingle` and returns 409 — idempotent on retry. Most other create routes (e.g., `/api/daywork`) will create duplicates on POST retry. **No idempotency-key infrastructure on the events table itself** — overlaps with risk D-1 above.

**API documentation:** **[agent]** All routes have JSDoc blocks with method/path/role/response shape. README files in `apps/web/`, `packages/db/`, `packages/types/` catalog routes + RPCs. **Gap:** no centralised OpenAPI/Swagger spec; new contributors must grep `src/app/api/**`.

**Type safety:** **[agent]** Strict mode enabled across the monorepo. `any` exemptions are minimal. Supabase types are hand-rolled (no codegen) and verified by code review. PostgREST embed shapes occasionally need `as unknown as Array<{...}>` casts (acceptable; we did this twice in this session).

### Top testing/API risks

| #   | Risk                                                                                                                         | Severity | Mitigation                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------- |
| T-1 | Playwright E2E not in CI; visual regressions land silently                                                                   | **P1**   | Wire Playwright to GitHub Actions; tolerate the longer build    |
| T-2 | Seed data with relative dates expires (availability windows close after 7d); test suite becomes flaky 1–2 weeks after reseed | **P2**   | Document reseed cadence; add automated reseed + integration run |
| T-3 | API payload casing inconsistent (snake vs camel)                                                                             | **P2**   | Standardise on camelCase responses; transform in route handler  |
| T-4 | No central API catalog; discoverability for new contributors poor                                                            | **P2**   | Auto-generate route index from JSDoc, or add OpenAPI            |
| T-5 | Component test coverage thin on dynamic content (Discover, Messages)                                                         | **P2**   | Add interaction tests for swipe, pagination, optimistic updates |

### Top testing/API strengths

1. **Pre-commit gauntlet with aggregate-type checker** — caught 2 real bugs that would have shipped.
2. **Test fixture realism** — `makeSingleChain()` factories accurately mimic Supabase fluent API.
3. **Live-DB stress tests as a class** — 4 scripts, 91/91 passing, exercise actual remote schema. Catches drift mocked tests can't see.

---

## 6. Industry Fit & Competitive Positioning

**[Per the industry agent. Sources cited at end of agent report; key findings reproduced here.]**

**Market context:** ~6,100 superyachts >30m globally, 90,000–120,000 active crew at any time, plus an annual cohort of green crew. English-language, geographically clustered (Antibes, Palma, Monaco, Genoa, Fort Lauderdale, Caribbean). Two transition windows per year (April + November) are peak daywork moments. MLC 2006 is the regulatory frame; the seafarer-no-fee rule means crew membership tiers are safe but per-placement commission would convert DockWalker into a regulated manning agency.

**Competitor matrix (condensed):**

| Platform                  | Type               | Daywork?                             | Mobile-native?                               | MLC posture                  |
| ------------------------- | ------------------ | ------------------------------------ | -------------------------------------------- | ---------------------------- |
| **DockWalker**            | Two-sided platform | **Yes — swipe + overlap resolution** | Web active; Expo blocked                     | **None claimed (gap)**       |
| Yotspot                   | Job board / SaaS   | Listed but not optimised             | App exists, low traction                     | Not prominent                |
| YPI Crew                  | Manning agency     | No                                   | None                                         | **Lloyd's MLC 2006 audited** |
| Bluewater                 | Hybrid             | Limited                              | "ONE Account" app                            | Compliant                    |
| The Crew Network          | Manning agency     | No                                   | None                                         | **MLC 2006 compliant**       |
| Crewfinders               | Free referral      | Implicit                             | None                                         | Not displayed                |
| Crewseekers               | Membership-paid    | Sailing-skewed                       | None                                         | Not central                  |
| Wilson Halligan           | Agency             | No                                   | None                                         | MLC certified                |
| Quay Crew                 | Agency             | No                                   | None                                         | Implied                      |
| Yacrew                    | Job board          | Listed                               | Web only                                     | Not central                  |
| **Cotton Crew Jobs**      | Daywork app        | Yes                                  | iOS, **last update 2020 (effectively dead)** | Not central                  |
| **Dayworker.co (Maflin)** | Daywork-only app   | Yes                                  | iOS + Android, **5.0★ but only 3 ratings**   | Not central                  |
| Seazone                   | Yacht ops SaaS     | Mentioned                            | Web                                          | Not central                  |

**Two patterns leap out.** First, **MLC compliance posture is a clear demarcation line** between agencies (claim it loudly) and tech platforms (silent on it). Second, **the daywork-native space is occupied by exactly two thin players** — Cotton Crew is dead since 2020, Dayworker.co is a one-person operation. There is no scaled, well-funded, daywork-native incumbent.

**DockWalker's genuinely-differentiated value props:**

1. **Daywork with date-aware overlap resolution.** No competitor handles overlapping applications cleanly; WhatsApp groups treat each gig as isolated. DockWalker auto-supersedes via `APPLICATION.SUPERSEDED`. This is the single hardest piece of business logic in the daywork problem and only DockWalker has solved it as data, not social convention.
2. **Single profile, dual-role with hat switching.** Crew → employer transitions are real (chiefs hiring deckhands). No competitor models it.
3. **IMO as truth anchor + NDA reveal.** Yotspot/Yacrew NDAs rely on free-text "Confidential M/Y" — gameable in hours. IMO + post-acceptance reveal is novel.
4. **Append-only event ledger.** Audit-grade hiring history. Could be presented as compliance evidence.
5. **Cert hard-gate at projection layer for permanent.** Server-side, not UI-only. No competitor enforces this cleanly.
6. **Explicit "no scoring" stance.** Counter-cultural positioning asset; captains hate algorithmic black boxes.
7. **Docky AI advisor with MCA/RAG grounding.** `PERMANENT.APPLICATION_BLOCKED` events are a defensible data flywheel.

**The largest credibility gap is regulatory posture.** No mention of MLC 2006 alignment, no MCA RPSP accreditation reference, no clear positioning as "marketplace facilitator, not manning agency". Competing agencies all lead with this; DockWalker is silent. To a captain or fleet manager, that silence reads as "amateur hour" — even though the architecture would actually pass an audit better than most agency CRMs.

**Second gap:** no captain testimonials, no named yacht references. Trust in this industry is transitive through named individuals.

**Third gap:** mobile-app blockage. Daywork is intrinsically mobile. Until Expo ships, DockWalker is competing one-handed against Dayworker.co's iOS+Android presence and against the WhatsApp-group loop.

### Top industry risks

| #   | Risk                                                                                                                                                                                                                                             | Severity | Mitigation                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| M-1 | **MLC 2006 / MCA posture silent** — biggest credibility gap with sophisticated buyers (agents, captains, fleet managers). Also: marketing copy ("no pay-to-rank") is inconsistent with the Crew Pro Available Crew gate — see Section 2 addendum | **P1**   | Publish positioning statement; apply for MCA RPSP accreditation; reconcile landing-page copy with the Crew Pro gate (~1 hour copy fix) |
| M-2 | **No named captain endorsements** — trust in this industry is transitive through individuals                                                                                                                                                     | **P1**   | Land 3 endorsements before launch; offer Crew Pro for life as incentive                                                                |
| M-3 | **Mobile-app blockage** — daywork is intrinsically mobile; web-only competes one-handed against Dayworker.co + WhatsApp                                                                                                                          | **P1**   | Resolve Mac+Xcode access; complete Phase 7                                                                                             |
| M-4 | **WhatsApp group network effect** — the biggest groups have multi-year stickiness; migration is humans-and-trust, not technology                                                                                                                 | **P2**   | Build a "WhatsApp bridge" feature: forward postings to WA groups with structured preview + deep-link back to apply                     |
| M-5 | **Yotspot/Bluewater bundle response** — incumbents could clone daywork in a quarter if DockWalker takes off                                                                                                                                      | **P2**   | Move fast on captain referrals + agency partnerships before they react                                                                 |

### Top industry strengths

1. **Daywork-native space is functionally vacant** — best window in years to claim the segment.
2. **DockWalker's architectural choices are individually defensible and collectively novel** — IMO anchor, dual-role, append-only ledger, no-scoring.
3. **UK-registered + EU-region infrastructure** — natural fit for the industry's regulatory and geographic centre of gravity.

---

## 7. Consolidated Risks (Cross-Domain, Ranked)

**P0 — Code-level fixes blocking real-user scale:**

1. **D-1 — Event idempotency.** Add `idempotency_key` column to events + unique constraint. Any state-mutating route must pass a key from a deterministic source (UUID-from-context preferred over UUID-from-thin-air). Otherwise a network retry can double-fill a multi-crew posting or double-rate an engagement.
2. **D-2 — NULL coercion in DAYWORK.ACCEPTED race guard.** Two-line fix: `if not found then raise exception 'daywork no longer exists'` after the SELECT. Latent today (no daywork-deletion path), but a future cleanup process would silently corrupt.

**P1 — Operational + go-to-market posture:**

3. **M-1 — MLC 2006 / MCA positioning silent.** Highest-leverage external action. A single page on the site + UK admin time + clean T&Cs draft. Closes the largest credibility gap.
4. **M-2 — No captain endorsements.** Land 3 named endorsements (Antibes-based, 60m+, charter-operated) before launch. Crew Pro for life as incentive.
5. **M-3 — Mobile-app blockage.** Resolve Mac+Xcode; complete Phase 7. Daywork without mobile is structurally compromised.
6. **F-1 — Discover page (834 lines) unmaintainable.** Split into 4 tab components.
7. **T-1 — Playwright E2E not in CI.** Wire to GitHub Actions.
8. **S-1 — NDA masking coverage drift.** Audit raw vessel queries; add lint rule.
9. **S-2 — GDPR DATA_SCRUBBED not automated.** Add cron 30d after DEACTIVATED.
10. **I-1, I-2, I-3 — Sentry DSN, rollback runbook, secrets to Vercel env.** Operational hygiene.

**P2 — Quality + maintainability:**

11. F-2/F-3/F-4/F-5 — Messages error boundary, cache strategy, z-index system, ARIA coverage.
12. T-2/T-3/T-4 — Reseed cadence, payload casing, API catalog.
13. S-4/S-5/S-6/S-7 — Telegram HMAC, per-user rate limit, admin audit log, JWT propagation.
14. M-4/M-5 — WhatsApp bridge, incumbent response speed.

---

## 8. Recommended Action Plan (6-Week Sketch)

### Week 1 — P0 code fixes + secret hygiene

- D-1: Add idempotency_key to events table + unique constraint. Update `appendEvent` to require key. Pass key from every route (deterministic per request).
- D-2: Add `if not found then raise` after the SELECT in `apply_projection` DAYWORK.ACCEPTED handler.
- I-3 / S-3: Audit + migrate all secrets from `.env.production.local` to Vercel Environment Variables. Rotate any keys that touched the file. Add `.env*.local` to `.gitignore` (verify it's already there).
- I-1: Enable Sentry — create project, add DSN to Vercel env vars, verify error capture.

### Week 2 — Regulatory positioning + first endorsement

- M-1: Draft and publish MLC 2006 positioning statement on the marketing site. T&Cs review by maritime lawyer (1 hour) — include the Crew Pro Reg 1.4 question per Section 2 addendum. Submit MCA RPSP application paperwork. Separately and quickly, fix the four marketing-copy locations identified in the Section 2 addendum (~1 hour) so "no pay-to-rank" is no longer contradicted by the Available Crew gate.
- M-2: Reach out to 3 captain candidates (Antibes-based, 60m+, charter). Crew Pro for life offer.
- I-2: Document database rollback runbook in `tasks/runbook.md`.

### Week 3 — Frontend + testing hardening

- F-1: Split discover page into 4 tab components.
- F-2: Add error boundary to messages page; render error UI on null context.
- T-1: Wire Playwright to GitHub Actions. Tolerate the longer build.
- S-1: Audit raw `from('vessels')` queries; replace with `get_vessel_public` calls.

### Week 4 — Mobile unblock attempt

- M-3: Make a concentrated push to resolve Mac+Xcode access. If unblocked, start Phase 5 (in-flight UX polish). If still blocked, document the specific failure mode and explore TestFlight via a contracted Mac developer for 2-3 days.

### Week 5 — Operational completeness

- S-2: Implement DATA_SCRUBBED automation (cron 30d after DEACTIVATED).
- F-3: Standardise on TanStack Query for cache invalidation.
- T-2: Document reseed cadence; add automated integration run.
- M-4: Build WhatsApp bridge (Meta Cloud API direction is already in flight).

### Week 6 — Launch readiness

- M-2: Land 2 more captain endorsements + 1 mid-size agency co-listing partnership (Wilson Halligan, Quay Crew).
- S-4 / S-5 / S-6: Telegram HMAC, per-user rate limit, admin audit log.
- Marketing surface: landing page redesign with DockWalker logo above fold, port-specific dynamic hero, captain quote, OG cards per posting.
- Final cross-browser + cross-device QA via the device-testing.md checklist.

---

## 9. Verdict

**Architecture: top-tier.** The codebase displays unusual rigor for a solo-engineer pre-launch product. Append-only ledger, deterministic projections, three-tier auth, comprehensive RLS, domain-aware CI gates, sophisticated NDA masking, IMO truth anchor — this is not a typical SaaS-foundation. It would survive a regulatory audit better than most agency CRMs.

**Product fit: real.** The daywork-coordination problem is genuinely unsolved. The two daywork-native apps are weak (one dead, one tiny). Agencies don't compete in this segment. WhatsApp groups dominate because nothing better exists. DockWalker's architectural choices are individually defensible and collectively novel.

**Operational posture: 80% there.** The two P0 code risks (event idempotency, NULL coercion in race guard) are concrete and fixable in a day each. The bigger work is external: MLC positioning, captain endorsements, mobile unblock. None of these are technically hard; all of them require deliberate go-to-market action.

**Single biggest leverage point: MLC 2006 / MCA RPSP positioning.** It costs UK admin time and a clean T&Cs draft. It closes the largest credibility gap and erects a moat against future entrants who cannot trivially clone the regulatory posture. This is the most under-invested part of the product.

**Second-biggest leverage point: captain referrals.** Trust in this industry is transitive. Three names + three yachts moves more crew than three months of paid acquisition.

**Third-biggest: mobile.** Daywork without mobile is structurally compromised. Whatever it takes to unblock Phase 7.

DockWalker is closer to launch than the founder's internal sense of it probably suggests. The remaining work is largely operational, not architectural.

---

_Synthesised from 6 parallel domain audits. File:line citations available in each agent's underlying report. Findings reflect the codebase state at commit `95d1abc` (post-Vessels V2 Wave F follow-ups)._
