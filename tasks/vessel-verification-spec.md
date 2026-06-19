# DockWalker — Vessel Verification Spec (Adapted)

**Nautalink Technologies, Inc.**
Version: 1.1 | Status: Adapted for current codebase | Base: v1.0 Approved

> This file adapts the approved vessel verification spec to the DockWalker codebase
> as of Stage 176, migration 00079. All codebase-specific mappings, deviations, and
> implementation notes are marked with **[ADAPT]** blocks.

---

## 1. Overview

DockWalker uses IMO numbers as immutable truth anchors for all vessel records. Vessel details (name, flag, LOA, GT, type) are human-verified by DockWalker admins against public sources (VesselFinder, MarineTraffic) and stored in a single canonical `vessels` row. All platform entities — jobs, applications, crew experience entries — reference the IMO as a foreign key and resolve details at query time. There is no duplication of vessel data across the platform.

---

## 2. Core Principles

- **IMO is the anchor.** Never changes. Every reference on the platform is to an IMO, not a name or a copy of vessel details.
- **One record per vessel.** A single `vessels` row per IMO. Updates propagate instantly platform-wide via relational joins — no fan-out, no batch updates required.
- **Admin-verified only.** No third-party API stores data in DockWalker's database. All vessel details are entered manually by a DockWalker admin after human lookup on public maritime sources.
- **Append-only audit trail.** All changes to verified vessel details are recorded in `vessel_detail_changes`. The display layer always reads current values; the audit layer retains full history.
- **Non-blocking corrections.** A vessel under review continues to function normally on the platform. Flags are a background data quality task, not a vessel freeze.

---

## 3. Database Schema

### 3.1 `vessels` table — Additive Changes

**[ADAPT]** The existing `vessels` table (migration 00003, modified through 00079) has these columns that remain unchanged:

```
id              uuid PRIMARY KEY
imo_number      text UNIQUE NOT NULL          -- 7-digit IMO, immutable anchor
name            text NOT NULL                 -- display name (user-submitted initially, updated on verification)
vessel_type     text NOT NULL                 -- 'motor' | 'sail' (display value, updated on verification)
size_band_id    uuid NOT NULL REFERENCES vessel_size_bands(id)  -- auto-derived from loa_meters
loa_meters      numeric                       -- display LOA (user-submitted initially, updated on verification)
nda_flag        boolean NOT NULL DEFAULT false
owner_person_id uuid NOT NULL REFERENCES persons(id)  -- who first submitted the vessel
created_at      timestamptz NOT NULL DEFAULT now()
updated_at      timestamptz NOT NULL DEFAULT now()
```

**[ADAPT] Design decision — display columns stay, verification is additive:**
Existing platform queries read `name`, `vessel_type`, `loa_meters`, `size_band_id` directly. Rather than rename these to `claimed_*` and force every query to use `COALESCE(verified_*, claimed_*)`, we keep the existing columns as the canonical display values. When an admin verifies, the display columns are updated to match the verified data. The `claimed_*` columns preserve the original user submission for audit/comparison.

**New columns to add:**

```sql
-- Verification status
status              text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'verified', 'rejected')),

-- Submission audit (preserve original user-submitted values)
submitted_at        timestamptz DEFAULT now(),
claimed_name        text,                     -- original user-submitted name (copied from name on creation)
claimed_flag        text,                     -- user-submitted flag state (country)
claimed_gt          integer,                  -- user-submitted gross tonnage
claimed_loa         numeric(6,2),             -- original user-submitted LOA (copied from loa_meters on creation)

-- Admin-verified fields (null until verified)
verified_name       text,
verified_flag       text,
verified_gt         integer,
verified_loa        numeric(6,2),
verified_type       text,                     -- 'motor' | 'sail' (verified vessel type)
verified_year       integer,                  -- build year
verified_at         timestamptz,
verified_by         uuid REFERENCES persons(id),  -- admin person_id
verify_source       text,                     -- e.g. 'VesselFinder', 'MarineTraffic'

-- Correction flag state
correction_flagged      boolean DEFAULT false,
correction_flagged_at   timestamptz,
correction_flag_count   integer DEFAULT 0     -- total lifetime flags
```

**[ADAPT] `owner_person_id` = spec's `submitted_by`:** The existing column serves the same purpose — who first created the vessel record. No rename needed; the API and UI can label it "Submitted by" where appropriate.

**[ADAPT] `claimed_flag` and `verified_flag`:** Flag state was intentionally removed from the `vessels` table in migration 00034 because it's per-experience soft data (a vessel can change flag during a crew member's tenure). The `claimed_flag` and `verified_flag` here serve a different purpose: they record the vessel's _current_ registered flag for admin verification against maritime registries. This does NOT conflict with the per-experience `flag_state` on `crew_experiences` — the experience records what was true during the crew member's time; the vessel record tracks the current registration.

