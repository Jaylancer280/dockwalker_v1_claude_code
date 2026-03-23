# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

### Stage 148: Profile polish — both hats, persistence, sea time fix, role fallback

#### 148a — `computeSeaTime` is mislabeled — it's total experience duration, not verified sea time

- [ ] Rename `computeSeaTime` → `computeTotalExperience` (file, function name, all call sites)
- [ ] Update all display labels that say "sea time" to say "total experience" or just "total"
- [ ] Update the Stage 147C test file name and test descriptions: `compute-sea-time.test.ts` → `compute-total-experience.test.ts`

#### 148b — Collapse state persistence in localStorage

- [ ] On section toggle: write `expandedSections` to `localStorage`
- [ ] On mount: read from `localStorage` and initialize state
- [ ] Use `useEffect` to sync state → localStorage

#### 148c — Employer hat profile needs structure

- [ ] Employer hat: show same 4 collapsible sections (minus daywork availability)
- [ ] Agent hat: wrap fields in collapsible section, add prompts for empty fields

#### 148d — Current Role fallback when no experiences exist

- [ ] Verify onboarding-set role displays when experiences.length === 0
- [ ] Show "Add your first experience to build your profile" when Summary is empty
- [ ] Confirm EpauletteBadge doesn't render without a role

### Stage 149: Skip onboarding + deferred profile completion + onboarding data gaps

#### 149a — "Skip for now" on onboarding

#### 149b — Persistent profile completion nudge

#### 149c — Add missing fields to full onboarding flow

(See full details in git history — planning agent spec from prior session)

---

## Post-TestFlight

> Deferred work. Not blocking launch. Prioritise based on real user feedback.

### Resilience Tests

- [ ] Discover page: mock safeFetch error → no spinner stuck
- [ ] Chat page: mock safeFetch error → polling still sets up
- [ ] Apply action: mock error → toast shown, state clears
- [ ] Post form: mock error → toast shown, state clears
- [ ] Availability overlay: network fail → no unhandled rejection

### Component Tests for Permanent UI

- [ ] PermanentJobCard, PermanentJobFeed, PermanentPostForm, PermanentReviewPage, PermanentApplicationCard

### Push-Triggers Further Decomposition

### Onboarding True Atomicity

### App Feature Guide

### Negotiation Timeout

### Weekly Check-In Cron (Permanent)

---

## Done

(See git history for completed stages 51-139, 141a, 142, 143, 144, 145, 146, 147, fixes 118a/123a/123b/127a/128a/128b/131a/139a-f/140a-e/143g/144-batch/fix1-addendum/144-cert/145a/146a, template name cap, messages test cleanup)
