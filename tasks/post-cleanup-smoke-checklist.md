# Post-cleanup smoke checklist (2026-05-04)

> Written 2026-05-04 after the Stage 235 / 235b / 235c bundle plus the lint
> sweep + Round 3 (public copy) + Round 5 minors (security deps + Next 16.2)
> were pushed to `origin/main`. Automated tests, type-check, lint, and
> production build all pass. Vercel CI green. **Zero browser smoke has run.**
>
> Run these in order. If anything fails, note the test number + the failure
> mode + the commit listed in the "Related commit" column, then stop and
> raise. Don't keep going on a broken smoke — later tests may share the
> same surface.

## Pre-conditions

Need accounts on the deployed instance for:

- **Crew with AEC 1 + AEC 2 separately** (no AEC 1+2 bundle in profile)
- **Employer with at least one active permanent posting in shortlist phase** (i.e., has opened a shortlist chat with one or more applicants)
- **Employer with a daywork posting in a multi-city region** (Côte d'Azur, Balearics, or any region with ≥2 cities)
- **Either hat with the messages page reachable** (an active engagement of any type)

Browsers: try at least desktop Chrome + mobile Safari (real device or DevTools mobile emulation).

## Tests

### 1. ✋ HIGHEST — Cert bundle symmetric apply gate (Stage 235c)

**Why this exists:** the user reported holding AEC 1 + AEC 2 separately on profile but being blocked from "MCA Approved Engine Course (AEC 1 & 2)" jobs. Stage 235c made cert matching symmetric (`commit 9cb5f8c`).

**Steps:**

1. Sign in as crew member with AEC 1 and AEC 2 selected on profile but NOT the AEC 1+2 bundle.
2. Confirm via `/profile` that both AEC 1 and AEC 2 show in the Certifications section, and AEC 1+2 does NOT.
3. Open a permanent posting requiring "MCA Approved Engine Course (AEC 1 & 2)" — e.g., a Deck/Engineer permanent role on the discover feed.
4. Tap Apply.

**Expected:** Apply succeeds. The button should NOT show "Missing certifications". The application appears in `/discover?tab=applied` afterward.

**Fail signal:** "Missing certifications" banner appears, OR a 403 error toast, OR the button stays disabled.

**Related commit:** `9cb5f8c fix(certs): symmetric bundle matching (Stage 235c)`

**If it fails:** Hard-refresh once (the lookups cache bumped v5 → v6 in `4a04286`; old cache may need a beat to clear). Then check the apply route returned `ok: true` in the network tab. If still failing, the bug is in the `expandCertCoverage` symmetric direction — file in `packages/shared/src/cert-matching.ts`.

---

### 2. Inbox bundling for shortlist chats (Stage 235b)

**Why this exists:** Permanent shortlist-phase chats now group by posting in the messages inbox. Singletons still bundle (consistent UX).

**Steps:**

1. Sign in as employer with at least one shortlist-phase chat on a permanent posting.
2. Navigate to `/messages`.
3. Verify the Active tab shows a row with: epaulette badge + role name + "·" + vessel name + a count badge `(N)` on the right + a chevron icon.
4. Tap the bundle row.
5. Verify children appear below (the individual shortlist chats, with "Pre-selection" badge suppressed inside the bundle since the parent already conveys it).
6. Tap any child → should navigate to `/messages/[engagementId]`.
7. Hit browser back. Bundle should be **collapsed again** (default-collapsed, no persistence).
8. If you have multiple shortlist chats with unread messages: bundle parent should show `2 of 5` (or similar) instead of just `5`, and the row name should be **bold**.

**Expected:** Bundle renders, expands, navigates correctly, collapses back on return.

**Fail signal:** Children don't appear on tap, OR row navigates instead of toggling, OR bundle disappears entirely.

**Related commit:** `64bca0f feat(b-011): inbox bundling for permanent shortlist chats (Stage 235b)`

**If it fails:** Inspect the messages page network call — the response should include `permanent_postings.id` and `permanent_postings.vessels.name` per shortlist conversation. If those fields are missing, the API select extension didn't deploy.

---

### 3. Return to Shortlist button (Stage 235)

**Why this exists:** Closes the loop on inbox-discoverability — employers can jump from a shortlist chat directly to the posting's shortlist tab.

**Steps:**

1. From inbox bundle (test 2 above), open a shortlist-phase chat.
2. **Desktop:** open the right sidebar. Find a `Star`-icon button labelled "Return to shortlist".
3. **Mobile:** tap the kebab/`MoreVertical` icon top-right. Find "Return to shortlist".
4. Tap it.
5. Verify URL is `/permanent/{id}/review?tab=shortlisted` and the page lands on the **Shortlisted** tab (not Applicants).

**Expected:** Single tap, lands on shortlist tab.

**Fail signal:** Button missing, OR tap does nothing, OR URL wrong, OR lands on Applicants tab.

**Related commit:** `0a69fd2 fix: post-launch bundle (Stage 235) — available-crew region scope, return-to-shortlist...`

**If it fails:** Check `permanent/[id]/review/page.tsx` reads `?tab=shortlisted` from `useSearchParams()`. If it does but the tab doesn't switch, `initialTab` isn't seeding the state correctly.

---

### 4. Available crew region+distance ordering (Stage 235)

**Why this exists:** Available crew search now scopes to the region (every city under it) instead of just the daywork's city. Distance ranking with a 200km ceiling. Each crew row shows a proximity pill (`same-port` / `same-city` / `same-region`).

**Steps:**

1. Sign in as employer with an active daywork posting in a multi-city region (e.g., Antibes posting → Côte d'Azur covers Cannes, Nice, Monaco).
2. Open `/daywork/[id]/review` and switch to the **Available Crew** tab.
3. Verify each visible crew row shows a coloured pill next to their city/port name reading `Same port`, `Same city`, or `Same region`.
4. Verify ordering: same-port crew come first, then same-city, then same-region. (Distance is internal — won't be visible, but the order should respect the bucket.)
5. Optional: cross-reference with at least one Pro crew member you know is in a different city of the same region. They should appear with the `Same region` pill.

**Expected:** Pills render, ordering is sane, region-scoped crew show up.

**Fail signal:** No pills visible, OR pills wrong colour/text, OR all candidates are same-city only (region scope didn't fire), OR list is empty when you know Pro crew exist nearby.

**Related commit:** `0a69fd2 fix: post-launch bundle (Stage 235)` — see also migration `00138_availability_city_index.sql`.

**If it fails:** Network tab → response from `/api/daywork/[id]/available-crew` should include `proximity` field per crew. If field missing, the route didn't deploy. If field present but pills don't render, look at `available-crew-tab.tsx`.

---

### 5. Billing page tier copy (Stage 235)

**Why this exists:** Tier copy was rewritten — Crew Pro tagline, Employer Pro tagline, reordered bullets, "Everything in Free" appended. Templates removed from CREW_TIER (templates are employer-only).

**Steps:**

1. Sign in as **crew hat**. Navigate to `/billing`.
2. Verify Crew Pro card shows: price `€4.99/month`, tagline "Be findable by captains in the same port or city.", four bullets including "500 Docky AI questions per month, personalised — reads your role, certs and sea-time" and "Everything in Free".
3. Verify NO mention of templates anywhere in the Crew Pro card.
4. Switch to **employer hat**. Navigate to `/billing`.
5. Verify Employer Pro card shows tagline "Hire faster: bigger shortlists, no template limits, unlimited reference checks." and bullets including "Unlimited daywork and permanent posting templates" and "Everything in Free".

**Expected:** Both tier cards render with the new copy and pricing.

**Fail signal:** Old copy ("10 Docky questions/month", or "5 daywork + 2 permanent templates" on Crew side), OR missing tagline, OR broken price line.

**Related commit:** `0a69fd2 fix: post-launch bundle (Stage 235)`

---

### 6. Review applicants (N) inline count (Stage 235)

**Why this exists:** Applicant count moved from the muted counts row onto the action button itself.

**Steps:**

1. Sign in as employer with a permanent posting that has applicants.
2. Navigate to `/daywork/mine`.
3. Find the permanent posting card. The button should read `Review applicants (N)` (where N = applicant count).
4. Verify the muted row below the title no longer shows "X applicants" — it should only show shortlist count.
5. Tap the button → navigates to `/permanent/[id]/review`.

**Expected:** Inline count visible on button.

**Fail signal:** Button still reads plain "Review applicants" without count, OR count is still in muted row, OR mismatch between count and actual applicants.

**Related commit:** `0a69fd2 fix: post-launch bundle (Stage 235)`

---

### 7. BottomSheet input focus retention (Stage 235)

**Why this exists:** Pre-fix, the messages page polled context every 5s. Each poll re-rendered the parent, the BottomSheet effect re-fired, and `sheetRef.current?.focus()` stole focus from any input the user was typing in — losing ~3 chars per cycle. Same root cause was breaking scroll-wheel time pickers.

**Steps:**

1. Sign in as either hat with an active engagement.
2. Open `/messages/[engagementId]` for that engagement.
3. Open one of the form overlays inside a BottomSheet — the easiest are: **employer side**, "Pre-arrival checklist" or "Propose date change". **Crew side**, "Cancel engagement" reason form.
4. Tap into a text input field inside the BottomSheet.
5. Start typing slowly (one char per second).
6. Wait at least 6 seconds. The 5s context poll will fire during your typing.

**Expected:** Cursor stays in the input. All typed characters land. No focus jump.

**Fail signal:** Cursor jumps out of the input mid-typing, OR characters disappear, OR focus shifts to the BottomSheet container.

**Related commit:** `0a69fd2 fix: post-launch bundle (Stage 235)` — `apps/web/src/components/ui/bottom-sheet.tsx`

**If it fails:** The `onCloseRef` ref pattern didn't deploy or got reverted. Check the file at line ~30.

---

### 8. Lookups cache v6 fresh fetch (Stage 235)

**Why this exists:** Cache key bumped v5 → v6 because old v5 caches written before bundleMap was reliably populated were silently falling back to `{}`, breaking cert bundle expansion (STCW 95 holders saw "Missing: Elementary First Aid").

**Steps:**

1. Open DevTools → Application → Local Storage on the deployed origin.
2. Delete the `dw-lookups-v5` and `dw-lookups-v6` entries (if either exists).
3. Hard-reload (Ctrl-Shift-R / Cmd-Shift-R).
4. In Application → Local Storage, confirm a new `dw-lookups-v6` entry was written.
5. Inspect its JSON content — `bundleMap` field should be a non-empty object with at least 2 keys (AEC 1+2 bundle, STCW 95 bundle), each pointing to an array of component cert IDs.
6. Repeat test 1 (apply gate) — should still pass.

**Expected:** v6 entry exists, bundleMap is populated, cert pills render correctly.

**Fail signal:** v6 entry doesn't appear, OR `bundleMap: {}` empty, OR test 1 starts failing.

**Related commit:** `0a69fd2 fix: post-launch bundle (Stage 235)` — `apps/web/src/hooks/use-lookups.tsx`

---

### 9. Public copy (Round 3)

**Why this exists:** Crew-side daywork swipe was removed in Stage 234 but README + landing page still said "swipe through". End users were forming the wrong mental model.

**Steps:**

1. Sign out (or open in incognito).
2. Navigate to `/` (root landing page).
3. Read the hero copy and the daywork value-prop card.

**Expected:** Both read "Browse" / "browse through". No "swipe" anywhere on this page.

**Fail signal:** "Swipe through" copy still visible.

**Related commit:** `859f5f7 docs: Round 3 — drop "swipe" from public crew-facing copy`

---

### 10. Push notification end-to-end (Stage 235 broader change)

**Why this exists:** Stage 235 added recipient-hat lookup for `role_context` on every notification insert. Push handlers also gained handlers for POSTPONEMENT_ACCEPTED/REJECTED + COMPLETION_CONFIRMED/DISPUTED (previously silently no-op).

**Steps:**

1. Two test accounts: a crew member and an employer with an active engagement.
2. Crew member: open `/profile` → notifications enabled.
3. Employer: send a message to the crew via `/messages/[engagementId]`.
4. Crew: confirm the bell badge updates **on whichever hat the crew is currently on** (this is the new behaviour — previously could land in alt-hat bucket and be invisible).
5. Optional: trigger a postponement-accept or completion-confirm, verify notification fires.

**Expected:** Bell badge increments on the active hat. Tapping notification deep-links to the chat.

**Fail signal:** Bell doesn't update, OR badge appears under the wrong hat (alt-hat bucket), OR Sentry shows `notifyOnEvent in-app insert` errors after the action.

**Related commit:** `0a69fd2 fix: post-launch bundle (Stage 235)` — `apps/web/src/lib/push-triggers/index.ts`

---

## Known issues already documented (not smoke-blockers)

These are known and tracked — surface them only if they're notably worse than expected, otherwise skip:

- **Onboarding may flicker / lose focus.** `apps/web/src/app/onboarding/page.tsx` defines 5 components inline (`ProgressDots`, `HatSelectionStep`, etc.). They remount on every parent re-render. Tracked in `tasks/todo.md` Backlog → "React Compiler readiness" with the four disabled rules. Not new — pre-existing — but the React Compiler rule that flagged it is now silently off, so don't expect ESLint to surface it.

- **Push handlers + available-crew branch + messages bundle integration tests deferred.** Coverage gaps from the audit. Code paths exist and work in the unit tests + component tests, but route-boundary integration testing for these specific paths is missing. If anything regresses there, manual smoke is the only signal.

- **Dependencies still flagging moderate severity advisories** (`@anthropic-ai/sdk` 0.79 path validation, `uuid` <14 transitive via resend → svix). Both blocked behind major version bumps deferred to Round 5 majors.

## What to do if a smoke fails

1. Note the test number + commit hash from the table.
2. **Don't keep smoking** — the failure may share a surface with later tests.
3. Two roads:
   - **Quick rollback:** `git revert <commit-hash>` on a hotfix branch, push.
   - **Forward fix:** raise the failure with file path / network response / screenshot. Faster if the bug is small.
4. Re-run the failed test after the fix lands.
