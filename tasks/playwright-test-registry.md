# Playwright Test Registry

> Maintained by the visual testing agent. Do not edit manually unless correcting stale data.
> All timestamps are UTC to the minute.

## Last Tested Commit

`d41bc90` — 2026-03-26T15:58

## Run History

| Timestamp        | Commit Range      | Spec Files Run                                     | Total | Passed | Failed | Notes                                                                 |
| ---------------- | ----------------- | -------------------------------------------------- | ----- | ------ | ------ | --------------------------------------------------------------------- |
| 2026-03-26T15:30 | initial → d41bc90 | smoke, employer, crew, crew-alt, agent, onboarding | 179   | 179    | 0      | Full page-load + visual baselines, 5 users                            |
| 2026-03-26T15:45 | (same)            | interactions                                       | 19    | 19     | 0      | Engagement state review pages + message threads                       |
| 2026-03-26T15:50 | (same)            | consistency                                        | 22    | 22     | 0      | Cross-role/cross-form comparison baselines                            |
| 2026-03-26T15:58 | (same)            | edge-cases                                         | 24    | 24     | 0      | Invalid URLs, form validation, modals, hat switching, templates, tabs |

## Spec File Index

| Spec File            | Tests | Last Run         | Status   | What It Covers                                                                        |
| -------------------- | ----- | ---------------- | -------- | ------------------------------------------------------------------------------------- |
| smoke.spec.ts        | 14x2  | 2026-03-26T15:30 | ALL PASS | Public pages, auth redirects, visual baselines (mobile + desktop)                     |
| employer.spec.ts     | 20x2  | 2026-03-26T15:30 | ALL PASS | Employer pages, hat routing, visual baselines (mobile + desktop)                      |
| crew.spec.ts         | 22x2  | 2026-03-26T15:30 | ALL PASS | Crew pages, hat routing, role gates, visual baselines (mobile + desktop)              |
| crew-alt.spec.ts     | 8     | 2026-03-26T15:30 | ALL PASS | Green crew (different location, fewer certs, no engagements)                          |
| agent.spec.ts        | 23x2  | 2026-03-26T15:30 | ALL PASS | Agent pages, market feed, discover redirect, visual baselines                         |
| onboarding.spec.ts   | 8     | 2026-03-26T15:30 | ALL PASS | Unboarded user gate tests                                                             |
| interactions.spec.ts | 14    | 2026-03-26T15:45 | ALL PASS | DW-01–DW-10 review pages, message threads (employer + crew)                           |
| consistency.spec.ts  | 22    | 2026-03-26T15:50 | ALL PASS | Form comparison, profile comparison, nav comparison, shared pages                     |
| edge-cases.spec.ts   | 19    | 2026-03-26T15:58 | ALL PASS | Invalid URLs, form validation, modals, hat switch, templates, invitation/applied tabs |

## Test Scenarios

### Public (no auth) — smoke.spec.ts

| ID    | Scenario                           | Route                   | Last Run         | Status |
| ----- | ---------------------------------- | ----------------------- | ---------------- | ------ |
| S-001 | Landing page — title branding      | `/`                     | 2026-03-26T15:30 | PASS   |
| S-002 | Landing page — sign-up/login links | `/`                     | 2026-03-26T15:30 | PASS   |
| S-003 | Landing page — returns 2xx         | `/`                     | 2026-03-26T15:30 | PASS   |
| S-004 | Visual — landing page              | `/`                     | 2026-03-26T15:30 | PASS   |
| S-005 | Login page — form renders          | `/auth/login`           | 2026-03-26T15:30 | PASS   |
| S-006 | Visual — login page                | `/auth/login`           | 2026-03-26T15:30 | PASS   |
| S-007 | Signup page — form renders         | `/auth/signup`          | 2026-03-26T15:30 | PASS   |
| S-008 | Visual — signup page               | `/auth/signup`          | 2026-03-26T15:30 | PASS   |
| S-009 | Forgot password — form renders     | `/auth/forgot-password` | 2026-03-26T15:30 | PASS   |
| S-010 | Visual — forgot password page      | `/auth/forgot-password` | 2026-03-26T15:30 | PASS   |
| S-011 | Redirect — dashboard to login      | `/dashboard`            | 2026-03-26T15:30 | PASS   |
| S-012 | Redirect — discover to login       | `/discover`             | 2026-03-26T15:30 | PASS   |
| S-013 | Redirect — profile to login        | `/profile`              | 2026-03-26T15:30 | PASS   |
| S-014 | Redirect — messages to login       | `/messages`             | 2026-03-26T15:30 | PASS   |