**[ADAPT] `verified_type` vs `vessel_type`:** The existing `vessel_type` column (motor/sail) is the display value. `verified_type` records what the admin confirmed. On verification, `vessel_type` is updated to match `verified_type`.

**[ADAPT] Migration data backfill:** Existing vessels were manually created by users. On migration:

- All existing vessels get `status: 'pending'` (they have never been admin-verified)
- `submitted_at` = `created_at`
- `claimed_name` = `name`
- `claimed_loa` = `loa_meters`
- `claimed_flag`, `claimed_gt` remain NULL (not collected previously)
- All `verified_*` fields remain NULL

### 3.2 `vessel_correction_flags` table

```sql
vessel_correction_flags (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id       uuid NOT NULL REFERENCES vessels(id),
  imo_number      text NOT NULL,
  flagged_by      uuid NOT NULL REFERENCES persons(id),
  flagged_at      timestamptz DEFAULT now(),
  field_disputed  text,                       -- e.g. 'loa', 'flag', 'name'
  claimed_correct text,                       -- what the user says it should be
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'resolved', 'dismissed'))
)
```

> Multiple flags on the same vessel append to this table. The vessel has one `correction_flagged: true` state regardless of how many flags are open. Admin resolves all open flags in one pass.

**RLS:** Authenticated users can INSERT (flag a vessel). Only admins can UPDATE status. Owner and admins can SELECT their own flags.

### 3.3 `vessel_detail_changes` table (append-only, never update/delete)

```sql
vessel_detail_changes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_number      text NOT NULL,
  vessel_id       uuid NOT NULL REFERENCES vessels(id),
  field           text NOT NULL,              -- e.g. 'loa_meters', 'verified_flag', 'name'
  old_value       text,
  new_value       text,
  changed_at      timestamptz DEFAULT now(),
  changed_by      uuid NOT NULL REFERENCES persons(id),  -- admin person_id
  reason          text,                       -- e.g. 'user correction flag — verified via VesselFinder'
  flag_ids        uuid[]                      -- correction flag ids this change resolves
)
```

**[ADAPT] Documented CRUD exception:** Like `daywork_templates` and `permanent_templates`, the `vessel_detail_changes` table is append-only utility data outside the event ledger. It serves as a purpose-built audit trail for admin vessel verification actions. Admin verification does NOT flow through `apply_projection` or the events table — it is a direct admin operation on the `vessels` row with audit captured in `vessel_detail_changes`. This is intentional: verification is an admin data-quality workflow, not a user domain action.

**RLS:** Only admins can INSERT. Admins can SELECT all. No UPDATE or DELETE policies (enforced by convention and absence of policy).

---

## 4. Vessel Lifecycle

### 4.1 New Vessel Submission

1. User enters a vessel name in a job post or experience entry.
2. Platform fuzzy-searches existing `vessels` table (any status) first via `/api/vessels/lookup`.
3. **Match found** — user selects from results, entity is linked to existing IMO. No new vessel record created.
4. **No match** — user is prompted to enter: vessel name, IMO, LOA, vessel type (motor/sail). Optionally: flag state, gross tonnage.
5. A `vessels` row is created via existing `VESSEL.CREATED` event path with `status: 'pending'`. User-supplied values stored in both the display columns (`name`, `loa_meters`, `vessel_type`) and the `claimed_*` audit columns.
6. The submitting user sees a **"Pending Verification"** badge on the vessel.
7. Admin receives a notification of a new pending vessel.

**[ADAPT] `VESSEL.CREATED` projection update:** The `apply_projection` handler for `VESSEL.CREATED` must be updated to also populate `status`, `submitted_at`, `claimed_name`, `claimed_loa`, and optionally `claimed_flag`/`claimed_gt` from the event payload.

**[ADAPT] Existing vessel creation forms** (experience add, daywork post, permanent post, vessel edit page) may optionally collect `flag` and `gt` fields. These are new optional inputs — not required for v1 submission.

### 4.2 Admin Verification

1. Admin reviews the pending vessel queue in the DockWalker admin panel.
2. Admin looks up the IMO manually on VesselFinder or MarineTraffic (public web — no API).
3. Admin enters verified details into the `verified_*` fields and records the source in `verify_source`.
4. Admin sets `status: 'verified'`, `verified_at`, `verified_by`.
5. **Display columns updated:** `name` = `verified_name`, `loa_meters` = `verified_loa`, `vessel_type` = `verified_type`, `size_band_id` re-derived from `verified_loa`.
6. The vessel is now live with verified data. All platform entities referencing that IMO immediately resolve to verified details via existing relational joins.
7. No fan-out or propagation job required.

