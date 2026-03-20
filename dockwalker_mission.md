APP NAME (WORKING): DockWalker

> **Version:** 2.0 — Updated to reflect permanent jobs alongside daywork.
> **Original:** v1.0 captured the founding daywork-only vision (see git history).
> **Authority:** This document defines product intent and boundaries. For technical architecture, see CLAUDE.md. For build progress, see BUILD_STATE.md.

---

CORE THESIS

DockWalker is a hyper-focused, two-sided hiring app for the superyacht industry. It exists to eliminate friction in crew hiring at every level — from green crew seeking their first paid day on a vessel to experienced crew seeking long-term placements.

Two modes, one app:

- **Daywork** — short-term engagements (1-14 days). Fast, instinctive, swipe-to-hire. For when someone needs cover Monday.
- **Permanent** — long-term positions. Deliberate, structured, shortlist-to-placement. For when someone needs a Chief Stew for the season.

Daywork brings them. Permanent makes them stay.

It is NOT a generic cross-industry job board.
It is NOT a reputation scoring system.
It is NOT a social network.
It is NOT a vessel management system.
It is NOT a gamified career app.
It is NOT a salary negotiation or bidding platform — salary is informational, displayed transparently on postings. In-app salary negotiation mechanics are out of scope by design.

It is a structured, truth-centric hiring layer for maritime professionals.

---

1. USERS

---

USER TYPES:

- Crew (green + experienced)
- Employer (Captain, Chief Engineer, Bosun, HOD, Management rep)
- Agency Agent (posts jobs on behalf of vessels, cannot switch to crew hat)
- Dual-role users allowed (crew who can also post as employer)

CREW CHARACTERISTICS:

- Range from first-day green crew to 20-year veterans
- Green crew: often dockwalking, frequently changing availability, limited formal CV structure, high sensitivity to time and cash flow
- Experienced crew: may be currently employed, open to better offers, have vessel history and certifications to showcase
- Both want daywork to pay bills AND permanent roles to build careers
- Cannot "post a job" as the "crew" variant of their profile

EMPLOYER CHARACTERISTICS (DAYWORK):

- Time constrained
- Needs short-term cover urgently
- Wants structured filtering
- Risk aware but pragmatic

EMPLOYER CHARACTERISTICS (PERMANENT):

- Deliberate and comparative
- Willing to wait for the right candidate
- Needs to shortlist, evaluate, and negotiate
- May delegate review to captain/HOD

AGENCY AGENT CHARACTERISTICS:

- Posts multiple jobs across multiple vessels
- Needs templates for repeat posting
- Volume user — efficiency matters
- Cannot switch hats (always agent)

Crew can act as employers (crew-crew hiring circumstances), employers cannot act as crew (apply).

---

2. CORE PROBLEM SOLVED

---

CURRENT STATE:

- WhatsApp blasts for both daywork and permanent roles
- Dockwalking chaos
- Agency calls and CV PDF spam
- No structured filtering
- No persistent structured interaction record
- Experienced crew miss opportunities because they're not in the right WhatsApp group

TARGET STATE:

- Structured daywork posting with swipe-to-hire
- Structured permanent posting with shortlist-to-placement
- Cert-enforced applications (hard gate for permanent, soft for daywork)
- One-tap/easy apply for both types
- Persistent in-app secure messaging (near real time)
- Clear state transitions — every action is a truth event in the ledger
- One profile serves both daywork and permanent — experience, certs, availability all in one place

---

3. VALUE PROPOSITION

---

FOR CREW:

- Increased probability of paid daywork
- Reduced dockwalking randomness
- Clear visibility into live jobs — both daywork and permanent
- Structured application history across both types
- Fast mobile-first application flow
- One profile, one app — daywork to pay the bills, permanent to build a career
- Cert gap visibility via AI advisor (Docky)

FOR EMPLOYERS:

- Filterable applicant pool
- Structured role/cert data
- Reduced scramble time (daywork)
- Simple accept/reject mechanics (daywork)
- Deliberate shortlist-to-placement pipeline (permanent)
- Persistent chat + hiring record
- Templates for repeat posting