### Employer (e@1) — employer.spec.ts

| ID    | Scenario                             | Route            | Last Run         | Status |
| ----- | ------------------------------------ | ---------------- | ---------------- | ------ |
| E-001 | Dashboard redirects to /daywork/mine | `/dashboard`     | 2026-03-26T15:30 | PASS   |
| E-002 | / redirects to /daywork/mine         | `/`              | 2026-03-26T15:30 | PASS   |
| E-003 | Daywork/mine loads with postings     | `/daywork/mine`  | 2026-03-26T15:30 | PASS   |
| E-004 | Visual — daywork/mine                | `/daywork/mine`  | 2026-03-26T15:30 | PASS   |
| E-005 | Post job — type selector loads       | `/daywork/post`  | 2026-03-26T15:30 | PASS   |
| E-006 | Visual — post job type selector      | `/daywork/post`  | 2026-03-26T15:30 | PASS   |
| E-007 | Vessels page loads                   | `/vessels`       | 2026-03-26T15:30 | PASS   |
| E-008 | Visual — vessels page                | `/vessels`       | 2026-03-26T15:30 | PASS   |
| E-009 | Profile page loads                   | `/profile`       | 2026-03-26T15:30 | PASS   |
| E-010 | Visual — profile page                | `/profile`       | 2026-03-26T15:30 | PASS   |
| E-011 | Settings page loads                  | `/settings`      | 2026-03-26T15:30 | PASS   |
| E-012 | Visual — settings page               | `/settings`      | 2026-03-26T15:30 | PASS   |
| E-013 | Billing page loads                   | `/billing`       | 2026-03-26T15:30 | PASS   |
| E-014 | Visual — billing page                | `/billing`       | 2026-03-26T15:30 | PASS   |
| E-015 | Notifications page loads             | `/notifications` | 2026-03-26T15:30 | PASS   |
| E-016 | Visual — notifications page          | `/notifications` | 2026-03-26T15:30 | PASS   |
| E-017 | Messages page loads                  | `/messages`      | 2026-03-26T15:30 | PASS   |
| E-018 | Visual — messages page               | `/messages`      | 2026-03-26T15:30 | PASS   |
| E-019 | Docky AI page loads                  | `/docky`         | 2026-03-26T15:30 | PASS   |
| E-020 | Visual — docky page                  | `/docky`         | 2026-03-26T15:30 | PASS   |

### Crew (c@1) — crew.spec.ts

| ID    | Scenario                            | Route                     | Last Run         | Status |
| ----- | ----------------------------------- | ------------------------- | ---------------- | ------ |
| C-001 | Dashboard redirects to /discover    | `/dashboard`              | 2026-03-26T15:30 | PASS   |
| C-002 | / redirects to /discover            | `/`                       | 2026-03-26T15:30 | PASS   |
| C-003 | Discover page loads                 | `/discover`               | 2026-03-26T15:30 | PASS   |
| C-004 | Visual — discover page              | `/discover`               | 2026-03-26T15:30 | PASS   |
| C-005 | Availability page loads             | `/availability`           | 2026-03-26T15:30 | PASS   |
| C-006 | Visual — availability page          | `/availability`           | 2026-03-26T15:30 | PASS   |
| C-007 | Profile page loads                  | `/profile`                | 2026-03-26T15:30 | PASS   |
| C-008 | Visual — profile page               | `/profile`                | 2026-03-26T15:30 | PASS   |
| C-009 | Add experience page loads           | `/profile/add-experience` | 2026-03-26T15:30 | PASS   |
| C-010 | Visual — add experience page        | `/profile/add-experience` | 2026-03-26T15:30 | PASS   |
| C-011 | Messages page loads                 | `/messages`               | 2026-03-26T15:30 | PASS   |
| C-012 | Visual — messages page              | `/messages`               | 2026-03-26T15:30 | PASS   |
| C-013 | Settings page loads                 | `/settings`               | 2026-03-26T15:30 | PASS   |
| C-014 | Visual — settings page              | `/settings`               | 2026-03-26T15:30 | PASS   |
| C-015 | Billing page loads                  | `/billing`                | 2026-03-26T15:30 | PASS   |
| C-016 | Visual — billing page               | `/billing`                | 2026-03-26T15:30 | PASS   |
| C-017 | Notifications page loads            | `/notifications`          | 2026-03-26T15:30 | PASS   |
| C-018 | Visual — notifications page         | `/notifications`          | 2026-03-26T15:30 | PASS   |
| C-019 | Docky AI page loads                 | `/docky`                  | 2026-03-26T15:30 | PASS   |
| C-020 | Visual — docky page                 | `/docky`                  | 2026-03-26T15:30 | PASS   |
| C-021 | Post job page renders for crew      | `/daywork/post`           | 2026-03-26T15:30 | PASS   |
| C-022 | Daywork/mine shows crew perspective | `/daywork/mine`           | 2026-03-26T15:30 | PASS   |