**[ADAPT] Admin route:** New `PATCH /api/admin/vessels/[id]/verify` route. Uses existing admin guard (`is_admin` on persons table, added Stage 103). Writes to `vessel_detail_changes` for any field that changed from claimed to verified values.

### 4.3 Rejected Vessels

1. If the IMO cannot be verified (invalid number, vessel not found, clear user error), admin sets `status: 'rejected'` with a reason.
2. The submitting user is notified. Their job post or experience entry is flagged for correction.

**[ADAPT] Admin route:** New `PATCH /api/admin/vessels/[id]/reject` route.

---

## 5. Correction Flag Flow

### 5.1 Triggering a Flag

- Any authenticated user can flag a vessel's details as incorrect from the vessel detail view.
- Flag UI collects: which field is disputed, and optionally what the correct value should be.
- A `vessel_correction_flags` row is created.
- If `correction_flagged` is already `true` on the vessel (flag already open), the new flag appends to `vessel_correction_flags` — no duplicate pending state is created.
- If `correction_flagged` is `false`, it flips to `true`, `correction_flagged_at` is set, `correction_flag_count` incremented, and admin is notified.

**[ADAPT] API route:** New `POST /api/vessels/[id]/flag` route. Authenticated users only.

### 5.2 Admin Re-verification

1. Admin reviews open correction flags in the admin panel, grouped by vessel.
2. Admin sees all open flags for the vessel — who flagged, which field, what they claim is correct.
3. Admin looks up the IMO on VesselFinder or MarineTraffic.
4. **If change required:** Admin updates the `verified_*` field(s) AND the display columns. For each changed field, a `vessel_detail_changes` row is appended:

   ```
   field: 'loa_meters'
   old_value: '73'
   new_value: '74'
   reason: 'user correction flag — verified via VesselFinder'
   flag_ids: [flag_uuid_1, flag_uuid_2]
   ```

5. All open `vessel_correction_flags` for this vessel are set to `status: 'resolved'`.
6. `correction_flagged` flips back to `false`.
7. Platform instantly reflects updated details everywhere via existing joins.

**[ADAPT] Admin route:** New `PATCH /api/admin/vessels/[id]/resolve-flags` route.

### 5.3 Dismissed Flags

- If admin verifies and the existing data is correct, all open flags are set to `status: 'dismissed'`.
- `correction_flagged` flips back to `false`. No `vessel_detail_changes` row created.
- The user who flagged may optionally receive a notification: "Details verified — no change required."

**[ADAPT]** Same admin route as 5.2 with a `dismiss: true` flag.

---

## 6. Display Rules

| Context                      | What to show                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Vessel card / job post       | Display columns (`name`, `vessel_type`, `loa_meters`). If `status = 'pending'`, show "Pending Verification" badge. |
| Crew experience entry        | `name`, `vessel_type`, `loa_meters` resolved via vessel join (same as today).                                      |
| Vessel under correction flag | Current display columns remain visible. Show subtle "Details under review" indicator. No functionality is blocked. |
| Rejected vessel              | Show "Unverified vessel" state. Prompt user to correct IMO.                                                        |

**[ADAPT] Zero query changes for display:** Because the display columns (`name`, `vessel_type`, `loa_meters`, `size_band_id`) are unchanged, all existing queries continue to work. The `status` field and badges are additive UI changes only.

---

## 7. Propagation Behaviour

No propagation job is needed. The architecture handles this natively:

- Every job, application, and experience entry stores only `vessel_id` (foreign key referencing `vessels.id`).
- Vessel details are resolved at query time via join on `vessels`.
- When an admin updates the display columns during verification, every query that joins against that vessel immediately returns the new values.
- **Zero additional work required for platform-wide updates.**

**[ADAPT]** This matches the existing architecture exactly. The `get_vessel_public` RPC, the `get_vessels_public_batch` function, and all `.from('vessels')` queries in the codebase already resolve via joins. No changes needed.

---

## 8. Admin Panel Requirements

The admin panel must expose:

- **Pending queue** — new vessel submissions awaiting first verification, sorted by `submitted_at` ascending.
- **Correction flag queue** — verified vessels with open correction flags, sorted by `correction_flagged_at` ascending.
- **Vessel detail view** — shows claimed fields, verified fields side-by-side, full `vessel_detail_changes` audit log, all open/resolved/dismissed flags.
- **Bulk actions** — ability to verify or reject multiple pending vessels in one pass.
- **Notification triggers** — admin is notified on: new pending vessel submitted, new correction flag raised.

**[ADAPT] Existing admin infrastructure:** Stage 103 added `is_admin` flag, admin guard helper, user lookup/search, and `ADMIN.*` audit events. Admin routes live at `/api/admin/*`. Admin UI pages live at `/app/(app)/admin/*`. New vessel admin pages extend this existing structure.

