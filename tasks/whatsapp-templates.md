# WhatsApp Message Templates — DockWalker

> **Purpose:** Complete template definitions ready for submission to Meta via Twilio Console.
> **Format:** Each template follows Meta's WhatsApp Business API template spec — body text with `{{n}}` variable placeholders + up to 2 CTA buttons with one dynamic URL segment each.
> **Review:** Meta approves templates within 24-48 hours. Submit all at once. Rejections require text adjustment and resubmission.

---

## Template Naming Convention

All templates use the prefix `dw_` and snake_case. Meta requires unique names per WhatsApp Business Account.

---

## Daywork Templates (8)

### 1. `dw_new_job` — New daywork posted near crew

**Recipient:** Crew with active availability in the job's city
**Trigger:** DAYWORK.POSTED (broadcast)

```
Body:
New {{1}} daywork in {{2}} — {{3}}, {{4}}/day. Starts {{5}}.

Button 1: [Browse jobs] → /discover
```

| Variable | Value                         | Example  |
| -------- | ----------------------------- | -------- |
| `{{1}}`  | Role name                     | Deckhand |
| `{{2}}`  | City name                     | Antibes  |
| `{{3}}`  | Job number                    | DW-00312 |
| `{{4}}`  | Day rate with currency symbol | €250     |
| `{{5}}`  | Start date (d MMM)            | 14 Apr   |

---

### 2. `dw_new_applicant` — Crew applied to employer's daywork

**Recipient:** Employer (job poster)
**Trigger:** DAYWORK.APPLIED

```
Body:
New applicant for your {{1}} position — {{2}}. You now have {{3}} applicant(s).

Button 1: [Review applicants] → /daywork/{{4}}/review
```

| Variable | Value                     | Example  |
| -------- | ------------------------- | -------- |
| `{{1}}`  | Role name                 | Deckhand |
| `{{2}}`  | Job number                | DW-00312 |
| `{{3}}`  | Applicant count           | 4        |
| `{{4}}`  | Daywork ID (UUID for URL) | abc-123  |

---

### 3. `dw_accepted` — Crew accepted for daywork

**Recipient:** Crew (applicant)
**Trigger:** DAYWORK.ACCEPTED

```
Body:
You've been accepted for {{1}} — {{2}}! {{3}} in {{4}}, {{5}} – {{6}}. Chat is now open.

Button 1: [Open conversation] → /messages/{{7}}
```

| Variable | Value                         | Example      |
| -------- | ----------------------------- | ------------ |
| `{{1}}`  | Role name                     | Deckhand     |
| `{{2}}`  | Job number                    | DW-00312     |
| `{{3}}`  | Vessel name (or "NDA Vessel") | M/Y Serenity |
| `{{4}}`  | Port name                     | Port Vauban  |
| `{{5}}`  | Start date (d MMM)            | 14 Apr       |
| `{{6}}`  | End date (d MMM)              | 16 Apr       |
| `{{7}}`  | Engagement ID (UUID for URL)  | def-456      |

---

### 4. `dw_rejected` — Crew application rejected

**Recipient:** Crew (applicant)
**Trigger:** DAYWORK.REJECTED

```
Body:
Your application for {{1}} — {{2}} was not successful this time. Keep your availability updated to be found for future opportunities.

Button 1: [Browse jobs] → /discover
```

| Variable | Value      | Example  |
| -------- | ---------- | -------- |
| `{{1}}`  | Role name  | Deckhand |
| `{{2}}`  | Job number | DW-00312 |

---

### 5. `dw_shortlisted` — Crew shortlisted for daywork

**Recipient:** Crew (applicant)
**Trigger:** DAYWORK.SHORTLISTED

```
Body:
You've been shortlisted for {{1}} — {{2}} in {{3}}. The employer is reviewing candidates.

Button 1: [View applications] → /discover
```

| Variable | Value      | Example     |
| -------- | ---------- | ----------- |
| `{{1}}`  | Role name  | Deckhand    |
| `{{2}}`  | Job number | DW-00312    |
| `{{3}}`  | Port name  | Port Vauban |

