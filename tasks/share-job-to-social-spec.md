# Share Job to Social — Feature Spec

> **Status:** IMPLEMENTED (Stage 200). API at `apps/web/src/app/api/jobs/[jobNumber]/route.ts`, public page at `apps/web/src/app/jobs/[jobNumber]/page.tsx` with dynamic OG metadata via `generateMetadata()`, share button via `ShareJobButton` component, middleware allows unauthenticated `/jobs/*` access. Retained as architectural reference; not a planning artifact.
> **Priority:** High — this is the primary organic acquisition channel. Every shared job is a signup funnel.
> **Decision date:** 2026-04-05.

---

## Why This Matters

DockWalker has no marketing budget. The organic acquisition loop is:

1. Captain posts a daywork job on DockWalker
2. Captain shares the job link to their WhatsApp group / crew agent Telegram / marina noticeboard
3. 30 crew see a rich preview card: "Deckhand — Antibes — 3 days — EUR 250/day"
4. 5 tap through to a public job detail page
5. 3 sign up to apply
6. Those 3 now have profiles, see other jobs, set availability, come back

This is the WhatsApp-to-signup flywheel. It works because:

- **No contact info is shown.** The captain can't just post their phone number in the WhatsApp message — the job detail page shows the role, vessel, dates, rate, and a "Sign up to apply" button. Nothing else. Crew MUST use the platform.
- **The preview card does the selling.** WhatsApp, iMessage, Telegram, and LinkedIn all render OG meta tags as rich preview cards. A card showing "Deckhand — M/Y Serenity — Antibes — EUR 250/day" with the DockWalker brand is more compelling than a plain URL.
- **Employers share their own postings.** This isn't crew sharing jobs with friends (though they can) — it's employers broadcasting their postings to their existing networks, pulling those networks onto DockWalker.
- **Agents share at scale.** An agent with 10 active postings shares all 10 to their WhatsApp broadcast list of 200 crew. That's 200 potential signups per agent per posting cycle.

The feature is small. The acquisition leverage is enormous.

---

## Architecture

### Current State

Every page and API route in DockWalker requires authentication. The app layout (`apps/web/src/app/(app)/`) wraps all pages with auth checks, sidebar, bottom nav. The middleware redirects unauthenticated users to `/auth/login`.

A shared link to `/discover` or any existing page dumps the recipient at a login wall before they see anything. This kills the share loop — nobody signs up for an app they can't preview.

### Target State

A new public route `/jobs/[jobNumber]` renders a standalone job detail page without requiring authentication. It sits outside the `(app)` layout — no sidebar, no bottom nav, no auth guard. It has its own minimal layout: DockWalker branding, job details, signup CTA.

The page has dynamic OG meta tags so WhatsApp/iMessage/LinkedIn render a rich preview card when the link is shared.

A share button on job cards (in the authenticated app) generates the public URL and triggers the native share sheet.

---

## Components

### 1. Public Job Detail API Route

**Path:** `apps/web/src/app/api/jobs/[jobNumber]/route.ts`
**Method:** GET
**Auth:** None required (public endpoint)

**Behaviour:**

- Parse `jobNumber` from URL params (e.g., "DW-00312" or "PM-00045")
- Determine type from prefix: `DW-` = daywork, `PM-` = permanent
- Query `dayworks` or `permanent_postings` by `job_number` where `status = 'active'`
- If not found or not active: return 404 `{ error: 'job_not_found' }`
- Hydrate: join role name, port/city/region names, cert names, experience bracket name, vessel public data (via `get_vessel_public` or direct query — NDA vessels show "NDA Vessel" as name, no IMO)
- Use service role client (no auth context available)

**Response shape:**

```typescript
{
  job_number: string;           // "DW-00312"
  type: 'daywork' | 'permanent';
  role_name: string;            // "Deckhand"
  department: string;           // "deck"
  vessel_name: string;          // "M/Y Serenity" or "NDA Vessel"
  vessel_type: string;          // "motor" | "sail"
  size_band: string;            // "40-60m"
  loa_meters: number | null;
  region: string;               // "Antibes"
  city: string;                 // "Antibes"
  port: string;                 // "Port Vauban"
  // Daywork-specific:
  start_date?: string;
  end_date?: string;
  working_days?: number;
  day_rate?: number;
  currency?: string;
  meals?: string[];
  positions_available?: number;
  permanent_opportunity?: boolean;
  // Permanent-specific:
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  salary_period?: string;
  contract_type?: string;
  live_aboard?: boolean;
  shortlist_cap?: number;
  // Shared:
  required_certs: string[];     // cert names, not IDs
  required_languages: string[];
  experience_bracket: string | null;
  description: string | null;
  notes: string | null;
  created_at: string;
}
```

**What is NOT returned:**

- `poster_person_id` — no employer identity
- `poster_name` — no employer name (crew must sign up to see who posted)
- `imo_number` — never on public endpoints
- `positions_filled` — crew-facing rule: never show fill count
- Any crew data, applicant data, engagement data

