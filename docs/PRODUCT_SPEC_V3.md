# Market Radar V3 — Product Specification

Status: FROZEN BASELINE BEFORE IMPLEMENTATION

## 1. Product goal
Personal, mobile-first installable PWA for deciding when and how to deploy new monthly investment contributions across a configurable ETF/fund portfolio. No individual-stock analysis. No selling/rebalancing by sale in Smart DCA.

## 2. Initial universe
- MSCI World
- S&P 500
- World Value
- Emerging Markets Value
- World Information Technology
- AI Infrastructure
- Defense
- Nuclear / Uranium
- Strategic Metals
- Gold

Assets are configurable; these are defaults, not hard-coded business logic.

## 3. Navigation
Exactly four first-class views, always reachable from persistent bottom navigation:
1. Radar
2. Comprar
3. Backtest
4. Ajustes

## 4. Domain architecture
One canonical domain model shared by all features. Separate modules are allowed/required by responsibility; duplicate financial logic is forbidden.

Core responsibilities:
- market data normalization
- indicators
- Radar scoring
- portfolio state
- Smart DCA allocation
- backtest simulation
- performance metrics

UI is presentation only. UI must not contain financial formulas.

## 5. Data
- Daily end-of-day data is sufficient; no intraday requirement.
- Refresh after market close / once daily.
- Historical series cached locally in IndexedDB for offline/repeat calculations.
- Provider-specific payloads are normalized at the data boundary; core logic never depends on Yahoo/EODHD/FRED response shapes.
- Provider/API configuration belongs in Ajustes and backup/export.
- Existing provider work may be studied, but V3 must not inherit patch/override architecture.

## 6. Radar
Radar shows per-asset opportunity/risk information and an overall portfolio view.

Approved score blocks from prior requirements:
- Valuation: 25%
- Trend: 20%
- Sentiment: 20%
- Macro: 20%
- Breadth: 15%

Drawdown interpretation:
- 0% to -5%: normal
- -5% to -10%: interesting
- -10% to -20%: opportunity
- -20% to -30%: strong opportunity
- below -30%: extraordinary opportunity

All indicator formulas and thresholds must be explicit and unit-tested before UI wiring. Missing data must be represented as missing; never silently fabricated.

## 7. Portfolio
Each asset has at minimum:
- stable id
- display name
- provider symbol(s)
- enabled flag
- target weight
- current holding value / position input needed for allocation

Target weights are validated. Portfolio state is shared by Radar, Comprar and Backtest.

## 8. Comprar / Smart DCA
Purpose: distribute NEW monthly money. Never sell existing holdings.

Rules:
- target weights are the anchor
- drawdown/opportunity is the primary tactical tilt
- underweight versus target is a secondary tilt
- allocation is non-negative
- allocation conserves the exact monthly contribution to cent precision
- explicit contribution of 0 remains 0
- assets with unusable required signal data are not assigned invented signals
- concentration limits must be mathematically feasible; if a configured cap is impossible for the number of eligible assets, the engine must use an explicit deterministic feasibility rule rather than violate conservation silently

There is exactly one production Smart DCA allocation function. Comprar calls it directly. Backtest calls the same function directly.

## 9. Backtest
Backtest is a simulation engine, not a second strategy implementation.

Strategies to compare:
- Target DCA: contribution by target weights
- Contribution Rebalance: new money toward underweights, never sells
- Smart DCA: exact production allocator

All strategies receive identical external contributions on identical execution dates.

Timing contract for decision date t:
1. information set contains only data strictly before t
2. strategy decides allocation from that information
3. contribution executes using price at t
4. t data becomes available only after execution

No same-close or future-data look-ahead.

Backtest metrics:
- total contributed capital
- terminal value
- gain/loss over contributions
- annualized TWR
- XIRR
- maximum drawdown
- annualized volatility
- Sharpe ratio

Cash contributions are external flows, never market return. Flat prices plus contributions must produce zero investment return.

Rolling validation:
- only complete windows count
- overlapping windows are labelled overlapping/descriptive
- win counts are not presented as independent statistical proof
- fewer than 5 valid windows => explicitly insufficient sample
- indicator warm-up history is supplied before each test window without becoming investable foresight

## 10. Ajustes
At minimum:
- monthly contribution
- asset enable/disable
- target weights
- holdings/portfolio values required by Comprar
- data provider/API configuration
- refresh/status information
- export complete configuration/data backup
- import/restore complete backup, including keys when the user explicitly exports them

Import is validated before replacing current state. A failed import must not destroy the existing configuration.

## 11. PWA / persistence
- Android-installable PWA
- responsive mobile-first layout
- persistent bottom navigation
- service worker with controlled cache versioning
- no stale-version ambiguity after deployment
- local persistence separated from calculation logic

## 12. Engineering constraints
- no version-overlay files such as v25.js / v251fix.js / v26-ui.js
- no monkey-patching or replacing global render functions
- no duplicated formulas across views
- no business logic in HTML templates
- no hidden fallback that converts valid zero into a default value
- no silent handling of invalid financial inputs
- modules must have explicit inputs/outputs
- prefer simple vanilla JS modules unless a dependency demonstrably reduces complexity

## 13. Release definition
V3 is not releasable until all are true:
- unit tests for every financial formula
- Smart DCA invariants and edge cases
- deterministic backtest fixtures with hand-verifiable results
- explicit no-look-ahead tests
- metrics tests including external cash flows
- import/export round-trip test
- corrupted-import rollback test
- data-provider normalization tests
- navigation/UI smoke test for all four views
- PWA manifest/service-worker sanity checks
- complete end-to-end fixture from data -> Radar -> Comprar -> Backtest
- CI green on the exact candidate commit
- final diff reviewed as a whole

No merge to main merely because an intermediate subset of tests is green.
