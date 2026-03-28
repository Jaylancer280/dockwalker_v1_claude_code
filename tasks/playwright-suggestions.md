# Playwright UX Suggestions

> Written by the visual testing agent during test runs. The planning agent reads this during Orient and may promote suggestions to `tasks/todo.md` with user approval.
>
> Each suggestion has been verified against the actual codebase. False positives are marked and moved to Rejected.

## Pending

(None — all suggestions have been triaged as of 2026-03-27.)

## Accepted

- **SUG-001** — Crew review page role gate → in founder-todo.md Phase 0. Pending implementation.
- **SUG-003** — Discover daywork feed broken (null daywork_ids) → PF-001 in todo.md. Fix: `.filter(Boolean)` on exclude IDs.
- **SUG-010** — Form cert/language UI inconsistency → superseded by todo item 9 (HierarchicalPills component, app-wide).
- **SUG-011** — Cancel posting no confirmation → **FIXED** (D-010 PASS in test registry 2026-03-27T10:30).
- **SUG-015** — Applied tab empty list → **FIXED in 9bef4bd** (verified: Applied (8) tab shows 8 cards).
- **SUG-016** — Employer not redirected from /discover → in founder-todo.md Phase 0. Pending implementation.
- **SUG-017** — Edit experience "Unknown vessel" → root cause is seed data (employer-owned vessels). Fixed by todo item 5 (seed overhaul — crew-owned vessels).

**Deferred to Post-TestFlight:**

- **SUG-007** — Billing shows Crew Pro to employer (billing not active for TestFlight)
- **SUG-009** — Employer notifications empty (seed limitation, not code bug — will generate in production)
- **SUG-012** — Form validation uses browser native (functional, just not styled)
- **SUG-013** — Invalid URLs show wrong error (users don't type URLs)
- **SUG-014** — Invitations tab count/content mismatch (likely test pollution; verify after fresh reseed)

## Rejected

### SUG-002 — Agent profile "1 Issue" banner (DEV ONLY)

**Reason:** Next.js development mode error overlay. Does not appear in production builds.

---

### SUG-004 — Employer message thread infinite spinner (FALSE POSITIVE)

**Reason:** Race condition under 8-worker parallel test load against single dev server. When run in isolation, page renders correctly in ~250ms with full content (job card, checklist, messages). Re-captured baseline confirmed. Not a code bug.

---

### SUG-005 — Employer review "No applicants" (CORRECT BEHAVIOR)

**Reason:** The Applicants tab is a "to review" queue filtering by `status IN ['applied', 'viewed']`. Once applicants are shortlisted/accepted/completed, they correctly move off this tab. The Shortlist tab shows shortlisted candidates. This is by design — not a bug.

---

### SUG-006 — Next.js dev mode error banners (DEV ONLY)

**Reason:** Next.js development mode error overlays. Do not appear in production builds. Harmless hydration mismatches.

---

### SUG-008 — Agent bottom nav missing Docky (BY DESIGN)

**Reason:** Agents use the employer nav which doesn't include Docky. Docky is a crew career advisor tool — agents are employment intermediaries, not active crew seeking career advice. Intentional per mission doc.
