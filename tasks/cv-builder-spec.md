# Feature Spec: DockWalker CV Builder

**Product:** DockWalker
**Owner:** Nautalink Technologies, Inc.
**Status:** Spec v2.1 — ready for implementation phasing
**Last updated:** 2026-04-29
**Supersedes:** Spec v1 (2026-04-05), Spec v2 (2026-04-28)

---

## 1. Problem Statement

Crew in superyacht hiring still circulate paper or basic PDF CVs that are self-declared, unverifiable, and divorced from any platform. DockWalker has the architecture (event ledger, IMO-anchored vessel history, consent-based references, multi-nationality, entry rights) to ship a CV that is both **beautiful and structurally tied back to the platform**.

The CV is not just a document — it is the platform's outbound acquisition surface. Every CV in circulation drives:

- **Captains** to scan the QR, sign up, contact references, and hire on-platform
- **Agencies** receiving DockWalker CVs through their own intake to recognise the platform and sign up themselves
- **Crew** to upgrade to Crew Pro to unlock the QR — the active hiring tool, not just a static document

---

## 2. Tier Model (locked)

| Tier              | Subscription | What's on the CV                                                                                                                                                                                                              | What it unlocks                                                                                                                                                                    |
| ----------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Free crew**     | €0           | Full CV: profile, photo, certs, languages, entry rights, all experience with vessel history (incl. period-correct names), all opted-in references with comments, sea time totals (if opted in). PDF download. **No QR code.** | Static, beautiful, shareable.                                                                                                                                                      |
| **Crew Pro**      | €4.99/mo     | All Free content + **QR code** on every page → `/cv/{handle}`                                                                                                                                                                 | Captain scans → can view full profile, contact references, hire for daywork, invite-to-apply for permanent. Active hiring tool.                                                    |
| **Free employer** | €0           | n/a (not on the CV side)                                                                                                                                                                                                      | Can scan QR, view profile, hire daywork (free, capped 5/hr), invite-to-apply for permanent (free, capped 5/hr). Reference contact: 5 accepted per 30 days, 10 outstanding pending. |
| **Employer Pro**  | €14.99/mo    | n/a                                                                                                                                                                                                                           | Unlimited reference contacts. Hiring caps lifted (rate limits remain for abuse defence).                                                                                           |

**Conversion funnels** (the killer architecture):

1. **Crew → Crew Pro**: "I want my CV to actively get me hired, not sit in a captain's email inbox" → upgrade.
2. **Captain → Employer Pro**: scans QR → wants to contact 6 references → hits 5/30d cap → upgrade.
3. **Agency → DockWalker**: receives DockWalker CV through their intake → scans QR → sees verified profile + references → realises competitors are also using the platform → signs up.

The Free crew CV is _deliberately_ useful and shareable on its own. It drives word-of-mouth growth. The QR is the active-hiring premium.

---

## 3. Data on the CV

All declared, non-private profile data. Excluded:

- Email, phone (excluded — forces all contact through the platform)
- Salary fields (always private, never returned by any DockWalker API)
- Anything marked `private: true`

### Sources

| CV section                  | Data sources                                                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity                    | `profiles.display_name`, `profiles.deck_name`, `profiles.avatar_url`, `profiles.nationality_ids` (multi-flag), `profiles.entry_right_ids`, `profiles.languages`                    |
| Current status              | `profiles.permanent_availability`, `profiles.notice_period_days`, `profiles.desired_role_id`, `availability_windows` (latest, summarised)                                          |
| Location                    | `profiles.location_city_id` (city + region)                                                                                                                                        |
| Bio                         | `profiles.bio`                                                                                                                                                                     |
| Certifications              | `profiles.certification_ids` joined to `certifications` (name, category, subcategory)                                                                                              |
| Experience                  | `crew_experiences` joined to `vessels` and `vessel_names` (period-correct via existing `lib/vessels/historical-names.ts`); auto-derived epaulettes via shared role-grouping helper |
| References (opt-in per row) | `references` where `status='accepted'` AND `include_on_cv=true`; renders referee name + role + comment + dates + (period-correct) vessel snapshot                                  |
| Sea time totals (opt-in)    | `crew_experiences.sea_time_days` + `sea_time_nautical_miles` summed; only included if `profiles.cv_include_sea_time=true`                                                          |
| QR code (Pro only)          | Generated server-side via `qrcode` npm; encodes `https://dockwalker.io/cv/{cv_handle}`                                                                                             |
| Footer                      | "Generated by DockWalker · dockwalker.io · {Display Name} · {generation date}" — neutral, no upgrade nudge                                                                         |