**Rate limiting:** This is a public endpoint. Apply the existing global rate limit (100/60s). Consider a tighter per-IP limit if abuse is observed (scraping job data).

### 2. Public Job Detail Page

**Path:** `apps/web/src/app/jobs/[jobNumber]/page.tsx`
**Layout:** Own layout, NOT inside `(app)`. Minimal: DockWalker logo header, no nav, no sidebar.

**Content (top to bottom):**

```
[DockWalker logo — small, top-left]

[Department background image — same as discover cards]

[Role name + epaulette badge]
[Vessel: M/Y Serenity — 45m Motor Yacht]  (or "NDA Vessel — 40-60m Motor Yacht")
[Location: Port Vauban, Antibes]

[Key details grid:]
  Dates: 14 Apr — 16 Apr (3 working days)     OR    Start: ASAP
  Rate: EUR 250/day                             OR    Salary: EUR 3,000-3,500/month
  Positions: 2                                        Contract: Seasonal
  Experience: Junior (0-2 years)                      Live aboard: Yes
  Meals: Breakfast, Lunch

[Required certifications — pill badges]
[Required languages — pill badges]

[Notes / Description — if present]

[Posted X days ago — DW-00312]

---

[CTA section — full width, sticky on mobile:]
  "Sign up to apply on DockWalker"  [Large primary button → /auth/signup?returnTo=/discover]
  "Already have an account? Log in" [Text link → /auth/login?returnTo=/discover]

[Footer: one-liner]
  "DockWalker — Superyacht hiring, simplified"
```

**If job not found / inactive:**

```
[DockWalker logo]

"This job is no longer available"
"Browse active daywork and permanent positions on DockWalker."

[CTA: "Browse jobs" → /auth/signup]
```

**Styling:**

- Match the app's design language (dark theme, department images, pill badges) but simplified — no interactive elements, no filters, no swipe
- Mobile-first, responsive (this will primarily be viewed on phones from WhatsApp taps)
- Fast — no client-side data fetching, server-render everything. This page must load in <1 second on a 3G connection. Every millisecond of delay between the WhatsApp tap and seeing the job is a lost signup.

### 3. Dynamic OG Meta Tags

**In the page's `generateMetadata()` function:**

```typescript
// Daywork example:
title: "Deckhand — Antibes, 3 days, €250/day — DockWalker"
description: "M/Y Serenity is looking for a deckhand in Port Vauban, Antibes. 14-16 Apr, €250/day. Apply on DockWalker."

// Permanent example:
title: "Chief Stewardess — Palma, €4,000/month — DockWalker"
description: "Permanent position on M/Y Atlas in Palma. Seasonal contract, live aboard. Apply on DockWalker."

// NDA vessel:
title: "Deckhand — Antibes, 3 days, €250/day — DockWalker"
description: "A 40-60m motor yacht is looking for a deckhand in Antibes. Apply on DockWalker."

// Shared:
openGraph: {
  type: 'website',
  siteName: 'DockWalker',
  images: [{ url: '/images/brand/og-image.png', width: 1200, height: 630 }],
}
```

**OG image:** Use the static brand OG image (from `tasks/founder-drafts.md` § 7) for now. A future enhancement could generate dynamic OG images per job (with role, rate, location baked into the image) using Vercel OG (`@vercel/og`) — but the static image is fine for launch. The title and description do the heavy lifting in the preview card.

**Twitter card:** Include `twitter:card = summary_large_image` for X/Twitter sharing.

### 4. Share Button

**Component:** `apps/web/src/components/share-job-button.tsx`

```typescript
interface ShareJobButtonProps {
  jobNumber: string; // "DW-00312"
  roleName: string; // "Deckhand"
  location: string; // "Antibes"
  rate: string; // "€250/day" or "€3,000-3,500/month"
}
```

**Behaviour:**

- Constructs share URL: `https://www.dockwalker.io/jobs/${jobNumber}`
- Constructs share text: `${roleName} needed in ${location} — ${rate}. Apply on DockWalker.`
- On tap: calls `navigator.share({ title, text, url })` if available (covers WhatsApp, iMessage, Telegram, email on mobile browsers)
- Fallback (desktop or browsers without Web Share API): copy URL to clipboard, show toast "Link copied"
- Icon: share/external-link icon, small, unobtrusive

**Placement (3 locations):**

1. **Discover cards (crew view)** — small share icon in the card footer or detail view. Crew sharing a job they saw to their WhatsApp group. Secondary placement — crew sharing is nice-to-have, not the primary loop.
2. **My Jobs cards (employer/agent view)** — share icon on each active posting card. THIS IS THE PRIMARY PLACEMENT. The employer just posted a job and wants to broadcast it. Make this prominent.
3. **Public job detail page** — share button on the page itself, for re-sharing. Someone who received the link can share it further.

### 5. Middleware Update

**In `apps/web/src/middleware.ts`:**