---

4. CORE EXPERIENCE FLOW

---

DAYWORK — CREW SIDE (TINDER-LIKE MECHANIC)

A. Job Discovery:

- One job shown at a time in a swipe card stack.
- Swipe Right = Apply.
- Swipe Left = Pass.
- Tap = View full structured details.
- Optional message with application (250 chars).

Job Card Fields:

- Vessel name (or "NDA Vessel"), type (M/Y / S/Y), size band, LOA
- Role needed + department + epaulette badge
- Duration (start date + end date + working days count)
- Location (region, city, port/marina)
- Day rate + currency (required)
- Required certs
- Experience bracket
- Meals provided
- Positions available
- Job reference (DW-XXXXX)
- Special notes

B. Apply:

- Single tap or swipe confirmation.
- Structured profile auto-attached.
- Optional 250-char message.
- No CV uploads required.
- Availability required (server-enforced gate).

C. Daywork Application States (crew-visible):

- Applied
- Under review (viewed by employer)
- Shortlisted
- Accepted (engagement opens, chat active)
- Rejected
- Withdrawn (crew-initiated)
- Superseded (system — overlapping dates, auto-resolved)

D. Messaging:

- Opens ONLY after employer accepts.
- No auto-deletion. No disappearing messages.
- All messages retained server-side (append only). Message hiding removed by design.
- Realtime delivery via Supabase Realtime, polling fallback.

---

DAYWORK — EMPLOYER SIDE

A. Post Daywork:

- Role, location, duration, start/end date, working days
- Vessel (IMO-anchored, reusable)
- Day rate + currency (required)
- Required certs, experience bracket
- Meals, notes
- Positions available (1-20)
- Templates for repeat posting

B. Applicant Review (Tinder-style):

- One applicant at a time in swipe stack.
- Swipe Right = Accept. Swipe Left = Reject. Swipe Up = Shortlist.
- Tap = Full structured profile.
- Three tabs: Applicants, Shortlisted, Available Crew (invite).
- Filters: certification, minimum available days.

C. Accept:

- Confirmation dialog.
- Engagement created, messaging auto-opens.
- Overlapping crew applications auto-superseded.
- Posting moves to in_progress (hidden from discovery).

---

PERMANENT — CREW SIDE (SCROLLABLE FEED)

A. Job Discovery:

- Toggle on Discover page: [Daywork | Permanent]. Toggle affects Browse only.
- Scrollable job feed — deliberate browsing, not instinctive swiping.
- Cursor-based pagination (20 per page).
- Sorted by recency. No algorithmic weighting.
- "Posted X days ago" on every card.

Job Card Fields:

- Role name + department + epaulette badge
- Vessel name (or "NDA Vessel"), type, size band, LOA
- Location (region, city, port/marina)
- Salary (exact or range) + currency + period (monthly/annual)
- Live aboard badge
- Required certifications (listed — hard gate for apply)
- Experience bracket
- Start date (or "ASAP" if past)
- Shortlist capacity ("Shortlist: up to X candidates") — static, not a live fill count
- Job reference (PM-XXXXX)
- "Posted by {name}" (tappable to profile)

B. Apply:

- Explicit "Apply" button (no swipe).
- Optional 250-char message.
- Cert hard-gate: crew CANNOT apply if missing any required cert. Server-side check, not just UI.
- Missing certs shown with link to profile edit.
- Blocked application attempts recorded as intelligence (`PERMANENT.APPLICATION_BLOCKED`).

C. Permanent Application States (crew-visible):

- Under review (applied, not yet shortlisted)
- Shortlisted ("You've been shortlisted, 1 of 5")
- Selected (in negotiation, chat open)
- Position filled (another candidate placed)
- Position closed (posting cancelled)
- Withdrawn (crew-initiated)

No competition metrics visible to crew. No live shortlist counts. No "candidate under consideration." Crew see only their own state.

D. Permanent Availability (profile-level):

