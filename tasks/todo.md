# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

### CV Builder v1

> Spec: [`tasks/cv-builder-spec.md`](./cv-builder-spec.md) (v2.1). Sign-off received 2026-04-28 on tier model, QR-landing UX, hire-from-QR primitives, lockdown approach, and 11 stress-test calls. Staged rollout decision 2026-04-29: PDF rendering deferred to Stage 2 to decouple from design iteration; rest of the wiring ships in Stage 1 with locked entry points (WhatsApp Coming-Soon pattern). v2.1 (2026-04-29) closed six gap-fill items (daywork idempotency UNIQUE constraint, permanent invitation lifecycle with applications.invited_from_id backlink, `not_looking` warning, apply-after-invite UX, mint-on-conflict retry, expired-status daily cron) and three deferred items (agent CVs out of scope, notification copy as content-pass, existing-posting invite as v2).
>
> Schema v130 → v131. Stage 1 scope: ~5–6 focused sessions across Phases 1–7. Stage 2 (Phase 8): PDF render + lockdown + unlock, sized when PDF design is ready.

**Pre-flight checks (every session):**

- Read CLAUDE.md invariants: append-only ledger, IMO truth anchor, RLS on every table, migrations reversible, TS strict.
- Confirm spec section being implemented — not drift.
- Re-check `MEMORY.md` for project patterns (no Docker, `npx supabase db push` only).

---

#### Phase 1 — Schema + flags + permanent_invitations

- [x] Migration `00131_cv_builder_v1.sql` — applied to live remote 2026-04-29:
  - [x] `profiles` add: `cv_handle text unique`, `cv_handle_updated_at timestamptz`, `cv_include_sea_time boolean not null default false`, `cv_generated_at timestamptz`
  - [x] Partial index `idx_profiles_cv_handle on profiles(cv_handle) where cv_handle is not null`
  - [x] `crew_experiences` add: `cv_show_full_vessel boolean not null default true`
  - [x] `references` add: `include_on_cv boolean not null default false`
  - [x] **(v2.1)** `daywork_invitations` UNIQUE — already exists from 00030 (`daywork_invitations_unique_crew_daywork`), no-op confirmed
  - [x] **(v2.1)** `applications` add: `invited_from_id uuid references public.permanent_invitations(id) on delete set null` + partial index `idx_applications_invited_from(invited_from_id) where invited_from_id is not null`
  - [x] New table `permanent_invitations` (id, permanent_posting_id FK, crew_person_id FK, status CHECK including `'expired'`, invited_by_person_id FK ON DELETE SET NULL, message ≤500, created_at, responded_at, UNIQUE(posting, crew))
  - [x] Indexes: `idx_permanent_invitations_crew(crew_person_id, status)`, `idx_permanent_invitations_posting(permanent_posting_id)`, `idx_permanent_invitations_pending_expiry(created_at) where status='pending'`
  - [x] Enable RLS + policy: invited_by OR crew OR posting employer can SELECT (note: permanent_postings has no `agent_person_id` column — agents post via `employer_person_id`, so policy uses that single check)
  - [x] Drop+recreate `events_aggregate_type_check` to add `'permanent_invitation'`
  - [x] `apply_projection` handlers: `PERMANENT.INVITED`, `CV.GENERATED` (lazy-mint cv_handle from payload via coalesce on OLD), `CV.HANDLE_REGENERATED`. CV handlers deliberately don't bump `profiles.updated_at` (preserves staleness signal for spec §11)
  - [x] **(v2.1)** Extended existing `PERMANENT.APPLIED` handler: optional `invited_from_id` branch with race-guarded `AND status='pending'` flip
- [x] Rollback `00131_*.down.sql` — schema fully reversed (drops invited_from_id + index, permanent_invitations CASCADE, references/crew_experiences/profiles columns + index, restores prior aggregate_type CHECK); apply_projection NOTICE points at re-applying 00130
- [x] **(v2.1)** `apps/web/src/lib/cv/mint-handle.ts` helper + 8 unit tests
- [x] Lessons-mandated apply_projection replacement protocol verified — `$$` count = 2, file ends `end case; end; $$;`, handler count 82 → 85
- [x] Run typecheck + tests — 1362 tests pass (+8 new mint-handle), web lint 0 errors, aggregate_type audit pass
- [x] Apply to remote: `npx supabase db push` — applied successfully (one fix-and-retry: removed reference to nonexistent `permanent_postings.agent_person_id` column)
- [x] Stress test `scripts/stress-test-cv-builder-phase1.ts` — 19/19 pass against live remote (schema columns exist, CV.GENERATED back-fills handle on first call + preserves on second, CV.HANDLE_REGENERATED rotates correctly). PERMANENT.INVITED + PERMANENT.APPLIED invited_from_id branch deferred to Phase 5 stress test (route exists then; full posting fixture too heavy for Phase 1)