---

### 6. `dw_invited` — Crew invited to apply for daywork

**Recipient:** Crew (invited)
**Trigger:** DAYWORK.INVITED

```
Body:
You've been invited to apply for {{1}} — {{2}} in {{3}}. {{4}}, {{5}}/day, {{6}} – {{7}}.

Button 1: [View invitation] → /discover
```

| Variable | Value                         | Example      |
| -------- | ----------------------------- | ------------ |
| `{{1}}`  | Role name                     | Deckhand     |
| `{{2}}`  | Job number                    | DW-00312     |
| `{{3}}`  | Port name                     | Port Vauban  |
| `{{4}}`  | Vessel name (or "NDA Vessel") | M/Y Serenity |
| `{{5}}`  | Day rate with currency symbol | €250         |
| `{{6}}`  | Start date (d MMM)            | 14 Apr       |
| `{{7}}`  | End date (d MMM)              | 16 Apr       |

---

### 7. `dw_invitation_accepted` — Crew accepted employer's invitation (direct hire)

**Recipient:** Employer (job poster)
**Trigger:** DAYWORK.INVITATION_ACCEPTED

```
Body:
Your invitation for {{1}} — {{2}} has been accepted. The engagement is confirmed and chat is now open.

Button 1: [Open conversation] → /messages/{{3}}
```

| Variable | Value                        | Example  |
| -------- | ---------------------------- | -------- |
| `{{1}}`  | Role name                    | Deckhand |
| `{{2}}`  | Job number                   | DW-00312 |
| `{{3}}`  | Engagement ID (UUID for URL) | def-456  |

---

### 8. `dw_completed` — Employer marked daywork as completed

**Recipient:** Crew (engaged)
**Trigger:** DAYWORK.COMPLETED

```
Body:
{{1}} — {{2}} has been marked as completed. Please confirm or raise a dispute in your conversation.

Button 1: [Open conversation] → /messages/{{3}}
```

| Variable | Value                        | Example  |
| -------- | ---------------------------- | -------- |
| `{{1}}`  | Role name                    | Deckhand |
| `{{2}}`  | Job number                   | DW-00312 |
| `{{3}}`  | Engagement ID (UUID for URL) | def-456  |

---

## Permanent Templates (7)

### 9. `pm_new_applicant` — Crew applied to permanent role

**Recipient:** Employer (posting owner)
**Trigger:** PERMANENT.APPLIED

```
Body:
{{1}} applied for your {{2}} position — {{3}}. You now have {{4}} applicant(s).

Button 1: [Review applicants] → /permanent/{{5}}/review
```

| Variable | Value                               | Example          |
| -------- | ----------------------------------- | ---------------- |
| `{{1}}`  | Crew first name                     | Sophie           |
| `{{2}}`  | Role name                           | Chief Stewardess |
| `{{3}}`  | Job number                          | PM-00045         |
| `{{4}}`  | Applicant count                     | 7                |
| `{{5}}`  | Permanent posting ID (UUID for URL) | ghi-789          |

---

### 10. `pm_shortlisted` — Crew shortlisted for permanent role

**Recipient:** Crew (applicant)
**Trigger:** PERMANENT.SHORTLISTED

```
Body:
You've been shortlisted for {{1}} — {{2}} in {{3}}. The employer is evaluating candidates.

Button 1: [View applications] → /discover
```

| Variable | Value      | Example            |
| -------- | ---------- | ------------------ |
| `{{1}}`  | Role name  | Chief Stewardess   |
| `{{2}}`  | Job number | PM-00045           |
| `{{3}}`  | Port name  | Club de Mar, Palma |

---

### 11. `pm_selected` — Crew selected for permanent role (negotiation begins)

**Recipient:** Crew (selected applicant)
**Trigger:** PERMANENT.SELECTED

```
Body:
You've been selected for {{1}} — {{2}}! Chat is now open to discuss next steps. {{3}} in {{4}}.

Button 1: [Open conversation] → /messages/{{5}}
```

