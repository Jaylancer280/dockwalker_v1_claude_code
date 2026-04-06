# Docky Job Matching — Deferred Feature Spec

> **Status:** DEFERRED — requires platform volume (hundreds of active postings per region minimum).
> **Decision date:** 2026-04-05.
> **Reason for deferral:** On an empty or low-volume database, this feature returns nothing useful or suggests the same few jobs to every crew member, making the platform feel dead. The feature's value is proportional to posting density. Ship post-traction only.

---

## What It Is

Docky (the AI career advisor) gains the ability to query active daywork and permanent postings that match the crew member's profile, and proactively suggest specific jobs during conversation. This turns Docky from a knowledge base (MCA documentation + profile advice) into an active career assistant that bridges the gap between "I have questions about my career" and "here's a job you should apply to right now."

### Example Interaction

```
Crew: "I'm a deckhand in Antibes with STCW and ENG1. What should I be looking for?"

Docky (current — MCA corpus only):
"With STCW Basic Safety and an ENG1 medical, you're qualified for most
deckhand daywork. You might consider adding your Powerboat Level 2..."

Docky (with job matching):
"With your qualifications you're eligible for 4 active daywork postings
in Antibes right now:
- DW-00312: Deckhand on M/Y Serenity, 3 days, €250/day (starts Monday)
- DW-00298: Deckhand on S/Y Horizon, 5 days, €220/day
- PM-00045: Junior Deckhand on M/Y Atlas, permanent, €3,200/month
You match all required certs for these. DW-00312 starts soonest — worth
applying if you're available Monday."
```

The crew member can then tap a job reference (DW-00312) to navigate directly to that job's detail view or apply.

---

## How It Works

### Data Flow

1. **Crew sends message** to Docky.
2. **Server-side**, before calling the LLM, a new function `searchMatchingJobs(personId, supabase)` queries:
   - Active `dayworks` where: role matches crew's primary/desired role, location matches crew's port/city/region, crew has all required certs (soft match for daywork — advisory, not blocking), dates overlap crew's availability window.
   - Active `permanent_postings` where: role matches, location matches, crew has all required certs (hard match — same logic as the apply cert gate), crew's permanent availability is not `not_looking`.
3. **Results** are formatted as structured context and injected into the LLM system block alongside MCA chunks and crew profile context. New section: `## MATCHING JOBS`.
4. **System prompt** instructs Docky: "When relevant, suggest specific job matches from the provided listings. Reference them by job number (DW-XXXXX or PM-XXXXX). Do not fabricate job numbers — only reference jobs from the MATCHING JOBS context."
5. **LLM response** may contain job references naturally woven into advice.
6. **Client-side**, the chat UI detects job reference patterns (`DW-\d{5}`, `PM-\d{5}`) in assistant messages and renders them as tappable links navigating to the job detail view.

### Query Design

The matching query should be lightweight — no full-text search, no vector similarity, no scoring. It's a structured filter:

```sql
-- Pseudocode, not literal SQL
SELECT dayworks.*
FROM dayworks
WHERE status = 'active'
  AND role_id = crew.primary_role_id OR role_id = crew.desired_role_id
  AND port_id IN (crew's availability port, crew's city ports)
  AND start_date >= CURRENT_DATE
ORDER BY start_date ASC
LIMIT 10
```

For permanent postings, add the cert superset check (same logic as the apply gate). Cap results at 10 to control token cost.

### Token Cost Considerations

Each matching job adds ~50-100 tokens of context (role, vessel, location, dates, rate, job number). 10 jobs = 500-1000 tokens. This is comparable to the MCA chunk context already injected. Acceptable.

The bigger question: should this run on every message, or only when the user asks about jobs? Options:

- **Always inject** — simplest, but wastes tokens on conversations about MCA regulations where jobs aren't relevant. ~500-1000 extra tokens per message.
- **Keyword trigger** — only inject when the message mentions jobs, work, apply, available, looking, etc. Risk: misses conversational context where Docky could helpfully bridge to a job suggestion without being asked.
- **LLM decides** — first call without jobs, if LLM's response would benefit from job context (detected via a lightweight check), re-call with jobs. Double latency, bad UX.

**Recommended approach:** Always inject for Pro users. The token cost is marginal compared to the crew context + MCA chunks already being sent. Let the system prompt handle when to reference them — "suggest jobs when relevant to the conversation, do not force job suggestions into unrelated answers."

---

## Subscription Gating

- **Free crew:** No job matching. Docky answers from MCA corpus only.
- **Crew Pro:** Job matching active. Docky can suggest specific postings from the live discover feed.

This is gated at the server — `searchMatchingJobs()` is only called when `isPro` is true. Free users never see job suggestions because the context is never injected.

---

## Client-Side: Job Reference Links

Job references in assistant messages (DW-00312, PM-00045) must be rendered as tappable links. Implementation:

- Parse assistant message text for patterns: `/\b(DW-\d{5}|PM-\d{5})\b/g`
- Replace matches with clickable elements
- Daywork references (DW-XXXXX) navigate to `/discover` with the job detail overlay open, or directly to a job detail page if one exists
- Permanent references (PM-XXXXX) navigate to the permanent job detail view
- If the job no longer exists (expired, cancelled), the link should show "This job is no longer available" rather than a broken page

This requires the chat message renderer to support inline interactive elements — currently it renders plain text / markdown. The link rendering is a contained change to the message bubble component.

---

## Why It's Deferred

1. **Volume dependency.** The feature's value is `f(active_postings_in_crew's_region)`. At 5 postings in Antibes, Docky suggests the same 5 jobs to every deckhand — it feels like a broken recommendation engine, not a career assistant. At 50+ postings with diversity across roles, dates, and rates, the suggestions become genuinely useful. The threshold is roughly: 20+ active postings per region per role category before this feels good.

2. **False promises.** Launching this on a sparse database trains early users to expect nothing from it. First impressions stick. Better to launch it when it reliably returns relevant results than to ship a feature that usually says "I don't see any matching jobs right now."

3. **Token cost at scale.** At high volume the query returns many matches and the token budget needs tuning. This is a good problem to have but needs attention when it happens, not speculative engineering now.

4. **Interaction design.** The best version of this feature might not be "Docky mentions jobs in conversation." It might be a dedicated "Jobs for you" section in the Docky UI, or a proactive push notification ("3 new jobs matching your profile were posted today"). These UX decisions should be informed by real usage patterns — how do crew actually use Docky? What do they ask? Do they ask about jobs, or is that a behaviour we'd be forcing?

---

## What It Is NOT

- **NOT an AI recommendation feed.** Docky does not rank jobs, score them, or present them in a "for you" algorithmic feed. It answers questions and, when relevant, mentions specific live postings that match the crew's declared profile. The crew still browses and applies through the normal discover flow. Docky is a guide, not a curator.

- **NOT a replacement for discover/browse.** The discover feed remains the primary job discovery mechanism. Docky supplements it with conversational context — "you asked about deckhand work in Antibes, here are 3 postings" — but does not replace the structured browse experience. Crew should never feel they need to ask Docky to find jobs.

- **NOT scoring or ranking jobs.** Docky does not say "this job is a 90% match" or "this is your best option." It presents factual information: the job exists, it matches your role and location, you have the required certs. The crew member evaluates fit. No algorithmic bias, no hidden weighting, no engagement optimization.

- **NOT a job alert system.** Docky does not proactively notify crew about new jobs. It responds to questions. If the crew asks "any new deckhand jobs?" Docky checks the current postings. It does not push "new job posted!" messages outside of conversation. (A separate job alert feature via push/email could exist independently of Docky.)

- **NOT personalised to employer preferences.** Docky does not factor in employer behaviour, hiring patterns, or "employers like you tend to get hired for X." It matches on declared, structured data: role, certs, location, availability. No learned preferences, no collaborative filtering, no "crew who applied to this also applied to that."

- **NOT a way to bypass the discover feed's fairness.** All crew see the same discover feed, sorted by recency, no boosts. Docky mentioning a job in conversation does not give that job or that crew member any ranking advantage. The job was already visible in the feed to anyone who scrolled to it. Docky just saves a search.

---

## Prerequisites Before Building

1. **Platform volume:** 20+ active postings per region per major role category, sustained over weeks (not a spike).
2. **Docky personalised advice shipped and stable:** The `buildCrewContext()` gating must be working in production. Job matching layers on top of profile context — don't stack two unshipped features.
3. **Crew usage patterns observed:** At least 1-2 months of Docky usage data (from `docky_interactions` table) showing what crew actually ask about. If nobody asks about jobs in Docky, this feature solves a problem that doesn't exist.
4. **Token budget validated:** Run the matching query against real production data, measure context size, validate that total system block (MCA chunks + crew context + matching jobs) stays within model context limits and acceptable cost per message.

---

## Implementation Checklist (for when this ships)

- [ ] `searchMatchingJobs(personId, supabase)` in `apps/web/src/lib/advisor/` — queries active dayworks + permanent_postings by role, location, certs, availability
- [ ] Format results as structured context block for LLM injection
- [ ] Add "MATCHING JOBS" section to `buildSystemBlock()` in `apps/web/src/lib/advisor/llm.ts`
- [ ] System prompt instructions: reference jobs by number, only from provided context, never fabricate
- [ ] Gate behind `isPro` — `searchMatchingJobs()` only called when `isPro` is true
- [ ] Chat UI: detect `DW-\d{5}` and `PM-\d{5}` patterns in assistant messages, render as tappable links
- [ ] Link navigation: daywork to discover detail overlay, permanent to permanent detail view
- [ ] Expired/cancelled job reference handling (graceful "no longer available" instead of broken page)
- [ ] Token budget validation against production data
- [ ] Update billing page feature list to include job matching as a Crew Pro (or higher tier) benefit