- "Career status" section on profile, separate from daywork availability
- Three states: Available immediately / Available after notice period (+ days) / Not looking
- "Currently employed" checkbox
- Informational for employers, not an enforcement gate (except "not looking" = excluded from feed)

---

PERMANENT — EMPLOYER SIDE

A. Post Permanent Job:

- Choice screen before form: "Daywork — Short-term cover, 1-14 days" or "Permanent — Long-term position, structured hiring"
- Salary min/max + currency + period (monthly/annual)
- Required certs (hard-gated for crew)
- Live aboard (yes/no)
- Shortlist cap (default 5)
- Vessel, role, location, start date, experience bracket, notes
- Templates for repeat posting (full CRUD)

B. Applicant Review (Scrollable List):

- Scrollable list, not card stack. Different mentality from daywork.
- Two tabs: Applicants, Shortlisted.
- Shortlist: employer explicitly moves candidates to shortlist (capped).
- During negotiation: banner shows "Currently in negotiation with {name}."
- Selected candidate shown on shortlist with "In negotiation" badge (employer view only).

C. The Hiring Funnel:

```
POST → APPLY (cert-gated) → SHORTLIST (capped) → SELECT → NEGOTIATE → CONFIRM or REVERT
```

1. Employer reviews applications, shortlists up to cap.
2. Employer selects ONE candidate — negotiation begins, engagement opens, chat active.
3. Other shortlisted candidates stay in "Shortlisted" (not rejected, not notified).
4. Employer either:
   - **Confirms placement** → posting filled, remaining shortlisted notified ("position filled")
   - **Reverts selection** → engagement closed, posting returns to active, employer picks another from shortlist
5. Crew can withdraw at any point — posting reverts to active.
6. Employer can cancel posting at any point — all applicants notified.

The shortlist is a pipeline, not a one-shot decision. This mirrors how captains actually hire.

D. Engagement (Post-Selection):

- Simpler than daywork. No work-started confirmation, no postponement, no completion, no ratings, no checklist.
- Chat open for negotiation and logistics.
- After placement confirmed: engagement stays active for start logistics, either party closes when done.
- Closed engagements move to message history.

---

5. EVENT MODEL (APPEND-ONLY)

---

All state derived from events. No hard deletes. No silent mutation of history. Events are namespaced by domain — daywork and permanent have separate handlers with zero cross-contamination.

DAYWORK EVENTS:

```
DAYWORK.POSTED / DAYWORK.APPLIED / DAYWORK.VIEWED
DAYWORK.ACCEPTED / DAYWORK.REJECTED / DAYWORK.COMPLETED
DAYWORK.SHORTLISTED / DAYWORK.CANCELLED_BY_EMPLOYER / DAYWORK.RELISTED
DAYWORK.INVITED / DAYWORK.INVITATION_ACCEPTED / DAYWORK.INVITATION_DECLINED
DAYWORK.POSITIONS_UPDATED / DAYWORK.EXTENDED
APPLICATION.WITHDRAWN / APPLICATION.SUPERSEDED
```

PERMANENT EVENTS:

```
PERMANENT.POSTED / PERMANENT.APPLIED / PERMANENT.APPLICATION_BLOCKED
PERMANENT.SHORTLISTED / PERMANENT.REJECTED / PERMANENT.SELECTED
PERMANENT.PLACEMENT_CONFIRMED / PERMANENT.SELECTION_REVERTED
PERMANENT.WITHDRAWN / PERMANENT.CANCELLED_BY_EMPLOYER
PERMANENT.ENGAGEMENT_CLOSED
```

SHARED EVENTS:

