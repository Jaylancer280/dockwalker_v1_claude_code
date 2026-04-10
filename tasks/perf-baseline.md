# Performance Baseline & Tracking

> Record Lighthouse scores before and after each phase. Mobile emulation, 4G throttling.
> Run: Chrome DevTools > Lighthouse > Performance > Mobile > Simulated throttling (default)

## Phase 0A — Baseline (before any changes)

| Page         | LCP (s) | FCP (s) | TBT (ms) | CLS | Score |
| ------------ | ------- | ------- | -------- | --- | ----- |
| Discover     |         |         |          |     |       |
| Messages     |         |         |          |     |       |
| Profile      |         |         |          |     |       |
| Daywork/Mine |         |         |          |     |       |
| Settings     |         |         |          |     |       |
| Billing      |         |         |          |     |       |

**Date:** **_
**Commit:** _**
**Notes:** \_\_\_

---

## Phase 1 Checkpoint (after 4C + 1C + 1A + 1B + 1D)

| Page         | LCP (s) | FCP (s) | TBT (ms) | CLS | Score | Delta LCP |
| ------------ | ------- | ------- | -------- | --- | ----- | --------- |
| Discover     |         |         |          |     |       |           |
| Messages     |         |         |          |     |       |           |
| Profile      |         |         |          |     |       |           |
| Daywork/Mine |         |         |          |     |       |           |
| Settings     |         |         |          |     |       |           |
| Billing      |         |         |          |     |       |           |

**Date:** **_
**Commit:** _**
**Notes:** \_\_\_

---

## Phase 2 Checkpoint (after 2A-2E)

| Page         | LCP (s) | FCP (s) | TBT (ms) | CLS | Score | Delta LCP |
| ------------ | ------- | ------- | -------- | --- | ----- | --------- |
| Discover     |         |         |          |     |       |           |
| Messages     |         |         |          |     |       |           |
| Profile      |         |         |          |     |       |           |
| Daywork/Mine |         |         |          |     |       |           |
| Settings     |         |         |          |     |       |           |
| Billing      |         |         |          |     |       |           |

**Date:** **_
**Commit:** _**
**Decision:** If LCP < 2.5s on 4G → skip Phase 3. If > 2.5s → proceed to Phase 3.

---

## Phase 3 Checkpoint (if attempted)

| Page         | LCP (s) | FCP (s) | TBT (ms) | CLS | Score | Delta LCP |
| ------------ | ------- | ------- | -------- | --- | ----- | --------- |
| Discover     |         |         |          |     |       |           |
| Messages     |         |         |          |     |       |           |
| Profile      |         |         |          |     |       |           |
| Daywork/Mine |         |         |          |     |       |           |
| Settings     |         |         |          |     |       |           |
| Billing      |         |         |          |     |       |           |

**Date:** **_
**Commit:** _**
