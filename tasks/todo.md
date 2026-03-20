# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

---

### Fix 118a: Invitations GET — filter full-position dayworks

**Goal:** Crew should not see invitations for daywork postings where all positions are already filled.

**Will NOT touch:** Database, migrations, invitation respond flow, push notifications.

**Done condition:** `GET /api/daywork/invitations` excludes invitations where `positions_filled >= positions_available` on the linked daywork. Test proves it.

---

#### 1. Add positions columns to daywork select

File: `apps/web/src/app/api/daywork/invitations/route.ts`

The daywork query (lines 50-57) currently selects `id, job_number, start_date, end_date, working_days, day_rate, currency, meals, notes, status, vessel_id, yacht_roles(...), ports(...), experience_brackets(...)`.

- [x] Add `positions_available, positions_filled` to the `.select()` string

---

#### 2. Add full-position filter to post-fetch filtering

File: `apps/web/src/app/api/daywork/invitations/route.ts`

The existing post-fetch filter (lines 99-112) already checks `startDate < today` and `status !== 'active'`.

- [x] Add a third condition after the status check:
  ```typescript
  const filled = dw.positions_filled as number | null;
  const available = dw.positions_available as number | null;
  if (filled != null && available != null && filled >= available) return false;
  ```
  This filters out invitations for dayworks where all positions are filled. Uses `!= null` to handle the case where columns exist but are null (legacy rows before multi-crew).

---

#### 3. Add test for full-position filtering

File: `apps/web/__tests__/api/invitations.test.ts`

- [x] Add test: `filters out invitations for fully-filled daywork positions`
  - Mock a pending invitation where the linked daywork has `positions_filled: 2, positions_available: 2, status: 'active'`, start_date in the future
  - Assert the invitation is NOT in the response
- [x] Add test: `keeps invitations for partially-filled daywork positions`
  - Mock same setup but `positions_filled: 1, positions_available: 2`
  - Assert the invitation IS in the response

---

#### 4. Documentation

- [x] Update `BUILD_STATE.md`: append to Stage 118 entry or add a `[Fix 118a]` line

---

### Fix 123a: Rollback 00057 — restore full apply_projection body

**Goal:** Make rollback 00057 self-contained per the project invariant (CLAUDE.md rule 4) and the lesson "Rollbacks must be self-contained."

**Will NOT touch:** Forward migration, API routes, UI, tests.

**Done condition:** `supabase/rollbacks/00057_nationality_and_visas.down.sql` contains the complete `CREATE OR REPLACE FUNCTION apply_projection(...)` body from migration 00056. Running this rollback would fully restore the database to the pre-00057 state.

---

#### 1. Replace the placeholder comment with the full function body

File: `supabase/rollbacks/00057_nationality_and_visas.down.sql`