### Agent (a@1) — agent.spec.ts

| ID    | Scenario                                | Route              | Last Run         | Status |
| ----- | --------------------------------------- | ------------------ | ---------------- | ------ |
| G-001 | Dashboard redirects to /daywork/mine    | `/dashboard`       | 2026-03-26T15:30 | PASS   |
| G-002 | / redirects to /daywork/mine            | `/`                | 2026-03-26T15:30 | PASS   |
| G-003 | /discover redirects to /discover/market | `/discover`        | 2026-03-26T15:30 | PASS   |
| G-004 | Market feed loads                       | `/discover/market` | 2026-03-26T15:30 | PASS   |
| G-005 | Visual — market feed                    | `/discover/market` | 2026-03-26T15:30 | PASS   |
| G-006 | Daywork/mine loads                      | `/daywork/mine`    | 2026-03-26T15:30 | PASS   |
| G-007 | "View job market" button visible        | `/daywork/mine`    | 2026-03-26T15:30 | PASS   |
| G-008 | Visual — daywork/mine (agent)           | `/daywork/mine`    | 2026-03-26T15:30 | PASS   |
| G-009 | Post job — type selector                | `/daywork/post`    | 2026-03-26T15:30 | PASS   |
| G-010 | Visual — post job (agent)               | `/daywork/post`    | 2026-03-26T15:30 | PASS   |
| G-011 | Profile loads with agent sections       | `/profile`         | 2026-03-26T15:30 | PASS   |
| G-012 | Profile shows agency name               | `/profile`         | 2026-03-26T15:30 | PASS   |
| G-013 | Visual — profile (agent)                | `/profile`         | 2026-03-26T15:30 | PASS   |
| G-014 | Vessels page loads                      | `/vessels`         | 2026-03-26T15:30 | PASS   |
| G-015 | Visual — vessels (agent)                | `/vessels`         | 2026-03-26T15:30 | PASS   |
| G-016 | Messages page loads (empty)             | `/messages`        | 2026-03-26T15:30 | PASS   |
| G-017 | Visual — messages (agent)               | `/messages`        | 2026-03-26T15:30 | PASS   |
| G-018 | Settings page loads                     | `/settings`        | 2026-03-26T15:30 | PASS   |
| G-019 | Visual — settings (agent)               | `/settings`        | 2026-03-26T15:30 | PASS   |
| G-020 | Billing page loads                      | `/billing`         | 2026-03-26T15:30 | PASS   |
| G-021 | Visual — billing (agent)                | `/billing`         | 2026-03-26T15:30 | PASS   |
| G-022 | Notifications page loads                | `/notifications`   | 2026-03-26T15:30 | PASS   |
| G-023 | Visual — notifications (agent)          | `/notifications`   | 2026-03-26T15:30 | PASS   |

### Crew-Alt (g@1) — crew-alt.spec.ts

