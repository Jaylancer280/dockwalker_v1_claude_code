# Lessons Learned

> After ANY user correction, append the pattern here immediately.
> Review this file at the start of every session before writing code.

## Patterns

- **Supabase client destructuring:** Always destructure `supabase` from `guard.value` in route handlers — do not use `guard.value.supabase` inline or assign to a separate variable before the guard check
- **Test mock ordering:** When a route does parallel `Promise.all` lookups, mock `from()` calls in the same order as the production code
- **Thenable mock pattern for chained queries:** When Supabase queries chain `.order().order()`, the mock builder must return itself from `.order()` and implement `.then()` for await resolution — do not return `Promise.resolve()` from `.order()` as that breaks subsequent chains
- **Adding fields to API responses breaks toEqual assertions:** When adding new fields to a response object (e.g. `size_band_id` to vessel hydration), find and update all existing tests that use `.toEqual()` on that object — `toEqual` is exact, not partial
- **Fix broken tests, don't label them "pre-existing":** If a test failure is caused or worsened by our changes (e.g. mock chain doesn't support chained `.order().order()`), fix it in the same stage rather than deferring. Component test mocks must match the actual call patterns in production code
- **Follow the full Close protocol — no shortcuts:** After implementation, always complete every step of the Close protocol including moving completed items from Queue to Done in `tasks/todo.md`, resetting Current Task to `(none)`, and verifying all documentation updates. Skipping steps causes the user to catch protocol violations manually
- **Never surface reputation or performance metrics:** The mission doc explicitly lists reputation scoring as out of scope. Surfacing would-rehire, completion rates, or any performance metric to differentiate crew quality violates the core product philosophy and disadvantages green crew — the exact user segment the app is designed to serve. Ratings exist for internal intelligence only.
- **Experience dates can NEVER overlap:** A crew member cannot work on two vessels simultaneously in v1. This is a hard requirement enforced at the API layer (POST and PATCH experience routes), not just a UI constraint.