```
PERSON.CREATED / PERSON.HAT_CHANGED / PERSON.DEACTIVATED / PERSON.DATA_SCRUBBED
PROFILE.CREATED / PROFILE.UPDATED
VESSEL.CREATED / VESSEL.UPDATED
AVAILABILITY.SET
MESSAGE.SENT
ENGAGEMENT.CANCELLED_BY_CREW / ENGAGEMENT.CANCELLED_BY_EMPLOYER
ENGAGEMENT.WORK_STARTED / ENGAGEMENT.WORK_STARTED_CONFIRMED
ENGAGEMENT.COMPLETION_CONFIRMED / ENGAGEMENT.COMPLETION_DISPUTED
ENGAGEMENT.RATED_BY_CREW / ENGAGEMENT.RATED_BY_EMPLOYER
ENGAGEMENT.POSTPONEMENT_PROPOSED / ENGAGEMENT.POSTPONEMENT_ACCEPTED / ENGAGEMENT.POSTPONEMENT_REJECTED
CHECKLIST.SET / CHECKLIST.ITEM_TOGGLED
EXPERIENCE.ADDED / EXPERIENCE.UPDATED / EXPERIENCE.REMOVED
ADMIN.ENGAGEMENT_COMPLETED / ADMIN.CANONICAL_ADDED / ADMIN.CANONICAL_UPDATED
```

For the complete typed payload map, see `packages/types/src/events.ts`.

---

6. MATCH LOGIC (NO SCORING)

---

Filtering only, not ranking. Same philosophy for both daywork and permanent.

Eligibility (daywork):

- Role match
- Cert requirements (advisory — soft gate)
- Location match
- Availability overlap (server-enforced)

Eligibility (permanent):

- Role match
- Cert requirements (enforced — hard gate, 403 if missing)
- Location match
- Permanent availability (informational, except "not looking" = excluded)

Sorting:

- Recency (most recently posted first) — both types
- No proximity scoring, no tenure weighting, no algorithmic ranking

No public scores.
No star ratings.
No reputation numbers.

---

7. INTELLIGENCE LAYER (SUBTLE, NON-GAMIFIED)

---

Derived but not surfaced as "scores."

Internal use (daywork):

- Experience summary bands (auto-derived from vessel history)
- Availability reliability (internal)
- Engagement frequency (internal)
- Ratings data (private — pay accuracy, cert verification, communication, would-rehire)

Internal use (permanent):

- Cert gap analysis (from `PERMANENT.APPLICATION_BLOCKED` — which certs block the most applications)
- Shortlist-to-placement conversion rates
- Negotiation revert rates per employer
- Cross-type career progression (crew who do daywork then get placed permanently)

Displayed:

- Vessel size exposure bands
- Total time onboard (from experience entries)
- Certifications held
- Nationality + visa status
- Permanent availability status (for employer context)

No qualitative judgment metrics.
No completion counts, engagement frequency, or performance metrics surfaced to differentiate crew quality. This disadvantages green crew — the exact user segment the app exists to serve.

---

8. TRUST & SAFETY

---

- Cert enforcement is declaration-based. Crew declare what they hold. Misrepresentation is a bannable offence. DockWalker does not verify certs.
- Soft moderation via admin tooling.
- No public reviews.
- No blacklists.
- Clear cancellation logging with structured reasons (both employer and crew).
- NDA vessel protection (IMO hidden until acceptance/selection).
- GDPR compliant: data export, account deactivation, data scrub pipeline.
- Abuse detection via one-way device fingerprint hash (non-PII).

---

9. MONETIZATION

---

Phase 1 (launch):

- Crew: free to use.
- Employers: free to use (daywork and permanent).
- Docky AI advisor: free tier (3 questions/month), Crew Pro for unlimited.

Phase 2 (post-traction):

- Permanent shortlist cap tiers (free: 5 per posting, paid: 10/15/unlimited).
- Permanent employer invitations (deferred — requires agency trust established first).
- Fleet management features for agencies (deferred).

Monetization principles (non-negotiable):

- No boosts.
- No priority listing manipulation.
- No pay-to-rank.
- No pay-to-be-seen for crew.
- Salary is informational, not a bidding mechanic. In-app salary negotiation is explicitly out of scope.

---

10. TRAJECTORY

---

DockWalker is a hiring platform today. What it becomes depends on the data that flows through it.

The append-only event ledger captures every meaningful interaction — applications, shortlists, placements, cert blocks, withdrawals, cancellations. Over time, this creates a dataset about maritime career patterns that no WhatsApp group, crew agency, or existing platform holds in structured form.