| ID    | Scenario                                 | Route           | Last Run         | Status |
| ----- | ---------------------------------------- | --------------- | ---------------- | ------ |
| A-001 | Discover page loads (different location) | `/discover`     | 2026-03-26T15:30 | PASS   |
| A-002 | Visual — discover (Palma user)           | `/discover`     | 2026-03-26T15:30 | PASS   |
| A-003 | Profile page loads (fewer certs)         | `/profile`      | 2026-03-26T15:30 | PASS   |
| A-004 | Visual — profile (fewer certs)           | `/profile`      | 2026-03-26T15:30 | PASS   |
| A-005 | Availability page loads (empty state)    | `/availability` | 2026-03-26T15:30 | PASS   |
| A-006 | Visual — availability (empty state)      | `/availability` | 2026-03-26T15:30 | PASS   |
| A-007 | Messages page loads (empty state)        | `/messages`     | 2026-03-26T15:30 | PASS   |
| A-008 | Visual — messages (empty state)          | `/messages`     | 2026-03-26T15:30 | PASS   |

### Onboarding (d@1) — onboarding.spec.ts

| ID    | Scenario                              | Route         | Last Run         | Status |
| ----- | ------------------------------------- | ------------- | ---------------- | ------ |
| O-001 | Landing redirects to /onboarding      | `/`           | 2026-03-26T15:30 | PASS   |
| O-002 | Dashboard redirects to /onboarding    | `/dashboard`  | 2026-03-26T15:30 | PASS   |
| O-003 | Discover redirects to /onboarding     | `/discover`   | 2026-03-26T15:30 | PASS   |
| O-004 | Profile redirects to /onboarding      | `/profile`    | 2026-03-26T15:30 | PASS   |
| O-005 | Settings redirects to /onboarding     | `/settings`   | 2026-03-26T15:30 | PASS   |
| O-006 | Vessels redirects to /onboarding      | `/vessels`    | 2026-03-26T15:30 | PASS   |
| O-007 | Onboarding page loads with form/steps | `/onboarding` | 2026-03-26T15:30 | PASS   |
| O-008 | Visual — onboarding page              | `/onboarding` | 2026-03-26T15:30 | PASS   |

### Interactions — interactions.spec.ts

| ID    | Scenario                                        | Route                 | Last Run         | Status |
| ----- | ----------------------------------------------- | --------------------- | ---------------- | ------ |
| I-001 | DW-01 review — active + invited (employer)      | `/daywork/.../review` | 2026-03-26T15:45 | PASS   |
| I-002 | DW-05 review — shortlisted (employer)           | `/daywork/.../review` | 2026-03-26T15:45 | PASS   |
| I-003 | DW-06 review — in-progress (employer)           | `/daywork/.../review` | 2026-03-26T15:45 | PASS   |
| I-004 | DW-07 review — completed + rated (employer)     | `/daywork/.../review` | 2026-03-26T15:45 | PASS   |
| I-005 | DW-08 review — disputed (employer)              | `/daywork/.../review` | 2026-03-26T15:45 | PASS   |
| I-006 | DW-09 review — cancelled by crew (employer)     | `/daywork/.../review` | 2026-03-26T15:45 | PASS   |
| I-007 | DW-10 review — cancelled by employer (employer) | `/daywork/.../review` | 2026-03-26T15:45 | PASS   |
| I-008 | DW-06 message thread (employer)                 | `/messages/[id]`      | 2026-03-26T15:45 | PASS   |
| I-009 | DW-04 review — applied pending (crew)           | `/daywork/.../review` | 2026-03-26T15:45 | PASS   |
| I-010 | DW-05 review — shortlisted (crew)               | `/daywork/.../review` | 2026-03-26T15:45 | PASS   |
| I-011 | DW-06 review — in-progress + checklist (crew)   | `/daywork/.../review` | 2026-03-26T15:45 | PASS   |
| I-012 | DW-07 review — completed + rated (crew)         | `/daywork/.../review` | 2026-03-26T15:45 | PASS   |
| I-013 | DW-02 review — NDA vessel (crew)                | `/daywork/.../review` | 2026-03-26T15:45 | PASS   |
| I-014 | DW-06 message thread + checklist (crew)         | `/messages/[id]`      | 2026-03-26T15:45 | PASS   |

### Consistency — consistency.spec.ts