- [x] Remove the comment on lines 11-12
- [x] Copy the complete `CREATE OR REPLACE FUNCTION public.apply_projection(...)` from `supabase/migrations/00056_invitation_source.sql` (lines 18-374) and paste it after line 9
- [x] Verify: the restored function's `PROFILE.CREATED` handler does NOT write `nationality_id` or `visa_ids` (it shouldn't — it's the 00056 version which predates those columns)
- [x] Verify: the restored function's `PROFILE.UPDATED` handler also does NOT reference `nationality_id` or `visa_ids`
- [x] Verify: the `DAYWORK.APPLIED` handler in the restored function DOES include `source` column handling (since 00056 added source, and rolling back 00057 should keep 00056's changes intact)

---

#### 2. Mental walkthrough

- [x] Confirm: if you run ONLY this rollback file against a DB at schema v57, the result is:
  1. `visa_ids` column dropped from profiles
  2. `nationality_id` column dropped from profiles
  3. `visa_types` table dropped
  4. `nationalities` table dropped
  5. `apply_projection` restored to exact 00056 version (with source/invitation handling, without nationality/visa handling)
     — i.e., the DB is at schema v56 state

---

#### 3. Documentation

- [x] Update `BUILD_STATE.md`: append a `[Fix 123a]` line noting the rollback was completed

---

### Fix 123b: Onboarding UI — add nationality + visa fields

**Goal:** Collect nationality and visas during onboarding so new users don't have to discover these fields in profile edit.

**Will NOT touch:** Database, migrations, API response shapes (onboarding API already accepts `nationalityId` and `visaIds`).

**Done condition:** Onboarding profile step shows a nationality dropdown (with flag emoji) and a visa multi-select. Selected values are submitted to the onboarding API. Nationality is required for crew, optional for agents. Visas are always optional.

---

#### 1. Add state variables

File: `apps/web/src/app/onboarding/page.tsx`

- [x] Add state variables alongside other profile state (near lines 151-167):

  ```typescript
  const [nationalityId, setNationalityId] = useState('');
  const [visaIds, setVisaIds] = useState<string[]>([]);
  ```

- [x] Add lookup state alongside other lookups (near lines 182-188):
  ```typescript
  const [nationalities, setNationalities] = useState<
    { id: string; name: string; flag_emoji: string }[]
  >([]);
  const [visaTypes, setVisaTypes] = useState<{ id: string; name: string }[]>([]);
  ```

---

#### 2. Fetch lookup data

File: `apps/web/src/app/onboarding/page.tsx`

- [x] In the existing data-loading useEffect (or wherever roles/certs/brackets are fetched), add parallel fetches:
  ```typescript
  supabase.from('nationalities').select('id, name, flag_emoji').order('sort_order'),
  supabase.from('visa_types').select('id, name').order('sort_order'),
  ```
- [x] Set the state from the results

---

#### 3. Add nationality dropdown + visa checkboxes to profile step

File: `apps/web/src/app/onboarding/page.tsx`

The profile step runs from approximately lines 523-803. Add the fields after the languages input and before the navigation buttons. Mirror the exact pattern used on the profile page (lines 894-923).

- [x] Nationality `<Select>` dropdown with flag emoji prefix:

  ```tsx
  <div className="flex flex-col gap-1.5">
    <Label>
      Nationality {identityType === 'crew' && <span className="text-destructive">*</span>}
    </Label>
    <Select value={nationalityId} onValueChange={setNationalityId}>
      <SelectTrigger>
        <SelectValue placeholder="Select nationality" />
      </SelectTrigger>
      <SelectContent>
        {nationalities.map((n) => (
          <SelectItem key={n.id} value={n.id}>
            {n.flag_emoji} {n.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
  ```

- [x] Visa multi-select checkboxes:

  ```tsx
  <div className="flex flex-col gap-1.5">
    <Label>
      Visas <span className="text-xs text-muted-foreground">(optional)</span>
    </Label>
    <div className="max-h-40 overflow-y-auto rounded-md border border-border p-3">
      {visaTypes.map((v) => (
        <label key={v.id} className="flex items-center gap-2 py-1.5 text-sm">
          <Checkbox
            checked={visaIds.includes(v.id)}
            onCheckedChange={() => {
              setVisaIds((prev) =>
                prev.includes(v.id) ? prev.filter((id) => id !== v.id) : [...prev, v.id],
              );
            }}
          />
          {v.name}
        </label>
      ))}
    </div>
  </div>
  ```

- [x] Verify `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `Label`, and `Checkbox` are imported (check existing imports — profile step likely already uses Select for other fields)

---

#### 4. Wire into submit payload

File: `apps/web/src/app/onboarding/page.tsx`

- [x] In the submit handler (wherever the onboarding API is called), add `nationalityId` and `visaIds` to the profile object:
  ```typescript
  profile: {
    // ... existing fields ...
    nationalityId: nationalityId || null,
    visaIds,
  }
  ```

---

#### 5. Add validation for crew nationality requirement

File: `apps/web/src/app/onboarding/page.tsx`

- [x] In the profile step's "Next" button handler (or validation logic), add:
  ```typescript
  if (identityType === 'crew' && !nationalityId) {
    // prevent advancing — show validation error or disable Next
  }
  ```
  Match the existing validation pattern used for other required fields in the same step.

---

#### 6. Verify end-to-end

- [x] Verify: existing onboarding tests still pass (the API already accepts these fields — this is UI-only)
- [x] Verify: nationality and visas appear on the profile page after completing onboarding with values set

---

#### 7. Documentation

- [x] Update `BUILD_STATE.md`: append a `[Fix 123b]` line noting onboarding UI was completed

---

## Done

(See git history for completed stages 51-123)
