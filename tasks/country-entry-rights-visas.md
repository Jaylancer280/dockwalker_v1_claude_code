# Entry Rights V1 — Canonical List, Schema, Picker

> **Purpose:** replace the existing `visa_types` system with a principled "entry rights" model — citizenship + residence + visa — covering the legal documents a crew member needs to _enter_ the countries where common yacht hubs are located.
>
> **Scope principle:** this tracks _entry_ rights, not _work_ rights. Work rights (right to take paid employment in a country) are handled by vessels through seafarer agreements, flag-state allowances, and the standard maritime-employment framework. DockWalker does not replicate that. It only surfaces the documents crew need to physically cross a border to join a vessel or attend an interview.
>
> **Parallel specs:** `tasks/qualifications-v1.md` (certs) and `tasks/marina-locations-prompt.md` (locations). Same patterns — canonical-only selection, fuzzy search, shared picker component, admin canonical CRUD, no free-text input.

---

## Current state (what this replaces)

- `public.visa_types` table — 10 rows mixing entry visas, work permits, and "Other": Schengen, UK Work Visa, B1/B2 (US), C1/D (US), Canadian Work Permit, Bahamian Work Permit, UAE Residence Visa, Australian Work Visa, Thai Work Permit, Other.
- `public.profiles.visa_ids uuid[]` — crew-owned array of visa UUIDs, consumed by onboarding profile step, profile-edit pill picker, agent profile section, `useLookups().visaTypes`.
- Event payloads `PROFILE.CREATED` / `PROFILE.UPDATED` carry `visa_ids`.
- No job-side requirement field exists — `dayworks` and `permanent_postings` do not reference visa IDs today. **Launch keeps it that way** (see Out of scope).

---

## V1 Canonical List (24 entries, 3 categories)

### Citizenship (6)

Permanent entry rights by birth or naturalisation. Lumping EU/EEA/Swiss is deliberate — at entry-rights level, free movement between those states is the relevant signal, not specific nationality (`nationality_id` already captures that at 40-row granularity).

1. EU/EEA/Swiss
2. UK
3. US
4. Canada
5. Australia
6. New Zealand

### Residence (7)

Permanent or long-duration entry rights held without citizenship. Crew with any of these typically enters the country visa-free.

1. US Green Card (Lawful Permanent Resident)
2. UK ILR (Indefinite Leave to Remain)
3. EU long-term residence
4. UAE Residence Visa
5. Canadian PR (Permanent Resident)
6. Australian PR (Permanent Resident)
7. New Zealand PR (Permanent Resident)

### Visa (11)

Temporary entry authorisations. Includes electronic travel authorisations (ESTA/eTA/NZeTA) since they function as entry gates even though they're not technically "visas."

1. Schengen visa
2. US B1/B2 (visitor — business/tourism)
3. US C1/D (transit + crew)
4. US ESTA (Visa Waiver Program)
5. UK Standard Visitor
6. Australian MCV (Maritime Crew Visa)
7. Canadian eTA
8. NZ NZeTA
9. Turkish İkamet (residence permit used for extended stays)
10. Bahamian visitor permit
11. Mexican FMM (Forma Migratoria Múltiple)

**Rationale for the additions over the initial draft:**

- **US ESTA** — most EU/UK/AU crew enter the US on ESTA, not B1/B2. Omitting it would force the majority to pick the wrong document.
- **UAE Residence Visa** (moved to Residence) — preserved from current `visa_types`; UAE is a yacht hub and crew living in the UAE need this.
- **Canadian PR, Australian PR, NZ PR** — parallel to US Green Card and UK ILR.
- **Canadian eTA, NZ NZeTA** — entry gates for visa-waiver nationals; parallel to US ESTA.
- **Bahamian visitor permit, Mexican FMM** — yacht-hub entry (Bahamas is a major Caribbean hub; Mexico appears on transatlantic/Pacific routes).

**Explicitly dropped from current `visa_types`:**