| ID    | Scenario                                 | Route(s)         | Last Run         | Status |
| ----- | ---------------------------------------- | ---------------- | ---------------- | ------ |
| X-001 | Daywork form — cert/language section     | `/daywork/post`  | 2026-03-26T15:50 | PASS   |
| X-002 | Permanent form — cert/language section   | `/daywork/post`  | 2026-03-26T15:50 | PASS   |
| X-003 | Daywork form — role/location selectors   | `/daywork/post`  | 2026-03-26T15:50 | PASS   |
| X-004 | Permanent form — role/location selectors | `/daywork/post`  | 2026-03-26T15:50 | PASS   |
| X-005 | Profile layout — employer                | `/profile`       | 2026-03-26T15:50 | PASS   |
| X-006 | Profile layout — crew                    | `/profile`       | 2026-03-26T15:50 | PASS   |
| X-007 | Profile layout — crew-alt                | `/profile`       | 2026-03-26T15:50 | PASS   |
| X-008 | Profile layout — agent                   | `/profile`       | 2026-03-26T15:50 | PASS   |
| X-009 | Empty notifications — employer           | `/notifications` | 2026-03-26T15:50 | PASS   |
| X-010 | Empty notifications — crew               | `/notifications` | 2026-03-26T15:50 | PASS   |
| X-011 | Empty messages — crew-alt                | `/messages`      | 2026-03-26T15:50 | PASS   |
| X-012 | Empty messages — agent                   | `/messages`      | 2026-03-26T15:50 | PASS   |
| X-013 | Empty notifications — agent              | `/notifications` | 2026-03-26T15:50 | PASS   |
| X-014 | Bottom nav — employer                    | `/daywork/mine`  | 2026-03-26T15:50 | PASS   |
| X-015 | Bottom nav — crew                        | `/discover`      | 2026-03-26T15:50 | PASS   |
| X-016 | Bottom nav — agent                       | `/daywork/mine`  | 2026-03-26T15:50 | PASS   |
| X-017 | Settings — employer                      | `/settings`      | 2026-03-26T15:50 | PASS   |
| X-018 | Settings — crew                          | `/settings`      | 2026-03-26T15:50 | PASS   |
| X-019 | Settings — agent                         | `/settings`      | 2026-03-26T15:50 | PASS   |
| X-020 | Billing — employer                       | `/billing`       | 2026-03-26T15:50 | PASS   |
| X-021 | Billing — crew                           | `/billing`       | 2026-03-26T15:50 | PASS   |
| X-022 | Billing — agent                          | `/billing`       | 2026-03-26T15:50 | PASS   |

### Edge Cases — edge-cases.spec.ts

| ID    | Scenario                                       | Route                 | Last Run         | Status |
| ----- | ---------------------------------------------- | --------------------- | ---------------- | ------ |
| D-001 | Invalid daywork ID — employer                  | `/daywork/.../review` | 2026-03-26T15:58 | PASS   |
| D-002 | Invalid vessel edit ID                         | `/vessels/.../edit`   | 2026-03-26T15:58 | PASS   |
| D-003 | Invalid message engagement ID — crew           | `/messages/...`       | 2026-03-26T15:58 | PASS   |
| D-004 | Garbage URL — crew                             | `/daywork/not-a-uuid` | 2026-03-26T15:58 | PASS   |
| D-005 | Empty daywork form validation                  | `/daywork/post`       | 2026-03-26T15:58 | PASS   |
| D-006 | Empty permanent form validation                | `/daywork/post`       | 2026-03-26T15:58 | PASS   |
| D-007 | Daywork form partially filled                  | `/daywork/post`       | 2026-03-26T15:58 | PASS   |
| D-008 | Hat switcher visible — employer                | `/daywork/mine`       | 2026-03-26T15:58 | PASS   |
| D-009 | Hat switch on profile                          | `/profile`            | 2026-03-26T15:58 | PASS   |
| D-010 | Cancel posting confirmation modal              | `/daywork/mine`       | 2026-03-26T15:58 | PASS   |
| D-011 | Template selector dropdown                     | `/daywork/post`       | 2026-03-26T15:58 | PASS   |
| D-012 | Templates tab on my jobs                       | `/daywork/mine`       | 2026-03-26T15:58 | PASS   |
| D-013 | Crew invitations tab                           | `/discover`           | 2026-03-26T15:58 | PASS   |
| D-014 | Crew applied tab                               | `/discover`           | 2026-03-26T15:58 | PASS   |
| D-015 | Availability gate — crew-alt (no availability) | `/discover`           | 2026-03-26T15:58 | PASS   |
| D-016 | Content overflow — employer jobs scrolled      | `/daywork/mine`       | 2026-03-26T15:58 | PASS   |
| D-017 | Permanent tab on my jobs                       | `/daywork/mine`       | 2026-03-26T15:58 | PASS   |
| D-018 | In Progress tab on my jobs                     | `/daywork/mine`       | 2026-03-26T15:58 | PASS   |
| D-019 | Done tab on my jobs                            | `/daywork/mine`       | 2026-03-26T15:58 | PASS   |