**Single source of truth.** No CV editor. To change the CV, update the profile. Three opt-in toggles only:

1. `references.include_on_cv` — per-reference, default OFF (explicit opt-in)
2. `crew_experiences.cv_show_full_vessel` — per-experience, default ON (industry norm is to disclose); UI surfaces toggle only on NDA-flagged vessels
3. `profiles.cv_include_sea_time` — profile-level, default OFF (privacy default)

---

## 4. PDF Generation + Lockdown

**Renderer**: `@react-pdf/renderer`

- Server-side, runs on Vercel without Chromium dependency (no cold-start issue)
- React component tree shared between PDF generation and (potentially v2) HTML preview
- Layout: A4, two-column. Left rail = identity, certs, languages, entry rights. Right column = experience, references, sea time. Photo circle-cropped top-left.
- Typography: Geist (matches app design system); fall back to Inter
- Colour palette: navy header (`#111a24`), platform accent (`#2d7de0`), neutrals
- Max 2 pages — paginate gracefully when experience list is long; epaulette badges per experience for visual rank scan

**Lockdown** (three layers):

1. **PDF document permissions via pdf-lib post-processing** (after @react-pdf renders):
   - `modifying: false` — block edits
   - `copying: false` — block UI text-copy (does not break ATS / programmatic parsing)
   - `documentAssembly: false` — block page-level changes
   - `contentAccessibility: true` — keep readable by screen readers + ATS systems
2. **Structural irreversibility**:
   - Footer text "Generated by DockWalker · dockwalker.io · {Name} · {date}" rendered as **vector graphics**, not selectable text
   - QR code (Pro only) rendered as vector — re-creating it requires a real DockWalker handle
   - `Producer` PDF metadata field stamped `DockWalker {version}` — programmatic tampering detector
3. **Architectural lockdown via QR**: the QR is the truth source. A crew member who tampers (e.g., adds their own phone number to the PDF) sells against themselves — captain scans → DockWalker profile shows no phone → discrepancy is visible.

> Lockdown is "casual deterrent" not "determined attacker." A user with command-line tools can strip permissions. The architectural lockdown (QR + platform single-source-of-truth) is what actually keeps the contact-info inside the platform.

---

## 5. QR-landing Flow

URL: `https://dockwalker.io/cv/{cv_handle}` (8-char random alphanumeric, ~218 trillion combinations, fits in a small QR)

Handle is **stored on `profiles.cv_handle`**, minted lazily on first PDF generation, regenerable (1 per 7 days, free for Pro). Survives Pro→Free downgrades (B-6) — already-printed CVs keep working.

### Landing page `/cv/{handle}` — three states

**State 1: not signed in**
Teaser only — name, photo, primary role, availability badge. Single CTA: **"Sign up to view full profile and contact"** → `/auth/signup?redirect=/cv/{handle}` (B-8: redirect preserved through auth).

The **availability badge** renders **permanent availability only** (not daywork — daywork's rolling 14-day window is too volatile for a printed CV in circulation for weeks/months). Three states from `profiles.permanent_availability`:

- `immediate` → "Available now"
- `after_notice` (with `notice_period_days`) → "Available in {N} days"
- `not_looking` → "Not currently looking — open to discuss"

The "open to discuss" softening on `not_looking` keeps the door open without overstating availability. Captains who choose to push past it go through the `not_looking` warning in the permanent QR-hire wizard (see §6).

**State 2: signed in, hat = employer or agent**
Full profile + sticky action bar at top:

```
┌──────────────────────────────────────────────────┐
│ [Photo]  Sophie Laurent · Bosun · 🇫🇷             │
│          M/Y Serenity (current) · 65m motor       │
│  [Hire daywork] [Hire permanent] [Contact ref]    │  ← sticky
├──────────────────────────────────────────────────┤
│ ABOUT / EXPERIENCE / CERTS / REFERENCES           │
│   ↳ each accepted reference: [Contact reference]  │
└──────────────────────────────────────────────────┘
```

NDA mask (B-1): the crew's per-experience `cv_show_full_vessel` toggle governs the QR-landing profile too. Crew toggle = source of truth for both PDF and QR-landing. Trust-boundary backstop (active engagement on this vessel) does NOT override the crew's toggle (crew is the explicit owner of disclosure).

Stale-notice (B-10): if `profiles.updated_at > cv_handle_updated_at + 30 days`, render a soft banner: _"This CV was generated on {date}. Profile has been updated since."_

**State 3: signed in, hat = crew**
Hat-switch banner (B-9): _"Switch to your employer hat to hire this crew or contact references."_ Plus the regular profile data view as fallback.

**State 4: deactivated crew (B-5)**
Tombstone page: _"This crew member is no longer active on DockWalker. Browse other crew or sign up to find similar profiles."_ — soft handoff to discovery.

### Rate limits on `/api/cv/{handle}` (B-7)

- 20 unique-handle requests per IP per hour for unauthenticated callers
- 100 per hour for authenticated callers
- Sufficient to deter scrapers, generous for real captains who scan one CV

---

## 6. Hire from QR

Two action buttons on the sticky bar map to existing primitives + one new event.

### Hire for daywork

Captain (or agent) taps **Hire for daywork**. Wizard:

1. **Vessel** — picker of caller's own registered vessels (or agent's placement vessels). If first-time captain (no vessel registered) → **B-3 pre-step: "Add your vessel" form** (IMO + name + type + LOA), then continues. _"DockWalker is anchored on IMO numbers. This stays."_ — dockwalker motto, per project invariant.
2. **Role** — yacht_roles picker
3. **Dates** — start_date, end_date
4. **Day rate** — amount + currency
5. **Port** — location picker
6. **Optional**: meals, working day dates, languages, message to crew

