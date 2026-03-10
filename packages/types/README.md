# @dockwalker/types

Shared TypeScript type definitions for the DockWalker monorepo. This package has no runtime dependencies — it exports only types.

## Files

| File            | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/enums.ts`  | `RoleContext`, `IdentityType`, `ApplicationStatus` (includes `shortlisted`), `VesselType`, `MealOption`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `src/events.ts` | `EventType` (all domain event names including `ENGAGEMENT.POSTPONEMENT_*`, `ENGAGEMENT.WORK_STARTED`, `ENGAGEMENT.WORK_STARTED_CONFIRMED`, `DAYWORK.RELISTED`, `ENGAGEMENT.CANCELLATION_RATED_BY_*`), `AggregateType` (includes `engagement`), `DomainEvent` interface, `EventPayloadMap` (typed payload per event for compile-time validation). `DAYWORK.RELISTED` payload includes optional `start_date`, `end_date`, `working_days` for relist-with-new-dates flow. `ENGAGEMENT.CANCELLED_BY_CREW` now carries structured `reason_category` (`personal_reasons`, `found_other_work`, `unsafe_conditions`, `other`) and optional `reason_text`. |
| `src/models.ts` | Entity interfaces: `Person`, `CrewProfile`, `AgentProfile`, `Vessel`, `Daywork`, `Application`, `AvailabilityWindow`, `Message`, `Engagement`, `EngagementRating`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/index.ts`  | Barrel re-export of all the above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## Usage

```ts
import type { DomainEvent, EventType, EventPayloadMap, RoleContext } from '@dockwalker/types';
```

## Scripts

```bash
npm run type-check   # tsc --noEmit
```