### Negative Space — negative-space.spec.ts

| ID        | Scenario                              | Route                     | Last Run         | Status |
| --------- | ------------------------------------- | ------------------------- | ---------------- | ------ |
| N-001     | Cert gate — crew blocked on PM-07     | `/permanent/.../review`   | 2026-03-26T18:30 | PASS   |
| N-002     | Cert gate — missing cert named        | `/permanent/.../review`   | 2026-03-26T18:30 | PASS   |
| N-003     | Cert gate — crew-alt also blocked     | `/permanent/.../review`   | 2026-03-26T18:30 | PASS   |
| N-004     | Availability gate — crew-alt discover | `/discover`               | 2026-03-26T18:30 | PASS   |
| N-005     | Availability gate — empty calendar    | `/availability`           | 2026-03-26T18:30 | PASS   |
| N-006     | Crew cannot post jobs (hat gate)      | `/daywork/post`           | 2026-03-26T18:30 | PASS   |
| N-007     | Employer discover shows employer view | `/discover`               | 2026-03-26T18:30 | PASS   |
| N-008     | Employer availability blocked         | `/availability`           | 2026-03-26T18:30 | PASS   |
| N-009     | NDA hidden from crew — DW-02          | `/daywork/.../review`     | 2026-03-26T18:30 | PASS   |
| N-010     | NDA hidden from crew — PM-03          | `/permanent/.../review`   | 2026-03-26T18:30 | PASS   |
| N-011     | NDA visible to employer               | `/vessels`                | 2026-03-26T18:30 | PASS   |
| N-012     | Message gate — no thread for DW-04    | `/messages`               | 2026-03-26T18:30 | PASS   |
| N-013     | Agent hat lock — no switch button     | `/profile`                | 2026-03-26T18:30 | PASS   |
| N-014     | Agent blocked from crew discover      | `/discover`               | 2026-03-26T18:30 | PASS   |
| N-015–025 | Onboarding gate — 11 protected routes | Various                   | 2026-03-26T18:30 | PASS   |
| N-026     | Employer availability page blocked    | `/availability`           | 2026-03-26T18:30 | PASS   |
| N-027     | Agent experience constraints          | `/profile/add-experience` | 2026-03-26T18:30 | PASS   |

### RLS Isolation — rls-isolation.spec.ts

| ID    | Scenario                                      | Route               | Last Run         | Status |
| ----- | --------------------------------------------- | ------------------- | ---------------- | ------ |
| R-001 | Employer sees own vessels                     | `/vessels`          | 2026-03-26T18:45 | PASS   |
| R-002 | Employer does NOT see agent vessel            | `/vessels`          | 2026-03-26T18:45 | PASS   |
| R-003 | Employer does NOT see crew-alt vessel         | `/vessels`          | 2026-03-26T18:45 | PASS   |
| R-004 | Agent sees own vessel                         | `/vessels`          | 2026-03-26T18:45 | PASS   |
| R-005 | Agent does NOT see employer vessels           | `/vessels`          | 2026-03-26T18:45 | PASS   |
| R-006 | Employer messages — own threads only          | `/messages`         | 2026-03-26T18:45 | PASS   |
| R-007 | Crew-alt messages — empty (no engagements)    | `/messages`         | 2026-03-26T18:45 | PASS   |
| R-008 | Agent messages — empty (no engagements)       | `/messages`         | 2026-03-26T18:45 | PASS   |
| R-009 | Agent my jobs — no employer postings          | `/daywork/mine`     | 2026-03-26T18:45 | PASS   |
| R-010 | Employer my jobs — own postings visible       | `/daywork/mine`     | 2026-03-26T18:45 | PASS   |
| R-011 | Agent cannot access employer vessel edit      | `/vessels/.../edit` | 2026-03-26T18:45 | PASS   |
| R-012 | Crew cannot access employer vessel edit       | `/vessels/.../edit` | 2026-03-26T18:45 | PASS   |
| R-013 | Crew experiences — own only, not other users' | `/profile`          | 2026-03-26T18:45 | PASS   |