| Variable | Value                         | Example            |
| -------- | ----------------------------- | ------------------ |
| `{{1}}`  | Role name                     | Chief Stewardess   |
| `{{2}}`  | Job number                    | PM-00045           |
| `{{3}}`  | Vessel name (or "NDA Vessel") | M/Y Atlas          |
| `{{4}}`  | Port name                     | Club de Mar, Palma |
| `{{5}}`  | Engagement ID (UUID for URL)  | jkl-012            |

---

### 12. `pm_rejected` — Crew application for permanent role rejected

**Recipient:** Crew (applicant)
**Trigger:** PERMANENT.REJECTED

```
Body:
Your application for {{1}} — {{2}} was not successful. Keep your profile updated for future opportunities.

Button 1: [Browse jobs] → /discover
```

| Variable | Value      | Example          |
| -------- | ---------- | ---------------- |
| `{{1}}`  | Role name  | Chief Stewardess |
| `{{2}}`  | Job number | PM-00045         |

---

### 13. `pm_placement_confirmed` — Permanent placement confirmed

**Recipient:** Crew (placed)
**Trigger:** PERMANENT.PLACEMENT_CONFIRMED

```
Body:
Your placement as {{1}} — {{2}} is confirmed. Congratulations! Check your conversation for next steps.

Button 1: [Open conversation] → /messages/{{3}}
```

| Variable | Value                        | Example          |
| -------- | ---------------------------- | ---------------- |
| `{{1}}`  | Role name                    | Chief Stewardess |
| `{{2}}`  | Job number                   | PM-00045         |
| `{{3}}`  | Engagement ID (UUID for URL) | jkl-012          |

---

### 14. `pm_position_filled` — Permanent position filled (not-selected notification)

**Recipient:** All non-selected applicants (not withdrawn)
**Trigger:** PERMANENT.PLACEMENT_CONFIRMED (secondary recipients)

```
Body:
The {{1}} position — {{2}} has been filled. Browse other permanent opportunities on DockWalker.

Button 1: [Browse jobs] → /discover
```

| Variable | Value      | Example          |
| -------- | ---------- | ---------------- |
| `{{1}}`  | Role name  | Chief Stewardess |
| `{{2}}`  | Job number | PM-00045         |

---

### 15. `pm_posting_cancelled` — Employer cancelled permanent posting

**Recipient:** All applicants (not withdrawn)
**Trigger:** PERMANENT.CANCELLED_BY_EMPLOYER

```
Body:
The {{1}} position — {{2}} has been closed by the employer. Browse other opportunities on DockWalker.

Button 1: [Browse jobs] → /discover
```

| Variable | Value      | Example          |
| -------- | ---------- | ---------------- |
| `{{1}}`  | Role name  | Chief Stewardess |
| `{{2}}`  | Job number | PM-00045         |

---

## Engagement Lifecycle Templates (7)

### 16. `eng_message` — New message in conversation

**Recipient:** Other party (crew or employer)
**Trigger:** MESSAGE.SENT

```
Body:
New message in your conversation about {{1}} — {{2}}.

Button 1: [Open conversation] → /messages/{{3}}
```

| Variable | Value                        | Example  |
| -------- | ---------------------------- | -------- |
| `{{1}}`  | Role name                    | Deckhand |
| `{{2}}`  | Job number                   | DW-00312 |
| `{{3}}`  | Engagement ID (UUID for URL) | def-456  |

**Note:** Message body content is NOT included in the WhatsApp template. This prevents sensitive conversation content from appearing on lock screens and avoids Meta template rejection for dynamic content that could be inappropriate.

---

### 17. `eng_work_started` — Work start confirmation requested

**Recipient:** Other party (crew or employer)
**Trigger:** ENGAGEMENT.WORK_STARTED

```
Body:
Work start confirmation requested for {{1}} — {{2}}. Please confirm in your conversation.

Button 1: [Open conversation] → /messages/{{3}}
```