- UK Work Visa, Canadian Work Permit, Bahamian Work Permit, Thai Work Permit — work rights, handled by vessels
- "Other" — no free-text policy (parallel to certs and locations)

---

## Schema Changes

### 1. Rename table: `visa_types` → `entry_rights`

Add `category` column. Keep existing UUIDs where semantically clean so `profiles.visa_ids` FK-by-value references still resolve.

```sql
alter table public.visa_types rename to entry_rights;

alter table public.entry_rights
  add column category text not null default 'visa'
  check (category in ('citizenship', 'residence', 'visa'));

alter table public.entry_rights
  drop column region;  -- replaced by category
```

### 2. UUID preservation map (existing 10 → V1 canonical)

| Existing row         | V1 row             | UUID action                                           |
| -------------------- | ------------------ | ----------------------------------------------------- |
| Schengen             | Schengen visa      | **preserve** (category=visa)                          |
| B1/B2 (US)           | US B1/B2           | **preserve** (category=visa)                          |
| C1/D (US)            | US C1/D            | **preserve** (category=visa)                          |
| Australian Work Visa | Australian MCV     | **preserve** (category=visa, renamed — closest match) |
| UAE Residence Visa   | UAE Residence Visa | **preserve** (category=residence)                     |
| UK Work Visa         | —                  | **delete** (work rights)                              |
| Canadian Work Permit | —                  | **delete** (work rights)                              |
| Bahamian Work Permit | —                  | **delete** (work rights)                              |
| Thai Work Permit     | —                  | **delete** (work rights)                              |
| Other                | —                  | **delete** (canonical-only rule)                      |

5 rows preserved (UUIDs unchanged, category + name updated). 5 rows deleted. 19 new rows inserted with fresh UUIDs.

### 3. Profile column rename

```sql
alter table public.profiles rename column visa_ids to entry_right_ids;
```

### 4. Clean profiles for deleted rows (runs BEFORE column rename, against the old `visa_ids` column)

```sql
-- Strip deleted visa UUIDs from every profile's array
update public.profiles
set visa_ids = (
  select coalesce(array_agg(v), '{}')
  from unnest(visa_ids) as v
  where v not in (
    -- hardcoded list of the 5 deleted visa UUIDs from the baseline
    '<uk_work_visa_uuid>',
    '<canadian_work_permit_uuid>',
    '<bahamian_work_permit_uuid>',
    '<thai_work_permit_uuid>',
    '<other_uuid>'
  )
)
where visa_ids && array[
  '<uk_work_visa_uuid>', '<canadian_work_permit_uuid>',
  '<bahamian_work_permit_uuid>', '<thai_work_permit_uuid>', '<other_uuid>'
]::uuid[];
```

Crew lose the deleted entries silently. A one-time in-app notification tells affected crew to review their profile (surface via `notifications` table — optional nicety).

### 5. `apply_projection` — coalesce `visa_ids` and `entry_right_ids`

The event ledger is append-only. Historical `PROFILE.CREATED` and `PROFILE.UPDATED` payloads carry `visa_ids`; new ones will carry `entry_right_ids`. Both handlers must accept either key:

```sql
-- In PROFILE.CREATED and PROFILE.UPDATED handlers:
coalesce(
  (select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'entry_right_ids') x),
  (select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'visa_ids') x),
  '{}'
)
```

This is replay-safe — a DB reset processing old events from pre-migration payloads still writes to the renamed column correctly.

**Also strip deleted UUIDs inside the coalesce** so a replay of a pre-migration event containing a dropped visa doesn't reintroduce it. Use a subquery that filters against a static list of deleted UUIDs.

### 6. RLS policy rename

```sql
drop policy "Authenticated users can read visa_types" on public.entry_rights;
create policy "Authenticated users can read entry_rights"
  on public.entry_rights for select to authenticated using (true);
```

### 7. Indexes / constraints

Add `create index idx_entry_rights_category on public.entry_rights (category, sort_order)` — the picker will group by category and order within.

---

## Picker Component

Small list (24 items) — no drill-down needed. A single searchable dropdown with category headers (Citizenship, Residence, Visa) works.