- Add `/jobs/*` to the public route allowlist (alongside `/`, `/auth/*`, `/api/health`, etc.)
- The `/api/jobs/*` route also needs to bypass auth — add to the API public allowlist

---

## What It Is NOT

- **NOT a public job board.** There is no `/jobs` index page. No browse. No search. No filters. Only individual jobs are accessible via direct link. The discover feed remains private, behind auth. If someone wants to browse, they sign up. The public page is a teaser for one specific job — enough to create intent, not enough to replace the app.

- **NOT a way to apply without signing up.** The public page has no apply button, no message input, no interaction beyond "sign up" / "log in." The entire point is that the job is visible but the action requires an account.

- **NOT an SEO play (yet).** The pages are not indexed by default — add `robots: noindex` initially. SEO indexing of job pages is a separate decision with its own implications (stale job pages in Google, crawl budget, structured data markup). Can be enabled later with proper `robots.txt` rules and expiry handling. For now, these pages exist only for direct sharing, not search engine discovery.

- **NOT a data leak.** No employer identity, no IMO numbers, no applicant data, no fill counts. The public page shows strictly what a crew member would see on a discover card — minus the poster name (which requires auth). NDA vessels show "NDA Vessel" with size band and type only.

- **NOT an embed or widget.** The page is a standalone web page, not an iframe-able component. No embed codes, no API for third-party integration. If agencies want to embed DockWalker jobs on their website, that's a separate feature with its own auth and branding considerations.

---

## Edge Cases

**Job expires or is cancelled after being shared:**
The link stays alive but the page shows "This job is no longer available" with a signup CTA to browse other jobs. Links shared in WhatsApp groups persist forever — this page must gracefully handle stale links for months or years.

**NDA vessel:**
Vessel name shows as "NDA Vessel". Vessel type and size band still shown (e.g., "NDA Vessel — 40-60m Motor Yacht"). No IMO. This is consistent with how NDA vessels appear in the authenticated discover feed.

**Job number collision / invalid format:**
If the job number doesn't match `DW-\d{5}` or `PM-\d{5}`, return 404 immediately. Don't query the database with garbage input.

**Rate limiting / scraping:**
Public endpoints are scraping targets. The global rate limit (100 req/60s per IP) applies. If systematic scraping is detected (sequential job number enumeration), consider adding a tighter per-IP limit on `/api/jobs/*` specifically. Job numbers are sequential, so enumeration is trivial — but the data exposed is intentionally limited (no employer identity, no crew data), so the scraping value is low.

**Canonical URL:**
Each public job page should have `<link rel="canonical" href="https://www.dockwalker.io/jobs/DW-00312" />` to prevent duplicate content issues if the same job is somehow accessible via multiple paths.

---

## Metrics (post-launch)

Track these to measure the acquisition loop effectiveness:

- **Share events:** How many times the share button is tapped (client-side analytics event)
- **Public page views:** How many times `/jobs/*` pages are loaded (Vercel Analytics already tracks this)
- **Signup conversion:** Of public page visitors, how many click "Sign up" and complete registration. Requires `returnTo` param to attribute signups to shared jobs.
- **Share-to-signup ratio:** The funnel: share tap → page view → signup click → registration complete → first application

These use existing analytics infrastructure (Vercel Analytics + Sentry). No new tracking code needed beyond one client-side event on the share button tap.

---

## Implementation Checklist

**API:**

- [ ] `GET /api/jobs/[jobNumber]/route.ts` — public, no auth, service role client
- [ ] Parse job number prefix (DW/PM), query correct table, validate active status
- [ ] Hydrate role, location, certs, vessel (NDA-safe), experience bracket
- [ ] Return 404 for inactive/missing/malformed job numbers

**Page:**

- [ ] `apps/web/src/app/jobs/[jobNumber]/page.tsx` — outside `(app)` layout
- [ ] `apps/web/src/app/jobs/[jobNumber]/layout.tsx` — minimal layout (logo header, no nav)
- [ ] Server-rendered job detail with department image, role badge, key details grid, cert/language pills
- [ ] "This job is no longer available" fallback state with signup CTA
- [ ] `generateMetadata()` with dynamic OG title, description, image
- [ ] `robots: noindex` meta tag (disable search indexing initially)
- [ ] `<link rel="canonical">` tag

**Share button:**

- [ ] `apps/web/src/components/share-job-button.tsx` — Web Share API with clipboard fallback
- [ ] Place on My Jobs cards (employer/agent — primary placement)
- [ ] Place on discover card detail view (crew — secondary)
- [ ] Place on public job detail page (re-sharing)

**Middleware:**

- [ ] Add `/jobs/*` to public route allowlist
- [ ] Add `/api/jobs/*` to API public allowlist

**Static OG image:**

- [ ] Create `apps/web/public/images/brand/og-image.png` per spec in `tasks/founder-drafts.md` § 7 (1200x630, dark navy, logo, tagline) — if not already present