Submit:

- Atomic `appendEvents([DAYWORK.POSTED, DAYWORK.INVITED])` — one transaction, two events. Daywork is created with `status='active'`; invitation row inserted with `crew_person_id` pre-targeted.
- Rate limit (B-4): **5 QR-flagged daywork posts per hour per employer.** New `qr_origin` field on `dayworks` (or marker on `daywork_invitations`) plus an Upstash key.
- **Idempotency** (v2.1): `daywork_invitations` carries a `UNIQUE(daywork_id, crew_person_id)` constraint (added in migration 00131 if not already present). Re-invitation on the same posting → 409 with `{ error: "You've already invited this crew to this posting." }`. Wizard submit button has client-side debounce. Different daywork (e.g., captain re-thought dates) = different posting = different invitation = no conflict.
- Crew receives notification → can accept (engagement opens) or decline → existing flow.

Free for everyone (Free + Pro employer alike). Hiring is the platform's win; capping it would push hires off-platform.

### Hire for permanent (invite-to-apply)

Captain taps **Hire for permanent**. Wizard creates a `permanent_postings` row, then fires `PERMANENT.INVITED` (new event) addressed to the scanned crew. Crew receives notification → taps "Apply" → enters the apply form (with banner — see Apply-after-invite UX below) → cert hard-gate fires → shortlist → select flow (B-2 invariant preservation).

This is **invitation-to-apply**, not direct hire. Cert gate is preserved; no architectural exception. The wizard's value is "this captain has explicitly thought about this crew" — surfaces them at the top of the applicant review list with an "✉ Invited" badge.

Same rate limit (5/hr per employer) applies.

#### `not_looking` warning (v2.1)

If the targeted crew has `permanent_availability = 'not_looking'`, the wizard renders an inline banner before the submit button:

> **Sophie has marked themselves as not currently looking for permanent positions.** Continuing will send the invitation anyway — they can decline.
> [Cancel] [Send invitation anyway]

This respects crew intent in the default path (most captains will reconsider) while preserving captain agency for genuine edge cases. Crew's `permanent_availability` value is not changed; they receive the invitation and can decline normally.

#### State machine (v2.1)

`permanent_invitations.status` transitions:

```
pending  →  applied   (crew applies through the apply form)
         →  declined  (crew taps Decline on the invitation)
         →  revoked   (captain rescinds the invitation)
         →  expired   (30 days no response — daily cron tick)
```

Backlink: `applications.invited_from_id uuid references permanent_invitations(id) on delete set null` lets the crew's application carry attribution. The `PERMANENT.APPLIED` projection handler reads `payload.invited_from_id`; if present, the same transaction also sets `permanent_invitations SET status='applied', responded_at=now()`. Daily expiry tick extends the existing `cron/reference-expiry` cron (or a dedicated handler) to flip `pending` → `expired` for invitations past 30 days.

#### Apply-after-invite UX (v2.1)

Crew taps the `PERMANENT.INVITED` notification → deep-links to `/permanent/[id]/apply?from_invitation={invitation_id}`. The apply page renders a context banner at the top:

> **Captain James invited you to apply for Bosun on M/Y Serenity.** Their invitation is what brought you here.

Standard apply form below — same fields, same cert validation, same message box. Crew writes their own message; we don't pre-fill (avoids putting words in their mouth).

Server-side validation on POST: confirm the invitation exists, is in `pending` status, and the caller is the invited `crew_person_id`. On success, `applications.invited_from_id` is set; the projection's PERMANENT.APPLIED handler also flips the invitation row to `applied` (single transaction).

Captain's review queue surfaces invited applications with an "✉ Invited" badge above the application card. No change to ordering — invited applications appear in the normal recency-based queue but are visually distinguishable.

### Reference contact from QR

Existing primitive — `POST /api/references/[id]/contact`. Already gated correctly: any authenticated employer/agent can call it; Free tier hits 5/30d + 10 outstanding pending caps; Pro is unlimited. No change needed; the QR landing surface just exposes the reference UUIDs to the captain.

---

## 7. Data Model

### Migrations (single migration ~00131)

```sql
-- profiles: CV-specific fields
alter table public.profiles
  add column cv_handle text unique,
  add column cv_handle_updated_at timestamptz,
  add column cv_include_sea_time boolean not null default false,
  add column cv_generated_at timestamptz;

-- partial index for fast handle lookup
create index idx_profiles_cv_handle on public.profiles(cv_handle) where cv_handle is not null;

-- crew_experiences: per-experience NDA disclosure (default: show full)
alter table public.crew_experiences
  add column cv_show_full_vessel boolean not null default true;

-- references: per-reference inclusion on CV (default: hidden)
alter table public.references
  add column include_on_cv boolean not null default false;

-- daywork_invitations: idempotency for QR-hire posts (v2.1)
-- guarantees a single (posting, crew) pair across the system; re-invite returns 409
alter table public.daywork_invitations
  add constraint daywork_invitations_unique_posting_crew
  unique (daywork_id, crew_person_id);

-- applications: backlink so a permanent application can carry attribution to its invitation (v2.1)
alter table public.applications
  add column invited_from_id uuid references public.permanent_invitations(id) on delete set null;

create index idx_applications_invited_from on public.applications(invited_from_id)
  where invited_from_id is not null;

-- permanent_invitations table mirroring daywork_invitations
create table public.permanent_invitations (
  id uuid primary key default gen_random_uuid(),
  permanent_posting_id uuid not null references public.permanent_postings(id) on delete cascade,
  crew_person_id uuid not null references public.persons(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'applied', 'declined', 'revoked', 'expired')),
  invited_by_person_id uuid references public.persons(id) on delete set null,
  message text check (message is null or length(message) <= 500),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (permanent_posting_id, crew_person_id)
);

create index idx_permanent_invitations_crew on public.permanent_invitations(crew_person_id, status);
create index idx_permanent_invitations_posting on public.permanent_invitations(permanent_posting_id);
create index idx_permanent_invitations_pending_expiry
  on public.permanent_invitations(created_at)
  where status = 'pending';

alter table public.permanent_invitations enable row level security;

create policy "Employer reads own permanent invitations"
  on public.permanent_invitations for select to authenticated
  using (
    invited_by_person_id = auth.uid()
    or crew_person_id = auth.uid()
    or exists (
      select 1 from public.permanent_postings pp
      where pp.id = permanent_posting_id
        and (pp.employer_person_id = auth.uid() or pp.agent_person_id = auth.uid())
    )
  );

-- events_aggregate_type: add 'permanent_invitation' for the new event
alter table public.events drop constraint events_aggregate_type_check;
alter table public.events add constraint events_aggregate_type_check
  check (aggregate_type in ( /* existing list */, 'permanent_invitation' ));
```

### Mint-on-conflict retry (v2.1)

`cv_handle` is an 8-char random alphanumeric. The minter generates a candidate and inserts; on `unique_violation` (very rare — birthday paradox at 218 trillion combinations is negligible until ~10M handles, but defence in depth), retry up to **5 times**, then surface a 500. Both `CV.HANDLE_REGENERATED` (regen) and the lazy mint inside `/api/cv/generate` use the same helper:

```ts
// apps/web/src/lib/cv/mint-handle.ts
async function mintHandle(personId: string, supabase: SupabaseClient) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = randomAlphanumeric(8);
    const { error } = await supabase
      .from('profiles')
      .update({ cv_handle: candidate, cv_handle_updated_at: new Date().toISOString() })
      .eq('person_id', personId);
    if (!error) return candidate;
    if (error.code !== '23505') throw error; // unique_violation only
  }
  throw new Error('cv_handle minting exhausted retry budget');
}
```