Docky (the AI advisor) is the delivery mechanism. Today it answers MCA regulatory questions and provides basic cert guidance. As the ledger grows, it can draw on real hiring patterns to help crew make career decisions — which certs unlock the most opportunities, which ports have the most demand for their role, what the typical path looks like from their current position to their goal.

This is not a roadmap. No features are promised. The architecture simply doesn't prevent it — the event-sourced design, the intelligence events (`PERMANENT.APPLICATION_BLOCKED`), and the crew experience data were built to support this trajectory without requiring schema changes or retroactive data collection.

The platform gets smarter as people use it. That's the flywheel.

---

11. GEOGRAPHIC STRATEGY

---

Launch in top 7 regions (canonical port lists per region):

- Antibes
- Palma
- Fort Lauderdale
- Caribbean
- Bahamas
- Dubai/UAE
- Turkey

55 ports/marinas across these regions. Hierarchical: Region -> City -> Port/Marina.

Density > scale. Both daywork and permanent launch in the same ports.

---

12. EXPLICIT NEGATIVE SPACE

---

This app is NOT:

- A generic cross-industry job board.
- A reputation scoring engine.
- A crew social network.
- A vessel PMS.
- An agency replacement (agencies post ON DockWalker, not replaced BY it).
- A salary negotiation or bidding platform.
- A review/rating system (ratings are private intelligence, never surfaced).
- A gamified progression tool.
- A headhunting platform (employer invitations for permanent deferred past launch).

If a feature:

- Requires scoring,
- Requires ranking,
- Introduces public reputation,
- Encourages vanity metrics,
- Adds feed-based engagement,
- Adds complex matching algorithms,
- Adds AI recommendation feeds,
- Surfaces competitive pressure to crew (shortlist counts, "candidates ahead of you"),
- Monetizes crew visibility unfairly,

-> It is OUT OF SCOPE.

---

13. ASSESSMENT CRITERIA

---

The app is correct if:

DAYWORK:

1. A green crew member can apply to a daywork job in <5 seconds.
2. An employer can post a daywork job in <60 seconds.
3. An employer can accept a candidate in 1-3 swipe/confirmation actions.
4. Messaging opens only after acceptance.

PERMANENT: 5. An employer can post a permanent role in <90 seconds. 6. A crew member can apply to a permanent role in <10 seconds. 7. Cert hard-gate blocks unqualified applications server-side. 8. Shortlist cap is enforced at the projection layer. 9. The negotiation stage allows employer to confirm, revert, or cancel without losing the shortlist pipeline.

BOTH: 10. All states are event-derived, except `daywork_templates` and `permanent_templates`. 11. No scoring system exists. 12. No ranking system exists. 13. No hidden algorithmic biasing exists. 14. All filters are explicit and visible. 15. Events are namespaced (`DAYWORK.*` and `PERMANENT.*`) with zero handler cross-contamination. 16. A crew member with any level of experience can join, showcase their experience on their profile, and find the app useful for both daywork and permanent searching.

The app is incorrect if:

- It becomes a profile directory without liquidity.
- It introduces reputation scoring.
- It overcomplicates onboarding.
- It becomes a generic ATS/HR platform.
- It introduces feature creep beyond the daywork + permanent scope.
- It adds social feed mechanics.
- It monetizes crew visibility unfairly.
- It surfaces competition metrics that create anxiety for crew.
- Permanent breaks daywork (zero contamination violated).

---

## END STATE VISION

DockWalker becomes:

"The default hiring platform for superyacht work in [Port X]."

Green crew find daywork to survive.
Experienced crew find permanent roles to build careers.
Captains rely on it when scrambling for daywork cover.
Agencies post permanent roles because the applicant pool is already there.
Transactions happen inside it.

No politics.
No predatory mechanics.
No inflated gamification.
No competitive anxiety.

Simple.
Fast.
Structured.
Fair.
Transactional.
Truth-centric.