### Shape

- Component: `apps/web/src/components/entry-right-picker.tsx` (shared)
- Props: `selectedIds: string[]`, `onChange: (ids: string[]) => void`
- Fuzzy search (same rule as certs): case- and punctuation-insensitive substring match on `name`. "us b1b2" finds "US B1/B2"; "esta" finds "US ESTA"; "pr" matches all three PR rows plus NZeTA (acceptable — search term specificity improves matches)
- Category grouping: three section headers in the dropdown, pills underneath each
- Selected entries render as pills above the picker with × remove
- No drill-down (small list), no collapsible groups
- Canonical-only selection, no free text
- Helper copy: _"Select all that apply — more entries means you can enter more hubs."_

### Data source

- `useLookups().entryRights` replaces `useLookups().visaTypes`. Shape: `{ id, name, category }[]`. 24 rows cached in localStorage same as other lookups.

---

## Implementation Notes

1. **Replacement, not extension.** This is a full semantic + schema replacement of `visa_types`. No dual-system period. The migration renames the table, clears deleted rows from profile arrays, renames the profile column, and updates every consumer in one sweep.

2. **Canonical-only selection — no free text.** Parallel rule to certs and locations. If a crew member holds a document not in the canonical list, they leave it out. Admin adds missing documents via `/admin/canonical` (out of scope — handled by existing canonical CRUD once entry_rights appears there).

3. **Fuzzy search implementation** — case- and punctuation-insensitive substring match on `name`, same normalisation as certs (lowercase, strip periods/hyphens/parentheses/extra whitespace before comparing). No external library.

4. **UUID preservation applies only to the 5 clean matches.** Do not attempt to preserve UUIDs for work-permit → something. Deleting those rows is the explicit intent.

5. **DockWalker does not verify entry rights.** Self-declarations only, same as certs. Add a disclaimer line to the picker and to `/privacy`: _"Entry-rights entries are self-declared. DockWalker does not verify immigration documents."_

6. **Single nationality assumption stays** — `profiles.nationality_id` remains singular. Dual-national crew cover their situation by selecting multiple citizenship entry-rights. `nationality_id` is for flag-emoji display and ranking; `entry_right_ids` is for legal entry capability. They overlap but are not redundant.

7. **Mobile deferred** — `apps/mobile/` is blocked. Do not include mobile changes in this phase. Mobile will consume the renamed table + column when unblocked.

---

## Out of Scope — V1.1 and Beyond

Explicitly deferred. Track in `tasks/todo.md` Backlog, not in this phase:

1. **Job-side requirement field** — `required_entry_right_ids uuid[]` on `dayworks` and `permanent_postings` with "soft warning, non-blocking" semantic when crew applies without a match. **Not at launch.** Current system never had this and adding it now bundles scope. When it ships: parallel to `required_certification_ids`, same picker reused on post forms.

2. **Hub → entry-rights auto-suggest** — when employer posts in Antibes, suggest "Schengen / EU/EEA/Swiss citizenship / EU long-term residence" as default requirements. Needs a `hub_default_entry_rights` junction table. Only relevant once job-side requirements ship.

3. **Multiple nationality support** — currently `profiles.nationality_id` is singular. Dual-national crew cover their legal reality via multiple citizenship entry-rights, but nationality itself stays single. Schema change deferred.

4. **Document upload / verification** — crew attach scans of passports, visas, residence cards. Requires storage (Supabase Storage bucket), expiry tracking, and a verification workflow. Big V1.1+ scope.

5. **Expiry tracking** — like certs, entry rights have expiry dates (visa validity, residence permit renewal). Schema would need a linking table (`profile_entry_rights` with `id, person_id, entry_right_id, issued_at, expires_at`). Parallel to the cert expiry V1.1 item.

6. **Additional canonical entries** — if crew or admin flag gaps post-launch (e.g. South African PR, specific Brazilian visas, Monaco temporary residence), admin adds via canonical CRUD. The list grows organically, same pattern as certs and locations.