### New events

| Event                   | Aggregate type         | Purpose                                                                                     |
| ----------------------- | ---------------------- | ------------------------------------------------------------------------------------------- |
| `PERMANENT.INVITED`     | `permanent_invitation` | Captain/agent invites a specific crew to apply to a permanent posting. Notification fires.  |
| `CV.GENERATED`          | `person`               | Crew downloaded their CV PDF. Payload: `{ handle, format: 'pdf' }`. Analytics + GDPR audit. |
| `CV.HANDLE_REGENERATED` | `person`               | Crew regenerated their `cv_handle`. Payload: `{ old_handle, new_handle }`.                  |

### apply_projection extensions

- `PERMANENT.INVITED` → INSERT into `permanent_invitations`; notification fan-out via push-triggers
- `PERMANENT.APPLIED` → existing handler is **extended**: when `payload.invited_from_id` is present, the same transaction sets `permanent_invitations SET status='applied', responded_at=now() WHERE id=payload.invited_from_id AND status='pending'` and writes `applications.invited_from_id = payload.invited_from_id`. No-op when `invited_from_id` is null (preserves all existing apply flows). The `AND status='pending'` clause is the race guard — concurrent decline + apply, decline wins.
- `CV.GENERATED` → UPDATE `profiles.cv_generated_at = now()`; mint `cv_handle` via `mintHandle()` if null
- `CV.HANDLE_REGENERATED` → UPDATE `profiles.cv_handle = payload.new_handle`, `cv_handle_updated_at = now()`

---

## 8. New Routes

| Route                        | Method          | Purpose                                                                                     | Gate / rate limit                                                                          |
| ---------------------------- | --------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `/api/cv/generate`           | POST            | Generate PDF; fires CV.GENERATED; returns blob with `application/pdf` content-type          | Crew only; mints handle on first call                                                      |
| `/api/cv/regenerate-handle`  | POST            | Mints new handle, fires CV.HANDLE_REGENERATED, invalidates old handle                       | Crew Pro only; **1 per 7 days** rate limit; explicit confirmation required                 |
| `/api/cv/[handle]`           | GET             | Returns full crew profile + accepted+included references for QR-landing page                | 20/hr unauth IP, 100/hr auth IP                                                            |
| `/api/permanent/[id]/invite` | POST            | Fires PERMANENT.INVITED, sends notification                                                 | Employer/agent hat; **5/hr per employer**; auth via existing daywork-post-like RPC pattern |
| `/api/daywork`               | POST (extended) | Existing route; new optional `inviteCrewPersonId` payload param triggers atomic POST+INVITE | **5/hr per employer for QR-flagged posts**                                                 |

### Route-layer NDA mask in `/api/cv/[handle]`

```ts
// per-experience: respect crew's cv_show_full_vessel toggle
if (experience.vessel.nda_flag && !experience.cv_show_full_vessel) {
  experience.vessel_name = 'NDA Vessel';
  experience.vessel_imo = null;
}
// references inherit the same toggle from their bound experience
```

Backstop: if for some reason the toggle is missing (legacy data), default to mask (privacy-safe).

---

## 9. UI Surfaces

### Profile page hot button

Card pattern matching the existing Docky-readiness card. Lives in `apps/web/src/app/(app)/profile/_components/`:

- **Free crew**: "Build your DockWalker CV" → tap → `/settings/cv` (CV Builder section)
- **Crew Pro**: "Your DockWalker CV — last generated 3 days ago" → tap → `/settings/cv`

Front-of-profile placement, near the avatar block — high visibility per user request.

### CV Builder section in Settings

New route: `/settings/cv` (sibling of `/settings/references`). Sections:

1. **Header**: "Build your CV" + Generate / Download button (Pro: download triggers PDF; Free: download triggers PDF without QR).
2. **Sea time toggle**: "Include sea time totals on my CV" + helper text "Sums every experience's sea time and nautical miles. Off by default for privacy."
3. **References list**: each accepted reference, each with a "Include on my CV" toggle. Default OFF. Helper text: "Your referee consented to display on your DockWalker profile. Toggling this on adds them to your downloadable CV. Toggle off any time."
4. **NDA experiences**: one row per `crew_experiences` where the bound `vessel.nda_flag = true`. Toggle: "Show full vessel name on CV (default ON — industry norm)." Banner above the section: explanatory text per the user's earlier call.
5. **QR code regeneration** (Pro only): button "Regenerate my CV link" with confirmation dialog: _"Old QR codes stop working immediately. Anyone holding a printed CV with the old code will see a 'no longer valid' page. New CV downloads will use the new code."_ + 7-day rate-limit indicator.

