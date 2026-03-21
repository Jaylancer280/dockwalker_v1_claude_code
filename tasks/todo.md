# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

---

### Fix 128a: TypeScript error in PermanentPostForm

**Goal:** Fix the `TS2322` error on line 312 of `permanent-post-form.tsx`. The `Select` component's `onValueChange` passes `string`, but `setSalaryCurrency` expects `CurrencyCode`.

**Done condition:** `npx tsc --noEmit` — zero errors. Commit Stage 128 + fix together.

---

- [ ] Import `CurrencyCode` from `@/lib/units` in `permanent-post-form.tsx`
- [ ] Change line 312 from `onValueChange={setSalaryCurrency}` to `onValueChange={(v) => setSalaryCurrency(v as CurrencyCode)}`
- [ ] Check if `salaryPeriod` has the same issue — `setSalaryPeriod` may also need a cast if the state is typed as `'monthly' | 'annual'` but `Select` passes `string`
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx vitest run` — 730 tests pass
- [ ] Commit Stage 128 with fix

---

## Done

(See git history for completed stages 51-127, fixes 118a/123a/123b/127a, messages test cleanup)
