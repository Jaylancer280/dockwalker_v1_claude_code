# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

## Queue

### Stage 75: Post-Implementation Regression Fixes

Three issues found during planning agent review of Stages 68-74.

**75a: Fix rollback 00034 — restore apply_projection**

- [x] Full `apply_projection` body restored from migration 00031 state (with vessel_operation in VESSEL.CREATED/UPDATED)
- [x] "Must be restored manually" comment removed — rollback is self-contained

**75b: Fix rollback 00035 — drop orphaned trigger + function**

- [x] Added DROP TRIGGER + DROP FUNCTION before column drops

**75c: Wire IMO reveal through message context for engaged crew**

- [x] Context API: added `imo_number` to vessels select
- [x] Types: added `imo_number?: string | null` to vessels interface
- [x] Daywork summary card: conditionally renders `IMO: {imo_number}` when present

**75d: Verification**

- [x] 493 tests pass, TSC clean
- [x] Rollback 00034 self-contained (full apply_projection body)
- [x] Rollback 00035 drops trigger and function before columns
- [x] Supabase db reset succeeds cleanly

## Done

(See git history for completed stages 51-74)