### QR-hire wizards

Daywork wizard: reuses existing `/post` form fields, prefilled with `inviteCrewPersonId`. Single-page form, post-and-invite atomic.

Permanent wizard: reuses existing `/post/permanent` form fields, fires `PERMANENT.INVITED` after `PERMANENT.POSTED`.

Vessel pre-step (for first-time captains/agents): minimal form (IMO + name + vessel_type + LOA + flag state), creates vessel via existing `/api/vessels` POST flow (which lands as `source='pending'` per current behaviour).

---

## 10. Abuse Mitigations Summary

| Threat                                                | Mitigation                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| QR-hire spam (1000 fake invitations from one captain) | 5 QR-flagged posts/hour per employer (Upstash rate limit)                    |
| Mass scraping of `/cv/{handle}` URLs                  | 20/hr unauth IP, 100/hr auth IP                                              |
| Crew tampers with CV PDF (adds phone number)          | Layer 1+2 lockdown deters; Layer 3 (QR truth source) makes it self-defeating |
| Crew regenerates handle to harass                     | 1/7d rate limit on regen                                                     |
| Captain hits Free reference cap and abandons          | 402 with explicit upgrade card → Employer Pro conversion                     |

---

## 11. Crew CV vs. Live Profile divergence (B-10)

Captain holds a printed CV with `Generated: 2026-04-15`. Profile has been updated since. When captain scans QR (later):

- The QR-landing profile renders **live** data (current role, current availability)
- A small banner at the top of the landing page reads _"This CV was generated on 15 April 2026. Profile has been updated since."_ if `profiles.updated_at > cv_generated_at + 30 days`
- Generated-on date is **printed on the CV itself** in the footer — captain can see the gap from the paper alone

No further action; live profile is authoritative.

---

## 12.1 Staged Rollout — Locked-Entry MVP (added 2026-04-29)

The `@react-pdf/renderer` component tree is the most design-iteration-heavy piece of v1. To decouple PDF visual work from the rest of the wiring (which is mechanical and benefits from landing together), v1 ships in two stages.

### Stage 1 — Locked-entry MVP

**Ships:**

- Migration 00131 (schema, columns, `permanent_invitations` table, event types, projection handlers)
- Settings → CV Builder section with all three toggles working: sea time, per-reference inclusion, per-experience NDA reveal
- Profile page hot button — present, **greyed out + "DockWalker CV — Coming Soon" toast on tap** (WhatsApp Coming-Soon pattern, see Fix 222d)
- `/api/cv/[handle]` endpoint + rate limits (20/hr unauth, 100/hr auth) — fully working
- `/cv/[handle]` public page — three render states + tombstone + stale notice — fully working
- Hire-from-QR wizards: daywork (atomic post+invite) and permanent (invite-to-apply); vessel pre-step for first-time captains
- `PERMANENT.INVITED` event + projection
- Sign-up redirect preservation, hat-switch banner
- Abuse rate limits (5/hr posts, 5/30d reference contacts, scrape limits)

**Deferred to Stage 2:**

- `@react-pdf/renderer` component tree (the visual layout)
- `pdf-lib` lockdown post-processing
- `/api/cv/generate` real PDF return — Stage 1 stub returns `503 { error: "DockWalker CV — Coming Soon" }`
- `/api/cv/regenerate-handle` — pointless without QR codes in circulation; defer
- Settings → CV Builder section's **Generate CV** button — greyed out + Coming-Soon toast
- Profile hot button — greyed out + Coming-Soon toast (same pattern)

### Chicken-and-egg around `cv_handle` minting

`cv_handle` is minted on first PDF generation per the v1 design. With PDF deferred, **no real-user flow mints a handle** during Stage 1. Two consequences:

1. The QR-landing surface and hire-from-QR wizards are wired + unit-tested but **unreachable via natural user flows** until Stage 2 lands.
2. Internal QA + stress testing require a way to mint handles without PDFs.

**Resolution:** a dev/admin route `POST /api/admin/cv/mint-handle/[personId]` (requireAdmin gate) that mints a handle for a given crew member, firing `CV.HANDLE_REGENERATED` with `old_handle=null`. Used for QA + stress testing during Stage 1; remains as admin-only after Stage 2 (rare operational tool — admin can rescue a crew whose minting failed, etc.).

