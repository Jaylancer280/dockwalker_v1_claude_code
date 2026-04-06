# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

### Replace all raw line-clamp with ExpandableText ("Read more" toggle)

> 13 instances use `line-clamp-*` on `<p>` tags — text is silently truncated with no way to read the full content. All should use the `ExpandableText` component which has "Read more" / "Show less" built in. 5 places already use it correctly.

**Replace each `<p className="...line-clamp-N...">{text}</p>` with `<ExpandableText text={text} maxLines={N} className="..." />`:**

- [ ] `discover/_components/daywork-card.tsx:269` — `card.notes` (line-clamp-3)
- [ ] `discover/_components/applied-tab.tsx:248` — `application.message` (line-clamp-2)
- [ ] `discover/_components/permanent-application-card.tsx:157` — application message (line-clamp-2)
- [ ] `daywork/[id]/review/_components/available-crew-tab.tsx:323` — `crew.bio` (line-clamp-3)
- [ ] `daywork/[id]/review/_components/applicants-tab.tsx:392` — `profile.bio` (line-clamp-3)
- [ ] `daywork/[id]/review/_components/applicants-tab.tsx:408` — `applicant.message` (line-clamp-2)
- [ ] `permanent/[id]/review/page.tsx:313` — application message (line-clamp-2)
- [ ] `messages/[engagementId]/_components/permanent-summary-card.tsx:90` — `pp.notes` (line-clamp-2)
- [ ] `messages/[engagementId]/_components/daywork-summary-card.tsx:72` — `dw.notes` (line-clamp-2)
- [ ] `messages/[engagementId]/_components/banners.tsx:186` — `cancellation_reason_text` (line-clamp-2)
- [ ] `daywork/mine/page.tsx:349` — `posting.notes` (line-clamp-2)
- [ ] `profile/_components/profile-experience-section.tsx:179` — contract details (line-clamp-2)
- [ ] `profile/_components/profile-experience-section.tsx:193` — `exp.description` (line-clamp-2)

**Note:** Some of these are inside swipeable cards or compact contexts where "Read more" might be awkward (e.g., the daywork swipe card). For those, a tap-to-expand or a smaller "more" link may work better. Use judgement — the goal is no silently hidden text.

---

### Verify: Agent My Jobs — may already work

> Investigation shows daywork mine uses `.eq('poster_person_id', user.id)` and permanent mine uses `.eq('employer_person_id', user.id)` — both filter by person, not role_context. Agent-posted jobs SHOULD appear. The original report may have been from a stale page or a hat-check issue on the frontend, not the API.

- [ ] USER: Test again — post a job as agent, check My Jobs page. If it shows, this is resolved. If not, check the page-level hat check (does the mine page render for agents or only employer hat?).

---

### Meals label — always says "optional", should be conditional on live aboard

> Daywork post form always shows "Meals provided (optional)" regardless of live aboard. Should only say "(optional)" when live aboard is checked. The permanent form has the conditional logic (line 224 in permanent-form-sections.tsx) — daywork form needs the same pattern.

- [ ] In `apps/web/src/app/(app)/daywork/post/page.tsx` ~line 606: change from always "(optional)" to conditional: show "(optional)" only when live aboard is checked. Otherwise just "Meals provided".

---

### Admin identity type change (deferred — medium-high effort)

> `identity_type` is immutable by design. Changing it requires new event type, projection handler, hat correction, agent data validation. 24+ routes check it. Admin-only, not self-service.

- Scope captured. Build when needed.

---

## Backlog

> Active backlog. Pick items into Queue when ready.
> **Implementation agent: do NOT move items here to defer them. If a todo item
> is too hard, stop and ask — do not unilaterally deprioritise.**

### Business logic / server-side

- **Permanent crew withdrawal auto-revert** — when crew withdraws from a selected permanent posting, employer should decide next step, not auto-revert.
- **Onboarding true atomicity** — `onboard_person` RPC should be fully atomic.
- **Negotiation timeout** — auto-close permanent engagements after X days inactivity.
- **Weekly check-in cron** — periodic nudge for permanent postings with no employer activity.
- **Deactivated user server-side sign-out** — force session invalidation on PERSON.DEACTIVATED.

### Web-only UI

- **Agent market as discover mode** — let agents browse full market feed.
- **Form validation — styled inline errors** — replace browser-native validation (SUG-012).
- **Invalid URL error pages** — custom error pages for garbage URLs (SUG-013).
- **Edit experience "Unknown vessel" prefix** — seed data issue (SUG-017).
- **Applicant count badge on My Jobs**.
- **Discover filter chips**.
- **Notifications grouping**.
- **Email: List-Unsubscribe header**.
- **Share button on discover cards (crew view)** — secondary placement.

### Testing

- **Resilience tests** — network failure, timeout, retry scenarios.
- **Component tests for Permanent UI**.
- **Component tests for Form Pickers**.

### Deferred — Mobile (blocked, needs Mac + Xcode)

- **Mobile Phase 7: TestFlight validation** — app crashes on startup (SIGABRT TurboModule init). Needs Xcode debugger. See `memory/project_mobile_blocked.md`.
- **Mobile Phase 8: Android polish pass**.
- **Capacitor removal** — waiting on Phase 7 validation.
- **Mobile OTA update test**.
- **Mobile Docky hooks/screens** — update to match new single-thread API when mobile unblocks.

---

## Done

(See git history for completed stages 51-200+. Recent: text overflow audit (9 instances clamped), vessel fuzzy search fix, contract type drill-down reset, textarea auto-expand, ExpandableText, availability toast, department specialisations, agent profile overlay, date input dd/mm/yyyy, permanent card truncation, share to social, invitation direct hire, Docky production launch.)
