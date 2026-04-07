# @dockwalker/types

Shared TypeScript type definitions for the DockWalker monorepo. This package has no runtime dependencies — it exports only types.

## Files

| File            | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/enums.ts`  | `RoleContext`, `IdentityType`, `ApplicationStatus` (includes `shortlisted`, `selected`, `not_selected`), `VesselType` (motor\|sail), `VesselOperation` (private\|charter), `ContractType` (permanent\|rotational\|seasonal\|crossing\|delivery\|temporary), `MealOption`, `SubscriptionPlan` (free\|crew_pro\|employer_pro), `SubscriptionStatus` (active\|past_due\|cancelled\|trialing), `PermanentPostingStatus` (active\|in_negotiation\|filled\|cancelled), `PermanentAvailability` (immediate\|after_notice\|not_looking), `SalaryPeriod` (monthly\|annual)                                                                                                                                                 |
| `src/events.ts` | `EventType` (all domain event names including daywork, engagement, experience, checklist, invitation, admin, and `PERMANENT.*` events), `AggregateType` (includes `engagement`, `checklist`, `experience`, `invitation`, `admin`, `permanent`), `DomainEvent` interface, `EventPayloadMap` (typed payload per event for compile-time validation), `DayworkInvitation` model interface. Permanent events: `PERMANENT.POSTED`, `PERMANENT.APPLIED`, `PERMANENT.APPLICATION_BLOCKED`, `PERMANENT.SHORTLISTED`, `PERMANENT.REJECTED`, `PERMANENT.SELECTED`, `PERMANENT.PLACEMENT_CONFIRMED`, `PERMANENT.SELECTION_REVERTED`, `PERMANENT.WITHDRAWN`, `PERMANENT.CANCELLED_BY_EMPLOYER`, `PERMANENT.ENGAGEMENT_CLOSED`. |
| `src/models.ts` | Entity interfaces: `Person`, `CrewProfile` (extended with `permanent_availability`, `notice_period_days`, `currently_employed`, `smoker`, `visible_tattoos`), `AgentProfile`, `Vessel`, `Daywork`, `Application` (extended with `permanent_posting_id`, `rejection_reason`), `AvailabilityWindow`, `Message`, `Engagement` (extended with `permanent_posting_id`, `outcome`, `closed` status), `EngagementRating`, `CrewExperience` (vessel_operation, contract_type, contract_details — no salary fields, DB intelligence only), `Subscription`, `PermanentPosting`, `PermanentTemplate`                                                                                                                         |
| `src/index.ts`  | Barrel re-export of all the above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## Usage

```ts
import type { DomainEvent, EventType, EventPayloadMap, RoleContext } from '@dockwalker/types';
```

## Scripts

```bash
npm run type-check   # tsc --noEmit
```