| Variable | Value                        | Example  |
| -------- | ---------------------------- | -------- |
| `{{1}}`  | Role name                    | Deckhand |
| `{{2}}`  | Job number                   | DW-00312 |
| `{{3}}`  | Engagement ID (UUID for URL) | def-456  |

---

### 18. `eng_work_confirmed` — Work start mutually confirmed

**Recipient:** Other party (crew or employer)
**Trigger:** ENGAGEMENT.WORK_STARTED_CONFIRMED

```
Body:
Work started confirmed for {{1}} — {{2}}. Good luck!

Button 1: [Open conversation] → /messages/{{3}}
```

| Variable | Value                        | Example  |
| -------- | ---------------------------- | -------- |
| `{{1}}`  | Role name                    | Deckhand |
| `{{2}}`  | Job number                   | DW-00312 |
| `{{3}}`  | Engagement ID (UUID for URL) | def-456  |

---

### 19. `eng_cancelled_by_crew` — Crew cancelled engagement

**Recipient:** Employer
**Trigger:** ENGAGEMENT.CANCELLED_BY_CREW

```
Body:
The engagement for {{1}} — {{2}} has been cancelled by the crew member. Check your conversation for details.

Button 1: [Open conversation] → /messages/{{3}}
```

| Variable | Value                        | Example  |
| -------- | ---------------------------- | -------- |
| `{{1}}`  | Role name                    | Deckhand |
| `{{2}}`  | Job number                   | DW-00312 |
| `{{3}}`  | Engagement ID (UUID for URL) | def-456  |

---

### 20. `eng_cancelled_by_employer` — Employer cancelled engagement

**Recipient:** Crew
**Trigger:** ENGAGEMENT.CANCELLED_BY_EMPLOYER

```
Body:
Your engagement for {{1}} — {{2}} has been cancelled by the employer. Check your conversation for details.

Button 1: [Open conversation] → /messages/{{3}}
```

| Variable | Value                        | Example  |
| -------- | ---------------------------- | -------- |
| `{{1}}`  | Role name                    | Deckhand |
| `{{2}}`  | Job number                   | DW-00312 |
| `{{3}}`  | Engagement ID (UUID for URL) | def-456  |

---

### 21. `eng_postponement` — Date change proposed

**Recipient:** Other party
**Trigger:** ENGAGEMENT.POSTPONEMENT_PROPOSED

```
Body:
A date change has been proposed for {{1}} — {{2}}. Please review and respond in your conversation.

Button 1: [Open conversation] → /messages/{{3}}
```

| Variable | Value                        | Example  |
| -------- | ---------------------------- | -------- |
| `{{1}}`  | Role name                    | Deckhand |
| `{{2}}`  | Job number                   | DW-00312 |
| `{{3}}`  | Engagement ID (UUID for URL) | def-456  |

---

### 22. `eng_checklist` — Pre-arrival checklist updated

**Recipient:** Crew
**Trigger:** CHECKLIST.SET

```
Body:
The pre-arrival checklist for {{1}} — {{2}} has been updated. Review it before your start date.

Button 1: [Open conversation] → /messages/{{3}}
```

| Variable | Value                        | Example  |
| -------- | ---------------------------- | -------- |
| `{{1}}`  | Role name                    | Deckhand |
| `{{2}}`  | Job number                   | DW-00312 |
| `{{3}}`  | Engagement ID (UUID for URL) | def-456  |

---

## Reminder Templates (3)

### 23. `reminder_engagement_starts` — Engagement starts tomorrow

**Recipient:** Both crew and employer
**Trigger:** Daily cron at 07:00 UTC

```
Body:
Your {{1}} engagement — {{2}} starts tomorrow. Make sure everything is ready.

Button 1: [View details] → /messages/{{3}}
```

| Variable | Value                        | Example  |
| -------- | ---------------------------- | -------- |
| `{{1}}`  | Role name                    | Deckhand |
| `{{2}}`  | Job number                   | DW-00312 |
| `{{3}}`  | Engagement ID (UUID for URL) | def-456  |

---

