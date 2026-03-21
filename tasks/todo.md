# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

---

### Fix 128b: Wire vessel creation in PermanentPostForm

**Goal:** Pass `onRequestCreate` to `VesselSelector` in the permanent post form so employers with no vessels can create one.

**Done condition:** Clicking "Add your first vessel" in the permanent form navigates to `/vessels`. One-line change.

---

File: `apps/web/src/app/(app)/daywork/post/_components/permanent-post-form.tsx` — line 249

Change:

```typescript
<VesselSelector value={vesselId} onValueChange={setVesselId} />
```

To:

```typescript
<VesselSelector value={vesselId} onValueChange={setVesselId} onRequestCreate={() => router.push('/vessels')} />
```

`router` is already imported and available (line 54).

- [ ] Add `onRequestCreate={() => router.push('/vessels')}` to VesselSelector on line 249
- [ ] `npx tsc --noEmit` — zero errors
- [ ] Commit

---

## Done

(See git history for completed stages 51-128, fixes 118a/123a/123b/127a/128a, messages test cleanup)