### Planned Scenarios (added by planning agent)

| ID  | Scenario | Route | Last Run | Status | Added By |
| --- | -------- | ----- | -------- | ------ | -------- |

_No planned scenarios yet. The planning agent adds rows here when planning features._

## Route Coverage

| Route                           | Covered | Spec File(s)                                        | Users Tested             |
| ------------------------------- | ------- | --------------------------------------------------- | ------------------------ |
| `/`                             | YES     | smoke, employer, crew, agent, onboarding            | anon, e@1, c@1, a@1, d@1 |
| `/auth/login`                   | YES     | smoke                                               | anon                     |
| `/auth/signup`                  | YES     | smoke                                               | anon                     |
| `/auth/forgot-password`         | YES     | smoke                                               | anon                     |
| `/auth/reset-password`          | NO      |                                                     |                          |
| `/onboarding`                   | YES     | onboarding                                          | d@1                      |
| `/dashboard`                    | YES     | smoke, employer, crew, agent, onboarding            | anon, e@1, c@1, a@1, d@1 |
| `/discover`                     | YES     | smoke, crew, crew-alt, agent, edge-cases            | anon, c@1, g@1, a@1      |
| `/discover/market`              | YES     | agent                                               | a@1                      |
| `/daywork/mine`                 | YES     | employer, crew, agent, edge-cases                   | e@1, c@1, a@1            |
| `/daywork/post`                 | YES     | employer, crew, agent, consistency, edge-cases      | e@1, c@1, a@1            |
| `/daywork/[id]/review`          | YES     | interactions, edge-cases                            | e@1, c@1                 |
| `/permanent/[id]/review`        | YES     | permanent, negative-space                           | e@1, c@1, g@1            |
| `/messages`                     | YES     | smoke, employer, crew, crew-alt, agent              | anon, e@1, c@1, g@1, a@1 |
| `/messages/[engagementId]`      | YES     | interactions, edge-cases                            | e@1, c@1                 |
| `/notifications`                | YES     | employer, crew, agent, consistency                  | e@1, c@1, a@1            |
| `/profile`                      | YES     | smoke, employer, crew, crew-alt, agent, consistency | anon, e@1, c@1, g@1, a@1 |
| `/profile/add-experience`       | YES     | crew                                                | c@1                      |
| `/profile/edit-experience/[id]` | NO      |                                                     |                          |
| `/settings`                     | YES     | employer, crew, agent, consistency, onboarding      | e@1, c@1, a@1, d@1       |
| `/billing`                      | YES     | employer, crew, agent, consistency                  | e@1, c@1, a@1            |
| `/availability`                 | YES     | crew, crew-alt                                      | c@1, g@1                 |
| `/vessels`                      | YES     | employer, agent, onboarding                         | e@1, a@1, d@1            |
| `/vessels/[id]/edit`            | YES     | edge-cases                                          | e@1                      |
| `/docky`                        | YES     | employer, crew                                      | e@1, c@1                 |
| `/docky/[conversationId]`       | NO      |                                                     |                          |

**Coverage: 24/26 routes (92%)**
Uncovered: `/profile/edit-experience/[id]`, `/docky/[conversationId]`

## Findings Log

Issues discovered during screenshot review. Tracked in `tasks/playwright-suggestions.md`.

