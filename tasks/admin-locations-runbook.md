# Admin runbook — locations curation

> Operational reference for admins working `/admin/locations/pending`.
> The queue surfaces every `source='pending'` city / port submitted via
> the manual "Add it manually" picker fallback. Each row is currently
> visible only to the submitting user; admin action is what makes it
> public, redirected, or permanently private.

## When to use which action

| Action  | What it does                                                                             | When to pick it                                                                                                      |
| ------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Approve | Flips `source` to `'curated'`. Optional name rewrite. Submitter's UUID + FKs unchanged.  | The location is real, unique, and not already in the canonical set. Edit the name first if there are typos / casing. |
| Merge   | Re-points every FK from the pending row to a chosen canonical row, then deletes pending. | A duplicate already exists under a different spelling, district name, or province name.                              |
| Hide    | Stamps `hidden_at = now()`. Submitter still resolves the FK; everyone else is filtered.  | Unverifiable submission you don't want to approve OR merge — e.g. an IMO that doesn't show up on Equasis.            |

## OSM district near-duplicates

OpenStreetMap returns the geographic name of the place, which often
isn't the city DockWalker uses as the canonical hub. The 00118 search
RPC filter excludes pending rows from other users' searches, so if a
user submits a "district" name and you don't merge it, two competing
canonical rows will eventually exist for the same hub once you approve
both — that fragments the picker UX.

### Example: Turkish Aegean coast

DockWalker canonical cities: `Bodrum`, `Marmaris`, `Fethiye`, `Antalya`,
`Gocek`, `Istanbul`. Common OSM-returned districts that should merge:

| User submits | Merge into |
| ------------ | ---------- |
| Turgutreis   | Bodrum     |
| Yalıkavak    | Bodrum     |
| Gümüşlük     | Bodrum     |
| Göltürkbükü  | Bodrum     |
| Ortakent     | Bodrum     |
| Konacık      | Bodrum     |

> **Ambiguity caveat for Muğla province:** Muğla covers Bodrum, Marmaris,
> Fethiye, AND Göcek. If a marina is labelled just "Muğla" you cannot
> distinguish without lat/lon. Cross-reference the submitter's notes or
> the marina's name against Equasis / Google Maps. When in doubt, **Hide**
> the submission and ask the user via support to resubmit with a more
> specific city name.

### Example: UAE

| User submits        | Merge into     |
| ------------------- | -------------- |
| Deira               | Dubai          |
| Jumeirah            | Dubai          |
| Al Seef             | Dubai          |
| Port Rashid         | Dubai          |
| Al Bateen           | Abu Dhabi      |
| Yas Island          | Abu Dhabi      |
| Mina Zayed          | Abu Dhabi      |
| Al Jazirah Al Hamra | Ras Al Khaimah |

### Example: Caribbean

| User submits     | Merge into        |
| ---------------- | ----------------- |
| Philipsburg      | St. Maarten       |
| Simpson Bay      | St. Maarten       |
| Cole Bay         | St. Maarten       |
| Charlotte Amalie | St. Thomas (USVI) |
| Frenchtown       | St. Thomas (USVI) |
| English Harbour  | Antigua           |
| Falmouth         | Antigua           |
| Jolly Harbour    | Antigua           |
| New Providence   | Nassau            |

### Example: Other Mediterranean clusters

| User submits      | Merge into |
| ----------------- | ---------- |
| Juan-les-Pins     | Antibes    |
| Palma de Mallorca | Palma      |

The full alias table the import pipeline uses lives at
`supabase/seed/marina_aliases.json`. When you spot a recurring
near-duplicate that isn't in the table, add it there so future OSM
re-imports normalise automatically.

## Step-by-step merge

1. Open `/admin/locations/pending`. Each pending row shows the
   submitter's display name, when they submitted, the parent chain
   (region → city, or region → city → port), and the row's own name.
2. Click **Merge** on the pending row.
3. The dialog opens. Type at least 2 characters in the search input —
   results come from `/api/locations/search` which is filtered to
   `source IN ('curated', 'osm')` only, so you can't accidentally
   pick another pending row.
4. Click the canonical match. On success the pending row's FKs are
   re-pointed and the pending row itself is deleted.

### Failure modes

- **`Failed to re-point ports.city_id: …23505…`** — the pending city
  has a child port whose name already exists under the canonical city.
  Postgres' `unique (city_id, name)` constraint blocks the move. The
  pending city's ports stay where they are; nothing else has been
  changed yet (the ripple ran ports first). Workaround: **Hide** the
  pending city. Manually re-point the conflicting child port via SQL
  if needed.
- **`Failed to re-point agent_placement_cities.city_id: …23505…`** —
  same class of error, but for an agent who has placement entries
  pointing to BOTH the pending city AND the canonical city. Postgres
  refuses to merge them onto a single `(person_id, city_id)`. **Hide**
  is again the safer fallback.
- Merge ripple is non-transactional. If a step in the middle fails
  (e.g. `availability_windows.city_id` after `ports.city_id` already
  succeeded) you'll have partial state — the pending city still
  exists, but its child ports are now under the canonical city. Open
  Supabase Studio and finish the cleanup manually, or re-run the
  merge. The duplicated steps are idempotent — they just update zero
  rows the second time.

## Approve checklist

Before clicking Approve:

1. **Edit the name** if there are typos or inconsistent casing — the
   prompt accepts a corrected name.
2. **Search canonical first** — if a curated / OSM row already exists
   with a near-identical name, prefer Merge over Approve.
3. **Check the country / region** — if the submitter's country
   selection looks wrong, you may need to relocate the row first via
   a direct SQL `UPDATE cities SET region_id = ... WHERE id = ...`
   before approving.

## Hide vs delete

We don't expose a Delete action. Hide is intentional: it preserves the
submitter's existing FK so their profile / posting still renders. A
user who typed "Port Azure" gets to keep seeing "Port Azure" as their
location even after Hide — they just don't pollute anyone else's
search results.

If you genuinely need to remove a pending row (e.g. abuse / spam),
hide it first and follow up via Supabase Studio:

```sql
-- Run only after confirming no FKs remain pointing at the row
delete from public.cities where id = '<uuid>' and source = 'pending';
```

The CASCADE / SET NULL behaviours on the cities and ports FKs handle
the rest automatically.

## Related code

- Admin queue page: `apps/web/src/app/(admin)/admin/locations/pending/page.tsx`
- Action routes: `apps/web/src/app/api/admin/locations/pending/{cities,ports}/[id]/route.ts`
- Pending submission route: `apps/web/src/app/api/locations/request/route.ts`
- Search RPC filter: migration `00118_locations_pending_search_filter.sql`
- Schema (source CHECK + hidden_at + created_at + submitted_by):
  migrations `00117` and `00119`.