### 24. `reminder_availability_expiring` — Availability expires tomorrow

**Recipient:** Crew
**Trigger:** Daily cron at 08:00 UTC

```
Body:
Your availability expires tomorrow. Update it now to stay visible to employers looking for crew.

Button 1: [Update availability] → /profile
```

No variables — static template.

---

### 25. `reminder_availability_stale` — No availability update in 7+ days

**Recipient:** Crew
**Trigger:** Daily cron at 08:00 UTC

```
Body:
It's been a while since you updated your availability. Set your dates to see daywork in your area.

Button 1: [Set availability] → /profile
```

No variables — static template.

---

## Document Exchange Template (1)

### 26. `doc_shared` — Documents uploaded in conversation

**Recipient:** Other party (crew or employer)
**Trigger:** Document upload in chat

```
Body:
{{1}} shared {{2}} document(s) in your conversation about {{3}} — {{4}}. Download within 48 hours.

Button 1: [Open conversation] → /messages/{{5}}
```

| Variable | Value                        | Example  |
| -------- | ---------------------------- | -------- |
| `{{1}}`  | Uploader first name only     | Sophie   |
| `{{2}}`  | Document count               | 3        |
| `{{3}}`  | Role name                    | Deckhand |
| `{{4}}`  | Job number                   | DW-00312 |
| `{{5}}`  | Engagement ID (UUID for URL) | def-456  |

---

## Summary

| Category   | Count  | Templates                                                                                                                                          |
| ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daywork    | 8      | `dw_new_job`, `dw_new_applicant`, `dw_accepted`, `dw_rejected`, `dw_shortlisted`, `dw_invited`, `dw_invitation_accepted`, `dw_completed`           |
| Permanent  | 7      | `pm_new_applicant`, `pm_shortlisted`, `pm_selected`, `pm_rejected`, `pm_placement_confirmed`, `pm_position_filled`, `pm_posting_cancelled`         |
| Engagement | 7      | `eng_message`, `eng_work_started`, `eng_work_confirmed`, `eng_cancelled_by_crew`, `eng_cancelled_by_employer`, `eng_postponement`, `eng_checklist` |
| Reminders  | 3      | `reminder_engagement_starts`, `reminder_availability_expiring`, `reminder_availability_stale`                                                      |
| Documents  | 1      | `doc_shared`                                                                                                                                       |
| **Total**  | **26** |                                                                                                                                                    |

---

## Submission Notes

**When submitting to Meta via Twilio Console:**

1. **Category:** All templates should be submitted as `UTILITY` (not `MARKETING`). Utility templates are for expected, user-initiated interactions — the user signed up for DockWalker and these are transactional notifications about their hiring activity. Utility messages within a 24h conversation window are free under Meta's July 2025 pricing.

2. **Language:** Submit all templates in `en` (English). Multi-language templates can be added later if needed.

3. **Button URLs:** Meta requires the base domain to be fixed. All buttons use `https://www.dockwalker.io/` as the base with one dynamic path suffix. Example: `https://www.dockwalker.io/messages/{{1}}`. The `{{1}}` in the button URL is a separate variable from the body `{{1}}` — Twilio handles the mapping.

4. **Approval time:** 24-48 hours per template. Submit all 26 at once. If any are rejected, adjust the body text (usually Meta objects to financial specifics or content that could be seen as promotional) and resubmit the rejected ones only.

5. **Testing:** Use the Twilio sandbox to test template rendering before going live. The sandbox doesn't require Meta approval but only works with pre-registered phone numbers.

6. **What NOT to include in any template:**
   - The other party's full name (first name only where used — `doc_shared` and `pm_new_applicant`)
   - Phone numbers, email addresses, or any personal contact information
   - Specific salary or rate amounts (included in `dw_new_job`, `dw_invited`, and `dw_accepted` — monitor for Meta rejection; have fallback versions without rates ready)
   - Message content from conversations (privacy risk on lock screens)
   - Competitive metrics ("you're 1 of 5 applicants" — violates mission doc)