| ID      | Severity | Found            | Route(s) Affected             | Summary                                                           |
| ------- | -------- | ---------------- | ----------------------------- | ----------------------------------------------------------------- |
| SUG-001 | HIGH     | 2026-03-26T15:45 | `/daywork/[id]/review`        | Crew review page shows employer UI, errors out                    |
| SUG-002 | MEDIUM   | 2026-03-26T15:50 | `/profile`                    | Agent profile shows "1 Issue" error banner                        |
| SUG-003 | HIGH     | 2026-03-26T15:50 | `/discover`                   | Crew discover "No jobs found" + false "Complete profile" banner   |
| SUG-004 | HIGH     | 2026-03-26T15:50 | `/messages/[id]`              | Employer message thread infinite spinner                          |
| SUG-005 | MEDIUM   | 2026-03-26T15:50 | `/daywork/[id]/review`        | Employer review shows "No applicants" for postings that have them |
| SUG-006 | LOW      | 2026-03-26T15:50 | Various                       | Next.js dev mode error overlays                                   |
| SUG-007 | LOW      | 2026-03-26T15:50 | `/billing`                    | "Crew Pro" upsell shown to employer and agent                     |
| SUG-008 | LOW      | 2026-03-26T15:50 | Bottom nav                    | Agent has no Docky in bottom nav                                  |
| SUG-009 | MEDIUM   | 2026-03-26T15:50 | `/notifications`              | Employer notifications empty despite active engagements           |
| SUG-010 | MEDIUM   | 2026-03-26T15:55 | `/daywork/post`               | Daywork vs permanent forms use different cert/language UI         |
| SUG-011 | HIGH     | 2026-03-26T15:58 | `/daywork/mine`               | Cancel posting has no confirmation — instant and irreversible     |
| SUG-012 | MEDIUM   | 2026-03-26T15:58 | `/daywork/post`               | Form validation uses browser-native tooltips                      |
| SUG-013 | LOW      | 2026-03-26T15:58 | `/daywork/[id]/review`        | Invalid UUID renders review chrome then errors — no 404           |
| SUG-014 | MEDIUM   | 2026-03-26T15:58 | `/discover` (Invitations tab) | Tab count shows "(1)" but content is empty                        |
| SUG-015 | HIGH     | 2026-03-26T15:58 | `/discover` (Applied tab)     | Tab count shows "(8)" but content is empty                        |

## File-to-Route Mapping Reference

Used by the testing agent to determine which routes to test when files change.

```
apps/web/src/app/page.tsx                                → /
apps/web/src/app/auth/login/page.tsx                     → /auth/login
apps/web/src/app/auth/signup/page.tsx                    → /auth/signup
apps/web/src/app/auth/forgot-password/page.tsx           → /auth/forgot-password
apps/web/src/app/auth/reset-password/page.tsx            → /auth/reset-password
apps/web/src/app/onboarding/page.tsx                     → /onboarding
apps/web/src/app/(app)/dashboard/page.tsx                → /dashboard
apps/web/src/app/(app)/discover/page.tsx                 → /discover
apps/web/src/app/(app)/discover/market/page.tsx          → /discover/market
apps/web/src/app/(app)/daywork/mine/page.tsx             → /daywork/mine
apps/web/src/app/(app)/daywork/post/page.tsx             → /daywork/post
apps/web/src/app/(app)/daywork/[id]/review/page.tsx      → /daywork/[id]/review
apps/web/src/app/(app)/permanent/[id]/review/page.tsx    → /permanent/[id]/review
apps/web/src/app/(app)/messages/page.tsx                 → /messages
apps/web/src/app/(app)/messages/[engagementId]/page.tsx  → /messages/[engagementId]
apps/web/src/app/(app)/notifications/page.tsx            → /notifications
apps/web/src/app/(app)/profile/page.tsx                  → /profile
apps/web/src/app/(app)/profile/add-experience/page.tsx   → /profile/add-experience
apps/web/src/app/(app)/profile/edit-experience/[id]/page.tsx → /profile/edit-experience/[id]
apps/web/src/app/(app)/settings/page.tsx                 → /settings
apps/web/src/app/(app)/billing/page.tsx                  → /billing
apps/web/src/app/(app)/availability/page.tsx             → /availability
apps/web/src/app/(app)/vessels/page.tsx                  → /vessels
apps/web/src/app/(app)/vessels/[id]/edit/page.tsx        → /vessels/[id]/edit
apps/web/src/app/(app)/docky/page.tsx                    → /docky
apps/web/src/app/(app)/docky/[conversationId]/page.tsx   → /docky/[conversationId]

# Component changes — grep for imports to find affected routes
apps/web/src/components/*                                → grep usage to determine routes
apps/web/src/lib/*                                       → may affect any route

# Data layer changes — test routes that display affected data
packages/types/*                                         → routes consuming changed types
packages/db/*                                            → routes consuming changed helpers
supabase/migrations/*                                    → routes displaying affected tables
```