---

> **Stage 1 — Locked-entry MVP (Phases 1–7).** PDF rendering deferred to Stage 2; everything else ships with Generate / Build CV buttons greyed-out + "Coming Soon" toast. Phase 1 above is shared with Stage 1 (schema enables both stages).

#### Phase 2 — Stage-1 plumbing (handle scaffolding, PDF deferred)

- [x] `npm install qrcode` (Stage-2 PDF QR dep, staged in now to stabilise lockfile)
- [x] `apps/web/src/app/api/cv/generate/route.ts` — POST stub, crew-only auth, returns `503 { error: "DockWalker CV — Coming Soon", message: ... }`
- [x] `apps/web/src/app/api/admin/cv/mint-handle/[personId]/route.ts` — POST, requireAdmin, 404/409/201/500 per spec, fires `CV.HANDLE_REGENERATED` with `old_handle=null`
- [x] `@dockwalker/types` extended with PERMANENT.INVITED, CV.GENERATED, CV.HANDLE_REGENERATED, optional invited_from_id on PERMANENT.APPLIED, `permanent_invitation` aggregate type
- [x] **Skip in Stage 1:** `cv-pdf.tsx`, `cv-data.ts`, `lockdown.ts`, `/api/cv/regenerate-handle` — Phase 8
- [x] Unit tests (9 new): 3 cv-generate (401 unauth, 403 non-crew, 503 crew); 6 admin mint-handle (403 non-admin, 404 missing profile, 409 existing, 201 success + event payload, 500 MintHandleError, 500 unknown error)

#### Phase 3 — CV Builder UI (locked-entry)

- [x] New route: `apps/web/src/app/(app)/settings/cv/page.tsx`
- [x] **(v2.1) Hat gate**: agent hat → `router.replace('/settings')` and render null while redirect is in flight
- [x] **Stage-1 Coming-Soon banner card** at top of section per spec §12.1 wording
- [x] **Generate CV button**: locked with `aria-disabled="true"` + Coming-Soon toast on click (matches `chat-header.tsx` Fix 222d pattern). Does NOT call `/api/cv/generate`.
- [x] Section: sea time toggle — PATCH /api/cv/settings with `{ cvIncludeSeaTime }`
- [x] Section: references list (filtered to `status='accepted'`) with per-row toggle — PATCH /api/cv/settings with `{ referenceId, includeOnCv }`. Helper text re: referee consent inheritance.
- [x] Section: NDA experiences list (filtered to `vessels.nda_flag = true`); per-row toggle — PATCH /api/cv/settings with `{ experienceId, cvShowFullVessel }`. Banner above per spec wording.
- [x] **Skipped in Stage 1**: Regenerate-handle button (Phase 8)
- [x] Profile page hot button: locked card just below the avatar block, crew-hat + crew-identity gated. Greyed-out + Coming-Soon toast on tap. Stage 2 unlocks.
- [x] Settings nav link: added "CV Builder" entry to `account-section.tsx` so users can find the new page from `/settings`.
- [x] **API surface (Phase 3 additions):**
  - GET /api/profile extended with `cv_handle, cv_handle_updated_at, cv_include_sea_time, cv_generated_at`
  - GET /api/references/mine REF_COLUMNS extended with `include_on_cv`
  - GET /api/experiences SELECT extended with `cv_show_full_vessel`
  - **New** PATCH /api/cv/settings — single endpoint, polymorphic body, owner-scoped. Justified as direct UPDATE (not event-sourced) because these are per-row UI display preferences with no projection cascade or temporal semantics.
- [x] Component tests (15 new): 9 PATCH endpoint tests (401/403/400/200×3/500/404×2) + 6 page tests (banner renders, locked Generate fires toast and does NOT call /api/cv/generate, agent hat redirects, sea-time toggle PATCHes correctly, accepted-only references render, NDA-only experiences render)

#### Phase 4 — QR-landing route + page