### Stage 1 Settings UI callout

Top of `/settings/cv` during Stage 1: a banner card explaining the deferred state, so toggle users understand why no Generate button works yet.

> **DockWalker CV — Coming Soon**
> Configure your CV settings now: choose which references to include, decide which NDA experiences to disclose, and toggle sea time inclusion. When the PDF generator launches, your settings will be ready and your first download will reflect them — no re-configuration needed.

The same banner-card content makes the toggles useful in advance (intent-capture); Stage 2 honours those settings on first generation.

### Stage 2 — Unlock (single deploy)

When PDF design is ready:

- Add `@react-pdf/renderer` + `pdf-lib` deps
- Build the `cv-pdf.tsx` component tree, `cv-data.ts` data assembly, `lockdown.ts` permission post-processor
- Replace the 503 stub at `/api/cv/generate` with the real PDF return (mints `cv_handle` on first call per spec section 7)
- Implement `/api/cv/regenerate-handle` (now meaningful — old QRs in circulation can be invalidated)
- Un-grey Generate / Build CV buttons; remove the Stage-1 "Coming Soon" banner
- Extend stress test + device test with PDF-specific cases

The Stage 1 → Stage 2 transition is a single deploy. No data migration, no user re-onboarding.

### Risk + mitigation

The main risk: PDF design uncovers a constraint that requires changing the URL format or the QR encoding. Stage 1 has wired around `dockwalker.io/cv/{8-char-handle}`. Mitigation: this URL is the ONLY contract between Stage 1 and Stage 2. The QR is one component slot in the PDF; the URL it encodes is fixed before Stage 2 design begins.

---

## 12. v1 Cut vs. v2 Deferred

### v1 (this spec — implementation phase)

- Migration adding all columns + permanent_invitations table + event types
- @react-pdf/renderer + pdf-lib lockdown
- `/api/cv/generate` + `/api/cv/regenerate-handle` + `/api/cv/[handle]`
- `/api/permanent/[id]/invite` + extended `/api/daywork` with inviteCrewPersonId
- `/cv/[handle]` page (teaser + signed-in profile with sticky action bar)
- Settings → CV Builder section + profile hot button
- Daywork QR-hire wizard + Permanent invite-to-apply wizard
- Sign-up redirect preservation
- Hat-switch banner for crew scanners
- Tombstone for deactivated crew
- Rate limits (5/hr posts, 1/7d regen, 20-100/hr handle lookup)
- Stress test against live remote

### v2 (deferred)

- "Send a message" channel from QR landing — needs new engagement type (`cv_inquiry`), auto-close timer, conversion nag. Tolerate v1 leakage to off-platform messaging; ship if it becomes a measured pain point.
- **Agent CVs** — explicitly **out of scope** for v1. CV Builder is crew-only. Agent profiles do not have `cv_handle`, do not surface the CV Builder section in settings, and the profile hot button is hidden when the user's hat is `agent`. Agents who want a marketing surface have their existing agency profile pages. Revisit if there is measured agent demand for a similar artefact.
- **PERMANENT.INVITED notification copy** — Stage 1 ships the event + projection + push-trigger fan-out infrastructure. Final notification body copy ("Captain James invited you to apply for Bosun on M/Y Serenity") is a content-only change applied during Stage 1 implementation, not a v2 deferral; documenting here so it is not forgotten in the QA pass. Push trigger lives in the existing `notification_triggers` table; entry shape mirrors `DAYWORK.INVITED`.
- **Inviting through an existing permanent posting** — Stage 1 captain wizard always creates a fresh `permanent_postings` row when firing `PERMANENT.INVITED`. v2 may add a "select an existing open posting" picker in the wizard for captains who already have a live permanent role and want to invite a specific candidate without duplicating the posting. Deferred because (a) captains who already have an open posting can simply send the candidate the URL; (b) the wizard's value is captain-focus on _this crew_, which fresh posting reinforces.
- Verified vessel-presence badges (post overlapping-crew-ledger maturity)
- "DockWalker Verified" seal (post-deeper-verification ledger)
- HTML preview mode for CV (currently PDF download only — fine for v1)
- Mobile Universal Link to in-app profile (when mobile ships)
- Multiple saved CV versions / named variants
- Print-shop quality export (300dpi)
- CV-builder-driven onboarding nudge ("complete your profile to unlock your CV")

---

## 13. Open Questions (closed for v1)

