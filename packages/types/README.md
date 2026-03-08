# @dockwalker/types

Shared TypeScript type definitions for the DockWalker monorepo. This package has no runtime dependencies — it exports only types.

## Files

| File            | Contents                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/enums.ts`  | `RoleContext`, `IdentityType`, `ApplicationStatus` (includes `shortlisted`), `VesselType`, `MealOption`                                                                         |
| `src/events.ts` | `EventType` (all domain event names), `AggregateType` (includes `engagement`), `DomainEvent` interface, `EventPayloadMap` (typed payload per event for compile-time validation) |
| `src/models.ts` | Entity interfaces: `Person`, `CrewProfile`, `AgentProfile`, `Vessel`, `Daywork`, `Application`, `AvailabilityWindow`, `Message`, `Engagement`, `EngagementRating`               |
| `src/index.ts`  | Barrel re-export of all the above                                                                                                                                               |

## Usage

```ts
import type { DomainEvent, EventType, EventPayloadMap, RoleContext } from '@dockwalker/types';
```

## Scripts

```bash
npm run type-check   # tsc --noEmit
```
