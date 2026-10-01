# Market Radar V3 — Architecture & Contracts

This document translates PRODUCT_SPEC_V3.md into implementation boundaries. No financial formula is implemented here.

## Design principles
1. One canonical domain vocabulary.
2. One implementation per financial rule.
3. Pure core functions: same inputs => same outputs, no storage/network/DOM access.
4. Data providers, persistence and UI depend on core contracts; core never depends on them.
5. Backtest controls historical time but invokes production strategy functions unchanged.
6. Invalid/missing data is explicit. No silent financial defaults.
7. Keep the application small: vanilla ES modules, IndexedDB/localStorage adapters, no framework unless a demonstrated need appears.

## Dependency direction

    providers ──> data repository ──> application services ──> UI
                                  │
                                  ▼
                               core/*
                                  ▲
                                  │
                           backtest engine

storage adapters ──> application services

`core/*` imports no UI, provider, browser-storage or network module.

## Proposed source tree

src/
  domain/
    types.js
    defaults.js
  core/
    indicators.js
    radar.js
    portfolio.js
    smart-dca.js
    metrics.js
    backtest.js
  data/
    normalize.js
    repository.js
    providers/
  storage/
    settings-store.js
    market-cache.js
    backup.js
  app/
    state.js
    refresh.js
    bootstrap.js
  ui/
    shell.js
    radar-view.js
    buy-view.js
    backtest-view.js
    settings-view.js
  main.js
public/
  index.html
  styles.css
  manifest.webmanifest
  sw.js
tests/
  core/
  data/
  storage/
  integration/
  e2e/

## Canonical contracts

### Asset
```js
{ id: string, name: string, enabled: boolean, targetWeight: number, symbols: { [providerId]: string | null } }
```
Asset contains configuration, not transient price/score/provider payloads.

### Holding
```js
{ assetId: string, value: number }
```
Live Comprar needs current EUR position value, not tax-lot accounting.

### PricePoint
```js
{ date: 'YYYY-MM-DD', close: number }
```
Ascending, unique trading dates, finite close > 0.

### MarketSeries
```js
{ assetId: string, points: PricePoint[], asOf: 'YYYY-MM-DD', source: string }
```

### IndicatorSnapshot
```js
{
  assetId: string, asOf: 'YYYY-MM-DD',
  drawdown: number | null, trend: number | null,
  valuation: number | null, sentiment: number | null,
  macro: number | null, breadth: number | null,
  missing: string[]
}
```
Null means unavailable. Zero is valid and is never treated as missing.

### PortfolioSnapshot
```js
{ asOf: 'YYYY-MM-DD', holdings: Holding[], totalValue: number, weights: { [assetId]: number } }
```

### SmartDcaRequest
```js
{ contribution: number, assets: Asset[], portfolio: PortfolioSnapshot, indicators: IndicatorSnapshot[], policy: SmartDcaPolicy }
```

### SmartDcaPolicy
```js
{ drawdownStrength: number, underweightStrength: number, maxContributionShare: number }
```
Policy is explicit input so live and backtest cannot accidentally use different constants.

### SmartDcaResult
```js
{
  contribution: number,
  allocations: { [assetId]: number },
  eligibleAssetIds: string[],
  effectiveMaxShare: number,
  diagnostics: {
    targetComponent: object,
    drawdownComponent: object,
    underweightComponent: object,
    warnings: string[]
  }
}
```
Allocations are whole euros and sum exactly to the whole-euro contribution. Diagnostics make decisions auditable without duplicating formulas in UI.

### RadarResult
```js
{ asOf: 'YYYY-MM-DD', assets: [{ assetId, score, components, opportunityBand, missing }], portfolioScore: number | null }
```

### BacktestRequest
```js
{
  assets: Asset[], histories: { [assetId]: PricePoint[] }, initialHoldings: object,
  monthlyContribution: number, startDate: string, endDate: string,
  strategy: 'targetDca' | 'contributionRebalance' | 'smartDca',
  smartDcaPolicy: SmartDcaPolicy, warmupTradingDays: number
}
```

### BacktestResult
Contains execution ledger, external cash-flow ledger, valuation series, terminal holdings and MetricsResult. The ledger is authoritative; summary values are derived from it.

## Smart DCA feasibility contract
Configured `maxContributionShare` is a desired cap. Let N be the number of eligible assets. Conservation requires an effective cap >= 1/N.

`effectiveMaxShare = max(configuredMaxContributionShare, 1 / N)`

If relaxed, diagnostics records it. If N = 0 and contribution > 0, return typed `NO_ELIGIBLE_ASSETS`; never invent signals.

## Money and rounding contract
- Monthly contribution in Comprar is a non-negative whole number of euros.
- Smart DCA performs weighting calculations with normal decimal Numbers.
- Final recommendations are rounded to whole euros.
- Rounding uses largest remainder: floor each raw allocation, then assign remaining euros to the largest fractional remainders; stable asset id breaks ties.
- Exact invariant: `sum(allocations) === contribution` in whole euros.
- No cent-level accounting is required in V3.
- Backtest valuation and return calculations remain decimal Numbers because market values and returns naturally contain fractions.

## Historical-time contract
For execution date t:
- `signalCutoff < t`.
- indicators and portfolio decision state use only information with date <= signalCutoff.
- execution uses normalized price at t.
- t enters strategy-visible history only after execution.
- missing execution prices follow an explicit common-date policy; no silent forward fill.

Backtest exposes decision date, signal cutoff and execution prices in its ledger.

## Contribution schedule contract
One contribution per calendar month, initially on the first common valid trading observation of the month. Never more than one external monthly contribution in a month.

## Performance-metric contract
Metrics consume valuation observations plus a separate external cash-flow ledger. Contributions are never inferred from changes in portfolio value.

Flat-price invariant with zero fees: TWR = 0, XIRR = 0 within numerical tolerance, market gain = 0 regardless of contributions.

## Persistence boundaries
SettingsStore owns settings only. MarketCache owns normalized historical series only. BackupService composes versioned snapshots.

Backup envelope:
```js
{ schemaVersion: 1, exportedAt: ISODateString, settings: {...}, marketCache: {...}, secretsIncluded: boolean }
```
Import: parse -> schema validate -> semantic validate -> stage -> atomic commit. Failure leaves current state unchanged.

## UI contract
`shell.js` owns navigation. Views cannot replace the shell or monkey-patch global rendering. Each view implements `mount(container, appContext)` and `unmount()`. Radar / Comprar / Backtest / Ajustes navigation remains mounted while only the content outlet changes.

## Error policy
Core returns valid documented results or typed domain errors. UI translates errors. Provider/network errors never become zero-valued financial indicators.

## Versioning/deployment
One application version constant is displayed in Ajustes and versions PWA caches. One coherent module graph; no compatibility overlay scripts.

## Test-first implementation order
1. Domain validation + defaults
2. Whole-euro allocation/rounding helper
3. Indicators
4. Portfolio calculations
5. Smart DCA + adversarial cases
6. Metrics
7. Backtest clock/ledger + no-look-ahead fixtures
8. Provider normalization/repository
9. Storage + backup transactional restore
10. UI shell/navigation
11. Four views
12. PWA/service worker
13. Full integration/E2E fixture

No later layer may compensate for an error in an earlier layer.