All v1 design decisions resolved during planning. v2.1 closed the six gap-fill items (daywork idempotency, permanent invitation lifecycle, `not_looking` warning, apply-after-invite UX, mint retry, expired-status cron) and the three deferral items (agent CVs out of scope, notification copy as content-pass, existing-posting invite as v2). Items deferred to post-v1 implementation:

- **Watermark / footer wording final copy** — to be styled during implementation; spec calls for "Generated by DockWalker · dockwalker.io · {Name} · {date}" as the neutral default.
- **PDF colour palette specifics** — implementation will follow `apps/web` design tokens.
- **QR-hire posting visibility on discover feed** — the daywork created by hire-from-QR appears on `/discover` like any other posting, by design (reduces discrimination — the same posting is open to all crew, with the targeted invite as a side-channel).
- **Agent placement vessel selector** — flagged in B-3 acceptance: agents already have a vessel-selector pattern in their existing `/post/permanent` flow; reuse.

---

## 14. Implementation Phases

See `tasks/todo.md` → **CV Builder v1** section for the full checklist. High-level phases per the staged rollout in §12.1:

### Stage 1 — Locked-entry MVP (~5–6 sessions)

1. **Schema + flags + permanent_invitations table** (1 session) — migration 00131, rollback, apply to remote, stress test
2. **Stage-1 plumbing** (small) — `qrcode` dep only (no react-pdf, no pdf-lib); admin mint-handle route for QA testing; `/api/cv/generate` stub returning 503 "Coming Soon"
3. **CV Builder UI** (1 session) — Settings section + Coming-Soon banner + working toggles; profile hot button (locked, Coming-Soon toast); Generate button (locked)
4. **QR-landing route + page** (1-2 sessions) — `/api/cv/[handle]`, `/cv/[handle]` page (three states + tombstone + stale notice), NDA mask
5. **Hire-from-QR wizards** (2 sessions) — daywork (atomic post+invite), permanent invite-to-apply, vessel pre-step, rate limits
6. **Auth flow polish + abuse mitigations** (small) — sign-up redirect preservation, hat-switch banner, scraping rate limits
7. **Stress test + device-test additions** (1 session) — live-DB E2E using admin-minted handles; device-testing additions for the locked-entry scope

### Stage 2 — Unlock (separate work stream, design-iteration-driven)

8. **PDF render + lockdown + unlock** (~?? sessions; design-iteration-driven)
   - Add `@react-pdf/renderer` + `pdf-lib` deps
   - Build `cv-pdf.tsx` component tree (two-column A4 layout, navy header, Geist typography, opt-in section rendering)
   - Build `cv-data.ts` server-side data assembly (period-correct vessel names, opted-in references, sea time totals)
   - Build `lockdown.ts` pdf-lib post-processor (permissions, vector footer, Producer metadata)
   - Replace 503 stub at `/api/cv/generate` with real PDF return; mints `cv_handle` on first call
   - Implement `/api/cv/regenerate-handle` (Crew Pro only, 1-per-7-days rate limit)
   - Un-grey Generate / Build CV buttons; remove the Stage-1 "Coming Soon" banner from `/settings/cv`
   - Add PDF-specific stress test cases (Free vs Pro render, lockdown permissions applied, regen rate-limit fires)
   - Add device-test coverage for the visual PDF flow

Total Stage 1: roughly **5–6 focused sessions**. Stage 2 sized when PDF design is ready.

---

## 15. Architectural Invariants Preserved

- **Append-only ledger**: ✓ all state changes via DAYWORK.POSTED / DAYWORK.INVITED / PERMANENT.POSTED / PERMANENT.INVITED / CV.GENERATED / CV.HANDLE_REGENERATED
- **IMO as truth anchor**: ✓ first-time captain wizard requires IMO upfront ("DockWalker is anchored on IMO numbers")
- **RLS on every table**: ✓ permanent_invitations gets explicit policy
- **Migrations reversible**: ✓ rollback drops columns + table + restores aggregate_type CHECK
- **TypeScript strict**: ✓ no exceptions
- **Two frontends, one backend**: ✓ web-only for v1; mobile inherits the same routes when it ships
- **No scoring / ranking / hidden algorithm**: ✓ QR-hire wizard is explicit captain action
- **Cert hard-gate on permanent applications**: ✓ preserved via invite-to-apply (B-2)
- **Out of scope reaffirmation**: this is not a "career app" — it is a hiring tool. The CV's value is its tie back to the platform's hiring primitives, not its standalone document polish.