**[ADAPT] New admin routes needed:**

- `GET /api/admin/vessels/pending` — pending queue
- `GET /api/admin/vessels/flagged` — correction flag queue
- `GET /api/admin/vessels/[id]` — vessel detail with claimed/verified/flags/audit
- `PATCH /api/admin/vessels/[id]/verify` — verify vessel (set verified\_\* fields, update display columns)
- `PATCH /api/admin/vessels/[id]/reject` — reject vessel
- `PATCH /api/admin/vessels/[id]/resolve-flags` — resolve or dismiss open flags
- `POST /api/admin/vessels/bulk-verify` — bulk verify/reject

**[ADAPT] New admin pages needed:**

- `/admin/vessels` — tabbed view: Pending | Flagged | All
- `/admin/vessels/[id]` — vessel detail with side-by-side comparison + audit log

---

## 9. Architectural Constraints (Non-negotiable)

- `vessel_detail_changes` is append-only. No UPDATE or DELETE ever runs on this table.
- `vessels.imo_number` is immutable after creation. It may never be updated.
- No third-party API response data is ever persisted to the DockWalker database.
- Vessel details entered by admins are manually sourced from public web interfaces only.
- A vessel with `status: 'pending'` or `correction_flagged: true` must never block job posting, applications, or experience entries referencing that IMO.

**[ADAPT]** These align with existing CLAUDE.md invariants (append-only ledger, IMO immutability, RLS on every table).

---

## 10. Out of Scope (This Spec)

- Automated periodic re-sync of vessel details (future phase — evaluate at 500+ active vessels)
- Vessel photo storage
- AIS position tracking
- Ownership / management company data
- Classification society / survey data

---

## 11. Implementation Phases

**[ADAPT]** Recommended implementation order:

### Phase 1 — Database Layer

- Migration 00080: ALTER `vessels` table (add new columns), CREATE `vessel_correction_flags`, CREATE `vessel_detail_changes`
- RLS policies on new tables
- Rollback file
- Update `apply_projection` VESSEL.CREATED handler to populate `status`, `submitted_at`, `claimed_name`, `claimed_loa`
- Backfill existing vessels: `status = 'pending'`, `claimed_name = name`, `claimed_loa = loa_meters`, `submitted_at = created_at`

### Phase 2 — Types + API

- Update `Vessel` interface in `packages/types/src/models.ts`
- Update vessel creation API to accept optional `claimedFlag`, `claimedGt`
- New admin verification/rejection/flag-resolution routes
- New user-facing correction flag route
- Tests for all new routes

### Phase 3 — Admin UI

- Pending queue page
- Correction flag queue page
- Vessel detail page with side-by-side claimed/verified view + audit log
- Bulk verify/reject actions

### Phase 4 — User-Facing UI

- "Pending Verification" badge on vessel cards (discover, mine, review)
- "Details under review" indicator on flagged vessels
- "Unverified vessel" state for rejected vessels
- "Flag incorrect details" button on vessel detail view
- Optional: flag/GT fields on vessel creation forms

### Phase 5 — Notifications

- Admin notification on new pending vessel
- Admin notification on new correction flag
- User notification on vessel verified/rejected
- User notification on flag dismissed

---

## 12. Files Affected (Audit)

**[ADAPT]** Pre-implementation query audit of all `from('vessels')` calls:

| File                              | Query pattern                     | Impact                                                          |
| --------------------------------- | --------------------------------- | --------------------------------------------------------------- |
| `api/vessels/route.ts` GET        | `.eq('owner_person_id', user.id)` | Add `status` to select. No filter change needed.                |
| `api/vessels/route.ts` POST       | Insert new vessel                 | Add `status`, `submitted_at`, `claimed_*` to event payload.     |
| `api/vessels/[id]/route.ts` PATCH | Update by id + owner              | No change — user edits display columns (pre-verification only). |
| `api/vessels/lookup/route.ts`     | Partial/exact IMO search          | Add `status` to response. Consider filtering by status.         |
| `api/profile/[personId]/route.ts` | Employer vessel list              | Add `status` to select for badge display.                       |
| `api/account/export/route.ts`     | GDPR export                       | Add new columns to export.                                      |
| `api/daywork/route.ts` POST       | Vessel ownership check            | No change — pending vessels can still be used for postings.     |
| `api/permanent/route.ts` POST     | Vessel ownership check            | No change — pending vessels can still be used for postings.     |
| `api/onboarding/route.ts`         | Vessel creation during onboarding | Same as POST vessel — add claimed\_\* fields.                   |
| `get_vessel_public` RPC           | Public vessel data                | Add `status` to return. No access change.                       |
| `get_vessels_public_batch` RPC    | Batch vessel lookup               | Add `status` to return. No access change.                       |
