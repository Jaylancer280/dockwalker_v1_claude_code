# @dockwalker/shared

Pure business logic shared between `apps/web/` and `apps/mobile/`.

## Exports

| Module                     | Exports                                                                                                                                                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `units`                    | `CurrencyCode`, `CURRENCY_SYMBOLS`, `currencySymbol`, `formatRate`, `DistanceUnit`, `convertDistance`, `distanceLabel`, `formatDistance`, `LengthUnit`, `metersToFeet`, `feetToMeters`, `lengthUnitFromDistance`, `convertSizeBandLabel` |
| `languages`                | `LANGUAGES`, `LANGUAGE_CODES`, `languageLabel`                                                                                                                                                                                           |
| `compute-total-experience` | `computeTotalExperience`                                                                                                                                                                                                                 |
| `epaulettes`               | `getDepartmentColor`, `EpauletteInfo`, `getEpaulette`                                                                                                                                                                                    |
| `grouping`                 | `PillGroup`, `rolesToGroups`, `certsToGroups`, `citiesToGroups`                                                                                                                                                                          |

## Usage

```ts
import {
  currencySymbol,
  LANGUAGES,
  computeTotalExperience,
  getEpaulette,
} from '@dockwalker/shared';
```

## Rules

- No React imports. No DOM. No Node.js APIs. Pure TypeScript only.
- If it uses `React`, it stays in the app that owns it.
- If it uses `process.env`, it stays in the app that owns it.
