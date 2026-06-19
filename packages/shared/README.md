# @dockwalker/shared

Pure-TS business logic. Web-only consumer today (`apps/web/`), but kept platform-agnostic on purpose so future workers, edge functions, scripts, or any other client can reuse without rework.

## Exports

| Module                     | Exports                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `units`                    | `CurrencyCode`, `CURRENCY_SYMBOLS`, `currencySymbol`, `formatRate`, `DistanceUnit`, `convertDistance`, `distanceLabel`, `formatDistance`, `LengthUnit`, `metersToFeet`, `feetToMeters`, `lengthUnitFromDistance`, `convertSizeBandLabel`                                                                                                                                                                         |
| `languages`                | `LANGUAGES`, `LANGUAGE_CODES`, `languageLabel`                                                                                                                                                                                                                                                                                                                                                                   |
| `compute-total-experience` | `computeTotalExperience`                                                                                                                                                                                                                                                                                                                                                                                         |
| `epaulettes`               | `getDepartmentColor`, `EpauletteInfo`, `getEpaulette`                                                                                                                                                                                                                                                                                                                                                            |
| `grouping`                 | `PillGroup`, `rolesToGroups`, `certsToGroups`, `citiesToGroups`, `CertInput`, `CertCategoryGroup`, `groupCertsByCategoryAndSubcategory`                                                                                                                                                                                                                                                                          |
| `cert-labels`              | `certCategoryLabel`, `certSubcategoryLabel`                                                                                                                                                                                                                                                                                                                                                                      |
| `cert-matching`            | `BundleMap`, `MatchResult`, `expandCertCoverage`, `meetsRequirements`, `expandCertForFilter` — bundle/component cert matching helpers, paired with migration 00115. **Symmetric:** holding a bundle covers its components, and holding _every_ component (all-or-nothing) covers the bundle. Partial component coverage does not match. Empty/malformed bundle rows are guarded so they can't be auto-satisfied. |
| `vessel-size`              | `SizeBandRange`, `vesselSizeRange`                                                                                                                                                                                                                                                                                                                                                                               |

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
