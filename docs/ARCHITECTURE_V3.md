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
    types.js             Canonical shapes, validation helpers, error codes
    defaults.js          Default assets and non-secret defaults
  core/
    indicators.js        Drawdown/trend/etc. pure calculations
    radar.js             Radar component scores + aggregate score
    portfolio.js         Weights, target gaps, eligibility
    smart-dca.js         The one production Smart DCA allocator
    metrics.js           TWR, XIRR, DD, vol, Sharpe
    backtest.js          Historical clock/execution; calls smart-dca.js
  data/
    normalize.js         Provider payload -> canonical PricePoint series
    repository.js        Canonical market-data access API
    providers/
      provider-a.js
      provider-b.js
  storage/
    settings-store.js
    market-cache.js
    backup.js
  app/
    state.js             Small application state/store
    refresh.js           Daily refresh orchestration
    bootstrap.js
  ui/
    shell.js             Persistent navigation and route switching
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
{
  id: string,                  // immutable internal id
  name: string,
  enabled: boolean,
  targetWeight: number,        // decimal [0,1]
  symbols: { [providerId]: string | null }
}
```
No current price, score or transient provider payload is stored inside Asset.

### Holding
```js
{
  assetId: string,
  value: number               // EUR current market value for live allocation
}
```
V3 initially uses value rather than share accounting in live Comprar because allocation needs current portfolio weights, not tax-lot accounting.

### PricePoint
```js
{
  date: 'YYYY-MM-DD',
  close: number
}
```
Normalized, ascending, unique trading dates, finite close > 0.

### MarketSeries
```js
{
  assetId: string,
  points: PricePoint[],
  asOf: 'YYYY-MM-DD',
  source: string
}
```

### IndicatorSnapshot
```js
{
  assetId: string,
  asOf: 'YYYY-MM-DD',
  drawdown: number | null,
  trend: number | null,
  valuation: number | null,
  sentiment: number | null,
  macro: number | null,
  breadth: number | null,
  missing: string[]
}
```
Null means unavailable. Zero is a valid value and is never treated as missing.

### PortfolioSnapshot
```js
{
  asOf: 'YYYY-MM-DD',
  holdings: Holding[],
  totalValue: number,
  weights: { [assetId]: number }
}
```

### SmartDcaRequest
```js
{
  contribution: number,
  assets: Asset[],
  portfolio: PortfolioSnapshot,
  indicators: IndicatorSnapshot[],
  policy: SmartDcaPolicy
}
```

### SmartDcaPolicy
```js
{
  drawdownStrength: number,
  underweightStrength: number,
  maxContributionShare: number
}
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
Allocations are EUR cents and sum exactly to contribution. Diagnostics make decisions auditable without duplicating formulas in UI.

### RadarResult
```js
{
  asOf: 'YYYY-MM-DD',
  assets: [{ assetId, score, components, opportunityBand, missing }],
  portfolioScore: number | null
}
```

### BacktestRequest
```js
{
  assets: Asset[],
  histories: { [assetId]: PricePoint[] },
  initialHoldings: object,
  monthlyContribution: number,
  startDate: string,
  endDate: string,
  strategy: 'targetDca' | 'contributionRebalance' | 'smartDca',
  smartDcaPolicy: SmartDcaPolicy,
  warmupTradingDays: number
}
```

### BacktestResult
Contains execution ledger, external cash-flow ledger, valuation series, terminal holdings and MetricsResult. The ledger is authoritative; summary values are derived from it.

## Smart DCA feasibility contract
Configured `maxContributionShare` is a desired cap. Let N be the number of eligible assets. Conservation requires an effective cap >= 1/N.

Therefore:
`effectiveMaxShare = max(configuredMaxContributionShare, 1 / N)`

If the cap is relaxed, `diagnostics.warnings` records it. This is deterministic and mathematically feasible. No money disappears and no hidden cash balance is created.

If N = 0 and contribution > 0, allocation returns a typed `NO_ELIGIBLE_ASSETS` error. It does not invent signals or silently allocate by target.

## Money and rounding contract
- User-facing contribution and allocation values are represented internally in integer euro cents during allocation.
- Financial return calculations use Number decimals, not cents.
- Smart DCA computes raw weights, allocates floor cents, then distributes remaining cents deterministically by largest fractional remainder, tie-broken by stable asset id.
- Exact invariant: sum(allocationCents) === contributionCents.

## Historical-time contract
For execution date t:
- `signalCutoff < t`.
- indicators and portfolio decision state use only information with date <= signalCutoff.
- execution uses normalized price at t.
- t is appended to the strategy-visible history after execution.
- missing execution price means that asset cannot execute on t; the engine uses a documented common execution-date policy rather than forward-filling silently.

Backtest must expose decision date, signal cutoff and execution price in its ledger so timing can be audited.

## Contribution schedule contract
A monthly contribution executes once per calendar month on the first common valid execution date on/after the configured monthly schedule point. Initial V3 default: first common trading observation of each month. There is never more than one external monthly contribution for a month.

## Performance-metric contract
Metrics consume valuation observations plus a separate external cash-flow ledger. Contributions are never inferred from changes in portfolio value.

Flat-price invariant with zero fees:
- TWR = 0
- XIRR = 0 (within numerical tolerance)
- market gain = 0
regardless of number/size of contributions.

## Persistence boundaries
SettingsStore owns settings only. MarketCache owns normalized historical market series only. BackupService composes explicit versioned snapshots of both.

Backup envelope:
```js
{
  schemaVersion: 1,
  exportedAt: ISODateString,
  settings: {...},
  marketCache: {...},
  secretsIncluded: boolean
}
```
Import procedure: parse -> schema validate -> semantic validate -> stage -> commit atomically. Any failure leaves existing state unchanged.

## UI contract
`shell.js` owns navigation. Views cannot replace the shell or monkey-patch a global render function. Each view implements:
```js
mount(container, appContext)
unmount()
```
The shell keeps Radar / Comprar / Backtest / Ajustes navigation mounted while switching only the content outlet.

## Error policy
Core functions either return a valid documented result or throw/return a typed domain error. UI translates domain errors into human-readable messages. Provider/network errors never become zero-valued financial indicators.

## Versioning/deployment
One application version constant is displayed in Ajustes and used to version PWA caches. A deployment contains one coherent module graph; there are no compatibility overlay scripts.

## Test-first implementation order
1. Domain validation + defaults
2. Money/conservation helpers
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

No later layer may be used to compensate for an error in an earlier layer.