- [ ] `apps/web/src/app/api/cv/[handle]/route.ts` — GET, returns full crew profile + opted-in accepted references. Rate limit: 20/hr unauth IP, 100/hr auth IP (Upstash). NDA mask: respects `crew_experiences.cv_show_full_vessel`; defaults to mask if column missing (privacy-safe backstop).
- [ ] Tombstone state: if crew is deactivated, return 200 with tombstone payload (don't 404 — graceful UX per B-5)
- [ ] `apps/web/src/app/cv/[handle]/page.tsx` — public route (allowed in middleware)
- [ ] Three render states: not-signed-in (teaser + sign-up CTA with `?redirect=/cv/{handle}`), signed-in employer/agent (full profile + sticky action bar), signed-in crew (hat-switch banner)
- [ ] Stale notice: if `profiles.updated_at > cv_generated_at + 30d`, render banner per spec
- [ ] Tombstone state: shows "no longer active" + soft handoff to discovery
- [ ] Sign-up flow: `/auth/signup` route reads `?redirect=` param and routes there post-onboarding (B-8)
- [ ] Hat-switch banner: re-uses existing hat-switcher infrastructure
- [ ] Unit tests: rate-limit fires; NDA mask applies per toggle; tombstone for deactivated crew; stale banner triggers correctly

#### Phase 5 — Hire-from-QR wizards

- [ ] Daywork wizard component — reuses fields from `/post` daywork form, prefilled with `inviteCrewPersonId`. Single-page form. **(v2.1)** Client-side submit-button debounce; on 409 from `unique_violation` show inline error "You've already invited this crew to this posting." with link back to existing daywork detail.
- [ ] Vessel pre-step component — minimal form (IMO + name + vessel_type + LOA + flag state). Reuses existing `/api/vessels` POST flow; vessel lands as `source='pending'` per current behaviour.
- [ ] Extend `/api/daywork/route.ts` POST: optional `inviteCrewPersonId` payload; if present, atomic `appendEvents([DAYWORK.POSTED, DAYWORK.INVITED])`. Rate limit: 5/hr per employer for QR-flagged posts. **(v2.1)** Catch `unique_violation` on `daywork_invitations` (Postgres `23505`) and return 409 `{ error: "You've already invited this crew to this posting." }` instead of 500.
- [ ] Permanent invite wizard — reuses fields from `/post/permanent`, fires `PERMANENT.INVITED` after `PERMANENT.POSTED`. **(v2.1)** Inline `not_looking` warning subsection: when targeted crew has `permanent_availability='not_looking'`, render banner "Sophie has marked themselves as not currently looking for permanent positions. Continuing will send the invitation anyway — they can decline." with `[Cancel]` and `[Send invitation anyway]` buttons. Crew's `permanent_availability` is not changed.
- [ ] `apps/web/src/app/api/permanent/[id]/invite/route.ts` — POST, employer/agent hat, fires PERMANENT.INVITED, sends notification, rate-limited 5/hr/employer
- [ ] Notification triggers: `notifyOnEvent` mappings for PERMANENT.INVITED → crew gets push + in-app card with deep link to `/permanent/[id]/apply?from_invitation={invitation_id}`. **(v2.1)** Notification body content-pass: "Captain James invited you to apply for Bosun on M/Y Serenity" — final wording during implementation, not a deferral. Push trigger entry mirrors `DAYWORK.INVITED` shape in `notification_triggers`.
- [ ] **(v2.1)** Apply-after-invite wiring on `/permanent/[id]/apply`:
  - Read `?from_invitation` query param, server-fetch the invitation, validate (a) it exists, (b) status is `pending`, (c) the invited `crew_person_id` matches the auth user
  - Render context banner above the apply form: "Captain James invited you to apply for Bosun on M/Y Serenity. Their invitation is what brought you here." (No pre-fill of message field — crew writes their own message.)
  - On apply submit, include `invited_from_id={invitation_id}` in the PERMANENT.APPLIED event payload. Server-side validation re-checks the same three conditions before committing. Projection (Phase 1 PERMANENT.APPLIED handler extension) flips the invitation row to `applied`.
- [ ] **(v2.1)** Captain review queue: render an `✉ Invited` badge on application cards where `applications.invited_from_id is not null`. No change to ordering — invited applications appear in the normal recency-based queue but are visually distinguishable. File: existing review-queue card component.
- [ ] Sticky action bar on `/cv/[handle]` page: "Hire daywork" / "Hire permanent" / inline "Contact reference" per accepted reference card
- [ ] Agent variant: agent's vessel selector points at their placement clients' vessels (reuse existing pattern from agent-side `/post/permanent`)
- [ ] Unit tests: atomic POST+INVITE event ordering; rate limit fires 429; agent placement-vessel flow; **(v2.1)** daywork re-invite returns 409; not_looking warning renders only when applicable; from_invitation server-side validation rejects mismatched crew_person_id; PERMANENT.APPLIED with invited_from_id flips invitation status; review queue badge renders on invited applications.

#### Phase 6 — Auth flow polish + abuse mitigations

- [ ] `?redirect=` parameter handling in signup flow (validate against allowlist, default to /profile)
- [ ] Hat-switch banner UI on `/cv/[handle]` for crew-hat scanners
- [ ] Confirm Upstash rate-limit configs are in place: `/api/cv/[handle]` (20/100), QR-flagged posts (5/hr), regen (1/7d)
- [ ] Admin abuse review surface: small admin page or query template for spotting QR-spam patterns (`dayworks` with high count of invitations from a single employer in a short window)
- [ ] **(v2.1)** Daily expiry cron for `permanent_invitations`: extend an existing cron handler (e.g., `/api/cron/reference-expiry`) OR add a new handler that flips `permanent_invitations SET status='expired' WHERE status='pending' AND created_at < now() - interval '30 days'`. Uses partial index `idx_permanent_invitations_pending_expiry`. Add to `vercel.json` if a new cron is created (recommend `0 3 * * *` to avoid clashes). Unit test: pending invitation 31d old → cron flips to `expired`; pending invitation 5d old → unchanged; non-pending invitations are not touched.

#### Phase 7 — Stress test + device-test additions (Stage 1 scope)

- [ ] `scripts/stress-test-cv-builder.ts` — live-DB E2E (Stage 1 cases):
  - Admin mint-handle route mints exactly once per person
  - `/api/cv/[handle]` returns full profile + opted-in references; respects NDA per-experience toggle (full vs masked)
  - Rate limit on `/api/cv/[handle]`: 21st request from one IP in an hour returns 429
  - QR-hire daywork: atomic POST+INVITE event sequence; rate limit fires at 6th post in an hour
  - **(v2.1)** Daywork idempotency: re-inviting the same crew on the same daywork posting returns 409 with the spec'd error message; inviting on a fresh daywork post is allowed (different `daywork_id`)
  - QR-hire permanent: PERMANENT.INVITED fires; cert hard-gate still applies on the crew's subsequent apply step
  - **(v2.1)** Permanent invitation lifecycle: pending → applied (crew applies via apply form with from_invitation, projection updates row + sets applications.invited_from_id); pending → declined (crew taps decline); pending → revoked (captain rescinds); pending → expired (cron tick after 30 days)
  - **(v2.1)** Apply-after-invite race: crew taps decline and apply concurrently — `AND status='pending'` race guard ensures only one transition wins; the other surfaces a graceful error
  - **(v2.1)** `not_looking` warning: invitation against `not_looking` crew renders the banner; submit-anyway still creates the invitation; crew's `permanent_availability` is unchanged
  - **(v2.1)** Captain review queue: invited applications display the `✉ Invited` badge; non-invited applications do not
  - **(v2.1)** Mint retry: simulate `unique_violation` once on the first mint attempt → helper retries and succeeds on the second; simulate 5 consecutive failures → helper throws (covered with a unit test using a mocked Supabase, not stress test)
  - Tombstone: deactivated crew returns tombstone, not 404
  - **Skip in Stage 1**: PDF rendering tests, regen rate-limit (both Phase 8).
- [ ] `tasks/device-testing.md` additions — new §11: CV Builder (Stage 1):
  - Crew flows: toggles in `/settings/cv` persist (sea time, references, NDA reveal); profile hot button shows Coming-Soon toast; Generate button shows Coming-Soon toast
  - Internal QA flows (admin-minted handle): scan/visit `/cv/{handle}` → teaser when signed-out; sign up with redirect → land on full profile; sticky action bar visible; NDA mask respects per-experience toggle; stale CV banner triggers when configured
  - Captain flows: hire daywork (atomic post+invite); hire permanent (invite-to-apply, cert gate fires on apply); contact reference (Free cap → upgrade nudge)
  - Agent flow: placement vessel selector for permanent invite-to-apply
  - Edge cases: deactivated crew tombstone, dual-hat scanner (hat switch banner)
- [ ] BUILD_STATE.md: stage entry for CV Builder Stage 1, schema bump v130 → v131, migration table row, Deferred Decisions (Phase 8 + v2 items)
- [ ] apps/web/README.md: new sections — `/api/cv/[handle]` route + admin mint-handle route, `/cv/[handle]` public page, CV Builder tier model, abuse mitigations, Stage-1 locked-entry state
- [ ] supabase/README.md: migration 00131 row

**Acceptance (Stage 1):**

- Migration 00131 applied; schema at v131; all toggles writable.
- `/settings/cv` renders Coming-Soon banner + working toggles + locked Generate button.
- Profile hot button locked + shows Coming-Soon toast.
- `/api/cv/[handle]` works for any admin-minted handle; `/cv/[handle]` page renders all three states + tombstone correctly.
- Hire-from-QR wizards (daywork + permanent) function end-to-end with admin-minted handles; rate limits fire as expected.
- All Stage-1 stress-test cases pass; device-testing additions cover the locked-entry surface.
- Stage-2 entry points (PDF render) clearly identified as deferred in BUILD_STATE.

---

---

> **Stage 2 — Unlock (deferred work stream, design-iteration-driven).** Triggered when PDF visual design is signed off. Single deploy unlocks the whole feature surface.

#### Phase 8 — PDF render + lockdown + unlock entry points

- [ ] Confirm PDF visual design is signed off (mockups / Figma / agreement on layout, typography, colour, opt-in section rendering)
- [ ] `npm install @react-pdf/renderer pdf-lib`
- [ ] `apps/web/src/lib/cv/cv-pdf.tsx` — React component tree (two-column A4, photo top-left, navy header, Geist typography, neutral footer with name + date, optional QR section for Pro)
- [ ] `apps/web/src/lib/cv/cv-data.ts` — server-side data assembly: profile + experiences (with period-correct vessel names via existing `lib/vessels/historical-names.ts`) + opted-in references + sea time totals if toggle on
- [ ] `apps/web/src/lib/cv/lockdown.ts` — pdf-lib post-processing: modifying false, copying false, documentAssembly false, contentAccessibility true; render footer + QR as vector graphics; stamp `Producer` metadata
- [ ] Replace 503 stub at `/api/cv/generate` with real PDF return: crew-only, fires CV.GENERATED, mints `cv_handle` if null on first call, returns PDF blob with `Content-Type: application/pdf`. Pro adds QR section to render tree; Free omits.
- [ ] `apps/web/src/app/api/cv/regenerate-handle/route.ts` — POST, Crew Pro only, 7-day rate limit (Upstash), explicit confirmation header, fires CV.HANDLE_REGENERATED. Wire into the previously-skipped Settings-CV "Regenerate my CV link" button (Phase 3 carve-out).
- [ ] **Un-grey Generate / Build CV buttons** in Settings + profile hot button. Remove the Stage-1 Coming-Soon banner card from `/settings/cv`.
- [ ] Unit tests: cv-data assembly per tier (Free no QR, Pro with QR, NDA toggle respected, sea time toggle respected); render-tree shape; lockdown permissions applied; regen rate-limit fires 429.
- [ ] Extend `scripts/stress-test-cv-builder.ts` with PDF cases:
  - Generate PDF for Free crew (no QR, no salary, references included only if opt-in)
  - Generate PDF for Pro crew (QR present, all opt-ins respected, NDA toggle respected)
  - Regenerate handle within 7d → 429; after 7d → success; old `/cv/{old_handle}` returns tombstone
- [ ] Extend `tasks/device-testing.md` §11 with PDF flow:
  - Generate (Free → no QR), preview download, regenerate handle (Pro), verify old QR resolves to "no longer valid" tombstone, lockdown verified by attempting to edit in Acrobat / Preview
- [ ] BUILD_STATE.md: stage entry for CV Builder Stage 2 unlock; remove Phase 8 from Deferred Decisions
- [ ] apps/web/README.md: update CV section to reflect PDF generator live; remove Stage-1 locked-entry note

**Acceptance (Stage 2 — full feature live):**

- Free crew generates a beautiful, branded CV PDF with no QR. Footer reads "Generated by DockWalker · dockwalker.io · {Name} · {date}".
- Crew Pro generates the same CV with a working QR code that resolves to `/cv/{handle}` with a sticky action bar.
- Captain scanning a Pro CV → signs up (redirect preserved) → hires for daywork (atomic post+invite) or invites for permanent (invite-to-apply, cert gate fires on apply) or contacts a reference (subject to Employer Free 5/30d cap).
- Agent scanning a Pro CV → can do all the above with their placement vessel selector.
- All abuse mitigations (rate limits) fire under stress test. NDA respects per-experience toggle on both PDF and QR-landing surfaces.
- Stress test 100% pass against remote (Stage 1 + Stage 2 cases).
- BUILD_STATE.md, apps/web/README.md, supabase/README.md, device-testing.md all updated to reflect feature-complete state.

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
